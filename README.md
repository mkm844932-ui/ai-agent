# Syllabus AI Assistant: Virtual 3D Tutor

An intelligent educational AI assistant built with a 3D Virtual Presenter (robot) that pre-loads study materials internally and answers student questions dynamically using Hugging Face router models.

---

## Features

- **Automatic Knowledge Indexing**: The backend automatically reads and indexes the syllabus/lecture material from `server/study_material.txt` on startup.
- **Intelligent Q&A**: Employs Qwen model (`Qwen/Qwen3.5-4B:featherless-ai`) via the Hugging Face Serverless Inference Router to provide structured, progressive educational explanations (concise definitions, step-by-step procedures, or comprehensive details).
- **Follow-up Context**: Automatically retains topic context throughout conversation history, allowing seamless follow-up questions.
- **Dynamic Suggested Questions**: Appends a list of 3-5 relevant follow-up questions at the end of every answer to guide student learning.
- **3D Presenter Speech & Lip-Sync**: Animates the Virtual Presenter robot to speak responses aloud via browser text-to-speech.
- **Voice Input**: Features direct microphone audio capture using OpenAI Whisper for hands-free queries.

---

## Tech Stack

- **Frontend**: React, Vite, Tailwind CSS, Lucide Icons, Three.js / React Three Fiber (for 3D robot animations)
- **Backend**: Express, Multer, dotenv, OpenAI SDK
- **AI Infrastructure**: Hugging Face Inference Router (`openai/whisper-large-v3` for speech transcription, `BAAI/bge-m3` for vector embeddings, `Qwen/Qwen3.5-4B` for LLM generation)

---

## Setup & Installation

Follow these steps to configure and run the project locally.

### 1. Prerequisites
Ensure you have the following installed on your machine:
- **Node.js** (v18 or higher recommended)
- **NPM** (Node Package Manager)
- A **Hugging Face Account** to generate an API token.

---

### 2. Installation
Navigate to the project root directory and install dependencies:
```bash
npm install
```

---

### 3. Environment Configuration
1. Create a `.env` file in the root directory by copying the example:
   ```bash
   copy .env.example .env
   ```
2. Open the newly created `.env` file and replace `your_huggingface_token` with your actual Hugging Face Access Token:
   ```env
   HF_TOKEN=hf_your_actual_token_here
   HF_STT_MODEL=openai/whisper-large-v3
   HF_EMBEDDING_MODEL=BAAI/bge-m3
   HF_LLM_MODEL=Qwen/Qwen3.5-4B:featherless-ai
   RAG_SIMILARITY_THRESHOLD=0.60
   ```
   *(To get a token, log in to Hugging Face, go to **Profile Settings -> Access Tokens**, click **New Token**, choose **Read** role, and generate).*

---

### 4. Running the Application

You need to run both the frontend dev server and the backend Express server.

#### Option A: Run manually in separate terminal windows

1. **Start the Backend Server**:
   ```bash
   node server/index.js
   ```
   *Output:* `🚀 Node.js JavaScript AI Server listening on http://localhost:8000`

2. **Start the Frontend Dev Server**:
   ```bash
   npm run dev
   ```
   *Output:* `Local: http://localhost:3000/`

---

## Usage

1. Open your browser and navigate to `http://localhost:3000`.
2. The UI will show **Syllabus AI Assistant Ready** with `Supervised_Learning_Syllabus.txt` pre-loaded.
3. Type a query in the input bar or click the **Voice** button to speak your question aloud.
4. Try asking:
   - *"What is regression?"*
   - *"How does a Decision Tree work?"*
   - *"Explain all"* (summarizes all topics at once)
5. Explore the recommended questions listed under **"You can ask next:"** at the bottom of the response.
