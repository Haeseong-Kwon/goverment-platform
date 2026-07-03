"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Footer() {
    const pathname = usePathname();
    const isSimulatorPath = pathname === "/" || pathname === "/onboarding" ||
        pathname === "/settlements" || pathname.startsWith("/settlements/") ||
        pathname === "/manager" || pathname.startsWith("/manager/") ||
        pathname === "/accountant";
    if (isSimulatorPath) return null;

    return (
        <footer className="bg-black pt-20 pb-10 text-white sm:pt-24 sm:pb-12">
            <div className="max-w-8xl mx-auto px-5 sm:px-6 lg:px-8">
                <div className="mb-16 grid grid-cols-1 gap-12 md:grid-cols-4 md:gap-10 lg:mb-20 lg:gap-16 xl:gap-20">
                    <div className="col-span-1 md:col-span-2 space-y-8">
                        <div className="flex items-center gap-2">
                            <span className="text-4xl font-black tracking-tighter">AOP</span>
                        </div>
                        <p className="max-w-md text-[16px] font-medium leading-relaxed text-gray-400 sm:text-[18px]">
                            한양대학교 ERICA SW창업캡스톤디자인 통합 플랫폼. <br />
                            All-in-One Platform for Campus Entrepreneurs.
                        </p>
                    </div>

                    <div>
                        <h3 className="text-[12px] font-black text-primary tracking-[0.2em] uppercase mb-8">Services</h3>
                        <ul className="space-y-4 text-[16px] font-bold text-gray-500">
                            <li><Link href="/dashboard" className="hover:text-white" style={{ transition: 'color 0.15s ease-out' }}>LMS Dashboard</Link></li>
                            <li><Link href="/community" className="hover:text-white" style={{ transition: 'color 0.15s ease-out' }}>Team Matching</Link></li>
                            <li><Link href="/proposals" className="hover:text-white" style={{ transition: 'color 0.15s ease-out' }}>Opportunities</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h3 className="text-[12px] font-black text-primary tracking-[0.2em] uppercase mb-8">Support</h3>
                        <ul className="space-y-4 text-[16px] font-bold text-gray-500">
                            <li><Link href="#" className="hover:text-white" style={{ transition: 'color 0.15s ease-out' }}>Service Guide</Link></li>
                            <li><Link href="#" className="hover:text-white" style={{ transition: 'color 0.15s ease-out' }}>Contact Us</Link></li>
                            <li><Link href="#" className="hover:text-white" style={{ transition: 'color 0.15s ease-out' }}>System Status</Link></li>
                        </ul>
                    </div>
                </div>

                <div className="flex flex-col items-start justify-between gap-5 border-t border-gray-800 pt-8 sm:pt-10 md:flex-row md:items-center lg:pt-12">
                    <p className="text-[12px] font-bold text-gray-600 uppercase tracking-widest">
                        © 2024 Hanyang University ERICA. All rights reserved.
                    </p>
                    <div className="flex items-center gap-6 text-[12px] font-bold uppercase tracking-widest text-gray-600 sm:gap-10">
                        <Link href="#" className="hover:text-white" style={{ transition: 'color 0.15s ease-out' }}>Terms</Link>
                        <Link href="#" className="hover:text-white" style={{ transition: 'color 0.15s ease-out' }}>Privacy</Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}
