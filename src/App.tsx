/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { cn } from './lib/utils';
import { Document } from './types';
import Workspace from './components/Workspace';
import KnowledgeGrid from './components/KnowledgeGrid';

export default function App() {
  const [view, setView] = useState<'grid' | 'workspace'>('grid');
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const handleOpenDoc = (doc: Document) => {
    setSelectedDoc(doc);
    setView('workspace');
  };

  return (
    <div className="flex flex-col h-screen w-full bg-gray-50 font-sans text-slate-900 overflow-hidden">
      {/* Troubleshooting Indicator (Hidden in production) */}
      <div className="sr-only">Synapse v1.0.0 Initialized</div>
      
      {/* Header Navigation */}
      <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0 z-50">
        <div className="flex items-center gap-4">
          <div 
            className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center cursor-pointer shadow-indigo-200 shadow-lg" 
            onClick={() => setView('grid')}
          >
            <div className="w-4 h-4 border-2 border-white rounded-full"></div>
          </div>
          <h1 className="text-lg font-black tracking-tighter text-slate-800 uppercase font-mono">Synapse</h1>
          <div className="h-4 w-px bg-gray-300 mx-2"></div>
          <nav className="flex gap-6">
            <span 
              className={cn("text-xs font-black uppercase tracking-widest cursor-pointer transition-colors px-2 py-1 rounded", view === 'workspace' ? "text-indigo-600 bg-indigo-50" : "text-gray-400 hover:text-gray-800")}
              onClick={() => setView('workspace')}
            >
              워크스페이스
            </span>
            <span 
              className={cn("text-xs font-black uppercase tracking-widest cursor-pointer transition-colors px-2 py-1 rounded", view === 'grid' ? "text-indigo-600 bg-indigo-50" : "text-gray-400 hover:text-gray-800")}
              onClick={() => setView('grid')}
            >
              지식 아카이브
            </span>
          </nav>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex bg-gray-100 rounded-lg px-3 py-1.5 border border-gray-200 w-72 items-center focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
            <span className="text-[10px] bg-gray-200 px-1.5 py-0.5 rounded text-gray-500 mr-2 font-mono font-bold">검색</span>
            <input 
              type="text" 
              placeholder="저장된 지식 검색..." 
              className="bg-transparent text-xs outline-none w-full placeholder:text-gray-400 font-medium"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="w-8 h-8 rounded-xl bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 font-black text-[10px]">
            SYN
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex flex-1 overflow-hidden relative">
        {view === 'grid' ? (
          <div className="w-full h-full p-10 overflow-y-auto custom-scrollbar">
            <KnowledgeGrid onOpenDoc={handleOpenDoc} searchQuery={searchQuery} />
          </div>
        ) : (
          <div className="w-full h-full flex">
            <Workspace doc={selectedDoc} />
          </div>
        )}
      </main>

      {/* Bottom Footer Overlay Style */}
      <footer className="h-10 bg-white border-t border-gray-200 flex items-center px-4 justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
           <div className="flex gap-1.5">
             <div className={cn("w-1.5 h-1.5 rounded-full transition-all", view === 'workspace' ? "bg-indigo-600 shadow-[0_0_8px_rgba(79,70,229,0.8)] scale-125" : "bg-gray-300")}></div>
             <div className="w-1.5 h-1.5 bg-gray-300 rounded-full"></div>
           </div>
           <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
             상태: {selectedDoc ? '지능형 지식 분석 중: ' + selectedDoc.title : '시스템 대기 중'}
           </span>
        </div>
        <div className="flex gap-4 items-center">
          <span className="text-[9px] text-emerald-500 font-black uppercase tracking-widest flex items-center gap-1.5 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
            <span className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse"></span>
            AI 엔진 가동 중
          </span>
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest px-2 py-0.5 border border-gray-100 rounded">V2.1.0</span>
        </div>
      </footer>
    </div>
  );
}
