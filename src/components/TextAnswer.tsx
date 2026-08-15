import React, { useEffect, useState } from 'react';
import { Volume2, VolumeX, RotateCcw } from 'lucide-react';
import { speechService } from '../services/speechService';

interface TextAnswerProps {
  answer: string;
  sourceRef?: string;
  onReset: () => void;
}

export const TextAnswer: React.FC<TextAnswerProps> = ({ answer, sourceRef, onReset }) => {
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    // Automatically speak the answer
    speechService.speak(answer, () => {
      setIsPlaying(false);
    });
    setIsPlaying(true);

    return () => {
      speechService.stopSpeaking();
    };
  }, [answer]);

  const toggleSpeech = () => {
    if (isPlaying) {
      speechService.stopSpeaking();
      setIsPlaying(false);
    } else {
      speechService.speak(answer, () => {
        setIsPlaying(false);
      });
      setIsPlaying(true);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto flex flex-col gap-3 animate-fadeIn">
      {/* Main Grounded Text Answer card */}
      <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-3.5 flex flex-col gap-3 shadow-lg">
        <div className="text-slate-100 text-xs md:text-sm leading-relaxed whitespace-pre-wrap">
          {answer}
        </div>

        {/* Footer controls: Audio Play/Pause, Citation, Reset */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
          <div className="flex items-center gap-2">
            <button
              onClick={toggleSpeech}
              className={`p-1.5 rounded-lg border transition flex items-center gap-1.5 ${
                isPlaying
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 font-semibold text-[11px]'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white text-[11px]'
              }`}
            >
              {isPlaying ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              <span>{isPlaying ? 'Speaking...' : 'Listen'}</span>
            </button>
            {sourceRef && (
              <span className="text-[10px] text-slate-500 italic">{sourceRef}</span>
            )}
          </div>

          <button
            onClick={onReset}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-800 text-[11px] font-semibold text-slate-300 hover:text-white transition"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Ask Another</span>
          </button>
        </div>
      </div>
    </div>
  );
};
