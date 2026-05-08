import { useState, useEffect } from 'react';
import { Send, Zap, MessageSquare, StickyNote, Link as LinkIcon } from 'lucide-react';
import { Document, SearchResult } from '../../types';
import { ai, MODELS } from '../../lib/gemini';
import { supabase } from '../../lib/supabase';
import NoteEditor from './NoteEditor';

interface AiWorkspaceProps {
  doc: Document;
}

export default function AiWorkspace({ doc }: AiWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<'chat' | 'notes' | 'links'>('notes');
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [relatedDocs, setRelatedDocs] = useState<SearchResult[]>([]);

  useEffect(() => {
    fetchRelatedContent();
  }, [doc.id]);

  const fetchRelatedContent = async () => {
    if (!doc.embedding) return;
    
    const { data, error } = await supabase.rpc('match_documents', {
      query_embedding: doc.embedding,
      match_threshold: 0.5,
      match_count: 5
    });

    if (data) {
      setRelatedDocs(data.filter((r: any) => r.id !== doc.id));
    }
  };

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    const userMsg = { role: 'user' as const, content: inputValue };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputValue('');

    try {
      const response = await ai.models.generateContent({
        model: MODELS.FLASH,
        contents: `Context: ${doc.content.substring(0, 5000)}\n\nQuestion: ${inputValue}`
      });
      const assistantMsg = { role: 'assistant' as const, content: response.text || '' };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white relative">
      {/* AI Tabs */}
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
                <p className="text-[13px] text-white leading-relaxed font-black mb-3">
                  안녕하세요, 시냅스 코어입니다. ⚡️
                </p>
                <p className="text-[11px] text-indigo-100 leading-relaxed font-medium">
                  현재 선택된 <strong>{doc.title}</strong> 노드로부터 심층 통찰을 추출할 준비가 되었습니다. 문서의 핵심 논리나 다른 지식과의 상관관계에 대해 무엇이든 질문해 주세요.
                </p>
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

        {activeTab === 'notes' && (
          <NoteEditor doc={doc} />
        )}

        {activeTab === 'links' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">유사 지식 노드</h4>
              <span className="text-[9px] text-indigo-600 font-black cursor-pointer hover:underline uppercase tracking-tighter">전체 지식 맵 보기</span>
            </div>
            <div className="grid grid-cols-1 gap-4">
              {relatedDocs.length > 0 ? relatedDocs.map((item) => (
                <div key={item.id} className="p-5 bg-gray-50 border border-gray-200 rounded-2xl group hover:border-indigo-300 hover:bg-white hover:shadow-xl hover:shadow-indigo-500/5 cursor-pointer transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[10px] text-indigo-600 font-black uppercase tracking-tighter bg-indigo-50 px-2 py-0.5 rounded">
                      {Math.round(item.similarity * 100)}% 일치
                    </div>
                    <Zap className="w-4 h-4 text-emerald-500 fill-current" />
                  </div>
                  <div className="text-xs font-black text-slate-800 mb-2 group-hover:text-indigo-600 transition-colors leading-snug">{item.title}</div>
                  <div className="text-[9px] text-slate-400 font-medium uppercase tracking-tight">내 지식 라이브러리에 저장된 관련 참조 내용이 있습니다.</div>
                </div>
              )) : (
                <div className="text-center py-12">
                   <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-inner">
                     <LinkIcon className="w-5 h-5 text-gray-300" />
                   </div>
                   <p className="text-[11px] text-slate-400 font-bold uppercase tracking-tight leading-relaxed px-8">아직 발견된 의미적 중첩 지식이 없습니다.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {activeTab === 'chat' && (
        <div className="p-5 border-t border-gray-100 bg-white">
          <div className="flex items-center gap-3 bg-gray-50 p-2.5 rounded-2xl border border-gray-200 shadow-inner group focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
            <input 
              type="text" 
              placeholder="내 지식 베이스에 물어보세요..." 
              className="bg-transparent text-[13px] flex-1 outline-none px-3 font-medium placeholder:text-gray-400"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            />
            <button 
              onClick={handleSend}
              className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
