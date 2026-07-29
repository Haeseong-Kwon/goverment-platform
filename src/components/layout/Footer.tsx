import Link from "next/link";

const SECTIONS = [
  {
    title: "창업자",
    links: [
      { href: "/founder/diagnostics", label: "AI 자격진단" },
      { href: "/founder/calculator", label: "4대보험 계산기" },
      { href: "/workspace/precheck", label: "정산 사전검증" },
    ],
  },
  {
    title: "주관기관",
    links: [
      { href: "/manager/landing", label: "매니저 소개" },
      { href: "/manager/review", label: "검토 큐" },
      { href: "/manager/plan-review", label: "사업비 계획 검토" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="bg-[#0F172A] pt-16 pb-10 text-white">
      <div className="mx-auto max-w-7xl px-5">
        <div className="mb-12 grid grid-cols-1 gap-10 md:grid-cols-4">
          <div className="space-y-4 md:col-span-2">
            <span className="text-2xl font-bold tracking-tight">StartUp Pilot</span>
            <p className="max-w-md text-sm leading-relaxed text-slate-400">
              정부 창업지원사업의 행정 전 과정을 다루는 이원화 SaaS.
              <br />
              창업자에게는 준비부터 정산까지, 주관기관에는 검토·정산 관리 대시보드를 제공합니다.
            </p>
          </div>

          {SECTIONS.map((section) => (
            <div key={section.title}>
              <h3 className="mb-6 text-xs font-bold uppercase tracking-[0.2em] text-[#2563EB]">{section.title}</h3>
              <ul className="space-y-3 text-sm font-semibold text-slate-400">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="transition-colors hover:text-white">{link.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-col items-start justify-between gap-4 border-t border-slate-800 pt-8 md:flex-row md:items-center">
          <p className="text-xs font-semibold text-slate-500">© {new Date().getFullYear()} StartUp Pilot. All rights reserved.</p>
          <p className="text-xs font-medium text-slate-500">
            AI 진단·계산 결과는 참고용이며, 최종 기준은 각 사업 공고문과 관리지침입니다.
          </p>
        </div>
      </div>
    </footer>
  );
}
