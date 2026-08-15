import dotenv from 'dotenv';
import OpenAI from "openai";

dotenv.config();

const token = process.env.HF_TOKEN;
const llmClient = new OpenAI({
  baseURL: "https://router.huggingface.co/v1",
  apiKey: token || "dummy_key",
});

const SYSTEM_PROMPT = `You are an intelligent educational AI assistant.

The user will upload an outline, syllabus, headings, or list of topics for a subject (referred to as the "DOCUMENT CONTEXT" or syllabus context). The uploaded outline/syllabus is provided only to identify the topics that the user wants to study.

### Core Requirement
Do NOT simply convert the uploaded document/image into text and display the topics back to the user.
Instead, analyze the document, identify all the topics and subtopics, and use them as the learning context.
When the user asks a question about any topic shown in the uploaded outline, you must explain that topic using your own pretrained knowledge, even if the uploaded outline contains only the topic name and no explanation.

### Important Behavior Rules:
1. The uploaded outline is a topic map, not the answer source. Do not restrict the answer to the words visible in the outline.
2. Do not merely extract and repeat the outline text. Use your pretrained knowledge to explain the requested concept.
3. Follow the hierarchy of topics and subtopics from the uploaded outline.
4. If the user asks about a subtopic contained within a listed topic, explain that subtopic in detail.
5. If the user asks a follow-up question (e.g., details, coefficients, comparisons, equations), maintain the relevant topic context and answer thoroughly.
6. Explain concepts progressively from basic to advanced. Use simple language first, followed by technical details when appropriate.
7. Include examples wherever they improve understanding.
8. For technical/academic topics, include definitions, basic concepts, mathematical/equation representations, working principles, components, formulas, examples, real-world applications, advantages, limitations, and comparisons when relevant.
9. Do not add unrelated topics unless they are necessary to properly explain the user's question.
10. Do not claim that information comes from the uploaded image when it actually comes from your general knowledge.
11. If the question is completely unrelated to the uploaded outline, answer it normally using your general knowledge, but do not falsely associate it with the uploaded syllabus.
12. Organize the final response clearly using headings, bullet points, tables, examples, and step-by-step explanations where appropriate.`;

const question = "what is regression";
const context = `UNIT-II: SUPERVISED LEARNING
Linear Models for Regression, Linear Models for Classification, Decision Tree Learning, Bayesian Learning, Naïve Bayes, Neural Networks - The Perceptron Learning Algorithm, Multi-layer Perceptron, Feed-forward Network, Error Back propagation, Support Vector Machines - Random Forest.`;

const questionPrompt = `You are explaining a topic to a student.
Use the following DOCUMENT CONTEXT (which acts as the syllabus/outline scope) and your pretrained knowledge to answer the question.

USER QUESTION:
${question}

DOCUMENT CONTEXT (SYLLABUS/OUTLINE):
${context}

Provide a detailed, structured, and comprehensive explanation using your pretrained knowledge if the question relates to the syllabus context. Otherwise, answer using your general knowledge.`;

async function test() {
  try {
    const res = await llmClient.chat.completions.create({
      model: "Qwen/Qwen3.5-4B:featherless-ai",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: questionPrompt }
      ],
      temperature: 0.2,
      max_tokens: 2048,
    });
    console.log("QWEN RESPONSE:", JSON.stringify(res, null, 2));
  } catch (err) {
    console.error(err);
  }
}

test();
