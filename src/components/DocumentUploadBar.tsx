import React, { useState, useRef } from 'react';
import { UploadCloud, Loader2, FileText, X } from 'lucide-react';
import { UploadedDocument } from '../types';
import { ragEngine } from '../services/ragEngine';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

interface DocumentUploadBarProps {
  documents: UploadedDocument[];
  onDocumentUploaded: (doc: UploadedDocument) => void;
  onDeleteDocument: (docId: string) => void;
}

export const DocumentUploadBar: React.FC<DocumentUploadBarProps> = ({
  documents,
  onDocumentUploaded,
  onDeleteDocument,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const extractTextFromPdf = async (arrayBuffer: ArrayBuffer): Promise<string> => {
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
    const pdf = await loadingTask.promise;
    const pages: string[] = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const lines: string[] = [];
      let lastY: number | null = null;

      for (const item of textContent.items) {
        const textItem = item as any;
        if (!textItem.str || textItem.str.trim().length === 0) continue;
        const currentY = textItem.transform ? textItem.transform[5] : null;
        if (lastY !== null && currentY !== null && Math.abs(currentY - lastY) > 2) {
          lines.push('\n');
        }
        lines.push(textItem.str);
        lastY = currentY;
      }

      const pageText = lines.join(' ').replace(/ \n /g, '\n').replace(/  +/g, ' ').trim();
      if (pageText.length > 0) pages.push(pageText);
    }

    return pages.join('\n\n');
  };

  const processFile = async (file: File) => {
    setIsProcessing(true);
    setStatusMessage('Uploading...');
    
    // Simulate user-friendly staging steps
    const steps = [
      'Uploading...',
      'Analyzing document...',
      'Extracting content...',
      'Understanding document...',
      'Indexing knowledge...'
    ];

    let stepIdx = 0;
    const interval = setInterval(() => {
      if (stepIdx < steps.length - 1) {
        stepIdx++;
        setStatusMessage(steps[stepIdx]);
      }
    }, 600);

    try {
      let contentText = '';

      if (file.type.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(file.name)) {
        setStatusMessage('Extracting image text (Vision LLM)...');
        const base64DataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const response = await fetch('/api/ai/vision-extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ base64Image: base64DataUrl }),
        });

        if (!response.ok) {
          throw new Error('Failed to extract text from the syllabus image.');
        }

        const data = await response.json();
        contentText = data.text || '';
      } else if (file.type.includes('text') || file.name.endsWith('.txt')) {
        contentText = await file.text();
      } else if (file.name.toLowerCase().endsWith('.pdf')) {
        const arrayBuffer = await file.arrayBuffer();
        contentText = await extractTextFromPdf(arrayBuffer);
      } else {
        const arrayBuffer = await file.arrayBuffer();
        const decoder = new TextDecoder('utf-8');
        const rawString = decoder.decode(arrayBuffer);
        contentText = rawString.replace(/[^\x20-\x7E\n]/g, ' ');
      }

      clearInterval(interval);

      if (contentText.trim().length < 20) {
        setIsProcessing(false);
        setStatusMessage('Error: Could not extract readable text.');
        return;
      }

      setStatusMessage('Indexing knowledge (BGE-M3)...');
      const parsedDoc = ragEngine.parseDocumentText(file.name, contentText);
      await ragEngine.indexDocumentAsync(parsedDoc);

      setTimeout(() => {
        setIsProcessing(false);
        setStatusMessage('');
        onDocumentUploaded(parsedDoc);
      }, 400);
    } catch (e) {
      clearInterval(interval);
      console.error('Document processing error:', e);
      setIsProcessing(false);
      setStatusMessage(`Error: ${(e as Error).message || 'Unknown error'}`);
    }
  };

  return (
    <div className="w-full flex flex-col gap-3">
      {/* Obvious upload button/box */}
      <div
        onClick={() => !isProcessing && fileInputRef.current?.click()}
        className={`border border-dashed border-slate-700 hover:border-brand-500 rounded-xl p-3 flex flex-col items-center justify-center text-center cursor-pointer transition bg-slate-950/40 hover:bg-brand-500/5 ${isProcessing ? 'opacity-70 pointer-events-none' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.ppt,.txt,.png,.jpg,.jpeg,.webp"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])}
        />
        
        {isProcessing ? (
          <div className="flex flex-col items-center gap-1.5 text-brand-400 py-1">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-[11px] font-semibold">{statusMessage}</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <UploadCloud className="w-5 h-5 text-slate-400" />
            <span className="text-[11px] font-semibold text-slate-200">
              + Upload Syllabus / Outline
            </span>
            <span className="text-[9px] text-slate-500">
              PDF, DOCX, TXT, IMAGES
            </span>
          </div>
        )}
      </div>

      {/* Document ready counts */}
      {documents.length > 0 && (
        <div className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1 bg-emerald-500/10 px-2.5 py-1 rounded-lg self-start">
          ✓ {documents.length} document{documents.length > 1 ? 's' : ''} ready
        </div>
      )}

      {/* Document list */}
      {documents.length > 0 && (
        <div className="space-y-1.5 mt-1 max-h-56 overflow-y-auto pr-1">
          {documents.map(doc => (
            <div
              key={doc.id}
              className="flex items-center justify-between bg-slate-900/60 border border-slate-800/80 rounded-xl px-3 py-2 animate-fadeIn"
            >
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="w-3.5 h-3.5 text-brand-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-slate-200 truncate pr-1">{doc.fileName}</p>
                  <p className="text-[9px] text-slate-500">Ready ✓</p>
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onDeleteDocument(doc.id); }}
                className="text-slate-500 hover:text-rose-400 transition p-1"
                title="Remove document"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
