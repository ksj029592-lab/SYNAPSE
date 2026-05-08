import { useState, useEffect } from 'react';
import { FileText, Youtube, Globe, Plus, Search, Trash2, Zap } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { Document } from '../types';
import { supabase } from '../lib/supabase';
import { summarizeDocument, generateEmbedding } from '../lib/gemini';
import * as pdfjs from 'pdfjs-dist';

// Configure PDF.js worker safely
const PDFJS_VERSION = '4.10.38'; // Fallback version if version property is missing
try {
  const version = (pdfjs as any).version || PDFJS_VERSION;
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.mjs`;
} catch (e) {
  console.error('Failed to set PDF.js worker path', e);
}

interface KnowledgeGridProps {
  onOpenDoc: (doc: Document) => void;
  searchQuery: string;
}

export default function KnowledgeGrid({ onOpenDoc, searchQuery }: KnowledgeGridProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'pdf' | 'youtube' | 'web'>('all');

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (data) setDocuments(data);
  };

  const onDrop = async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setIsUploading(true);
    try {
      let content = '';
      if (file.type === 'application/pdf') {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjs.getDocument(arrayBuffer).promise;
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

      const { summary, keywords } = await summarizeDocument(content);
      const embedding = await generateEmbedding(content);

      const { data, error } = await supabase.from('documents').insert({
        title: file.name,
        content,
        type: 'pdf',
        summary,
        keywords,
        embedding
      }).select().single();

      if (data) {
        setDocuments([data, ...documents]);
        onOpenDoc(data);
      }
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: { 'application/pdf': ['.pdf'], 'text/plain': ['.txt'] }
  });

  const filteredDocs = documents.filter(doc => {
    const matchesSearch = doc.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          doc.keywords.some(k => k.toLowerCase().includes(searchQuery.toLowerCase()));
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
          {([['all', '전체'], ['pdf', '문서'], ['youtube', '미디어'], ['web', '웹 링크']] as const).map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-5 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-md transition-all ${
                activeTab === tab ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Upload Card */}
        <div 
          {...getRootProps()} 
          className={`aspect-[4/3] border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all ${
            isDragActive ? 'border-indigo-500 bg-indigo-50 scale-[0.98]' : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
          }`}
        >
          <input {...getInputProps()} />
          <div className="w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 mb-4 shadow-inner">
            {isUploading ? (
              <Zap className="w-6 h-6 animate-pulse" />
            ) : (
              <Plus className="w-6 h-6" />
            )}
          </div>
          <span className="text-sm font-black text-slate-700 tracking-tight">
            {isUploading ? '문서 분석 중...' : 'PDF 또는 텍스트 드롭'}
          </span>
          <span className="text-[10px] text-gray-400 mt-1 uppercase font-bold tracking-widest text-center">PDF, TXT 파일 지원</span>
        </div>

        {/* Document Cards */}
        {filteredDocs.map((doc) => (
          <div
            key={doc.id}
            onClick={() => onOpenDoc(doc)}
            className="group aspect-[4/3] bg-white border border-gray-200 rounded-3xl p-7 flex flex-col cursor-pointer hover:shadow-xl hover:shadow-indigo-500/10 hover:-translate-y-1 hover:border-indigo-100 transition-all"
          >
            <div className="flex items-center justify-between mb-5">
              <div className="p-2.5 bg-gray-50 rounded-xl group-hover:bg-indigo-50 transition-colors shadow-sm">
                {doc.type === 'pdf' ? <FileText className="w-5 h-5 text-red-500" /> : 
                 doc.type === 'youtube' ? <Youtube className="w-5 h-5 text-red-600" /> : 
                 <Globe className="w-5 h-5 text-blue-500" />}
              </div>
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                {new Date(doc.created_at).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
              </span>
            </div>
            
            <h3 className="text-base font-black text-slate-800 line-clamp-2 mb-3 leading-tight group-hover:text-indigo-600 transition-colors tracking-tight">
              {doc.title}
            </h3>
            
            <p className="text-xs text-gray-400 line-clamp-3 leading-relaxed mb-4 font-medium">
              {doc.summary ? doc.summary[0] : '내용 스캔 중...'}
            </p>

            <div className="mt-auto flex flex-wrap gap-1.5">
              {doc.keywords?.slice(0, 3).map((tag, i) => (
                <span key={i} className="text-[9px] px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full font-black uppercase border border-gray-200">
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
