"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/common/Button";
import { Mail, Lock, ChevronRight, Loader2, Rocket, ArrowRight } from "lucide-react";
import { m, LazyMotion, domAnimation } from "framer-motion";
import { getCurrentUser, signIn } from "@/lib/services/AuthService";
import { getStartupProfile, resolveWorkspaceDestination } from "@/lib/services/WorkspaceService";

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [checkingSession, setCheckingSession] = useState(true);

    useEffect(() => {
        const checkSession = async () => {
            const user = await getCurrentUser();
            if (user) {
                const profile = await getStartupProfile();
                router.replace(profile ? resolveWorkspaceDestination(profile) : "/workspace-entry");
                return;
            }
            setCheckingSession(false);
        };

        checkSession();
    }, [router]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            await signIn(email, password);
            const profile = await getStartupProfile();
            router.push(profile ? resolveWorkspaceDestination(profile) : "/workspace-entry");
        } catch (err: any) {
            setError(err.message || "로그인에 실패했습니다.");
        } finally {
            setLoading(false);
        }
    };

    if (checkingSession) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-white dark:bg-slate-950">
                <Loader2 className="animate-spin text-primary" size={32} />
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-white dark:bg-slate-950 flex relative overflow-hidden">
            {/* Background Decorations */}
            <div className="absolute top-0 right-0 w-[50%] h-[100%] bg-primary/5 dark:bg-blue-500/5 -skew-x-12 translate-x-1/4 pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-primary/10 rounded-full blur-[150px] -translate-x-1/2 translate-y-1/2 animate-blob"></div>
            
            {/* Left Section: Branding/Intro */}
            <div className="hidden lg:flex flex-col justify-center px-20 w-1/2 relative z-10">
                <div className="max-w-md space-y-10">
                    <Link href="/" className="inline-flex items-center gap-3 group">
                        <span className="text-4xl font-black tracking-tighter">AOP</span>
                        <div className="w-[1px] h-8 bg-slate-200 dark:bg-white/20"></div>
                        <span className="text-xs font-bold tracking-[0.4em] uppercase opacity-60">Auth Gateway</span>
                    </Link>
                    
                    <div className="space-y-6">
                        <h1 className="text-[56px] font-black leading-[1.05] tracking-tightest">
                            Empowering <br />
                            <span className="text-primary italic">Next Unicorns.</span>
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 font-bold text-lg leading-relaxed">
                            당신의 아이디어가 비즈니스가 되는 곳. <br />
                            AOP 통합 창업 플랫폼에 오신 것을 환영합니다.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-8">
                        {[
                            { label: "Team Build", value: "Smart Matching", icon: <Rocket size={20} /> },
                            { label: "Success Rate", value: "85%+", icon: <ArrowRight size={20} /> }
                        ].map((stat, i) => (
                            <div key={i} className="p-6 rounded-3xl border border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5">
                                <div className="text-primary mb-3">{stat.icon}</div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{stat.label}</p>
                                <p className="text-[15px] font-black uppercase text-slate-900 dark:text-white">{stat.value}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right Section: Login Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-6 relative z-10">
                <LazyMotion features={domAnimation}>
                    <m.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="w-full max-w-[480px] space-y-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl p-10 sm:p-14 rounded-[3rem] border border-slate-200 dark:border-white/10 shadow-[0_32px_120px_rgba(0,0,0,0.08)]"
                    >
                        <div className="space-y-3">
                            <h2 className="text-3xl font-black uppercase tracking-tighter">Login to AOP</h2>
                            <p className="text-slate-500 font-bold text-sm tracking-tight text-muted">등록된 이메일 계정으로 로그인해 주세요.</p>
                        </div>

                        <form onSubmit={handleLogin} className="space-y-6">
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-primary uppercase tracking-[0.2em] ml-1">Email Address</label>
                                    <div className="relative group">
                                        <Mail className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={20} />
                                        <input 
                                            required
                                            type="email" 
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="example@hanyang.ac.kr"
                                            className="w-full h-16 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-white/5 rounded-2xl pl-16 pr-6 font-bold text-slate-900 dark:text-white focus:ring-4 focus:ring-primary/10 transition-all outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex justify-between items-center ml-1">
                                        <label className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Password</label>
                                        <Link href="#" className="text-[10px] font-black text-slate-400 hover:text-primary transition-colors uppercase tracking-[0.15em]">Forgot Password?</Link>
                                    </div>
                                    <div className="relative group">
                                        <Lock className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={20} />
                                        <input 
                                            required
                                            type="password" 
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder="••••••••"
                                            className="w-full h-16 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-white/5 rounded-2xl pl-16 pr-6 font-bold text-slate-900 dark:text-white focus:ring-4 focus:ring-primary/10 transition-all outline-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            {error && (
                                <m.p 
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="text-red-500 text-xs font-bold bg-red-50 dark:bg-red-500/10 p-4 rounded-xl border border-red-100 dark:border-red-500/20"
                                >
                                    {error}
                                </m.p>
                            )}

                            <Button 
                                type="submit" 
                                disabled={loading}
                                className="w-full h-18 rounded-2xl bg-primary text-white font-black text-sm uppercase tracking-[0.25em] shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
                            >
                                {loading ? (
                                    <Loader2 className="animate-spin" />
                                ) : (
                                    <span className="flex items-center gap-3">
                                        Connect to Platform <ChevronRight size={20} />
                                    </span>
                                )}
                            </Button>
                        </form>

                        <div className="pt-8 border-t border-slate-100 dark:border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
                            <p className="text-[12px] font-bold text-slate-500">계정이 없으신가요?</p>
                            <Link href="/signup">
                                <Button variant="ghost" className="text-[11px] font-black uppercase tracking-widest text-primary hover:bg-primary/5 rounded-xl">
                                    Create New Account
                                </Button>
                            </Link>
                        </div>
                    </m.div>
                </LazyMotion>
            </div>
        </main>
    );
}
