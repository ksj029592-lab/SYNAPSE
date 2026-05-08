export type DocumentType = 'pdf' | 'youtube' | 'web';

export interface Document {
  id: string;
  title: string;
  content: string;
  type: DocumentType;
  summary: string[];
  keywords: string[];
  embedding?: number[];
  user_id?: string;
  created_at: string;
}

export interface Note {
  id: string;
  content: string;
  document_id?: string;
  embedding?: number[];
  user_id?: string;
  created_at: string;
}

export interface SearchResult {
  id: string;
  title: string;
  similarity: number;
  type: 'document' | 'note';
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}
