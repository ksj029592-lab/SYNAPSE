import { useState, useEffect, useRef } from 'react';
import { 
  FileText, Youtube, Globe, Plus, Search, Trash2, Zap, 
  BookOpen, ArrowRight, MessageSquare, StickyNote, 
  Link as LinkIcon, Send, Maximize2, Sparkles, Terminal,
  Scissors, Edit2, Save, X, GripVertical, Check, Highlighter, Bold
} from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import * as pdfjs from 'pdfjs-dist';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion, Reorder, AnimatePresence, useDragControls } from 'motion/react';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
export interface Document {
  id: string;
  title: string;
  content: string;
  type: 'pdf' | 'youtube' | 'web';
  summary: string[];
  keywords: string[];
  embedding: number[];
  notes?: NoteBlock[];
  created_at: string;
}

export interface NoteBlock {
  id: string;
  content: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  zIndex: number;
  title?: string;
}

export interface MasterNote {
  id: string;
  title: string;
  notes: NoteBlock[];
  updated_at: string;
}

export interface SearchResult extends Document {
  similarity: number;
}

// --- Configuration & Libs ---
const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || '';
// Only initialize if we have credentials
const supabase = (supabaseUrl && supabaseAnonKey) ? createClient(supabaseUrl, supabaseAnonKey) : null;

const apiKey = process.env.GEMINI_API_KEY || '';
const ai = new GoogleGenerativeAI(apiKey);

const MODELS = {
  FLASH: 'gemini-2.0-flash',
  EMBEDDING: 'text-embedding-004'
};

// Robust PDF.js worker configuration
try {
  const version = (pdfjs as any).version || '5.7.284';
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;
} catch (e) {
  console.error('Failed to set PDF.js worker path', e);
}

// --- AI Helpers ---
async function summarizeDocument(text: string) {
  if (!apiKey) {
    console.warn('GEMINI_API_KEY is missing. Using fallback summary.');
    return {
      summary: ["AI 분석을 위해 API 키가 필요합니다.", "현재 데모 모드로 동작 중입니다.", "환경 변수를 설정하면 전체 분석이 가능합니다."],
      keywords: ["demo", "manual"]
    };
  }

  const prompt = `
    Analyze the following text and provide:
    1. A concise 3-line summary of the core thesis/arguments.
    2. Exactly 5 highly relevant keywords (hashtags).
    
    Text: ${text.substring(0, 30000)}
    
    Format the response MUST be a valid JSON object like this:
    {
      "summary": ["line 1", "line 2", "line 3"],
      "keywords": ["tag1", "tag2", "tag3", "tag4", "tag5"]
    }
  `;

  try {
    const model = ai.getGenerativeModel({ model: MODELS.FLASH });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const rawText = response.text() || '';
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    const jsonText = jsonMatch ? jsonMatch[0] : rawText;
    return JSON.parse(jsonText);
  } catch (e) {
    console.error('AI Summary failed:', e);
    return {
      summary: [text.substring(0, 200) + '...'],
      keywords: ["analysis-failed"]
    };
  }
}

async function getSmartInsight(noteContent: string, context: string) {
  if (!apiKey) return "API Key가 설정되지 않아 실시간 분석이 불가능합니다.";
  
  const prompt = `
    You are an AI research assistant. A user is writing a note. 
    Compare this note with the current research context and provide a brief, high-density "Synapse Insight".
    
    Current Note: "${noteContent}"
    Research Context: "${context}"
    
    Identify connections, contradictions, or missing links. Keep it under 2 sentences.
    Start with something like "This point connects to..." or "Interestingly, this contrast with...".
  `;

  try {
    const model = ai.getGenerativeModel({ model: MODELS.FLASH });
    const result = await model.generateContent(prompt);
    return result.response.text() || '';
  } catch (e) {
    console.error('Insight failed:', e);
    return "연결을 찾는 중 오류가 발생했습니다.";
  }
}

async function generateEmbedding(text: string) {
  if (!apiKey) return Array(768).fill(0);
  try {
    const model = ai.getGenerativeModel({ model: MODELS.EMBEDDING });
    const result = await model.embedContent(text.substring(0, 10000));
    return result.embedding.values;
  } catch (e) {
    console.error('Embedding generation failed:', e);
    return Array(768).fill(0);
  }
}

// --- Sub-Components ---

function NoteBlockComponent({ block, onUpdate, onRemove, onBringToFront, onAIInsight }: { 
  block: NoteBlock, 
  onUpdate: (updates: Partial<NoteBlock>) => void, 
  onRemove: (id: string) => void,
  onBringToFront: (id: string) => void,
  onAIInsight: (id: string) => void
}) {
  const dragControls = useDragControls();
  const [isResizing, setIsResizing] = useState(false);

  return (
    <motion.div
      drag
      dragControls={dragControls}
      dragListener={false}
      dragMomentum={false}
      onDragStart={() => onBringToFront(block.id)}
      onDragEnd={(_, info) => {
        onUpdate({ x: block.x + info.offset.x, y: block.y + info.offset.y });
      }}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1, x: block.x, y: block.y, zIndex: block.zIndex || 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="absolute"
      style={{ x: 0, y: 0 }}
    >
      <div 
        className="bg-white border-2 border-slate-200 rounded-2xl shadow-xl hover:shadow-2xl transition-shadow flex flex-col overflow-hidden group select-none relative"
        style={{ width: block.width, height: block.height }}
        onMouseDown={() => onBringToFront(block.id)}
      >
        {/* Header - Drag Handle */}
        <div 
          className="h-10 bg-slate-50 border-b border-slate-100 flex items-center justify-between px-3 cursor-grab active:cursor-grabbing shrink-0 touch-none"
          onPointerDown={(e) => dragControls.start(e)}
        >
          <div className="flex items-center gap-2 overflow-hidden flex-1">
            <GripVertical className="w-3.5 h-3.5 text-slate-300" />
            <input 
              className="text-[11px] font-black text-slate-600 bg-transparent outline-none truncate w-full"
              value={block.title || ''}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => onUpdate({ title: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pr-1">
            <div className="flex items-center bg-white border border-slate-200 rounded-lg px-0.5 mr-1 overflow-hidden shadow-sm">
              <button 
                title="Bold (Ctrl+B)"
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); document.execCommand('bold'); }}
                className="p-1 px-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
              >
                <Bold className="w-3.5 h-3.5" />
              </button>
              <button 
                title="Highlight"
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); document.execCommand('backColor', false, '#fef08a'); }}
                className="p-1 px-1.5 text-slate-500 hover:text-indigo-600 hover:bg-yellow-100 rounded transition-colors"
              >
                <Highlighter className="w-3.5 h-3.5" />
              </button>
              <div className="w-[1px] h-3.5 bg-slate-200 mx-0.5"></div>
              <button 
                title="Decrease Font Size"
                onClick={(e) => { e.stopPropagation(); onUpdate({ fontSize: Math.max(9, (block.fontSize || 13) - 1) }); }} 
                className="p-1 px-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-50 rounded transition-colors"
              >
                <span className="text-[10px] font-black">A-</span>
              </button>
              <button 
                title="Increase Font Size"
                onClick={(e) => { e.stopPropagation(); onUpdate({ fontSize: Math.min(32, (block.fontSize || 13) + 1) }); }} 
                className="p-1 px-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-50 rounded transition-colors"
              >
                <span className="text-[10px] font-black">A+</span>
              </button>
            </div>
            <button onClick={(e) => { e.stopPropagation(); onAIInsight(block.id); }} className="p-1.5 text-indigo-400 hover:bg-indigo-50 rounded-lg transition-all active:scale-95 shadow-sm border border-indigo-50 bg-white">
              <Sparkles className="w-3.5 h-3.5" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); onRemove(block.id); }} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all active:scale-95 shadow-sm border border-slate-50 bg-white ml-0.5">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        
        {/* Content Area */}
        <div
          contentEditable
          suppressContentEditableWarning
          className="flex-1 p-5 leading-relaxed text-slate-700 outline-none overflow-y-auto custom-scrollbar placeholder:text-slate-300 font-medium bg-white selection:bg-indigo-100 cursor-text"
          style={{ fontSize: `${block.fontSize || 13}px` }}
          onInput={(e) => onUpdate({ content: e.currentTarget.innerHTML })}
          onMouseDown={(e) => e.stopPropagation()}
          dangerouslySetInnerHTML={{ __html: block.content }}
        />

        {/* Enhanced Resize Handle */}
        <div 
          className="absolute right-0 bottom-0 w-8 h-8 cursor-se-resize flex items-end justify-end p-1.5 text-slate-300 hover:text-indigo-500 transition-colors group/resize z-30 touch-none"
          onPointerDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setIsResizing(true);
            const startX = e.clientX;
            const startY = e.clientY;
            const startWidth = block.width;
            const startHeight = block.height;

            onBringToFront(block.id);

            const onPointerMove = (moveEvent: PointerEvent) => {
              moveEvent.preventDefault();
              const newWidth = Math.max(240, startWidth + (moveEvent.clientX - startX));
              const newHeight = Math.max(160, startHeight + (moveEvent.clientY - startY));
              onUpdate({
                width: newWidth,
                height: newHeight
              });
            };

            const onPointerUp = () => {
              setIsResizing(false);
              document.body.style.cursor = '';
              window.removeEventListener('pointermove', onPointerMove);
              window.removeEventListener('pointerup', onPointerUp);
            };

            document.body.style.cursor = 'se-resize';
            window.addEventListener('pointermove', onPointerMove);
            window.addEventListener('pointerup', onPointerUp);
          }}
        >
          <div className="flex flex-col gap-0.5 items-end opacity-40 group-hover/resize:opacity-100">
            <div className="w-3 h-[2px] bg-current rounded-full rotate-[-45deg] origin-right translate-y-[2px]"></div>
            <div className="w-2 h-[2px] bg-current rounded-full rotate-[-45deg] origin-right"></div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function NoteEditor({ doc, onUpdate }: { doc: Document, onUpdate: (updates: Partial<Document>) => void }) {
  const [blocks, setBlocks] = useState<NoteBlock[]>(doc.notes || [{ id: '1', content: '', x: 50, y: 50, width: 320, height: 240, fontSize: 13, zIndex: 1, title: '시작하기' }]);
  const [insight, setInsight] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [maxZ, setMaxZ] = useState(1);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const initialBlocks = doc.notes || [{ id: '1', content: '', x: 50, y: 50, width: 320, height: 240, fontSize: 13, zIndex: 1, title: '시작하기' }];
    setBlocks(initialBlocks);
    const highestZ = Math.max(...initialBlocks.map(b => b.zIndex || 1));
    setMaxZ(highestZ);
  }, [doc.id, doc.notes]);

  const bringToFront = (id: string) => {
    const nextZ = maxZ + 1;
    setMaxZ(nextZ);
    updateBlock(id, { zIndex: nextZ });
  };

  const addBlock = (title: string = '새 메모', content: string = '', x: number = 100, y: number = 100) => {
    const nextZ = maxZ + 1;
    setMaxZ(nextZ);
    const newBlock: NoteBlock = {
      id: Math.random().toString(36).substr(2, 9),
      title,
      content,
      x,
      y,
      width: 320,
      height: 240,
      fontSize: 13,
      zIndex: nextZ
    };
    const newBlocks = [...blocks, newBlock];
    setBlocks(newBlocks);
    onUpdate({ notes: newBlocks });
  };

  const updateBlock = (id: string, updates: Partial<NoteBlock>) => {
    const newBlocks = blocks.map(b => b.id === id ? { ...b, ...updates } : b);
    setBlocks(newBlocks);
    onUpdate({ notes: newBlocks });
  };

  const removeBlock = (id: string) => {
    if (blocks.length <= 1 && blocks[0].id === id) {
      updateBlock(id, { content: '', title: '새 메모' });
      return;
    }
    const newBlocks = blocks.filter(b => b.id !== id);
    setBlocks(newBlocks);
    onUpdate({ notes: newBlocks });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const text = e.dataTransfer.getData('text/plain');
    const title = e.dataTransfer.getData('title') || '가져온 자료';
    
    if (text && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left - 50;
      const y = e.clientY - rect.top - 20;
      addBlock(title, text, x, y);
    }
  };

  const getAIInsight = async (blockId: string) => {
    const block = blocks.find(b => b.id === blockId);
    if (!block || !block.content) return;
    
    setIsAnalyzing(true);
    const insightText = await getSmartInsight(block.content, doc.content);
    setInsight(insightText);
    setIsAnalyzing(false);
  };

  return (
    <div 
      ref={canvasRef}
      className="relative w-full h-full bg-[#f8fafc] bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:32px_32px] cursor-crosshair overflow-hidden rounded-2xl border-2 border-dashed border-slate-100"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      onDoubleClick={(e) => {
        if (e.target === canvasRef.current) {
          const rect = canvasRef.current.getBoundingClientRect();
          addBlock('새 메모', '', e.clientX - rect.left - 160, e.clientY - rect.top - 120);
        }
      }}
    >
      <div className="absolute top-6 left-6 z-10 flex flex-col gap-2 pointer-events-none select-none">
        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white/80 backdrop-blur px-3 py-1.5 rounded-full border border-slate-200 inline-flex items-center gap-2">
          캔버스 모드 : 자유로운 사유 배치
          <span className={cn("w-1.5 h-1.5 rounded-full", isAnalyzing ? "bg-indigo-500 animate-pulse" : "bg-emerald-400")}></span>
        </h4>
        <p className="text-[9px] text-slate-400 font-bold ml-1">더블 클릭하여 새 메모 추가 • 우측 자료를 드래그하여 배치</p>
      </div>

      <AnimatePresence>
        {blocks.map((block) => (
          <NoteBlockComponent 
            key={block.id}
            block={block}
            onUpdate={(updates) => updateBlock(block.id, updates)}
            onRemove={removeBlock}
            onBringToFront={bringToFront}
            onAIInsight={getAIInsight}
          />
        ))}
      </AnimatePresence>

      {insight && (
        <motion.div 
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 max-w-lg w-full px-6"
        >
          <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-2xl border border-slate-700 backdrop-blur-xl relative group">
            <button onClick={() => setInsight(null)} className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors">
              <X size={16} />
            </button>
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0 mt-0.5 shadow-lg shadow-indigo-600/30">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-[10px] font-black text-indigo-400 uppercase mb-2 tracking-widest">시냅스 코어 분석</p>
                <p className="text-[13px] text-slate-200 leading-relaxed font-medium">
                  {insight}
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function AiWorkspace({ doc, onUpdate }: { doc: Document, onUpdate: (updates: Partial<Document>) => void }) {
  const [activeTab, setActiveTab] = useState<'chat' | 'notes' | 'links'>('notes');
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [relatedDocs, setRelatedDocs] = useState<SearchResult[]>([]);

  useEffect(() => {
    fetchRelatedContent();
  }, [doc.id]);

  const fetchRelatedContent = async () => {
    if (!doc.embedding || !supabase) return;
    try {
      const { data } = await supabase.rpc('match_documents', {
        query_embedding: doc.embedding,
        match_threshold: 0.5,
        match_count: 5
      });
      if (data) {
        setRelatedDocs(data.filter((r: any) => r.id !== doc.id));
      }
    } catch (e) {
      console.error('Failed to fetch related content:', e);
    }
  };

  const handleSend = async () => {
    if (!inputValue.trim()) return;
    const userMsg = { role: 'user' as const, content: inputValue };
    setMessages([...messages, userMsg]);
    setInputValue('');

    try {
      const model = ai.getGenerativeModel({ model: MODELS.FLASH });
      const result = await model.generateContent(`Context: ${doc.content.substring(0, 5000)}\n\nQuestion: ${inputValue}`);
      const assistantMsg = { role: 'assistant' as const, content: result.response.text() || '' };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (error: any) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'assistant', content: `Gemini API 호출에 실패했습니다: ${error.message || '알 수 없는 오류'}` }]);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white relative">
      <div className="flex border-b border-gray-200 bg-white sticky top-0 z-10 flex-shrink-0 shadow-sm">
        {[
          { id: 'chat', label: '인텔리전트 질의', icon: MessageSquare },
          { id: 'notes', label: '통찰 프로세서', icon: StickyNote },
          { id: 'links', label: '지식 토폴로지', icon: LinkIcon }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 py-3.5 px-4 text-[10px] font-black border-b-2 uppercase tracking-tighter transition-all flex items-center justify-center gap-2 ${
              activeTab === tab.id ? 'border-indigo-600 text-indigo-600 bg-indigo-50/30' : 'border-transparent text-gray-400 hover:text-slate-600'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-5 custom-scrollbar bg-white">
        {activeTab === 'chat' && (
          <div className="flex flex-col gap-5">
            {messages.length === 0 && (
              <div className="p-6 bg-indigo-600 rounded-3xl shadow-xl shadow-indigo-100">
                <p className="text-[13px] text-white leading-relaxed font-black mb-3">안녕하세요, 시냅스 코어입니다. ⚡️</p>
                <p className="text-[11px] text-indigo-100 leading-relaxed font-medium">현재 선택된 <strong>{doc.title}</strong> 노드로부터 심층 통찰을 추출할 준비가 되었습니다.</p>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-4 rounded-2xl text-[12px] leading-relaxed shadow-sm ${
                  m.role === 'user' ? 'bg-indigo-600 text-white font-black' : 'bg-gray-100 text-slate-800'
                }`}>
                  {m.content}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'notes' && <NoteEditor doc={doc} onUpdate={onUpdate} />}

        {activeTab === 'links' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">유사 지식 노드</h4>
              <span className="text-[9px] text-indigo-600 font-black cursor-pointer hover:underline uppercase tracking-tighter">전체 지식 맵 보기</span>
            </div>
            <div className="grid grid-cols-1 gap-4">
              {relatedDocs.map((item) => (
                <div key={item.id} className="p-5 bg-gray-50 border border-gray-200 rounded-2xl group hover:border-indigo-300 hover:bg-white transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[10px] text-indigo-600 font-black uppercase tracking-tighter bg-indigo-50 px-2 py-0.5 rounded">
                      {Math.round(item.similarity * 100)}% 일치
                    </div>
                    <Zap className="w-4 h-4 text-emerald-500 fill-current" />
                  </div>
                  <div className="text-xs font-black text-slate-800 mb-2 leading-snug">{item.title}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {activeTab === 'chat' && (
        <div className="p-5 border-t border-gray-100 bg-white">
          <div className="flex items-center gap-3 bg-gray-50 p-2.5 rounded-2xl border border-gray-200">
            <input 
              type="text" 
              placeholder="내 지식 베이스에 물어보세요..." 
              className="bg-transparent text-[13px] flex-1 outline-none px-3 font-medium"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            />
            <button onClick={handleSend} className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center hover:bg-indigo-700 shadow-lg shadow-indigo-600/20">
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SourceViewer({ doc, onUpdate }: { doc: Document, onUpdate: (updates: Partial<Document>) => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editableContent, setEditableContent] = useState(doc.content);

  useEffect(() => {
    setEditableContent(doc.content);
  }, [doc.content]);

  const handleSave = () => {
    onUpdate({ content: editableContent });
    setIsEditing(false);
  };

  const trimSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    
    // Simple manual trim: delete selected text in edit mode
    // If not in edit mode, we could potentially use AI to 'trim' to the selection or similar
    // But user asked to "cut unnecessary content", which implies deletion.
    if (isEditing) {
      const start = selection.anchorOffset;
      const end = selection.focusOffset;
      // This is tricky with raw content. Let's make it easier:
      // If editing, they can just delete. 
      // If not editing, maybe a 'Crop to Selection' feature?
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    const selection = window.getSelection()?.toString();
    if (selection) {
      e.dataTransfer.setData('text/plain', selection);
      // Visual feedback
      const ghost = document.createElement('div');
      ghost.innerText = selection.substring(0, 50) + '...';
      ghost.className = 'px-3 py-1 bg-indigo-600 text-white text-[10px] rounded shadow-lg pointer-events-none fixed -top-full';
      document.body.appendChild(ghost);
      e.dataTransfer.setDragImage(ghost, 0, 0);
      setTimeout(() => document.body.removeChild(ghost), 0);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase">{doc.type}</span>
          <h2 className="text-sm font-semibold truncate text-slate-800 max-w-[400px]">{doc.title}</h2>
        </div>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <button onClick={handleSave} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-[10px] font-black rounded-lg hover:bg-emerald-700 transition-colors">
                <Check className="w-3 h-3" /> 저장
              </button>
              <button onClick={() => setIsEditing(false)} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-200 text-gray-700 text-[10px] font-black rounded-lg hover:bg-gray-300 transition-colors">
                <X className="w-3 h-3" /> 취소
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setIsEditing(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 text-[10px] font-black rounded-lg hover:bg-indigo-100 border border-indigo-200 transition-colors">
                <Edit2 className="w-3 h-3" /> 자료 편집/정리
              </button>
              <button className="p-1.5 hover:bg-gray-200 rounded text-gray-500"><Maximize2 className="w-4 h-4" /></button>
            </>
          )}
        </div>
      </div>
      
      <div className="p-6 bg-indigo-50/50 border-b border-indigo-100 flex-shrink-0 shadow-inner">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse"></div>
            <h3 className="text-xs font-black text-indigo-700 uppercase tracking-widest">학습 자료 원본 제어</h3>
          </div>
          <span className="text-[10px] text-slate-400 font-bold">드래그하여 메모장으로 소환할 수 있습니다</span>
        </div>
        
        {!isEditing && (
          <div className="p-4 bg-white/60 border border-indigo-100 rounded-2xl">
            <p className="text-[11px] text-slate-500 mb-2 font-black uppercase tracking-tighter">AI 요약 아카이브</p>
            <div className="space-y-1.5">
              {doc.summary.map((line, i) => (
                <p key={i} className="text-[12px] text-slate-700 leading-relaxed font-bold flex items-start gap-2">
                  <span className="text-indigo-400 opacity-50 shrink-0">•</span> {line}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-12 bg-gray-100/50 custom-scrollbar" onDragStart={handleDragStart}>
        <div className="max-w-2xl mx-auto bg-white shadow-2xl min-h-full p-16 flex flex-col gap-8 rounded-xl border border-gray-100 relative">
          {isEditing ? (
            <div className="flex flex-col h-full gap-4">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-2 bg-emerald-50 px-2 py-1 rounded">
                  <Scissors className="w-3 h-3" /> 불필요한 내용 잘라내기 모드
                </h4>
                <p className="text-[9px] text-slate-400 font-medium">내용을 직접 수정하거나 불필요한 문단을 삭제하세요.</p>
              </div>
              <textarea
                className="w-full flex-1 min-h-[500px] text-slate-700 leading-loose text-[13px] font-semibold outline-none border-none resize-none p-4 bg-slate-50 rounded-xl"
                value={editableContent}
                onChange={(e) => setEditableContent(e.target.value)}
              />
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-black text-slate-900 leading-tight border-b-2 border-gray-100 pb-6">{doc.title}</h1>
              <div className="prose prose-slate prose-sm max-w-none select-text cursor-text active:cursor-move">
                {doc.content.split('\n').map((line, i) => (
                  line.trim() && <p key={i} className="text-slate-600 leading-relaxed mb-4 text-[13px] font-semibold leading-loose hover:bg-indigo-50/50 transition-colors rounded px-2 -mx-2">{line}</p>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Workspace({ 
  documents, 
  initialDoc, 
  onDelete, 
  onImportComplete,
  masterNotes,
  setMasterNotes,
  currentMasterNoteId,
  setCurrentMasterNoteId
}: { 
  documents: Document[], 
  initialDoc?: Document | null, 
  onDelete: (id: string, e: React.MouseEvent) => void, 
  onImportComplete: () => void,
  masterNotes: MasterNote[],
  setMasterNotes: React.Dispatch<React.SetStateAction<MasterNote[]>>,
  currentMasterNoteId: string | null,
  setCurrentMasterNoteId: (id: string | null) => void
}) {
  const [activeSidebarTab, setActiveSidebarTab] = useState<'archive' | 'notes'>('archive');
  const [notes, setNotes] = useState<NoteBlock[]>(() => {
    const saved = localStorage.getItem('synapse_current_workspace_notes');
    return saved ? JSON.parse(saved) : [{ id: '1', content: '', x: 50, y: 50, width: 320, height: 240, fontSize: 13, zIndex: 1, title: '시작하기' }];
  });

  // Handle document import from Knowledge Grid
  useEffect(() => {
    if (initialDoc) {
      const newBlock = { 
        id: Math.random().toString(36).substr(2, 9), 
        title: initialDoc.title,
        content: initialDoc.content,
        x: 50 + (notes.length * 20),
        y: 50 + (notes.length * 20),
        width: 400,
        height: 300,
        fontSize: 13,
        zIndex: notes.length > 0 ? Math.max(...notes.map(n => n.zIndex || 1)) + 1 : 1
      };
      setNotes(prev => [...prev, newBlock]);
      onImportComplete();
      setActiveSidebarTab('archive');
    }
  }, [initialDoc, onImportComplete, notes.length]);

  useEffect(() => {
    localStorage.setItem('synapse_current_workspace_notes', JSON.stringify(notes));
  }, [notes]);

  const [isSaving, setIsSaving] = useState(false);

  const saveCurrentLayout = () => {
    const title = prompt('마스터 노드 제목을 입력하세요:', currentMasterNoteId ? masterNotes.find(m => m.id === currentMasterNoteId)?.title : '새 마스터 노드');
    if (!title || !title.trim()) return;

    setIsSaving(true);
    // Deep clone notes to ensure the saved master note isn't coupled with current workspace state
    const notesClone = JSON.parse(JSON.stringify(notes));
    const now = new Date().toISOString();
    
    if (currentMasterNoteId) {
      setMasterNotes(prev => prev.map(m => 
        m.id === currentMasterNoteId 
          ? { ...m, title: title.trim(), notes: notesClone, updated_at: now } 
          : m
      ));
    } else {
      const newMaster: MasterNote = {
        id: Math.random().toString(36).substring(2, 11),
        title: title.trim(),
        notes: notesClone,
        updated_at: now
      };
      setMasterNotes(prev => [newMaster, ...prev]);
      setCurrentMasterNoteId(newMaster.id);
    }
    
    // Immediate feedback: switch to notes tab
    setActiveSidebarTab('notes');
    
    // Keep 'Save Complete' state for visual feedback
    setTimeout(() => {
      setIsSaving(false);
    }, 1500);
  };

  const loadMasterNote = (m: MasterNote) => {
    setNotes(m.notes);
    setCurrentMasterNoteId(m.id);
  };

  const deleteMasterNote = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('이 마스터 노드를 삭제하시겠습니까?')) return;
    setMasterNotes(prev => prev.filter(m => m.id !== id));
    if (currentMasterNoteId === id) setCurrentMasterNoteId(null);
  };

  const createNewWorkspace = () => {
    if (notes.length > 0 && !confirm('현재 워크스페이스를 비우고 새로 시작하시겠습니까?')) return;
    setNotes([{ id: '1', content: '', x: 50, y: 50, width: 320, height: 240, fontSize: 13, zIndex: 1, title: '시작하기' }]);
    setCurrentMasterNoteId(null);
  };

  const renameMasterNote = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const note = masterNotes.find(m => m.id === id);
    if (!note) return;
    const newTitle = prompt('새 제목을 입력하세요:', note.title);
    if (newTitle && newTitle.trim()) {
      setMasterNotes(prev => prev.map(m => m.id === id ? { ...m, title: newTitle.trim() } : m));
    }
  };

  return (
    <div className="flex flex-1 overflow-hidden bg-white">
      {/* Central Notepad Area */}
      <section className="flex-1 flex flex-col bg-white overflow-hidden border-r border-gray-100">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/30 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-lg shadow-indigo-200"></div>
            <h2 className="text-xs font-black text-slate-800 uppercase tracking-widest truncate max-w-[200px]">
              {currentMasterNoteId ? masterNotes.find(m => m.id === currentMasterNoteId)?.title : '마스터 노트 (Master Note)'}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={createNewWorkspace}
              className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-[10px] font-black text-slate-500 hover:bg-gray-50 transition-colors shadow-sm cursor-pointer"
            >
              새 워크스페이스
            </button>
            <button 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                saveCurrentLayout();
              }}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[10px] font-black transition-all flex items-center gap-2 shadow-lg shadow-indigo-200 cursor-pointer active:scale-95",
                isSaving ? "bg-emerald-500 text-white" : "bg-indigo-600 text-white hover:bg-indigo-700"
              )}
            >
              {isSaving ? (
                <><Check size={12} /> 저장 완료!</>
              ) : (
                <><Save size={12} /> 현재 레이아웃 저장</>
              )}
            </button>
          </div>
        </div>
        <div className="flex-1 w-full bg-white overflow-hidden relative">
          <NoteEditor 
            doc={{ content: '', notes } as any} 
            onUpdate={(updates) => updates.notes && setNotes(updates.notes)} 
          />
        </div>
      </section>

      {/* Right Knowledge Archive Sidebar */}
      <aside className="w-80 border-l border-gray-200 flex flex-col bg-gray-50/50 flex-shrink-0">
        <div className="p-2 border-b border-gray-200 bg-white grid grid-cols-2 gap-1">
          <button 
            onClick={() => setActiveSidebarTab('archive')}
            className={cn(
              "py-2.5 text-[10px] font-black uppercase tracking-widest rounded-lg flex items-center justify-center gap-2 transition-all",
              activeSidebarTab === 'archive' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "text-gray-400 hover:text-gray-600"
            )}
          >
            <Globe size={12} /> 지식 아카이브
          </button>
          <button 
            onClick={() => setActiveSidebarTab('notes')}
            className={cn(
              "py-2.5 text-[10px] font-black uppercase tracking-widest rounded-lg flex items-center justify-center gap-2 transition-all",
              activeSidebarTab === 'notes' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "text-gray-400 hover:text-gray-600"
            )}
          >
            <StickyNote size={12} /> 저장된 노트
          </button>
        </div>

        {activeSidebarTab === 'archive' ? (
          <>
            <div className="p-5 border-b border-gray-200 bg-white">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">지식 아카이브</h3>
                <span className="text-[9px] bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full font-black uppercase">{documents.length} NODES</span>
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="자료 탐색 및 드래그..." 
                  className="w-full bg-gray-100 border-none rounded-xl py-2 pl-8 pr-3 text-[11px] outline-none focus:ring-2 focus:ring-indigo-100 transition-all font-medium" 
                />
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
              {documents.length === 0 ? (
                <div className="p-8 text-center border-2 border-dashed border-gray-200 rounded-3xl mx-2 bg-white/50">
                  <div className="w-10 h-10 bg-gray-100 rounded-2xl flex items-center justify-center text-gray-300 mx-auto mb-4">
                    <FileText className="w-5 h-5" />
                  </div>
                  <p className="text-[11px] text-gray-400 font-bold leading-relaxed uppercase tracking-tight">아카이브가 비어있습니다</p>
                  <p className="text-[9px] text-gray-400 mt-2 leading-relaxed">상단 지식 아카이브 탭에서 <br/>학습 자료를 추가하세요.</p>
                </div>
              ) : (
                documents.map((item) => (
                  <div 
                    key={item.id} 
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', item.content);
                      e.dataTransfer.setData('title', item.title);
                      const ghost = document.createElement('div');
                      ghost.innerText = item.title;
                      ghost.className = 'px-3 py-1.5 bg-indigo-600 text-white text-[10px] font-black rounded-lg shadow-xl fixed -top-full';
                      document.body.appendChild(ghost);
                      e.dataTransfer.setDragImage(ghost, 0, 0);
                      setTimeout(() => document.body.removeChild(ghost), 0);
                    }}
                    className="w-full text-left p-4 rounded-2xl transition-all group bg-white border border-gray-100 hover:border-indigo-300 hover:shadow-lg cursor-grab active:cursor-grabbing"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className="text-indigo-500">
                        {item.type === 'pdf' ? <FileText size={14} /> : item.type === 'youtube' ? <Youtube size={14} /> : <Globe size={14} />}
                      </div>
                      <span className="text-[11px] font-black text-slate-400 uppercase tracking-tighter bg-gray-50 px-1.5 py-0.5 rounded">{item.type}</span>
                    </div>
                    <h4 className="text-[12px] font-black text-slate-800 line-clamp-2 leading-snug mb-3">{item.title}</h4>
                    <div className="flex items-center justify-between">
                      <div className="flex gap-1">
                        {item.keywords?.slice(0, 1).map((k, i) => (
                          <span key={i} className="text-[9px] text-indigo-400 font-bold">#{k}</span>
                        ))}
                      </div>
                      <button 
                        onClick={(e) => onDelete(item.id, e)}
                        className="p-1 text-gray-200 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar min-h-0 bg-white">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 ml-1">저장된 마스터 노트</h3>
            {!masterNotes || masterNotes.length === 0 ? (
              <div className="p-8 text-center border-2 border-dashed border-gray-200 rounded-3xl bg-gray-50/50">
                <p className="text-[10px] text-gray-400 font-bold">저장된 마스터 노트가 없습니다.</p>
              </div>
            ) : (
              <Reorder.Group 
                axis="y" 
                values={masterNotes} 
                onReorder={setMasterNotes} 
                className="space-y-3 pb-8"
              >
                {masterNotes.map((m) => (
                  <Reorder.Item 
                    key={m.id}
                    value={m}
                    className={cn(
                      "p-4 rounded-2xl border transition-all relative group bg-white shadow-sm",
                      currentMasterNoteId === m.id ? "bg-indigo-50/80 border-indigo-200 shadow-md ring-1 ring-indigo-200" : "border-gray-100 hover:border-indigo-200 hover:shadow-md"
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => loadMasterNote(m)}>
                        <h4 className="text-[12px] font-black text-slate-800 truncate leading-none mb-1">{m.title}</h4>
                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">
                          {m.notes?.length || 0}개의 블록 • {new Date(m.updated_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={(e) => renameMasterNote(m.id, e)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                          title="이름 변경"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button 
                          onClick={(e) => deleteMasterNote(m.id, e)}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                          title="삭제"
                        >
                          <Trash2 size={13} />
                        </button>
                        <div className="p-1.5 text-slate-300 cursor-grab active:cursor-grabbing hover:text-slate-500">
                          <GripVertical size={13} />
                        </div>
                      </div>
                    </div>
                  </Reorder.Item>
                ))}
              </Reorder.Group>
            )}
          </div>
        )}

        <div className="p-4 bg-indigo-600 text-white m-3 rounded-2xl shadow-xl shadow-indigo-200">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span className="text-[10px] font-black uppercase tracking-widest">지식 가이드</span>
          </div>
          <p className="text-[11px] font-medium leading-relaxed opacity-90">
            {activeSidebarTab === 'archive' 
              ? "우측의 자료를 중앙 메모장으로 **드래그**하여 통합하세요. AI가 실시간으로 인사이트를 제공합니다."
              : "저장된 마스터 노드를 선택하여 이전 워크스페이스 작업을 불러오세요."}
          </p>
        </div>
      </aside>
    </div>
  );
}


function KnowledgeGrid({ documents, onOpenDoc, onUpload, searchQuery }: { documents: Document[], onOpenDoc: (doc: Document) => void, onUpload: (files: File[]) => Promise<void>, searchQuery: string }) {
  const [isUploading, setIsUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'pdf' | 'youtube' | 'web'>('all');

  const handleDrop = async (files: File[]) => {
    setIsUploading(true);
    await onUpload(files);
    setIsUploading(false);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop: handleDrop, accept: { 'application/pdf': ['.pdf'], 'text/plain': ['.txt'] } });

  const filteredDocs = documents.filter(doc => {
    const matchesSearch = doc.title.toLowerCase().includes(searchQuery.toLowerCase()) || doc.keywords.some(k => k.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesTab = activeTab === 'all' || doc.type === activeTab;
    return matchesSearch && matchesTab;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">시냅스 지식 아카이브</h2>
          <p className="text-sm text-gray-500 mt-1 font-medium">흩어진 지식의 파편들을 연결하여 당신만의 거대한 통찰을 완성하세요.</p>
        </div>
        <div className="flex bg-white rounded-lg border border-gray-200 p-1 shadow-sm">
          {[['all', '전체'], ['pdf', '문서'], ['youtube', '미디어'], ['web', '웹 링크']].map(([tab, label]) => (
            <button key={tab} onClick={() => setActiveTab(tab as any)} className={`px-5 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-md ${activeTab === tab ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>{label}</button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div {...getRootProps()} className={`aspect-[4/3] border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all ${isDragActive ? 'border-indigo-500 bg-indigo-50 scale-[0.98]' : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'}`}>
          <input {...getInputProps()} />
          <div className="w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 mb-4 shadow-inner">
            {isUploading ? <Zap className="w-6 h-6 animate-pulse" /> : <Plus className="w-6 h-6" />}
          </div>
          <span className="text-sm font-black text-slate-700">{isUploading ? '문서 분석 중...' : 'PDF 또는 텍스트 드롭'}</span>
        </div>
        {filteredDocs.map((doc) => (
          <div key={doc.id} onClick={() => onOpenDoc(doc)} className="group aspect-[4/3] bg-white border border-gray-200 rounded-3xl p-7 flex flex-col cursor-pointer hover:shadow-xl transition-all">
            <div className="flex items-center justify-between mb-5">
              <div className="p-2.5 bg-gray-50 rounded-xl group-hover:bg-indigo-50 transition-colors shadow-sm">
                {doc.type === 'pdf' ? <FileText className="w-5 h-5 text-red-500" /> : doc.type === 'youtube' ? <Youtube className="w-5 h-5 text-red-600" /> : <Globe className="w-5 h-5 text-blue-500" />}
              </div>
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{new Date(doc.created_at).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}</span>
            </div>
            <h3 className="text-base font-black text-slate-800 line-clamp-2 mb-3 leading-tight group-hover:text-indigo-600 transition-colors">{doc.title}</h3>
            <p className="text-xs text-gray-400 line-clamp-3 leading-relaxed mb-4 font-medium">{doc.summary ? doc.summary[0] : '내용 스캔 중...'}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Main App ---
export default function App() {
  const [view, setView] = useState<'grid' | 'workspace'>('grid');
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isInitializing, setIsInitializing] = useState(true);

  const [masterNotes, setMasterNotes] = useState<MasterNote[]>(() => {
    const saved = localStorage.getItem('synapse_saved_master_notes');
    try {
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [currentMasterNoteId, setCurrentMasterNoteId] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('synapse_saved_master_notes', JSON.stringify(masterNotes));
  }, [masterNotes]);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    if (!supabase) {
      const local = localStorage.getItem('synapse_docs');
      if (local) setDocuments(JSON.parse(local));
      setIsInitializing(false);
      return;
    }
    try {
      const { data } = await supabase.from('documents').select('*').order('created_at', { ascending: false });
      if (data) setDocuments(data);
    } catch (e) {
      console.error('Fetch docs failed:', e);
    } finally {
      setIsInitializing(false);
    }
  };

  const deleteDocument = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('정말로 이 지식 노드를 삭제하시겠습니까?')) return;
    
    setDocuments(prev => {
      const newList = prev.filter(d => d.id !== id);
      if (!supabase) localStorage.setItem('synapse_docs', JSON.stringify(newList));
      return newList;
    });

    if (supabase) {
      try {
        await supabase.from('documents').delete().eq('id', id);
      } catch (error) {
        console.error('Delete failed:', error);
      }
    }
  };

  const handleUpload = async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    
    try {
      let content = '';
      if (file.type === 'application/pdf') {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          fullText += textContent.items.map((item: any) => item.str).join(' ') + '\n';
        }
        content = fullText;
      } else {
        content = await file.text();
      }

      if (!content.trim()) throw new Error('파일이 비어있거나 읽을 수 없습니다.');

      const { summary, keywords } = await summarizeDocument(content);
      const embedding = await generateEmbedding(content);

      const newDoc: Document = {
        id: Math.random().toString(36).substr(2, 9),
        title: file.name,
        content,
        type: 'pdf',
        summary,
        keywords,
        embedding,
        created_at: new Date().toISOString()
      };

      if (supabase) {
        const { data, error: dbError } = await supabase.from('documents').insert({
          title: newDoc.title,
          content: newDoc.content,
          type: newDoc.type,
          summary: newDoc.summary,
          keywords: newDoc.keywords,
          embedding: newDoc.embedding
        }).select().single();
        
        if (dbError) throw new Error(dbError.message);
        if (data) {
          setDocuments(prev => [data, ...prev]);
          handleOpenDoc(data);
        }
      } else {
        // Local strategy
        setDocuments(prev => {
          const newList = [newDoc, ...prev];
          localStorage.setItem('synapse_docs', JSON.stringify(newList));
          return newList;
        });
        handleOpenDoc(newDoc);
      }
    } catch (error: any) {
      console.error('Upload Error:', error);
      alert(`업로드 실패: ${error.message}`);
    }
  };

  const handleOpenDoc = (doc: Document) => {
    setSelectedDoc(doc);
    setView('workspace');
  };

  return (
    <div className="flex flex-col h-screen w-full bg-gray-50 font-sans text-slate-900 overflow-hidden">
      <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0 z-50">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center cursor-pointer shadow-indigo-200 shadow-lg" onClick={() => setView('grid')}>
            <div className="w-4 h-4 border-2 border-white rounded-full"></div>
          </div>
          <h1 className="text-lg font-black tracking-tighter text-slate-800 uppercase font-mono">Synapse</h1>
          <nav className="flex gap-6 ml-4">
            <span className={cn("text-xs font-black uppercase cursor-pointer px-2 py-1 rounded transition-colors hover:text-indigo-600", view === 'workspace' ? "text-indigo-600 bg-indigo-50" : "text-gray-400")} onClick={() => setView('workspace')}>워크스페이스</span>
            <span className={cn("text-xs font-black uppercase cursor-pointer px-2 py-1 rounded transition-colors hover:text-indigo-600", view === 'grid' ? "text-indigo-600 bg-indigo-50" : "text-gray-400")} onClick={() => setView('grid')}>지식 아카이브</span>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-gray-100 rounded-lg px-3 py-1.5 border border-gray-200 w-72 items-center">
            <span className="text-[10px] bg-gray-200 px-1.5 py-0.5 rounded text-gray-500 mr-2 font-bold">검색</span>
            <input type="text" placeholder="저장된 지식 검색..." className="bg-transparent text-xs outline-none w-full" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
          <div className="w-8 h-8 rounded-xl bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 font-black text-[10px]">SYN</div>
        </div>
      </header>
      <main className="flex flex-1 overflow-hidden relative">
        {view === 'grid' ? (
          <div className="w-full h-full p-10 overflow-y-auto custom-scrollbar">
            <KnowledgeGrid 
              documents={documents} 
              onOpenDoc={handleOpenDoc} 
              onUpload={handleUpload}
              searchQuery={searchQuery} 
            />
          </div>
        ) : (
          <div className="w-full h-full flex">
            <Workspace 
              documents={documents} 
              initialDoc={selectedDoc} 
              onDelete={deleteDocument} 
              onImportComplete={() => setSelectedDoc(null)}
              masterNotes={masterNotes}
              setMasterNotes={setMasterNotes}
              currentMasterNoteId={currentMasterNoteId}
              setCurrentMasterNoteId={setCurrentMasterNoteId}
            />
          </div>
        )}
      </main>
      <footer className="h-10 bg-white border-t border-gray-200 flex items-center px-4 justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
           <div className="flex gap-1.5">
             <div className={cn("w-1.5 h-1.5 rounded-full transition-all", view === 'workspace' ? "bg-indigo-600 shadow-[0_0_8px_rgba(79,70,229,0.8)] scale-125" : "bg-gray-300")}></div>
             <div className="w-1.5 h-1.5 bg-gray-300 rounded-full"></div>
           </div>
           <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">상태: {selectedDoc ? '지능형 지식 분석 중: ' + selectedDoc.title : '시스템 대기 중'}</span>
        </div>
        <div className="flex gap-4 items-center">
          <span className="text-[9px] text-emerald-500 font-black uppercase flex items-center gap-1.5 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
            <span className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse"></span>AI 엔진 가동 중
          </span>
          <span className="text-[10px] text-gray-400 font-bold px-2 py-0.5 border border-gray-100 rounded">V2.1.0</span>
        </div>
      </footer>
    </div>
  );
}
