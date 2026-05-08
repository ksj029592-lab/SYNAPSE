import { useState, useEffect } from 'react';
import { Sparkles, Terminal } from 'lucide-react';
import { Document } from '../../types';
import { getSmartInsight } from '../../lib/gemini';

interface NoteEditorProps {
  doc: Document;
}

export default function NoteEditor({ doc }: NoteEditorProps) {
  const [content, setContent] = useState('');
  const [insight, setInsight] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Debounced insight generation
  useEffect(() => {
    if (content.length < 20) {
      setInsight(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsAnalyzing(true);
      try {
        const text = await getSmartInsight(content, doc.content.substring(0, 5000));
        setInsight(text);
      } catch (error) {
        console.error(error);
      } finally {
        setIsAnalyzing(false);
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [content, doc.content]);

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-center justify-between px-2">
        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
          지식 합성 및 사유의 기록
          <div className="flex gap-1">
            <span className={isAnalyzing ? "w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" : "w-1.5 h-1.5 rounded-full bg-emerald-400"}></span>
          </div>
        </h4>
        <div className="flex gap-2">
          <button className="text-[10px] font-black text-indigo-400 hover:text-indigo-600 transition-colors uppercase bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100">영구 지식으로 기록</button>
        </div>
      </div>
      
      <div className="bg-slate-950 text-white rounded-3xl p-8 flex-1 shadow-2xl flex flex-col relative overflow-hidden group border border-slate-800">
        <div className="absolute top-6 right-6 text-slate-800 pointer-events-none group-focus-within:opacity-20 transition-opacity">
          <Terminal className="w-6 h-6" />
        </div>
        
        <textarea
          className="bg-transparent text-[13px] leading-relaxed text-slate-200 w-full flex-1 outline-none resize-none placeholder:text-slate-800 font-medium"
          placeholder="자료의 핵심을 관통하는 당신만의 통찰을 기록하세요. 인공지능이 사유의 확장을 실시간으로 지원합니다..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        
        {insight && (
          <div 
            className="mt-6 bg-indigo-950/90 border border-indigo-500/30 rounded-2xl p-5 backdrop-blur-xl shadow-2xl shadow-indigo-500/10"
          >
            <div className="flex items-start gap-4">
              <div className="w-6 h-6 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0 mt-0.5 shadow-lg shadow-indigo-600/20">
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
              <div>
                <p className="text-[11px] font-black text-indigo-300 uppercase mb-1.5 tracking-widest">시냅스 실시간 인사이트</p>
                <p className="text-[12px] text-indigo-50 leading-relaxed font-medium">
                  {insight}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
      
      <div className="flex items-center justify-between px-3">
        <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">글자 수: {content.length} / 단어 수: {content.split(/\s+/).filter(Boolean).length}</span>
        <span className="text-[10px] text-emerald-500 font-black uppercase tracking-widest flex items-center gap-1.5 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
          AI 라이브 분석 중
        </span>
      </div>
    </div>
  );
}
