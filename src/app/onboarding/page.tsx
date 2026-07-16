"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { completeOnboarding } from "@/lib/services/WorkspaceService";

const programs = [
  { id: "yechang-2026", label: "예비창업패키지" },
  { id: "chocang-2026", label: "초기창업패키지" },
  { id: "modu-2026", label: "모두의창업" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    fullName: "",
    position: "대표",
    teamName: "",
    itemSummary: "",
    industry: "",
    programIds: [] as string[],
    teamBuildingIntent: false,
    desiredPositions: "",
  });

  const toggleProgram = (programId: string) => setForm((current) => ({
    ...current,
    programIds: current.programIds.includes(programId)
      ? current.programIds.filter((id) => id !== programId)
      : [...current.programIds, programId],
  }));

  const submit = async () => {
    if (!form.fullName.trim() || !form.teamName.trim() || !form.itemSummary.trim()) {
      setError("이름, 팀 이름, 아이템 소개를 입력해 주세요.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await completeOnboarding({
        ...form,
        desiredPositions: form.desiredPositions.split(",").map((item) => item.trim()).filter(Boolean),
      });
      router.replace(result.redirect);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "온보딩을 완료하지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#F8FAFC] px-5 py-10 text-[#0F172A]">
      <section className="mx-auto max-w-2xl rounded-3xl border border-[#E2E8F0] bg-white p-6 shadow-sm md:p-10">
        <p className="text-sm font-bold text-[#2563EB]">창업자 워크스페이스 설정 · {step}/3</p>
        <h1 className="mt-3 text-3xl font-bold">준비 흐름을 개인화합니다</h1>
        <p className="mt-2 text-sm leading-6 text-[#475569]">입력한 정보는 자격 진단, 마감 일정, 팀 TODO의 기준으로 사용됩니다.</p>

        {step === 1 && <div className="mt-8 grid gap-4">
          <Field label="이름" value={form.fullName} onChange={(fullName) => setForm({ ...form, fullName })} placeholder="홍길동" />
          <Field label="현재 포지션" value={form.position} onChange={(position) => setForm({ ...form, position })} placeholder="대표 / 기획 / 개발" />
          <Field label="팀 이름" value={form.teamName} onChange={(teamName) => setForm({ ...form, teamName })} placeholder="예: 성장하는 팀" />
        </div>}

        {step === 2 && <div className="mt-8 space-y-5">
          <div><p className="text-sm font-bold">준비 중인 지원사업</p><p className="mt-1 text-xs text-[#64748B]">선택하지 않아도 시작할 수 있으며, 나중에 일정에 추가할 수 있습니다.</p></div>
          <div className="grid gap-3 sm:grid-cols-3">{programs.map((program) => <button key={program.id} type="button" onClick={() => toggleProgram(program.id)} className={`rounded-2xl border p-4 text-left text-sm font-bold ${form.programIds.includes(program.id) ? "border-[#2563EB] bg-[#EFF6FF] text-[#1D4ED8]" : "border-[#E2E8F0]"}`}>{program.label}</button>)}</div>
        </div>}

        {step === 3 && <div className="mt-8 grid gap-4">
          <Field label="아이템 한 줄 소개" value={form.itemSummary} onChange={(itemSummary) => setForm({ ...form, itemSummary })} placeholder="예: 소상공인을 위한 재고 예측 서비스" />
          <Field label="업종" value={form.industry} onChange={(industry) => setForm({ ...form, industry })} placeholder="예: SaaS, 교육, 제조" />
          <label className="flex items-center gap-3 rounded-2xl bg-[#F8FAFC] p-4 text-sm font-semibold"><input type="checkbox" checked={form.teamBuildingIntent} onChange={(event) => setForm({ ...form, teamBuildingIntent: event.target.checked })} /> 함께할 팀원을 찾고 있어요</label>
          {form.teamBuildingIntent && <Field label="찾는 포지션 (쉼표로 구분)" value={form.desiredPositions} onChange={(desiredPositions) => setForm({ ...form, desiredPositions })} placeholder="개발, 디자인" />}
        </div>}

        {error && <p className="mt-5 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-600">{error}</p>}
        <div className="mt-8 flex justify-between gap-3"><button type="button" disabled={step === 1 || loading} onClick={() => setStep(step - 1)} className="rounded-xl border border-[#CBD5E1] px-5 py-3 text-sm font-bold disabled:opacity-40">이전</button>{step < 3 ? <button type="button" onClick={() => setStep(step + 1)} className="rounded-xl bg-[#2563EB] px-5 py-3 text-sm font-bold text-white">다음</button> : <button type="button" disabled={loading} onClick={submit} className="inline-flex items-center gap-2 rounded-xl bg-[#2563EB] px-5 py-3 text-sm font-bold text-white">{loading && <Loader2 size={16} className="animate-spin" />}설정 완료</button>}</div>
      </section>
    </main>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="grid gap-2 text-sm font-bold">{label}<input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="h-12 rounded-xl border border-[#CBD5E1] px-4 font-medium outline-none focus:border-[#2563EB]" /></label>;
}
