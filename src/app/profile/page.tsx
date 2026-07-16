"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SubPageHero } from "@/components/common/SubPageHero";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import {
    Mail,
    Award,
    Github,
    Settings,
    ChevronRight,
    Loader2,
    LogOut
} from "lucide-react";
import { getCurrentUser, signOut } from "@/lib/services/AuthService";
import { getProfileByUserId } from "@/lib/services/BoardServices";

export default function ProfilePage() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchUserData = async () => {
            try {
                const currentUser = await getCurrentUser();
                if (!currentUser) {
                    router.push("/login");
                    return;
                }
                setUser(currentUser);
                const userProfile = await getProfileByUserId(currentUser.id);
                setProfile(userProfile);
            } catch (error) {
                console.error("Error fetching profile data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchUserData();
    }, [router]);

    const handleLogout = async () => {
        await signOut();
        router.push("/");
    };

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
                <Loader2 className="animate-spin text-primary" size={48} />
                <p className="font-black uppercase tracking-[0.3em] text-xs text-muted">Syncing Identity...</p>
            </div>
        );
    }

    if (!user) return null;

    const displayName = profile?.full_name || user?.user_metadata?.full_name || "User";
    const displayEmail = user?.email || "No email provided";
    const displayBio = profile?.bio || "소프트웨어 창업을 준비 중인 학생입니다.";

    return (
        <main className="min-h-screen bg-background text-foreground transform-gpu">
            <SubPageHero
                title="My Identity"
                description={`${displayName} | ${profile?.role || 'Student'}. ${displayBio}`}
                backgroundImage="https://images.unsplash.com/photo-1497215728101-856f4ea42174?q=80&w=2070&auto=format&fit=crop"
            >
                <div className="flex flex-wrap gap-4 mt-8">
                    <Badge variant="primary" className="bg-primary/10 border-primary/20 text-primary">{profile?.role || 'Student'}</Badge>
                    <Badge variant="success" className="bg-green-500/10 border-green-500/20 text-green-500">Active Member</Badge>
                </div>
            </SubPageHero>

            <div className="max-w-8xl mx-auto px-10 py-32 space-y-32">
                {/* Profile Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-20">
                    {/* Left: Info & Projects */}
                    <div className="space-y-24">
                        <div className="p-12 bg-background border border-border group hover:border-primary premium-transition">
                            <div className="flex flex-col md:flex-row gap-12 items-start">
                                <div className="w-40 h-40 bg-foreground text-background dark:bg-slate-100 dark:text-slate-900 flex items-center justify-center text-4xl font-black rounded-sm shrink-0">
                                    {displayName[0]}
                                </div>
                                <div className="space-y-6 flex-grow">
                                    <h2 className="text-[40px] font-black uppercase tracking-tightest leading-none text-foreground">{displayName}</h2>
                                    <p className="text-muted font-bold text-[18px] leading-relaxed">
                                        {profile?.major || "Hanyang University"} {profile?.role || 'Student'}. {displayBio}
                                    </p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-border">
                                        <div className="flex items-center gap-3 text-muted">
                                            <Mail size={18} />
                                            <span className="font-bold text-[14px]">{displayEmail}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-muted">
                                            <Github size={18} />
                                            <span className="font-bold text-[14px]">{profile?.github_url || "github.com"}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-12 pt-12">
                            <div className="section-accent-bar flex items-center justify-between">
                                <h3 className="text-[32px] font-black uppercase tracking-tighter text-foreground">My Innovations</h3>
                                <Button variant="ghost" className="text-primary gap-2">Explore All <ChevronRight size={18} /></Button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                <div className="col-span-full py-20 text-center border border-dashed border-border rounded-3xl bg-muted/5">
                                    <p className="font-bold text-muted uppercase tracking-widest text-xs">No projects registered yet.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right: Achievements & Settings */}
                    <aside className="space-y-16">
                        <div className="p-12 bg-muted/5 border border-border group relative overflow-hidden">
                            <h3 className="text-[24px] font-black uppercase tracking-tighter mb-10 border-b border-border pb-6 flex items-center gap-3 text-foreground">
                                <Award size={24} className="text-primary" />
                                Achievements
                            </h3>
                            <div className="space-y-8">
                                <p className="text-muted font-bold text-sm tracking-tight">상이나 자격증 등을 등록해 주세요.</p>
                            </div>
                            <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
                        </div>

                        <div className="p-12 border-2 border-foreground bg-background space-y-10 group">
                            <h3 className="text-[24px] font-black uppercase tracking-tighter flex items-center gap-3 text-foreground">
                                <Settings size={24} className="group-hover:rotate-90 premium-transition" />
                                Preference
                            </h3>
                            <div className="space-y-6">
                                <button className="w-full flex items-center justify-between p-6 border border-border hover:border-foreground dark:hover:border-white premium-transition text-left group/item">
                                    <span className="font-black uppercase tracking-tighter text-foreground">Edit Account Info</span>
                                    <ChevronRight size={18} className="group-hover/item:translate-x-2 premium-transition text-border" />
                                </button>
                                <button 
                                    onClick={handleLogout}
                                    className="w-full flex items-center justify-between p-6 border border-red-200 bg-red-50/10 hover:bg-red-50 dark:hover:bg-red-500/10 premium-transition text-left group/item"
                                >
                                    <span className="font-black uppercase tracking-tighter text-red-500">Sign Out</span>
                                    <LogOut size={18} className="group-hover/item:translate-x-2 premium-transition text-red-500" />
                                </button>
                            </div>
                        </div>
                    </aside>
                </div>

                {/* Bottom Activity Section */}
                <section className="pt-24 border-t-2 border-foreground dark:border-slate-800">
                    <div className="section-accent-bar mb-16">
                        <h3 className="text-[40px] font-black uppercase tracking-tighter leading-none">Operational Log</h3>
                    </div>
                    <div className="space-y-8">
                        <div className="p-12 text-center border border-border rounded-xl bg-muted/5">
                            <p className="font-bold text-muted tracking-tight">활동 로그가 없습니다.</p>
                        </div>
                    </div>
                </section>
            </div>
        </main>
    );
}
