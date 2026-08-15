import dotenv from 'dotenv';
import OpenAI from "openai";

dotenv.config();

const token = process.env.HF_TOKEN;
const llmClient = new OpenAI({
  baseURL: "https://router.huggingface.co/v1",
  apiKey: token || "dummy_key",
});

async function test() {
  try {
    const list = await llmClient.models.list();
    console.log("SUPPORTED MODELS:");
    for (const m of list.data) {
      if (m.id.toLowerCase().includes("qwen")) {
        console.log(m.id);
      }
    }
  } catch (err) {
    console.error(err);
  }
}

test();
