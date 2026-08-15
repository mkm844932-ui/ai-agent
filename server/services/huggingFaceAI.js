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

export const SYSTEM_PROMPT = `You are an intelligent educational AI assistant.

The user has loaded a syllabus outline (DOCUMENT CONTEXT). Your task is to explain topics from this syllabus outline using your pretrained knowledge, keeping responses focused, structured, and customized to the user's intent.

### Core Guidelines:
1. **Answer ONLY what the user asks**:
   - Short/definition questions (e.g. "What is X?", "Define X", "Meaning of X") must get a concise definition first (1-2 sentences), followed by a brief explanation and example. Do NOT explain mathematical equations, types, advantages, or limitations unless explicitly asked.
   - Adjust explanation depth dynamically based on user wording ("Explain X in detail" -> comprehensive, "How does X work?" -> process focus, "What is the equation of X?" -> formula focus).
   - **Explain all / Summarize all**: If the user requests to "explain all" or "explain all topics", provide a structured, comprehensive overview explaining every major topic in the syllabus/document context at once.
2. **Proper Answer Structure**:
   - Organize responses cleanly using markdown (headings, bullet points, numbered steps, or tables for comparisons). Avoid huge blocks of unstructured text.
3. **Primary Academic Context**:
   - Use the loaded syllabus/study material as the primary guide for defining the scope. Use your general knowledge to explain and expand on those topics.
4. **Context Retention**:
   - Maintain the conversation context across follow-up questions (e.g. if the user asks "How does it work?" or "What are its advantages?", determine what "it" or "its" refers to from the history).
5. **Suggested Questions**:
   - At the very end of EVERY response, add a separate section with exactly 3 to 5 relevant follow-up questions the user can ask next based on the current topic.
   - Format this section exactly as:
     **You can ask next:**
     1. [Question 1]
     2. [Question 2]
     3. [Question 3]`;

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
export async function generateQwenAnswer(question, context) {
  if (!process.env.HF_TOKEN || process.env.HF_TOKEN === "your_huggingface_token") {
    throw new Error("HF_TOKEN is not configured in .env");
  }

  const questionPrompt = `You are explaining a topic to a student.
Use the following DOCUMENT CONTEXT (which acts as the syllabus/outline scope) and your pretrained knowledge to answer the question.

USER QUESTION:
${question}

DOCUMENT CONTEXT (SYLLABUS/OUTLINE):
${context || 'No syllabus outline is loaded.'}

Provide a detailed, structured, and comprehensive explanation using your pretrained knowledge if the question relates to the syllabus context. Otherwise, answer using your general knowledge.`;

  try {
    let chatCompletion;
    try {
      chatCompletion = await llmClient.chat.completions.create({
        model: LLM_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: questionPrompt },
        ],
        temperature: 0.2,
        max_tokens: 4096,
      });
    } catch (err) {
      chatCompletion = await llmClient.chat.completions.create({
        model: "Qwen/Qwen3.5-4B:featherless-ai",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: questionPrompt },
        ],
        temperature: 0.2,
        max_tokens: 4096,
      });
    }

    return chatCompletion.choices[0]?.message?.content || "I couldn't find enough information about this in the uploaded documents.";
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

