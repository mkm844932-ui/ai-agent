import React, { useState, useRef } from 'react';
import { Mic, MicOff, Send, Square } from 'lucide-react';
import { AppPhase } from '../types';

interface ChatInputBarProps {
  phase: AppPhase;
  liveTranscript: string;
  onStartListening: () => void;
  onStopListening: () => void;
  onSendTextQuery: (text: string) => void;
  onStopSpeaking?: () => void;
  hasDocuments: boolean;
}

export const ChatInputBar: React.FC<ChatInputBarProps> = ({
  phase,
  liveTranscript,
  onStartListening,
  onStopListening,
  onSendTextQuery,
  onStopSpeaking,
  hasDocuments,
}) => {
  const [textInput, setTextInput] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const isListening = phase === 'listening';
  const isSpeaking = phase === 'answering';

  const startVoiceRecording = async () => {
    onStartListening();
    
    // Start MediaRecorder if supported for backend Whisper API
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          stream.getTracks().forEach(track => track.stop());

          // Send to backend /api/ai/transcribe (Whisper API)
          if (audioBlob.size > 500) {
            setIsTranscribing(true);
            try {
              const formData = new FormData();
              formData.append('audio', audioBlob, 'speech.webm');

              const res = await fetch('/api/ai/transcribe', {
                method: 'POST',
                body: formData
              });

              if (res.ok) {
                const data = await res.json();
                if (data.text && data.text.trim()) {
                  onSendTextQuery(data.text.trim());
                }
              }
            } catch (e) {
              console.warn('Backend Whisper API error, fallback active:', e);
            } finally {
              setIsTranscribing(false);
            }
          }
        };

        mediaRecorder.start();
      } catch (err) {
        console.warn('Microphone stream access warning:', err);
      }
    }
  };

  const stopVoiceRecording = () => {
    onStopListening();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (textInput.trim() && hasDocuments && !isListening) {
      onSendTextQuery(textInput);
      setTextInput('');
    }
  };

  return (
    <div className="w-full bg-slate-900/90 backdrop-blur-md border-t border-slate-800/80 px-4 py-3 shrink-0 flex flex-col items-center">
      
      {/* Live transcript / Whisper transcription indicator */}
      {(liveTranscript || isTranscribing) && (
        <div className="w-full max-w-2xl mb-2 px-3 py-1.5 rounded-lg bg-slate-950/80 border border-slate-800 text-center animate-fadeIn">
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
            {isTranscribing ? 'Transcribing with Whisper v3...' : 'Hearing Voice Query...'}
          </p>
          {liveTranscript && <p className="text-xs text-slate-200 italic font-medium">"{liveTranscript}"</p>}
        </div>
      )}

      {/* ChatGPT-style input bar */}
      <form onSubmit={handleSubmit} className="w-full max-w-3xl flex items-center gap-2">
        {/* Voice Button */}
        <button
          type="button"
          onClick={isListening ? stopVoiceRecording : startVoiceRecording}
          disabled={!hasDocuments || isTranscribing}
          className={`p-2.5 rounded-xl border transition-all flex items-center gap-1.5 shrink-0 ${
            !hasDocuments || isTranscribing
              ? 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed opacity-40'
              : isListening
              ? 'bg-rose-600 border-rose-500 text-white animate-pulse shadow-rose-500/20 shadow-md'
              : 'bg-slate-800 hover:bg-slate-750 border-slate-700 text-brand-400 hover:text-brand-300'
          }`}
          title={isListening ? "Stop listening" : "Press to ask by voice"}
        >
          {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          <span className="text-xs font-semibold hidden sm:inline">
            {isListening ? 'Listening...' : isTranscribing ? 'Whisper...' : 'Voice'}
          </span>
        </button>

        {/* Stop Speaking Button */}
        {isSpeaking && onStopSpeaking && (
          <button
            type="button"
            onClick={onStopSpeaking}
            className="p-2.5 rounded-xl border border-rose-500/60 bg-rose-600/20 hover:bg-rose-600/40 text-rose-400 hover:text-rose-300 transition-all flex items-center gap-1.5 shrink-0 animate-pulse"
            title="Stop speaking"
          >
            <Square className="w-4 h-4 fill-current" />
            <span className="text-xs font-semibold hidden sm:inline">Stop</span>
          </button>
        )}

        {/* Text Input */}
        <div className="flex-1 relative flex items-center">
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder={
              !hasDocuments
                ? 'Upload a syllabus outline to get started...'
                : isListening
                ? 'Listening to your voice...'
                : isTranscribing
                ? 'Transcribing speech with OpenAI Whisper...'
                : 'Ask a question about your study material...'
            }
            disabled={!hasDocuments || isListening || isTranscribing}
            className="w-full bg-slate-950/80 border border-slate-800 focus:border-brand-500/60 rounded-xl pl-4 pr-10 py-2.5 text-xs md:text-sm text-slate-200 placeholder-slate-500 focus:outline-none disabled:opacity-50 transition"
          />
          
          <button
            type="submit"
            disabled={!hasDocuments || isListening || isTranscribing || !textInput.trim()}
            className="absolute right-2 p-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-30 text-white transition"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>

      <p className="text-[9.5px] text-slate-500 mt-1.5 text-center">
        ⚡ Hugging Face API: Whisper Large v3 (STT) • BGE-M3 (Embeddings) • Qwen3.5-4B (LLM)
      </p>
    </div>
  );
};
