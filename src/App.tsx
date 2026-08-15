import React, { useState, useEffect } from 'react';
import { UploadedDocument, AppPhase, ChatMessage } from './types';
import { ragEngine } from './services/ragEngine';
import { speechService } from './services/speechService';
import { storageService } from './services/storageService';

// Components
import { AssistantRobot } from './components/AssistantRobot';
import { ConversationThread } from './components/ConversationThread';
import { ChatInputBar } from './components/ChatInputBar';
import { Sparkles, Sun, Moon, Trash2 } from 'lucide-react';

export const App: React.FC = () => {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [phase, setPhase] = useState<AppPhase>('idle');

  // Grounded documents list — restricted to the default syllabus
  const [documents, setDocuments] = useState<UploadedDocument[]>([
    {
      id: 'default-supervised-learning',
      fileName: 'Supervised_Learning_Syllabus.txt',
      fileSize: 15331,
      fileType: 'txt',
      uploadDate: new Date().toISOString(),
      status: 'ready',
      rawText: 'Supervised Learning syllabus outline covering linear models for regression and classification.',
      subjectName: 'Supervised Learning Syllabus',
      units: []
    }
  ]);

  // Conversation messages history
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [liveTranscript, setLiveTranscript] = useState('');

  // Storage saving/loading for documents disabled to avoid caching legacy files from other sessions

  // Sync speech callbacks
  useEffect(() => {
    speechService.setCallbacks({
      onStatusChange: (status) => {
        if (status === 'listening') {
          setPhase('listening');
        } else if (status === 'speaking') {
          setPhase('answering');
        } else if (status === 'idle' && phase === 'listening') {
          setPhase('idle');
        }
      },
      onTranscriptPartial: (text) => {
        setLiveTranscript(text);
      },
      onTranscriptFinal: (text) => {
        setLiveTranscript('');
        if (text.trim()) {
          handleAskQuestion(text);
        } else {
          setPhase('idle');
        }
      },
    });
  }, [documents, phase]);

  const handleAskQuestion = async (queryText: string) => {
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-u`,
      sender: 'user',
      text: queryText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setPhase('processing');

    const aiResp = await ragEngine.generateAnswerAsync(queryText, documents, messages);

    const tutorMsg: ChatMessage = {
      id: `msg-${Date.now()}-t`,
      sender: 'tutor',
      text: aiResp.answer,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      visualizationPlan: aiResp.visualizationPlan,
      sourceRef: aiResp.sourceRef
    };

    setMessages(prev => [...prev, tutorMsg]);
    setPhase('answering');

    // Speak aloud through the human 3D assistant with lip sync
    speechService.speak(aiResp.answer, () => {
      setPhase('idle');
    });
  };

  const handleClearHistory = () => {
    setMessages([]);
    setPhase('idle');
    speechService.stopSpeaking();
  };

  const handleStopSpeaking = () => {
    speechService.stopSpeaking();
    setPhase('idle');
  };

  const handleDocumentUploaded = (newDoc: UploadedDocument) => {
    setDocuments(prev => {
      const next = [newDoc, ...prev];
      storageService.saveDocuments(next);
      return next;
    });
  };

  const handleDeleteDocument = (docId: string) => {
    const next = storageService.deleteDocument(docId);
    setDocuments(next);
    if (next.length === 0) {
      handleClearHistory();
    }
  };

  return (
    <div className={`h-screen flex flex-col overflow-hidden font-sans selection:bg-brand-500 selection:text-white transition-colors duration-200 ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* Header */}
      <header className="w-full border-b border-slate-800/40 bg-slate-900/40 backdrop-blur px-5 py-2.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7.5 h-7.5 rounded-lg bg-gradient-to-tr from-brand-600 to-brand-500 flex items-center justify-center shadow-md">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-xs font-bold tracking-tight">Document AI</h1>
            <p className="text-[9px] text-slate-500 font-semibold">Virtual 3D Assistant</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              onClick={handleClearHistory}
              className="px-2.5 py-1 rounded-xl bg-slate-800/50 hover:bg-slate-800 text-slate-400 hover:text-rose-400 text-xs flex items-center gap-1 border border-slate-700/30 transition"
              title="Clear conversation history"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Clear Chat</span>
            </button>
          )}

          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-1.5 rounded-xl bg-slate-800/50 hover:bg-slate-800 text-slate-400 border border-slate-700/30 transition"
          >
            {isDarkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
        </div>
      </header>

      {/* Main 2-Column Viewport Layout */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        
        {/* CENTER COLUMN: ChatGPT-style Conversation Area */}
        <section className="flex-1 flex flex-col overflow-hidden bg-slate-950/40 relative border-r border-slate-800/30">
          <ConversationThread
            messages={messages}
            isProcessing={phase === 'processing'}
            hasDocuments={true}
          />
        </section>

        {/* RIGHT COLUMN: 3D Human Assistant Presenter (25-30% width) */}
        <aside className="w-full md:w-80 p-4 flex flex-col items-center justify-center shrink-0 bg-slate-900/10 border-l border-slate-800/30">
          <div className="w-full max-w-xs flex flex-col items-center gap-3">
            <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider self-start">
              Virtual Presenter
            </h2>
            <div className="w-full">
              <AssistantRobot phase={phase} />
            </div>
            <p className="text-[10px] text-slate-500 text-center leading-normal px-2">
              The human 3D presenter speaks and lip-syncs answers in real time as they appear in the conversation thread.
            </p>
          </div>
        </aside>

      </div>

      {/* BOTTOM FIXED CHATGPT-STYLE INPUT BAR */}
      <ChatInputBar
        phase={phase}
        liveTranscript={liveTranscript}
        onStartListening={() => speechService.startListening()}
        onStopListening={() => speechService.stopListening()}
        onSendTextQuery={handleAskQuestion}
        onStopSpeaking={handleStopSpeaking}
        hasDocuments={true}
      />
    </div>
  );
};
