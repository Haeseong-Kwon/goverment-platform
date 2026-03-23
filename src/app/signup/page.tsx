"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/common/Button";
import { Mail, Lock, User, ChevronRight, Loader2, Sparkles } from "lucide-react";
import { m, LazyMotion, domAnimation } from "framer-motion";
import { getCurrentUser, signUp } from "@/lib/services/AuthService";

const DEFAULT_SITE_URL = "https://swcapstone.vercel.app";

export default function SignupPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [fullName, setFullName] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [checkingSession, setCheckingSession] = useState(true);

    useEffect(() => {
        const checkSession = async () => {
            const user = await getCurrentUser();
            if (user) {
                router.replace("/dashboard");
                return;
            }
            setCheckingSession(false);
        };

        checkSession();
    }, [router]);

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const emailRedirectTo =
                `${process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL}/auth/callback`;
            await signUp(email, password, fullName, emailRedirectTo);
            alert("회원가입이 완료되었습니다. 이메일 인증 링크를 눌러 가입을 완료해 주세요.");
            router.push("/login");
        } catch (err: any) {
            setError(err.message || "회원가입에 실패했습니다.");
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
            <div className="absolute top-0 left-0 w-[50%] h-[100%] bg-primary/5 dark:bg-blue-500/5 skew-x-12 -translate-x-1/4 pointer-events-none"></div>
            <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-[150px] translate-x-1/2 -translate-y-1/2 animate-blob"></div>
            
            {/* Right Section: Branding/Intro (Flipped for Signup) */}
            <div className="hidden lg:flex flex-col justify-center px-20 w-1/2 relative z-10 order-2">
                <div className="max-w-md space-y-10 ml-auto text-right">
                    <Link href="/" className="inline-flex items-center gap-3 group">
                        <span className="text-xs font-bold tracking-[0.4em] uppercase opacity-60 text-right">Join the Ecosystem</span>
                        <div className="w-[1px] h-8 bg-slate-200 dark:bg-white/20"></div>
                        <span className="text-4xl font-black tracking-tighter">AOP</span>
                    </Link>
                    
                    <div className="space-y-6">
                        <h1 className="text-[56px] font-black leading-[1.05] tracking-tightest">
                            Start Your <br />
                            <span className="text-primary italic">Journey Today.</span>
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 font-bold text-lg leading-relaxed">
                            AOP와 함께 당신의 창업 꿈을 현실로 만드세요. <br />
                            동료들과 협업하고, 프로젝트를 성장시키세요.
                        </p>
                    </div>

                    <div className="flex justify-end gap-4 pt-8">
                        <div className="p-6 rounded-3xl border border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5 text-left min-w-[200px]">
                            <Sparkles className="text-primary mb-3" size={20} />
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Benefit</p>
                            <p className="text-[15px] font-black uppercase text-slate-900 dark:text-white">Seamless Sync</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Left Section: Signup Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-6 relative z-10 order-1">
                <LazyMotion features={domAnimation}>
                    <m.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="w-full max-w-[480px] space-y-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl p-10 sm:p-14 rounded-[3rem] border border-slate-200 dark:border-white/10 shadow-[0_32px_120px_rgba(0,0,0,0.08)]"
                    >
                        <div className="space-y-3">
                            <h2 className="text-3xl font-black uppercase tracking-tighter">Create Account</h2>
                            <p className="text-slate-500 font-bold text-sm tracking-tight">AOP 플랫폼의 새로운 일원이 되어보세요.</p>
                        </div>

                        <form onSubmit={handleSignup} className="space-y-6">
                            <div className="space-y-5">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-primary uppercase tracking-[0.2em] ml-1">Full Name</label>
                                    <div className="relative group">
                                        <User className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={20} />
                                        <input 
                                            required
                                            type="text" 
                                            value={fullName}
                                            onChange={(e) => setFullName(e.target.value)}
                                            placeholder="홍길동"
                                            className="w-full h-16 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-white/5 rounded-2xl pl-16 pr-6 font-bold text-slate-900 dark:text-white focus:ring-4 focus:ring-primary/10 transition-all outline-none"
                                        />
                                    </div>
                                </div>

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
                                    <label className="text-[10px] font-black text-primary uppercase tracking-[0.2em] ml-1">Password</label>
                                    <div className="relative group">
                                        <Lock className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={20} />
                                        <input 
                                            required
                                            type="password" 
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder="•••••••• (Min 6 characters)"
                                            minLength={6}
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
                                        Complete Enrollment <ChevronRight size={20} />
                                    </span>
                                )}
                            </Button>
                        </form>

                        <div className="pt-8 border-t border-slate-100 dark:border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
                            <p className="text-[12px] font-bold text-slate-500">이미 계정이 있으신가요?</p>
                            <Link href="/login">
                                <Button variant="ghost" className="text-[11px] font-black uppercase tracking-widest text-primary hover:bg-primary/5 rounded-xl">
                                    Sign In Instead
                                </Button>
                            </Link>
                        </div>
                    </m.div>
                </LazyMotion>
            </div>
        </main>
    );
}
