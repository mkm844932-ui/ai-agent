import os
from dotenv import load_dotenv
from huggingface_hub import InferenceClient
from openai import OpenAI

# Load environment variables
load_dotenv()

HF_TOKEN = os.getenv("HF_TOKEN")
HF_STT_MODEL = os.getenv("HF_STT_MODEL", "openai/whisper-large-v3")
HF_EMBEDDING_MODEL = os.getenv("HF_EMBEDDING_MODEL", "BAAI/bge-m3")
HF_LLM_MODEL = os.getenv("HF_LLM_MODEL", "Qwen/Qwen3-8B:nscale")
RAG_THRESHOLD = float(os.getenv("RAG_SIMILARITY_THRESHOLD", "0.60"))

# Initialize clients if HF_TOKEN is valid
hf_client = None
llm_client = None

def get_hf_client():
    token = os.getenv("HF_TOKEN")
    if token and token != "your_huggingface_token":
        return InferenceClient(token)
    return None

def get_llm_client():
    token = os.getenv("HF_TOKEN")
    if token and token != "your_huggingface_token":
        return OpenAI(
            base_url="https://router.huggingface.co/v1",
            api_key=token
        )
    return None

SYSTEM_PROMPT = """You are an intelligent educational AI assistant.

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
     3. [Question 3]"""


def transcribe_audio(audio_bytes: bytes) -> str:
    """Uses Whisper API (openai/whisper-large-v3) to transcribe speech to text."""
    client = get_hf_client()
    if not client:
        raise RuntimeError("HF_TOKEN is not configured or invalid")

    try:
        # Try automatic_speech_recognition with default/fal-ai provider
        try:
            result = client.automatic_speech_recognition(
                audio_bytes,
                model=HF_STT_MODEL,
                provider="fal-ai"
            )
        except Exception:
            result = client.automatic_speech_recognition(
                audio_bytes,
                model=HF_STT_MODEL
            )

        if hasattr(result, "text"):
            return result.text
        if isinstance(result, dict) and "text" in result:
            return result["text"]
        return str(result)
    except Exception as e:
        print(f"Whisper STT Error: {e}")
        raise e


def generate_embedding(text: str) -> list[float]:
    """Uses BAAI/bge-m3 via Hugging Face inference client feature extraction / sentence similarity."""
    client = get_hf_client()
    if not client:
        raise RuntimeError("HF_TOKEN is not configured or invalid")

    try:
        res = client.feature_extraction(text, model=HF_EMBEDDING_MODEL)
        
        if hasattr(res, "tolist"):
            res = res.tolist()
        if isinstance(res, list) and len(res) > 0 and isinstance(res[0], list):
            res = res[0]
        return res
    except Exception as e:
        print(f"BGE-M3 Embedding Error: {e}")
        raise e


def compute_sentence_similarity(source_sentence: str, sentences: list[str]) -> list[float]:
    """Uses BAAI/bge-m3 sentence similarity API directly."""
    client = get_hf_client()
    if not client:
        raise RuntimeError("HF_TOKEN is not configured or invalid")

    try:
        output = client.sentence_similarity(
            model=HF_EMBEDDING_MODEL,
            inputs={
                "source_sentence": source_sentence,
                "sentences": sentences
            },
            provider="hf-inference"
        )
        return output
    except Exception as e:
        print(f"Sentence Similarity Error: {e}")
        return []


def query_llm_qwen(question: str, context: str) -> str:
    """Uses Qwen via Hugging Face's OpenAI-compatible router to generate grounded answers."""
    client = get_llm_client()
    if not client:
        raise RuntimeError("HF_TOKEN is not configured or invalid")

    user_prompt = f"""You are explaining a topic to a student.
Use the following DOCUMENT CONTEXT (which acts as the syllabus/outline scope) and your pretrained knowledge to answer the question.

USER QUESTION:
{question}

DOCUMENT CONTEXT (SYLLABUS/OUTLINE):
{context or 'No syllabus outline is loaded.'}

Provide a detailed, structured, and comprehensive explanation using your pretrained knowledge if the question relates to the syllabus context. Otherwise, answer using your general knowledge."""

    model_name = os.getenv("HF_LLM_MODEL", "Qwen/Qwen3.5-4B:featherless-ai")

    try:
        try:
            completion = client.chat.completions.create(
                model=model_name,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.2,
                max_tokens=4096
            )
        except Exception:
            # Fallback
            completion = client.chat.completions.create(
                model="Qwen/Qwen3.5-4B:featherless-ai",
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.2,
                max_tokens=4096
            )

        return completion.choices[0].message.content or "I couldn't find enough information about this in the uploaded documents."
    except Exception as e:
        print(f"Qwen LLM Error: {e}")
        raise e
