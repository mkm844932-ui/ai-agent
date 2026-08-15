import { computeSentenceSimilarity } from './huggingFaceAI.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


// Number/Word/Roman Normalization maps
const WORD_MAP = {
  "one": "1", "first": "1", "1st": "1",
  "two": "2", "second": "2", "2nd": "2",
  "three": "3", "third": "3", "3rd": "3",
  "four": "4", "fourth": "4", "4th": "4",
  "five": "5", "fifth": "5", "5th": "5",
  "six": "6", "sixth": "6", "6th": "6",
  "seven": "7", "seventh": "7", "7th": "7",
  "eight": "8", "eighth": "8", "8th": "8",
  "sem": "semester",
  "sub": "subject", "subs": "subjects",
  "courses": "courses", "course": "course"
};

const ROMAN_MAP = {
  "i": "1", "ii": "2", "iii": "3", "iv": "4",
  "v": "5", "vi": "6", "vii": "7", "viii": "8"
};

const SYNONYMS = {
  "regression": ["linear", "prediction", "continuous", "equation", "slope", "intercept", "mse", "cost function"],
  "classification": ["logistic", "categorical", "class", "label", "decision boundary", "sigmoid", "probability"],
  "decision tree": ["entropy", "information gain", "gini", "split", "leaf", "node", "pruning"],
  "bayesian": ["bayes", "prior", "posterior", "likelihood", "probability", "theorem"],
  "naive bayes": ["spam", "conditional independence", "gaussian", "multinomial", "bernoulli", "text classification"],
  "neural": ["neuron", "activation", "weight", "bias", "layer", "perceptron", "mlp", "feed-forward", "feedforward"],
  "backpropagation": ["gradient", "chain rule", "backward", "error propagation", "loss", "weight update"],
  "svm": ["support vector", "hyperplane", "margin", "kernel", "rbf", "polynomial"],
  "random forest": ["ensemble", "bagging", "voting", "multiple trees", "overfitting"],
  "perceptron": ["single neuron", "binary classification", "step function", "learning rate"],
  "supervised": ["labeled", "training data", "prediction", "target", "output"]
};

// Normalize text helper
export function normalizeText(text) {
  if (!text) return "";
  let clean = text.toLowerCase()
    .replace(/['’]s/g, " is") // contractions
    .replace(/what's/g, "what is")
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()|]/g, " ") // punctuation
    .replace(/\s+/g, " ")
    .trim();

  const tokens = clean.split(/\s+/);
  const normalizedTokens = tokens.map(tok => {
    if (WORD_MAP[tok]) return WORD_MAP[tok];
    if (ROMAN_MAP[tok]) return ROMAN_MAP[tok];
    return tok;
  });
  return normalizedTokens.join(" ");
}

// Detect semester number from text
export function detectSemester(text) {
  const norm = normalizeText(text);
  
  // Look for patterns like "semester 6", "sem 6", "6 semester"
  const patterns = [
    /\bsemester\s+([1-8])\b/,
    /\bsem\s+([1-8])\b/,
    /\b([1-8])\s*semester\b/,
    /\b([1-8])\s*sem\b/,
    /\b([1-8])\s*th\s+semester\b/,
    /\b([1-8])\s*th\s+sem\b/
  ];

  for (const pat of patterns) {
    const match = norm.match(pat);
    if (match) {
      return parseInt(match[1], 10);
    }
  }

  // Handle words
  const words = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth"];
  for (let i = 0; i < words.length; i++) {
    if (norm.includes(words[i])) {
      return i + 1;
    }
  }

  return null;
}

// Detect query intent
export function detectIntent(query) {
  const q = query.toLowerCase();
  if (/\b(define|definition|what does|mean)\b/i.test(q)) return "DEFINITION";
  if (/\b(explain.*detail|detailed explanation|everything about)\b/i.test(q)) return "DETAILED_EXPLANATION";
  if (/\b(explain|what is|tell me about)\b/i.test(q)) return "EXPLANATION";
  if (/\b(compare|difference between|versus|vs)\b/i.test(q)) return "COMPARISON";
  if (/\b(how to|how do i|steps|procedure|workflow)\b/i.test(q)) return "HOW_TO";
  if (/\b(list|what are the|subjects in|courses in)\b/i.test(q)) {
    if (/\b(subject|course)\b/i.test(q)) return "SUBJECT_LOOKUP";
    return "LIST";
  }
  if (/\b(code|codes)\b/i.test(q)) return "CODE_LOOKUP";
  if (/\b(credit|credits)\b/i.test(q)) return "CREDIT_LOOKUP";
  if (/\b(summary|summarize|overview)\b/i.test(q)) return "OVERVIEW";
  if (/\b(why)\b/i.test(q)) return "WHY";
  if (/\b(what)\b/i.test(q)) return "WHAT";
  if (/\b(when)\b/i.test(q)) return "WHEN";
  if (/\b(where)\b/i.test(q)) return "WHERE";
  if (/\b(who)\b/i.test(q)) return "WHO";
  return "FOLLOW_UP";
}

// Query Understanding & Entity extraction
export function analyzeQuery(query) {
  const norm = normalizeText(query);
  const intent = detectIntent(query);
  const semester = detectSemester(query);

  // Entity detection – ML/supervised learning topics
  let entity = "";
  const entities = [
    "linear regression", "logistic regression", "regression",
    "classification", "decision tree", "bayesian learning", "bayesian",
    "naive bayes", "neural network", "perceptron", "multi-layer perceptron", "mlp",
    "feed-forward network", "feedforward", "backpropagation", "error backpropagation",
    "support vector machine", "svm", "random forest", "supervised learning"
  ];
  for (const ent of entities) {
    if (norm.includes(ent)) {
      entity = ent;
      break;
    }
  }

  // Fallback entity extraction
  if (!entity) {
    const stopwords = new Set(['what', 'is', 'the', 'how', 'does', 'do', 'a', 'an', 'are', 'in', 'on', 'of', 'for', 'to', 'with', 'explain', 'detail', 'define', 'meaning', 'give', 'example', 'all', 'topics']);
    entity = query.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).find(w => w.length > 3 && !stopwords.has(w)) || "";
  }

  return {
    intent,
    entity,
    semester,
    normalized: norm
  };
}

class DocumentStore {
  constructor() {
    this.chunks = [];
    this.topicProfile = new Set();
    this.initDefaultSyllabus();
  }

  initDefaultSyllabus() {
    try {
      const filePath = path.join(__dirname, '..', 'study_material.txt');
      if (fs.existsSync(filePath)) {
        const rawText = fs.readFileSync(filePath, 'utf-8');
        this.addChunks("default-supervised-learning", "Supervised_Learning_Syllabus.txt", rawText);
        console.log(`[RAG INDEX] Pre-loaded study material with ${this.chunks.length} chunks.`);
      } else {
        console.warn(`[RAG INDEX] Study material file not found at: ${filePath}`);
      }
    } catch (e) {
      console.error("Error pre-loading syllabus outline:", e);
    }
  }

  clear() {
    this.chunks = [];
    this.topicProfile = new Set();
  }

  removeDocument(documentName) {
    this.chunks = this.chunks.filter(c => c.documentName !== documentName);
  }

  // Indexing with table-aware extraction
  addChunks(documentId, documentName, rawText) {
    if (!rawText || !rawText.trim()) return;

    if (documentId === "default-supervised-learning") {
      this.clear();
    } else {
      this.chunks = this.chunks.filter(c => c.documentId !== documentId && c.documentName !== documentName);
    }

    const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    let currentSemester = null;
    let chunkIndex = 0;

    // Course row patterns (e.g. 622CSE01 Full Stack Development 3 0 0 4)
    const rowPattern = /\b([0-9A-Z]{8})\s+([\w\s–-]+?)\s+(\d)\s+(\d)\s+(\d)\s+(\d)\b/i;

    let textBuffer = [];
    let currentLength = 0;

    const flushBuffer = () => {
      if (textBuffer.length === 0) return;
      const chunkText = textBuffer.join(' ').trim();
      if (chunkText.length > 10) {
        this.chunks.push({
          documentId,
          documentName,
          pageNumber: 1,
          section: currentSemester !== null ? `SEMESTER ${currentSemester}` : `${documentName} Chunk`,
          chunkIndex,
          text: chunkText,
          semester: currentSemester,
          contentType: 'text'
        });
        chunkIndex++;
      }
      textBuffer = [];
      currentLength = 0;
    };

    for (const line of lines) {
      // Semester detection
      const detectedSem = detectSemester(line);
      if (detectedSem !== null) {
        flushBuffer();
        currentSemester = detectedSem;
      }

      // Check if it's a structured course/table row
      const rowMatch = line.match(rowPattern);
      if (rowMatch) {
        flushBuffer(); // Flush any pending normal text chunks first

        const structuredRow = {
          courseCode: rowMatch[1].trim(),
          courseTitle: rowMatch[2].trim(),
          lecture: rowMatch[3],
          tutorial: rowMatch[4],
          practical: rowMatch[5],
          credits: rowMatch[6]
        };

        const chunkText = `Course Code: ${structuredRow.courseCode} | Course Title: ${structuredRow.courseTitle} | Lecture: ${structuredRow.lecture} | Tutorial: ${structuredRow.tutorial} | Practical: ${structuredRow.practical} | Credits: ${structuredRow.credits} (Semester ${currentSemester || 'N/A'})`;

        this.chunks.push({
          documentId,
          documentName,
          pageNumber: 1,
          section: currentSemester !== null ? `SEMESTER ${currentSemester}` : `${documentName} Table`,
          chunkIndex,
          text: chunkText,
          semester: currentSemester,
          contentType: 'table',
          structuredData: structuredRow
        });
        chunkIndex++;
      } else {
        // Accumulate regular text line
        textBuffer.push(line);
        currentLength += line.length;
        if (currentLength >= 250) {
          flushBuffer();
        }
      }
    }
    flushBuffer();

    console.log(`[RAG INDEX] Indexed ${this.chunks.length} chunks for document: "${documentName}"`);
  }

  // Hybrid Search logic
  async searchRelevantChunks(question, topK = 15) {
    if (this.chunks.length === 0) return [];

    const analysis = analyzeQuery(question);
    const queryNorm = analysis.normalized;
    const queryTerms = queryNorm.split(/\s+/).filter(t => t.length > 2);

    // Expand search terms using synonyms
    const expandedTerms = new Set(queryTerms);
    for (const term of queryTerms) {
      if (SYNONYMS[term]) {
        SYNONYMS[term].forEach(syn => expandedTerms.add(syn));
      }
    }

    const candidateTexts = this.chunks.map(c => c.text);
    let similarityScores = [];
    try {
      similarityScores = await computeSentenceSimilarity(question, candidateTexts);
    } catch (err) {
      console.warn("BGE-M3 similarity error, falling back to keyword similarity:", err.message);
      similarityScores = new Array(this.chunks.length).fill(0.1);
    }

    const scoredCandidates = this.chunks.map((chunk, index) => {
      const textNorm = normalizeText(chunk.text);
      const textLower = chunk.text.toLowerCase();

      // 1. Semantic Similarity (0.45 weight)
      const semanticScore = similarityScores[index] || 0.0;

      // 2. Keyword Overlap (0.25 weight)
      let matchedTerms = 0;
      expandedTerms.forEach(term => {
        if (textNorm.includes(term)) matchedTerms++;
      });
      const keywordScore = expandedTerms.size > 0 ? (matchedTerms / expandedTerms.size) : 0.0;

      // 3. Entity Match (0.15 weight)
      let entityScore = 0.0;
      if (analysis.entity && textLower.includes(analysis.entity.toLowerCase())) {
        entityScore = 1.0;
      }

      // 4. Metadata Semester Match (0.10 weight)
      let metadataScore = 0.0;
      if (analysis.semester !== null && chunk.semester === analysis.semester) {
        metadataScore = 1.0;
      }

      // 5. Exact Phrase Matching (0.05 weight)
      let phraseScore = 0.0;
      if (textLower.includes(question.toLowerCase())) {
        phraseScore = 1.0;
      }

      // Configurable weights
      const finalScore = 
        semanticScore * 0.45 +
        keywordScore  * 0.25 +
        entityScore   * 0.15 +
        metadataScore * 0.10 +
        phraseScore   * 0.05;

      return { chunk, finalScore, details: { semanticScore, keywordScore, entityScore, metadataScore, phraseScore } };
    });

    // Sort descending
    scoredCandidates.sort((a, b) => b.finalScore - a.finalScore);

    // Context filter: If query specifies semester, prioritize it, but do not reject neighbor hierarchy if related
    const filtered = scoredCandidates.filter(item => {
      // Don't completely discard but give strict priority
      if (analysis.semester !== null && item.chunk.semester !== null && item.chunk.semester !== analysis.semester) {
        // Lower score drastically for wrong semester
        item.finalScore -= 0.4;
      }
      return item.finalScore > 0.05;
    });

    filtered.sort((a, b) => b.finalScore - a.finalScore);

    if (filtered.length === 0 && scoredCandidates.length > 0) {
      return scoredCandidates.slice(0, topK);
    }

    return filtered.slice(0, topK);
  }

  // Answerability evaluation
  evaluateAnswerability(scoredCandidates) {
    if (scoredCandidates.length === 0) return "NONE";
    const topScore = scoredCandidates[0].finalScore;

    if (topScore >= 0.65) return "HIGH";
    if (topScore >= 0.40) return "MEDIUM";
    if (topScore >= 0.20) return "LOW";
    return "NONE";
  }

  checkDomainMatch(questionTopic) {
    return true; // Simplified or overridden by confidence levels
  }
}

export const documentStore = new DocumentStore();
