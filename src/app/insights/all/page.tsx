"use client";

import { MOCK_INSIGHTS } from "@/constants/mockData";
import { Badge } from "@/components/common/Badge";
import { Clock, ChevronRight, Search, ArrowLeft } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useState, useMemo } from "react";

export default function InsightsAllPage() {
    const [searchQuery, setSearchQuery] = useState("");

    const filteredArticles = useMemo(() => {
        return MOCK_INSIGHTS.filter(article => 
            article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            article.excerpt.toLowerCase().includes(searchQuery.toLowerCase()) ||
            article.category.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [searchQuery]);

    return (
        <main className="min-h-screen bg-white dark:bg-slate-900 pb-20">
            {/* Header Hero Area */}
            <div className="bg-slate-50 dark:bg-slate-800/20 pt-32 pb-20 px-6 border-b border-slate-200 dark:border-slate-800">
                <div className="max-w-6xl mx-auto">
                    <Link 
                        href="/insights" 
                        className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-primary transition-colors mb-8"
                    >
                        <ArrowLeft size={16} /> 인사이트 메인으로
                    </Link>
                    <h1 className="text-4xl md:text-6xl font-black text-slate-900 dark:text-white tracking-tighter mb-6 uppercase">
                        Archive: <span className="opacity-40 italic font-medium">All Articles</span>
                    </h1>
                    <p className="text-slate-600 dark:text-slate-400 font-medium text-lg max-w-2xl mb-12">
                        창업 생태계의 모든 지식과 가이드를 한곳에서 만나보세요. 
                        원하시는 주제를 검색하거나 전체 목록을 훑어보실 수 있습니다.
                    </p>

                    {/* Simple Searchbar */}
                    <div className="relative max-w-2xl">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        <input
                            type="text"
                            placeholder="아티클 제목, 내용, 태그 검색..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full h-14 pl-14 pr-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:border-primary transition-colors font-bold text-slate-900 dark:text-white"
                        />
                    </div>
                </div>
            </div>

            {/* List View Container */}
            <div className="max-w-6xl mx-auto px-6 py-20">
                {filteredArticles.length > 0 ? (
                    <div className="space-y-1">
                        {filteredArticles.map((article, index) => (
                            <Link 
                                key={article.id} 
                                href={`/insights/${article.id}`}
                                className="group flex flex-col md:flex-row items-start md:items-center gap-6 md:gap-12 p-8 border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors animate-slide-up"
                                style={{ animationDelay: `${index * 0.05}s` }}
                            >
                                {/* Date Area */}
                                <div className="hidden md:flex flex-col items-start w-32 shrink-0">
                                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{article.date.split('.')[0]}</span>
                                    <span className="text-xl font-black text-slate-900 dark:text-white">{article.date.split('.')[1]}.{article.date.split('.')[2]}</span>
                                </div>

                                {/* Thumbnail (Small List Style) */}
                                <div className="relative w-full md:w-48 aspect-[16/10] md:aspect-square rounded-2xl overflow-hidden shrink-0 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                    <Image 
                                        src={article.thumbnailUrl} 
                                        alt={article.title} 
                                        fill 
                                        className="object-cover group-hover:scale-110 transition-transform duration-500"
                                    />
                                    <div className="absolute top-3 left-3 md:hidden">
                                         <Badge variant="primary" className="bg-primary text-white text-[9px] px-2 py-0.5 border-none">{article.category}</Badge>
                                    </div>
                                </div>

                                {/* Content Area */}
                                <div className="flex-grow space-y-3">
                                    <div className="hidden md:block">
                                        <Badge variant="default" className="text-[10px] font-black tracking-widest uppercase py-0.5 px-2 border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400">
                                            {article.category}
                                        </Badge>
                                    </div>
                                    <h3 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white group-hover:text-primary transition-colors leading-tight tracking-tight">
                                        {article.title}
                                    </h3>
                                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium line-clamp-1 md:line-clamp-2 max-w-3xl">
                                        {article.excerpt}
                                    </p>
                                    <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest pt-2">
                                        <span className="flex items-center gap-1"><Clock size={12} /> {article.readTime}</span>
                                        <span className="md:hidden">• {article.date}</span>
                                        <span>• BY {article.author}</span>
                                    </div>
                                </div>

                                {/* Arrow Icon */}
                                <div className="hidden md:flex w-12 h-12 rounded-full border border-slate-200 dark:border-slate-700 items-center justify-center text-slate-300 group-hover:border-primary group-hover:text-primary transition-all group-hover:translate-x-2">
                                    <ChevronRight size={20} />
                                </div>
                            </Link>
                        ))}
                    </div>
                ) : (
                    <div className="py-40 text-center space-y-6">
                        <div className="text-6xl opacity-20">🔎</div>
                        <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">No results found</h3>
                        <p className="text-slate-500 font-medium">다른 검색어를 입력해 보시거나 철자를 확인해 주세요.</p>
                        <button 
                            onClick={() => setSearchQuery("")}
                            className="px-8 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold hover:scale-105 transition-transform"
                        >
                            전체보기 초기화
                        </button>
                    </div>
                )}
            </div>
            
            {/* Simple Footer Text */}
            <div className="max-w-6xl mx-auto px-6 pt-10 text-center opacity-30">
                <p className="text-xs font-bold uppercase tracking-widest select-none">AOP INSIGHT ARCHIVE • UPDATED WEEKLY</p>
            </div>
        </main>
    );
}
