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
import { documentStore } from './services/documentStore.js';

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
// (Legacy course parsing removed — not relevant to educational AI tutor)

/**
 * Clean & Synthesize Answer Text — preserves markdown formatting
 */
function postProcessAnswer(rawAnswer) {
  if (!rawAnswer) return '';
  // Only trim leading/trailing whitespace. Preserve all markdown structure.
  return rawAnswer.trim();
}

/**
 * Resolves conversational context using session history
 */
/**
 * Resolve follow-up queries by extracting the active topic from history.
 * Does NOT modify the question text — context is handled by passing history to the LLM.
 */
function resolveFollowUpQuery(question, history = []) {
  // Simply return the original question. The LLM receives full conversation
  // history and resolves pronouns (it, its, they) natively.
  return { resolvedQuestion: question };
}

/**
 * Validates Qwen generated answer
 */
/**
 * Validates Qwen generated answer — only catches metadata leaks
 */
function validateAnswer(answer) {
  if (!answer) return false;
  const lower = answer.toLowerCase();

  // Reject if system prompt or metadata leaked into the answer
  if (lower.includes("semester metadata:") || lower.includes("[semester metadata:") || lower.includes("system prompt")) {
    return false;
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

    // Client-side document re-indexing removed to prevent syllabus corruption.
    // The server preloads and manages the study material index.

    console.log(`\n--------------------------------------------------`);
    console.log(`[RAG PIPELINE] ORIGINAL QUESTION: "${queryText}"`);

    // STEP 1: CONVERSATIONAL CONTEXT RESOLUTION
    const { resolvedQuestion } = resolveFollowUpQuery(queryText, history);
    console.log(`[RAG PIPELINE] RESOLVED QUESTION: "${resolvedQuestion}"`);

    // STEP 2: HYBRID RETRIEVAL
    const scoredCandidates = await documentStore.searchRelevantChunks(resolvedQuestion, 15);

    // STEP 3: ANSWERABILITY EVALUATION
    const confidence = documentStore.evaluateAnswerability(scoredCandidates);
    console.log(`[RAG PIPELINE] EVALUATED CONFIDENCE: ${confidence}`);

    let contextPassages = '';
    let sources = [];

    const isExplainAll = /\b(explain all|summarize all|explain everything|all topics|overview of all)\b/i.test(resolvedQuestion.toLowerCase());

    if (isExplainAll && documentStore.chunks.length > 0) {
      // Load all chunks for "explain all" requests
      contextPassages = documentStore.chunks.map(c => c.text).join('\n\n');
      sources = Array.from(new Set(documentStore.chunks.map(c => c.documentName))).map(docName => ({
        documentName: docName,
        page: 1,
      }));
      console.log(`[RAG PIPELINE] 'Explain all' detected. Loaded all ${documentStore.chunks.length} chunks.`);
    } else if (scoredCandidates.length > 0) {
      // Always pass top candidates as context — even for LOW/NONE confidence.
      // Let the LLM decide if the context is relevant.
      const chunksToRerank = scoredCandidates.map(c => c.chunk);
      let topCandidates;
      try {
        const reranked = await rerankCandidates(resolvedQuestion, chunksToRerank);
        topCandidates = reranked.slice(0, 8).map(r => r.chunk);
      } catch (e) {
        console.warn('[RERANKER] Error, using scored candidates directly:', e.message);
        topCandidates = scoredCandidates.slice(0, 8).map(c => c.chunk);
      }

      if (topCandidates.length > 0) {
        contextPassages = topCandidates.map(c => c.text).join('\n\n');
        sources = Array.from(new Set(topCandidates.map(c => c.documentName))).map(docName => ({
          documentName: docName,
          page: 1,
        }));
      }
    }

    console.log(`[RAG PIPELINE] CONTEXT CHARS: ${contextPassages.length}`);

    // STEP 5: QWEN LLM ANSWER GENERATION WITH CONVERSATION HISTORY
    let rawAnswer = '';
    try {
      rawAnswer = await generateQwenAnswer(resolvedQuestion, contextPassages, history);

      const isValid = validateAnswer(rawAnswer);
      if (!isValid) {
        console.log(`[RAG PIPELINE] Answer failed validation (metadata leak). Retrying...`);
        rawAnswer = await generateQwenAnswer(resolvedQuestion, contextPassages, history);
      }
      console.log(`[QWEN API] Response generated.`);
    } catch (llmErr) {
      console.warn('[QWEN API ERROR]:', llmErr.message);
      rawAnswer = 'Sorry, I encountered an error while generating the answer. Please try again.';
    }

    const finalAnswer = postProcessAnswer(rawAnswer);

    console.log(`[RAG FINAL ANSWER]: "${finalAnswer.slice(0, 200)}..."`);
    console.log(`--------------------------------------------------\n`);

    return res.json({
      question: queryText,
      answer: finalAnswer,
      sources,
    });
  } catch (error) {
    console.error('Error in /api/ai/ask:', error);
    return res.status(500).json({ error: error.message || 'An unexpected error occurred.' });
  }
});

// Start Express JS server
app.listen(PORT, () => {
  console.log(`🚀 Node.js JavaScript AI Server listening on http://localhost:${PORT}`);
});
