import React, { useState } from 'react';
import { Mic, MicOff, Send, Keyboard } from 'lucide-react';
import { AppPhase } from '../types';

interface VoiceOrbProps {
  phase: AppPhase;
  liveTranscript: string;
  onStartListening: () => void;
  onStopListening: () => void;
  onSendTextQuery: (text: string) => void;
  hasDocuments: boolean;
}

export const VoiceOrb: React.FC<VoiceOrbProps> = ({
  phase,
  liveTranscript,
  onStartListening,
  onStopListening,
  onSendTextQuery,
  hasDocuments,
}) => {
  const [textInput, setTextInput] = useState('');
  const [showTyping, setShowTyping] = useState(false);
  const isListening = phase === 'listening';

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (textInput.trim() && hasDocuments) {
      onSendTextQuery(textInput);
      setTextInput('');
    }
  };

  return (
    <div className="w-full flex flex-col items-center justify-center py-2 px-2 max-w-md mx-auto">
      {/* Microphone Control Area */}
      <div className="relative flex flex-col items-center justify-center">
        {isListening && (
          <>
            <div className="absolute w-24 h-24 bg-rose-500/20 rounded-full animate-ping pointer-events-none" />
            <div className="absolute w-28 h-28 bg-rose-600/10 rounded-full animate-pulse-glow pointer-events-none" />
          </>
        )}

        <button
          onClick={isListening ? onStopListening : onStartListening}
          disabled={!hasDocuments}
          className={`w-20 h-20 rounded-full flex flex-col items-center justify-center transition-all shadow-lg border relative ${
            !hasDocuments
              ? 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed opacity-40'
              : isListening
              ? 'bg-rose-600 border-rose-500 text-white scale-105 shadow-rose-500/20'
              : 'bg-gradient-to-tr from-brand-600 to-brand-500 border-brand-400 text-white hover:scale-102 hover:shadow-brand-500/20'
          }`}
          title={isListening ? "Release/Stop Listening" : "Press to Ask by Voice"}
        >
          {isListening ? (
            <MicOff className="w-7 h-7 animate-pulse" />
          ) : (
            <Mic className="w-7 h-7" />
          )}
          <span className="text-[9px] uppercase tracking-wider font-bold mt-1 opacity-90">
            {isListening ? 'Stop' : 'Ask'}
          </span>
        </button>
      </div>

      {/* Live transcript or instructions */}
      {liveTranscript ? (
        <div className="w-full mt-3 bg-slate-900/60 border border-slate-800 rounded-xl p-2.5 text-center animate-fadeIn">
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-0.5">Hearing...</p>
          <p className="text-xs text-slate-200 font-medium italic">"{liveTranscript}"</p>
        </div>
      ) : (
        <p className="text-[11px] text-slate-400 mt-3 text-center">
          {isListening ? 'Listening... Speak your question now' : 'Click "Ask" to speak naturally'}
        </p>
      )}

      {/* Secondary keyboard toggle */}
      {hasDocuments && !isListening && (
        <div className="mt-4 w-full flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => setShowTyping(!showTyping)}
            className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-slate-300 font-semibold transition"
          >
            <Keyboard className="w-3.5 h-3.5" />
            <span>{showTyping ? 'Hide keyboard input' : 'Prefer typing?'}</span>
          </button>

          {showTyping && (
            <form onSubmit={handleTextSubmit} className="w-full flex items-center gap-1.5 mt-1.5 animate-fadeIn">
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Ask me a question..."
                className="flex-1 bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500/50"
              />
              <button
                type="submit"
                disabled={!textInput.trim()}
                className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 p-2 rounded-xl border border-slate-750 transition"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
};
