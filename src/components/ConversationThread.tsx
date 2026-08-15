import React, { useRef, useEffect } from 'react';
import { Bot, User, Sparkles } from 'lucide-react';
import { ChatMessage } from '../types';
import ReactMarkdown from 'react-markdown';

interface ConversationThreadProps {
  messages: ChatMessage[];
  isProcessing: boolean;
  hasDocuments: boolean;
}

export const ConversationThread: React.FC<ConversationThreadProps> = ({
  messages,
  isProcessing,
  hasDocuments,
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessing]);

  if (messages.length === 0 && !isProcessing) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-500">
        <div className="w-12 h-12 rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400 mb-3">
          <Sparkles className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-semibold text-slate-300 mb-1">
          {hasDocuments ? 'Syllabus AI Assistant Ready' : 'No Syllabus Outline Loaded'}
        </h3>
        <p className="text-xs max-w-sm text-slate-500 leading-relaxed">
          {hasDocuments
            ? 'Ask a question using your voice or type below. The AI will explain any topic or subtopic from your syllabus.'
            : 'Upload a syllabus outline or image on the left sidebar to enable learning assistant.'}
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-3xl mx-auto w-full">
      {messages.map((msg) => {
        const isUser = msg.sender === 'user';
        return (
          <div
            key={msg.id}
            className={`flex items-start gap-3 animate-fadeIn ${
              isUser ? 'flex-row-reverse' : 'flex-row'
            }`}
          >
            {/* Avatar Icon */}
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold ${
                isUser
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'bg-slate-800 border border-slate-700 text-slate-300'
              }`}
            >
              {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5 text-brand-400" />}
            </div>

            {/* Message Bubble */}
            <div
              className={`max-w-[85%] rounded-2xl p-3.5 text-xs md:text-sm leading-relaxed ${
                isUser
                  ? 'bg-brand-600 text-white rounded-tr-none shadow-md'
                  : 'bg-slate-900 border border-slate-800 text-slate-100 rounded-tl-none shadow-sm'
              }`}
            >
              {isUser ? (
                <div className="whitespace-pre-wrap">{msg.text}</div>
              ) : (
                <div className="prose prose-invert prose-sm max-w-none prose-headings:text-slate-100 prose-headings:mt-3 prose-headings:mb-1.5 prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-table:text-xs prose-th:bg-slate-800 prose-th:px-2 prose-th:py-1 prose-td:px-2 prose-td:py-1 prose-td:border-slate-700 prose-th:border-slate-600 prose-strong:text-slate-200">
                  <ReactMarkdown>{msg.text}</ReactMarkdown>
                </div>
              )}

              {/* Source Reference if available */}
              {msg.sourceRef && (
                <div className="mt-2 text-[10px] text-slate-400 border-t border-slate-800/80 pt-1.5 italic">
                  {msg.sourceRef}
                </div>
              )}

              <div
                className={`text-[9px] mt-1.5 ${
                  isUser ? 'text-brand-200 text-right' : 'text-slate-500 text-left'
                }`}
              >
                {msg.timestamp}
              </div>
            </div>
          </div>
        );
      })}

      {/* Processing Loader */}
      {isProcessing && (
        <div className="flex items-start gap-3 animate-pulse">
          <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400">
            <Bot className="w-3.5 h-3.5 text-brand-400" />
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl rounded-tl-none p-3.5 text-xs text-slate-400 flex items-center gap-2">
            <div className="w-3.5 h-3.5 rounded-full border-2 border-brand-400 border-t-transparent animate-spin" />
            <span>Thinking...</span>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
};
