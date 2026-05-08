import { useState, useEffect } from 'react';
import { BookOpen, Search, Plus, FileText, Youtube, Globe, ArrowRight } from 'lucide-react';
import { Document } from '../types';
import { supabase } from '../lib/supabase';
import SourceViewer from './viewer/SourceViewer';
import AiWorkspace from './chat/AiWorkspace';

interface WorkspaceProps {
  doc: Document | null;
}

export default function Workspace({ doc: initialDoc }: WorkspaceProps) {
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(initialDoc);
  const [library, setLibrary] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchLibrary();
  }, []);

  useEffect(() => {
    if (initialDoc) setSelectedDoc(initialDoc);
  }, [initialDoc]);

  const fetchLibrary = async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from('documents')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setLibrary(data);
    setIsLoading(false);
  };

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left Sidebar: Knowledge Library for multi-source pulling */}
      <aside className="w-64 border-r border-gray-200 flex flex-col bg-gray-50/50 flex-shrink-0">
        <div className="p-4 border-b border-gray-200 bg-white">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">학습 라이브러리</h3>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
            <input 
              type="text" 
              placeholder="자료 탐색..." 
              className="w-full bg-gray-100 border-none rounded-lg py-1.5 pl-8 pr-3 text-[11px] focus:ring-2 focus:ring-indigo-500/20 outline-none"
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
          {library.map((item) => (
            <button
              key={item.id}
              onClick={() => setSelectedDoc(item)}
              className={`w-full text-left p-2 rounded-lg transition-all group flex items-center gap-2 ${
                selectedDoc?.id === item.id 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : 'hover:bg-white text-slate-600'
              }`}
            >
              <div className={selectedDoc?.id === item.id ? 'text-white' : 'text-indigo-400'}>
                {item.type === 'pdf' ? <FileText size={14} /> : 
                 item.type === 'youtube' ? <Youtube size={14} /> : 
                 <Globe size={14} />}
              </div>
              <span className="text-[11px] font-bold truncate flex-1">{item.title}</span>
              <ArrowRight className={`w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity ${selectedDoc?.id === item.id ? 'text-white' : 'text-indigo-500'}`} />
            </button>
          ))}
          
          {library.length === 0 && !isLoading && (
            <div className="text-center py-8 px-4">
              <p className="text-[10px] text-gray-400 font-bold leading-tight uppercase">저장된 자료가 없습니다.</p>
            </div>
          )}
        </div>
      </aside>

      {/* Center: Source Analysis Area */}
      <section className="flex-1 border-r border-gray-200 flex flex-col bg-white overflow-hidden">
        {selectedDoc ? (
          <SourceViewer doc={selectedDoc} />
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50 p-12">
            <div className="text-center max-w-sm">
              <div className="w-16 h-16 bg-white shadow-sm rounded-2xl flex items-center justify-center mx-auto mb-6 border border-gray-100">
                <BookOpen className="w-8 h-8 text-indigo-400" />
              </div>
              <h3 className="text-lg font-black text-slate-800 mb-2">분석할 지식 노드를 선택하세요</h3>
              <p className="text-xs text-gray-500 font-medium leading-relaxed">
                좌측 라이브러리에서 자료를 선택하여 지식의 조직화를 시작하거나, 아카이브에서 새로운 정보를 수집하세요.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Right Pane: AI Synthesis & Final Notes */}
      <section className="w-[450px] flex flex-col h-full bg-white overflow-hidden">
        {selectedDoc ? (
          <AiWorkspace doc={selectedDoc} />
        ) : (
          <div className="flex-1 border-l border-gray-100 bg-gray-50/30"></div>
        )}
      </section>
    </div>
  );
}
