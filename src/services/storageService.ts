import { UploadedDocument } from '../types';

const DOCUMENTS_KEY = 'docai_documents_v3';

class StorageService {
  public saveDocuments(docs: UploadedDocument[]): void {
    try {
      localStorage.setItem(DOCUMENTS_KEY, JSON.stringify(docs));
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }
  }

  public loadDocuments(): UploadedDocument[] {
    try {
      const data = localStorage.getItem(DOCUMENTS_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed.length > 0) return parsed;
      }

      // Default syllabus document matching the uploaded image outline
      const defaultDoc: UploadedDocument = {
        id: "default-supervised-learning",
        fileName: "Supervised_Learning_Syllabus.txt",
        fileSize: 312,
        fileType: "txt",
        uploadDate: new Date().toISOString(),
        rawText: `UNIT-II: SUPERVISED LEARNING
Linear Models for Regression, Linear Models for Classification, Decision Tree Learning, Bayesian Learning, Naïve Bayes, Neural Networks - The Perceptron Learning Algorithm, Multi-layer Perceptron, Feed-forward Network, Error Back propagation, Support Vector Machines - Random Forest.`,
        units: [],
        status: "ready",
        subjectName: "Supervised Learning"
      };

      this.saveDocuments([defaultDoc]);
      return [defaultDoc];
    } catch (e) {
      console.error('Error loading documents:', e);
      return [];
    }
  }

  public deleteDocument(docId: string): UploadedDocument[] {
    const docs = this.loadDocuments().filter(d => d.id !== docId);
    this.saveDocuments(docs);
    return docs;
  }

  public clearAll(): void {
    localStorage.removeItem(DOCUMENTS_KEY);
    // Also clear old storage keys
    localStorage.removeItem('ai_toy_tutor_documents_v2');
    localStorage.removeItem('ai_toy_tutor_quiz_history_v2');
    localStorage.removeItem('ai_toy_tutor_user_profile_v2');
  }
}

export const storageService = new StorageService();
