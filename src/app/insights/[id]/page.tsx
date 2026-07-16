"use client";

import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { MOCK_INSIGHTS } from "@/constants/mockData";
import { Badge } from "@/components/common/Badge";
import { Calendar, Clock, ArrowLeft, Share2, Bookmark, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function InsightDetailPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        window.scrollTo(0, 0);
    }, [id]);

    const article = MOCK_INSIGHTS.find(a => a.id === id) || MOCK_INSIGHTS[0];

    if (!mounted) return null;

    return (
        <main className="min-h-screen bg-white dark:bg-slate-900 pb-20">
            {/* Navigation Header */}
            <div className="sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
                <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
                    <button 
                        onClick={() => router.back()}
                        className="flex items-center gap-2 text-sm font-bold text-slate-600 dark:text-slate-400 hover:text-primary dark:hover:text-blue-400 transition-colors"
                    >
                        <ArrowLeft size={18} />
                        목록으로 돌아가기
                    </button>
                    <div className="flex items-center gap-4">
                        <button className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                            <Share2 size={20} />
                        </button>
                        <button className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                            <Bookmark size={20} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Hero Section */}
            <article className="animate-slide-up">
                <header className="max-w-5xl mx-auto px-6 pt-16 pb-12">
                    <div className="flex items-center gap-3 mb-6">
                        <Badge variant="primary" className="bg-primary text-white px-4 py-1.5 text-xs tracking-widest border-none shadow-md">
                            {article.category}
                        </Badge>
                        <span className="flex items-center gap-1.5 text-xs font-bold text-slate-400 dark:text-slate-500 tracking-wider">
                            <Clock size={14} /> {article.readTime}
                        </span>
                    </div>
                    
                    <h1 className="text-4xl md:text-6xl font-black text-slate-900 dark:text-slate-50 leading-[1.1] tracking-tighter mb-8 bg-clip-text text-transparent bg-gradient-to-br from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">
                        {article.title}
                    </h1>

                    <div className="flex items-center justify-between border-y border-slate-100 dark:border-slate-800 py-8">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center border border-slate-200 dark:border-slate-700">
                                <span className="text-lg font-black text-slate-400 uppercase">{article.author.charAt(0)}</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-sm font-black text-slate-900 dark:text-slate-50 tracking-tight">{article.author}</span>
                                <span className="text-xs font-bold text-slate-400 tracking-wider uppercase">에리카 창업지원단</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                            <Calendar size={14} /> {article.date}
                        </div>
                    </div>
                </header>

                {/* Featured Image */}
                <div className="max-w-6xl mx-auto px-6 mb-16 px-4 md:px-10">
                    <div className="relative aspect-[21/9] rounded-[2rem] overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800">
                        <Image
                            src={article.thumbnailUrl}
                            alt={article.title}
                            fill
                            className="object-cover"
                            priority
                        />
                    </div>
                </div>

                {/* Article Content */}
                <div className="max-w-3xl mx-auto px-6">
                    <div className="prose prose-slate dark:prose-invert prose-lg max-w-none">
                        <p className="text-xl font-bold text-slate-700 dark:text-slate-300 leading-relaxed mb-10 border-l-4 border-primary pl-6 py-2">
                            {article.excerpt}
                        </p>
                        
                        <div className="space-y-8 text-slate-600 dark:text-slate-400 font-medium leading-loose text-lg">
                            <p>
                                스타트업 생태계에서 정보는 곧 기회입니다. 특히 초기 창업자들에게 있어 올바른 방향성을 제시하는 인사이트는 성공과 실패를 가르는 중요한 지표가 됩니다. 본 아티클에서는 {article.author}의 관점에서 바라본 시장의 흐름과 실전적인 노하우를 공유합니다.
                            </p>
                            
                            <h2 className="text-3xl font-black text-slate-900 dark:text-slate-50 tracking-tight mt-16 mb-8 uppercase">핵심 전략 포인트</h2>
                            
                            <p>
                                대부분의 초기 창업팀이 겪는 공통적인 문제는 리소스의 비효율적 배분입니다. 한정된 자원 속에서 시장의 검증을 빠르게 받아내는 것이 무엇보다 중요합니다. 이를 위해 우리는 다음과 같은 세 가지 핵심 원칙을 제안합니다.
                            </p>

                            <ul className="space-y-4 list-none pl-0 mt-8">
                                <li className="flex gap-4 p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                                    <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center shrink-0 font-black text-sm">1</div>
                                    <div>
                                        <h4 className="font-black text-slate-900 dark:text-slate-50 mb-1">데이터 기반의 의사결정</h4>
                                        <p className="text-sm">직관에 의존하기보다 실제 사용자 지표와 시장 반응을 수치화하여 분석하세요.</p>
                                    </div>
                                </li>
                                <li className="flex gap-4 p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                                    <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center shrink-0 font-black text-sm">2</div>
                                    <div>
                                        <h4 className="font-black text-slate-900 dark:text-slate-50 mb-1">애자일한 실행과 피드백 루프</h4>
                                        <p className="text-sm">완벽함을 기다리기보다 빠르게 실행하고 고객의 소리를 비즈니스에 즉시 반영하세요.</p>
                                    </div>
                                </li>
                                <li className="flex gap-4 p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                                    <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center shrink-0 font-black text-sm">3</div>
                                    <div>
                                        <h4 className="font-black text-slate-900 dark:text-slate-50 mb-1">명확한 문제 정의와 솔루션 매칭</h4>
                                        <p className="text-sm">우리가 해결하려는 문제가 무엇인지, 그리고 우리의 솔루션이 그 문제를 어떻게 해결하는지 끊임없이 자문해야 합니다.</p>
                                    </div>
                                </li>
                            </ul>

                            <p className="mt-12">
                                결론적으로 스타트업은 끊임없는 가설 검증의 과정입니다. 이 과정에서 얻어지는 인사이트는 단순한 정보가 아니라 팀의 핵심 자산이 됩니다. {article.title}를 통해 여러분의 비즈니스가 한 단계 더 도약할 수 있기를 바랍니다.
                            </p>
                        </div>
                    </div>

                    {/* Tags Section */}
                    <div className="mt-20 pt-10 border-t border-slate-100 dark:border-slate-800">
                        <div className="flex flex-wrap gap-2">
                            {["Startup", "AOP", "Hanyang", "Insight", "Innovation"].map(tag => (
                                <span key={tag} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-full text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-primary transition-colors cursor-pointer">
                                    # {tag}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Author Footer */}
                    <div className="mt-16 p-10 bg-slate-50 dark:bg-slate-800/20 border border-slate-200 dark:border-slate-700 rounded-[2.5rem] flex flex-col md:flex-row items-center gap-8">
                        <div className="w-24 h-24 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0 border-4 border-white dark:border-slate-800 shadow-xl overflow-hidden">
                             <span className="text-3xl font-black text-slate-400 uppercase">{article.author.charAt(0)}</span>
                        </div>
                        <div className="text-center md:text-left">
                            <h4 className="text-xl font-black text-slate-900 dark:text-slate-50 mb-2 leading-none">{article.author}</h4>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
                                스타트업 생태계의 다양한 목소리를 전달하고, 창업자들에게 영감을 주는 흥미로운 이야기를 기록합니다.
                            </p>
                            <Link 
                                href="/insights/all"
                                className="px-6 py-2.5 bg-slate-900 dark:bg-slate-50 text-white dark:text-slate-900 rounded-xl font-bold text-sm hover:scale-105 transition-transform inline-block"
                            >
                                아티클 전체보기
                            </Link>
                        </div>
                    </div>
                </div>
            </article>

            {/* Related Articles */}
            <section className="max-w-5xl mx-auto px-6 mt-32">
                <div className="flex items-center justify-between mb-10">
                    <h3 className="text-3xl font-black text-slate-900 dark:text-slate-50 tracking-tighter uppercase">Next Reading</h3>
                    <Link href="/insights" className="text-sm font-bold text-primary dark:text-blue-400 flex items-center gap-1">
                        전체보기 <ChevronRight size={16} />
                    </Link>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {MOCK_INSIGHTS.filter(a => a.id !== id).slice(0, 2).map((a) => (
                        <Link key={a.id} href={`/insights/${a.id}`} className="group block space-y-4">
                            <div className="relative aspect-[16/9] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
                                <Image src={a.thumbnailUrl} alt={a.title} fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
                            </div>
                            <div>
                                <h4 className="text-xl font-black text-slate-900 dark:text-slate-50 group-hover:text-primary dark:group-hover:text-blue-400 transition-colors line-clamp-1">
                                    {a.title}
                                </h4>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">{a.category}</p>
                            </div>
                        </Link>
                    ))}
                </div>
            </section>
        </main>
    );
}
