import { Maximize2 } from 'lucide-react';
import { Document } from '../../types';

interface SourceViewerProps {
  doc: Document;
}

export default function SourceViewer({ doc }: SourceViewerProps) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase">
            {doc.type}
          </span>
          <h2 className="text-sm font-semibold truncate text-slate-800 max-w-[400px]">{doc.title}</h2>
        </div>
        <div className="flex gap-2">
          <button className="p-1.5 hover:bg-gray-200 rounded text-gray-500 transition-colors">
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {/* AI Summary Banner (High Density Style) */}
      <div className="p-6 bg-indigo-50/50 border-b border-indigo-100 flex-shrink-0 shadow-inner">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse"></div>
          <h3 className="text-xs font-black text-indigo-700 uppercase tracking-widest">AI 심층 분석 및 핵심 요약</h3>
        </div>
        <div className="space-y-2.5">
          {Array.isArray(doc.summary) ? doc.summary.map((line, i) => (
            <p key={i} className="text-[13px] text-slate-700 leading-relaxed font-bold">
              <span className="text-indigo-400 mr-2 opacity-50">{i + 1}.</span> {line}
            </p>
          )) : (
            <p className="text-[13px] text-slate-700 leading-relaxed font-bold">{doc.summary}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 mt-5">
          {doc.keywords?.map((tag, i) => (
            <span key={i} className="text-[10px] px-2.5 py-1 bg-white border border-indigo-200 text-indigo-600 rounded-lg uppercase font-black tracking-tight shadow-sm hover:bg-indigo-50 transition-colors cursor-default">
              #{tag}
            </span>
          ))}
        </div>
      </div>

      {/* Content Viewer Area */}
      <div className="flex-1 overflow-y-auto p-12 bg-gray-100/50 relative custom-scrollbar">
        <div className="max-w-2xl mx-auto bg-white shadow-2xl min-h-full p-16 flex flex-col gap-8 rounded-xl border border-gray-100">
          <h1 className="text-2xl font-black text-slate-900 leading-tight border-b-2 border-gray-100 pb-6">
            추출된 원본 컨텐츠
          </h1>
          <div className="prose prose-slate prose-sm max-w-none">
            {doc.content.split('\n').map((line, i) => (
              <p key={i} className="text-slate-600 leading-relaxed mb-4 text-[13px] font-semibold leading-loose">
                {line}
              </p>
            ))}
          </div>
          
          <div className="mt-8 p-6 border-l-4 border-indigo-400 bg-indigo-50/50 rounded-r-xl">
            <p className="text-[10px] text-indigo-800 italic uppercase font-black mb-2 tracking-widest">지능형 맥락 분석</p>
            <p className="text-xs text-slate-600 italic font-medium leading-relaxed">
              "본 문서는 현재 당신의 아카이브 내에서 다음 핵심 키워드와 매우 밀접한 상관관계를 형성하고 있습니다: {doc.keywords?.join(', ')}"
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
