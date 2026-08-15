// ─── Core Document Types (kept from existing) ───

export interface SubTopic {
  id: string;
  title: string;
  summary: string;
  masteryScore: number;
}

export interface Topic {
  id: string;
  chapterId: string;
  title: string;
  summary: string;
  fullContent: string;
  keyTerms: string[];
  formulas: string[];
  subtopics: SubTopic[];
  masteryScore: number;
  isCompleted: boolean;
}

export interface Chapter {
  id: string;
  unitId: string;
  title: string;
  order: number;
  topics: Topic[];
  isCompleted: boolean;
}

export interface Unit {
  id: string;
  documentId: string;
  title: string;
  order: number;
  chapters: Chapter[];
}

export interface UploadedDocument {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: 'pdf' | 'docx' | 'ppt' | 'txt' | 'png' | 'jpg' | 'jpeg' | 'webp';
  uploadDate: string;
  rawText: string;
  units: Unit[];
  status: 'processing' | 'ready' | 'error';
  subjectName: string;
}

// ─── App State Types ───

export type AppPhase =
  | 'idle'            // Waiting for user to ask
  | 'listening'       // Mic is active
  | 'processing'      // AI is thinking
  | 'answering';      // Showing text answer + speaking via presenter

export interface VisualizationNode {
  id: string;
  label: string;
  description: string;
  color?: string;
}

export interface VisualizationConnection {
  from: string;
  to: string;
  label?: string;
}

export interface VisualizationPlan {
  title: string;
  nodes: VisualizationNode[];
  connections: VisualizationConnection[];
}

export interface AIAnswer {
  answer: string;
  sourceRef: string;
  visualizationPlan: VisualizationPlan;
  isSyllabusMatched: boolean;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'tutor';
  text: string;
  timestamp: string;
  visualizationPlan?: VisualizationPlan;
  sourceRef?: string;
}

// Legacy compat types used by ragEngine internally
export type TeachingModeId = 'EXPLAIN_TOPIC';
export type AcademicLevel = 'intermediate';
