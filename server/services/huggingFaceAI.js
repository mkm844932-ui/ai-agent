import dotenv from 'dotenv';
import { InferenceClient } from "@huggingface/inference";
import OpenAI from "openai";

dotenv.config();

const token = process.env.HF_TOKEN;

// Centralized Hugging Face & OpenAI Clients
export const hfClient = new InferenceClient(token);

export const llmClient = new OpenAI({
  baseURL: "https://router.huggingface.co/v1",
  apiKey: token || "dummy_key",
});

export const STT_MODEL = process.env.HF_STT_MODEL || "openai/whisper-large-v3";
export const EMBEDDING_MODEL = process.env.HF_EMBEDDING_MODEL || "BAAI/bge-m3";
export const RERANKER_MODEL = "BAAI/bge-reranker-v2-m3";
export const LLM_MODEL = process.env.HF_LLM_MODEL || "Qwen/Qwen3.5-4B:featherless-ai";
export const SIMILARITY_THRESHOLD = parseFloat(process.env.RAG_SIMILARITY_THRESHOLD || "0.60");

export const SYSTEM_PROMPT = `You are an intelligent educational AI tutor.

The user has study material loaded as DOCUMENT CONTEXT. Your task is to explain topics using the study material as primary context and your pretrained knowledge to expand.

### Core Guidelines:
1. **Answer ONLY what the user asks**:
   - "What is X?" / "Define X" → Concise definition (1-2 sentences) + brief explanation + simple example. Do NOT add types, formulas, advantages, limitations unless asked.
   - "Explain X" → Moderate explanation with concept + working + example.
   - "Explain X in detail" / "Explain X completely" → Comprehensive structured answer: definition, working, types, formulas, examples, advantages, limitations.
   - "How does X work?" → Focus on step-by-step working process.
   - "Why is X used?" → Focus on purpose and reasoning.
   - "X vs Y" / "Compare X and Y" / "Difference between X and Y" → Use a markdown comparison table.
   - "Give an example of X" → Focus on practical examples.
   - "Explain all" / "Summarize all" → Structured overview of every major topic in the document context.
2. **Proper Answer Structure**:
   - Use markdown: ## headings, **bold**, bullet points, numbered steps, tables for comparisons, code blocks for code.
   - Never return a large unstructured block of text.
3. **Primary Academic Context**:
   - Use the study material as the primary knowledge source. Expand with your general knowledge when the material is brief.
4. **Context Retention**:
   - The conversation history is provided. Use it to resolve pronouns like "it", "its", "they", "this" to the most recently discussed topic.
5. **Out-of-Scope Handling**:
   - If the question is completely unrelated to the study material and you cannot find any relevant context, respond: "This question is outside the scope of the current study material. The available material covers Supervised Learning topics such as Regression, Classification, Decision Trees, Bayesian Learning, Neural Networks, SVM, and Random Forest."
   - Do NOT hallucinate or pretend the study material contains information it does not.
   - If the question is partially related, answer using available context and supplement with general knowledge.
6. **Suggested Questions**:
   - At the very end of EVERY response, add a separate section:
     **You can ask next:**
     1. [Question 1]
     2. [Question 2]
     3. [Question 3]
   - Generate 3-5 relevant follow-up questions based on the current topic.`;

/**
 * Model 2: Whisper STT (openai/whisper-large-v3)
 */
export async function transcribeAudio(audioBuffer) {
  if (!process.env.HF_TOKEN || process.env.HF_TOKEN === "your_huggingface_token") {
    throw new Error("HF_TOKEN is not configured in .env");
  }

  try {
    let result;
    try {
      result = await hfClient.automaticSpeechRecognition({
        data: audioBuffer,
        model: STT_MODEL,
        provider: "fal-ai",
      });
    } catch (err) {
      result = await hfClient.automaticSpeechRecognition({
        data: audioBuffer,
        model: STT_MODEL,
      });
    }

    return result.text || result;
  } catch (error) {
    console.error("Whisper STT Error:", error);
    throw error;
  }
}

/**
 * Model 1: BGE-M3 Feature Extraction (BAAI/bge-m3)
 */
export async function generateBgeEmbedding(text) {
  if (!process.env.HF_TOKEN || process.env.HF_TOKEN === "your_huggingface_token") {
    throw new Error("HF_TOKEN is not configured in .env");
  }

  try {
    const res = await hfClient.featureExtraction({
      model: EMBEDDING_MODEL,
      inputs: text,
    });
    return res;
  } catch (error) {
    console.error("BGE-M3 Feature Extraction Error:", error);
    throw error;
  }
}

/**
 * Model 1: BGE-M3 Sentence Similarity (BAAI/bge-m3)
 */
export async function computeSentenceSimilarity(question, documentChunks) {
  if (!process.env.HF_TOKEN || process.env.HF_TOKEN === "your_huggingface_token") {
    throw new Error("HF_TOKEN is not configured in .env");
  }

  try {
    const scores = await hfClient.sentenceSimilarity({
      model: EMBEDDING_MODEL,
      inputs: {
        source_sentence: question,
        sentences: documentChunks,
      },
      provider: "hf-inference",
    });

    return scores;
  } catch (error) {
    console.error("BGE-M3 Sentence Similarity Error:", error);
    return [];
  }
}

/**
 * Model 3: Qwen3-8B LLM Direct Test (Without RAG)
 */
export async function testQwenDirectly(promptText = "Explain what an API is in one sentence.") {
  if (!process.env.HF_TOKEN || process.env.HF_TOKEN === "your_huggingface_token") {
    throw new Error("HF_TOKEN is not configured in .env");
  }

  try {
    let completion;
    try {
      completion = await llmClient.chat.completions.create({
        model: LLM_MODEL,
        messages: [{ role: "user", content: promptText }],
      });
    } catch (err) {
      completion = await llmClient.chat.completions.create({
        model: "Qwen/Qwen3.5-4B:featherless-ai",
        messages: [{ role: "user", content: promptText }],
      });
    }

    return completion.choices[0]?.message?.content;
  } catch (error) {
    console.error("Qwen Direct Test Error:", error);
    throw error;
  }
}

/**
 * Model 3: Qwen3-8B LLM Grounded Generation
 */
export async function generateQwenAnswer(question, context, history = []) {
  if (!process.env.HF_TOKEN || process.env.HF_TOKEN === "your_huggingface_token") {
    throw new Error("HF_TOKEN is not configured in .env");
  }

  const questionPrompt = `DOCUMENT CONTEXT (STUDY MATERIAL):
${context || 'No study material is loaded.'}

USER QUESTION:
${question}`;

  // Build messages array with conversation history for follow-up context
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
  ];

  // Inject last 6 conversation messages for context retention
  if (history && history.length > 0) {
    const recentHistory = history.slice(-6);
    for (const msg of recentHistory) {
      const role = (msg.sender === 'user' || msg.role === 'user') ? 'user' : 'assistant';
      const content = msg.text || msg.content || '';
      if (content.trim()) {
        messages.push({ role, content });
      }
    }
  }

  messages.push({ role: "user", content: questionPrompt });

  try {
    let chatCompletion;
    try {
      chatCompletion = await llmClient.chat.completions.create({
        model: LLM_MODEL,
        messages,
        temperature: 0.2,
        max_tokens: 4096,
      });
    } catch (err) {
      chatCompletion = await llmClient.chat.completions.create({
        model: "Qwen/Qwen3.5-4B:featherless-ai",
        messages,
        temperature: 0.2,
        max_tokens: 4096,
      });
    }

    return chatCompletion.choices[0]?.message?.content || "I couldn't find enough information about this in the study material.";
  } catch (error) {
    console.error("Qwen LLM Error:", error);
    throw error;
  }
}

/**
 * Model Reranker: BAAI/bge-reranker-v2-m3
 */
export async function rerankCandidates(query, candidates) {
  if (!process.env.HF_TOKEN || process.env.HF_TOKEN === "your_huggingface_token") {
    console.warn("HF_TOKEN is not configured. Skipping reranker.");
    return candidates.map(c => ({ chunk: c, score: 1.0 }));
  }

  const results = [];
  for (const cand of candidates) {
    try {
      let score = 0;
      try {
        const output = await hfClient.textClassification({
          model: RERANKER_MODEL,
          inputs: { text: query, text_pair: cand.text || cand },
          provider: "hf-inference",
        });
        if (Array.isArray(output) && output.length > 0) {
          score = output[0]?.score || 0;
        }
      } catch (e) {
        const fallbackText = `${query} ${cand.text || cand}`;
        const output = await hfClient.textClassification({
          model: RERANKER_MODEL,
          inputs: fallbackText,
          provider: "hf-inference",
        });
        if (Array.isArray(output) && output.length > 0) {
          score = output[0]?.score || 0;
        }
      }
      results.push({ chunk: cand, score });
    } catch (error) {
      console.error("Error reranking candidate:", error.message);
      results.push({ chunk: cand, score: 0 });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}

/**
 * Model 3: Qwen Vision LLM Text Extraction
 */
export async function extractTextFromImage(base64DataUrl) {
  if (!process.env.HF_TOKEN || process.env.HF_TOKEN === "your_huggingface_token") {
    throw new Error("HF_TOKEN is not configured in .env");
  }

  try {
    const chatCompletion = await llmClient.chat.completions.create({
      model: LLM_MODEL,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract all visible outline, syllabus, headings, topics, and text content from this image exactly as written. Organize it logically as a structured text list. Avoid adding conversational introductions or outros.",
            },
            {
              type: "image_url",
              image_url: {
                url: base64DataUrl,
              },
            },
          ],
        },
      ],
      max_tokens: 1000,
    });

    return chatCompletion.choices[0]?.message?.content || "";
  } catch (error) {
    console.error("Qwen Vision LLM Error:", error);
    throw error;
  }
}

