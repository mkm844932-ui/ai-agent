import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import {
  transcribeAudio,
  generateBgeEmbedding,
  testQwenDirectly,
  generateQwenAnswer,
  rerankCandidates,
  extractTextFromImage,
  STT_MODEL,
  EMBEDDING_MODEL,
  LLM_MODEL,
} from './services/huggingFaceAI.js';
import { documentStore, detectSemester, analyzeQuery } from './services/documentStore.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const upload = multer({ storage: multer.memoryStorage() });

/**
 * STEP 1: Independent Model Health Endpoint
 * GET /api/ai/health
 */
app.get('/api/ai/health', async (req, res) => {
  const status = {
    huggingFace: Boolean(process.env.HF_TOKEN && process.env.HF_TOKEN !== 'your_huggingface_token'),
    whisper: { model: STT_MODEL, status: 'untested' },
    bge: { model: EMBEDDING_MODEL, status: 'untested' },
    qwen: { model: LLM_MODEL, status: 'untested' },
  };

  if (!status.huggingFace) {
    return res.json({
      ...status,
      message: 'HF_TOKEN is not configured in .env',
    });
  }

  try {
    const emb = await generateBgeEmbedding('Health check test sentence');
    status.bge = {
      model: EMBEDDING_MODEL,
      status: 'working',
      embeddingDimension: Array.isArray(emb) ? emb.length : typeof emb,
    };
  } catch (err) {
    status.bge = { model: EMBEDDING_MODEL, status: 'error', error: err.message };
  }

  try {
    const qwenRes = await testQwenDirectly('Explain what an API is in one short sentence.');
    status.qwen = {
      model: LLM_MODEL,
      status: 'working',
      sampleOutput: qwenRes,
    };
  } catch (err) {
    status.qwen = { model: LLM_MODEL, status: 'error', error: err.message };
  }

  status.whisper = {
    model: STT_MODEL,
    status: 'ready',
  };

  res.json(status);
});

/**
 * STEP 19: AI Diagnostics Endpoint
 * GET /api/ai/diagnostics
 */
app.get('/api/ai/diagnostics', (req, res) => {
  const tokenConfigured = Boolean(process.env.HF_TOKEN && process.env.HF_TOKEN !== 'your_huggingface_token');
  res.json({
    hfTokenConfigured: tokenConfigured,
    whisperConfigured: tokenConfigured,
    bgeConfigured: tokenConfigured,
    qwenConfigured: tokenConfigured,
    qwenProvider: LLM_MODEL.includes(':') ? LLM_MODEL.split(':')[1] : 'default',
    documentCount: Array.from(new Set(documentStore.chunks.map(c => c.documentName))).length,
    chunkCount: documentStore.chunks.length,
    indexed: documentStore.chunks.length > 0,
  });
});

/**
 * 1. Document Upload & Indexing Endpoint
 * POST /api/documents/upload
 */
app.post('/api/documents/upload', (req, res) => {
  try {
    const { documentId, documentName, text } = req.body;

    if (!text || !documentName) {
      return res.status(400).json({ error: 'documentName and text are required' });
    }

    const docId = documentId || `doc-${Date.now()}`;
    documentStore.addChunks(docId, documentName, text);

    return res.json({
      success: true,
      documentId: docId,
      documentName,
      status: 'ready',
      chunksCount: documentStore.chunks.length,
    });
  } catch (error) {
    console.error('Error in /api/documents/upload:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * 2. Model 2: Whisper STT (openai/whisper-large-v3)
 * POST /api/ai/transcribe
 */
app.post('/api/ai/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const transcribedText = await transcribeAudio(req.file.buffer);
    console.log(`[WHISPER STT] Transcribed: "${transcribedText}"`);

    return res.json({ text: transcribedText });
  } catch (error) {
    console.error('Error in /api/ai/transcribe:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * Parses raw text chunks into a clean list of structured courses
 */
function parseCoursesFromContext(context) {
  const courses = [];
  const lines = context.split(/(?=\b\d+\b)/);

  const rowPattern = /\b([0-9A-Z]{8})\s+([\w\s–-]+?)\s+(\d)\s+(\d)\s+(\d)\s+(\d)\b/i;
  const simpleListPattern = /^\s*(\d+)\.?\s+([\w\s–-]+)/;

  for (const line of lines) {
    const cleaned = line.replace(/^\s*\.?\s*/, '').trim();
    if (!cleaned) continue;

    const rowMatch = cleaned.match(rowPattern);
    if (rowMatch) {
      courses.push({
        code: rowMatch[1].trim(),
        title: rowMatch[2].trim(),
        credits: parseInt(rowMatch[6], 10) || 3,
        type: rowMatch[2].toLowerCase().includes('laboratory') || rowMatch[2].toLowerCase().includes('practical') || rowMatch[2].toLowerCase().includes('internship') ? 'practical' : 'theory'
      });
      continue;
    }

    const listMatch = cleaned.match(simpleListPattern);
    if (listMatch) {
      const title = listMatch[2].trim();
      if (!/^(category|course|semester|L T P C)/i.test(title)) {
        courses.push({
          code: '',
          title,
          credits: 3,
          type: title.toLowerCase().includes('laboratory') || title.toLowerCase().includes('internship') || title.toLowerCase().includes('practical') ? 'practical' : 'theory'
        });
      }
    } else {
      const title = cleaned.replace(/^\d+[\s.]*/, '').trim();
      if (title.length > 5 && !/^(category|course|semester|L T P C)/i.test(title)) {
        courses.push({
          code: '',
          title,
          credits: 3,
          type: title.toLowerCase().includes('laboratory') || title.toLowerCase().includes('internship') || title.toLowerCase().includes('practical') ? 'practical' : 'theory'
        });
      }
    }
  }

  const seen = new Set();
  return courses.filter(c => {
    const key = c.title.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Clean & Synthesize Answer Text
 */
function postProcessAnswer(rawAnswer, queryLower) {
  if (!rawAnswer) return '';

  let cleaned = rawAnswer
    .replace(/^(?:Tyro Settings Page|iClient Start Page|API Guide|SharePoint Folder|Section \d+|Table \d+)\b[:\s]*/gi, '')
    .replace(/\b(?:healthpointRefTag|healthpointTotalBenefitAmount|healthpointTerminalDateTime|healthpointMemberNumber|serviceCode|patientId|responseCode|claimAmount|rebateAmount|transactionId)\b/gi, '')
    .replace(/[{}"\\]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (/^what is (tyro|iclient|settlement|headless|headful)\??$/i.test(queryLower.trim())) {
    const sentences = cleaned.split(/(?<=[.!?])\s+/).filter(s => s.length > 10);
    if (sentences.length > 0) {
      cleaned = sentences.slice(0, 3).join(' ');
    }
  }

  if (!cleaned.endsWith('.')) cleaned += '.';
  return cleaned;
}

/**
 * Resolves conversational context using session history
 */
function resolveFollowUpQuery(question, history = []) {
  if (!history || history.length === 0) {
    return { resolvedQuestion: question, activeSemester: null, activeEntity: null };
  }

  let activeSemester = null;
  let activeEntity = null;

  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    if (msg.sender === 'user' || msg.role === 'user') {
      const text = msg.text || msg.content || '';
      const sem = detectSemester(text);
      if (sem !== null && activeSemester === null) {
        activeSemester = sem;
      }
      const analysis = analyzeQuery(text);
      if (analysis.entity && !activeEntity) {
        activeEntity = analysis.entity;
      }
    }
  }

  let resolvedQuestion = question;
  const qLower = question.toLowerCase();
  const isFollowUp = /^(which|what|explain|how|why|tell|show|any|are|can|define|details|more|that|them|it|they)\b/i.test(question.trim()) || question.split(' ').length < 5;

  if (isFollowUp) {
    if (activeSemester !== null && !detectSemester(question)) {
      resolvedQuestion = `${question} for semester ${activeSemester}`;
    }
    if (activeEntity && !qLower.includes(activeEntity.toLowerCase())) {
      resolvedQuestion = `${resolvedQuestion} regarding ${activeEntity}`;
    }
  }

  return { resolvedQuestion, activeSemester, activeEntity };
}

/**
 * Validates Qwen generated answer
 */
function validateAnswer(answer, question, contextPassages, intent) {
  if (!answer) return false;
  const lower = answer.toLowerCase();

  if (lower.includes("couldn't find enough information") || lower.includes("insufficient information")) {
    return true;
  }

  if (lower.includes("semester metadata:") || lower.includes("[semester metadata:") || lower.includes("system prompt")) {
    return false;
  }

  if (intent === 'DEFINITION' || intent === 'EXPLANATION') {
    if (answer.split('\n').length > 10) {
      return false;
    }
  }

  return true;
}

/**
 * POST /api/ai/vision-extract
 * Extracts syllabus text from uploaded outline images.
 */
app.post('/api/ai/vision-extract', async (req, res) => {
  try {
    const { base64Image } = req.body;
    if (!base64Image) {
      return res.status(400).json({ error: 'base64Image is required' });
    }

    console.log(`[VISION EXTRACTION] Extracting text from image...`);
    const text = await extractTextFromImage(base64Image);
    return res.json({ text });
  } catch (error) {
    console.error('Error in /api/ai/vision-extract:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * 3. Model 1 (BAAI/bge-m3) + Model 3 (Qwen/Qwen3-8B:nscale) + BGE Reranker
 * POST /api/ai/ask
 */
app.post('/api/ai/ask', async (req, res) => {
  try {
    const { question, documentText, documentName, history } = req.body;

    if (!question || !question.trim()) {
      return res.status(400).json({ error: 'Question is required' });
    }

    const queryText = question.trim();

    // Re-index document text if client passes documentText
    if (documentText && documentName) {
      documentStore.addChunks(`doc-${Date.now()}`, documentName, documentText);
    }

    console.log(`\n--------------------------------------------------`);
    console.log(`[RAG PIPELINE] ORIGINAL QUESTION: "${queryText}"`);

    // STEP 1: CONVERSATIONAL CONTEXT RESOLUTION
    const { resolvedQuestion } = resolveFollowUpQuery(queryText, history);
    console.log(`[RAG PIPELINE] RESOLVED QUESTION: "${resolvedQuestion}"`);

    const analysis = analyzeQuery(resolvedQuestion);

    // STEP 2: HYBRID RETRIEVAL
    const scoredCandidates = await documentStore.searchRelevantChunks(resolvedQuestion, 15);

    // STEP 3: ANSWERABILITY EVALUATION
    const confidence = documentStore.evaluateAnswerability(scoredCandidates);
    console.log(`[RAG PIPELINE] EVALUATED CONFIDENCE: ${confidence}`);

    let contextPassages = '';
    let sources = [];

    if (confidence !== "NONE" && scoredCandidates.length > 0) {
      // STEP 4: RE-RANKING
      const chunksToRerank = scoredCandidates.map(c => c.chunk);
      const reranked = await rerankCandidates(resolvedQuestion, chunksToRerank);
      const topCandidates = reranked.slice(0, 5).map(r => r.chunk);

      if (topCandidates.length > 0) {
        contextPassages = topCandidates.map(c => c.text).join('\n\n');
        sources = Array.from(new Set(topCandidates.map(c => c.documentName))).map(docName => ({
          documentName: docName,
          page: 1,
        }));
      }
    }

    console.log(`[RAG PIPELINE] CONTEXT CHARS: ${contextPassages.length}`);

    // STEP 5: QWEN LLM GROUNDED ANSWER GENERATION & VALIDATION
    let rawAnswer = '';
    try {
      rawAnswer = await generateQwenAnswer(resolvedQuestion, contextPassages);

      const isValid = validateAnswer(rawAnswer, resolvedQuestion, contextPassages, analysis.intent);
      if (!isValid) {
        console.log(`[RAG PIPELINE] Answer failed validation. Retrying Qwen with stricter prompt...`);
        const retryPrompt = `The user asked: "${resolvedQuestion}".
The previous generated response was not well formatted or contained metadata.
Using ONLY the following context, please answer the question directly. Do not include raw labels, brackets, or unrelated fields.
Context:
${contextPassages}`;
        rawAnswer = await generateQwenAnswer(resolvedQuestion, retryPrompt);
      }
      console.log(`[QWEN API] Response generated.`);
    } catch (llmErr) {
      console.warn('[QWEN API ERROR]:', llmErr.message);
    }

    // STEP 6: GROUNDED FALLBACK & STRUCTURED EXTRACTION (If Qwen is offline or fails)
    const detectedSem = detectSemester(resolvedQuestion);
    const parsedCourses = parseCoursesFromContext(contextPassages);

    if (detectedSem !== null && parsedCourses.length > 0) {
      const romanNumerals = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
      const semRoman = romanNumerals[detectedSem];

      // Formulate List responses
      if (/\b(subjects|courses|study|study subjects)\b/i.test(resolvedQuestion.toLowerCase())) {
        const theoryList = parsedCourses.filter(c => c.type === 'theory').map((c, i) => `${i + 1}. ${c.title}`).join('\n');
        const practicalList = parsedCourses.filter(c => c.type === 'practical').map((c, i) => `${i + 1}. ${c.title}`).join('\n');

        let ans = `### Semester ${semRoman} Subjects\n\n${theoryList}`;
        if (practicalList) {
          ans += `\n\n### Practical / Other Components\n\n${practicalList}`;
        }
        rawAnswer = ans;
      }
      // Formulate Course Code responses
      else if (/\b(code|codes)\b/i.test(resolvedQuestion.toLowerCase())) {
        const rows = parsedCourses.map(c => `| ${c.title} | ${c.code || 'N/A'} |`).join('\n');
        rawAnswer = `### Semester ${semRoman} Course Codes\n\n| Course | Course Code |\n|---|---|\n${rows}`;
      }
      // Formulate Credits responses
      else if (/\b(credit|credits)\b/i.test(resolvedQuestion.toLowerCase())) {
        const rows = parsedCourses.map(c => `| ${c.title} | ${c.credits} |`).join('\n');
        rawAnswer = `### Semester ${semRoman} Course Credits\n\n| Subject | Credits |\n|---|---:|\n${rows}`;
      }
    }

    // Default sentence fallback if unstructured or Qwen is offline
    if (!rawAnswer || rawAnswer.includes("couldn't find enough information")) {
      const sentences = contextPassages
        .split(/(?<=[.!?])\s+|\n+/)
        .map(s => s.trim())
        .filter(s => s.length > 12 && !s.toLowerCase().includes("semester metadata"));
      
      if (sentences.length > 0) {
        rawAnswer = sentences.slice(0, 3).join(' ');
      } else {
        rawAnswer = "I couldn't find enough information about this in the uploaded documents.";
      }
    }

    const finalAnswer = postProcessAnswer(rawAnswer, resolvedQuestion.toLowerCase());

    console.log(`[RAG FINAL ANSWER]: "${finalAnswer.slice(0, 200)}..."`);
    console.log(`--------------------------------------------------\n`);

    return res.json({
      question: queryText,
      answer: finalAnswer,
      sources,
    });
  } catch (error) {
    console.error('Error in /api/ai/ask:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Start Express JS server
app.listen(PORT, () => {
  console.log(`🚀 Node.js JavaScript AI Server listening on http://localhost:${PORT}`);
});
