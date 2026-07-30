"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { getCurrentUser } from "@/lib/services/AuthService";
import { completeOnboarding } from "@/lib/services/WorkspaceService";
import { STARTUP_PROGRAMS } from "@/features/startup-workspace/rules";
import { Button, ChoiceChip, Field, Notice, StatusBadge, inputClass } from "@/features/startup-workspace/ui";
import { cn } from "@/lib/utils";
import { toMessage } from "@/lib/errors";

const STEPS = [
  { title: "대표자 정보", hint: "누가 팀을 이끄는지 확인합니다." },
  { title: "지원사업 선택", hint: "선택한 공고의 마감일로 준비 일정을 역산합니다." },
  { title: "아이템 소개", hint: "자격 진단과 계획서 진단의 기준이 됩니다." },
] as const;

const emptyForm = {
  fullName: "",
  position: "대표",
  teamName: "",
  itemSummary: "",
  industry: "",
  programIds: [] as string[],
  teamBuildingIntent: false,
  desiredPositions: "",
};

export default function OnboardingPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    let mounted = true;
    getCurrentUser()
      .then((user) => {
        if (!mounted) return;
        if (!user) router.replace("/login");
        else setChecking(false);
      })
      .catch(() => { if (mounted) setChecking(false); });
    return () => { mounted = false; };
  }, [router]);

  const patch = (changes: Partial<typeof form>) => setForm((current) => ({ ...current, ...changes }));

  const toggleProgram = (programId: string) =>
    setForm((current) => ({
      ...current,
      programIds: current.programIds.includes(programId)
        ? current.programIds.filter((id) => id !== programId)
        : [...current.programIds, programId],
    }));

  const stepValid =
    step === 0 ? Boolean(form.fullName.trim() && form.teamName.trim())
    : step === 1 ? true
    : Boolean(form.itemSummary.trim());

  const submit = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await completeOnboarding({
        ...form,
        fullName: form.fullName.trim(),
        teamName: form.teamName.trim(),
        itemSummary: form.itemSummary.trim(),
        desiredPositions: form.desiredPositions.split(",").map((item) => item.trim()).filter(Boolean),
      });
      router.replace(result.redirect);
    } catch (reason) {
      setError(toMessage(reason, "온보딩을 완료하지 못했습니다."));
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#F8FAFC]">
        <Loader2 className="animate-spin text-[#2563EB]" size={28} />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] px-5 py-10 text-[#0F172A]">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="text-xl font-bold">StartUp Pilot</Link>

        <ol className="mt-6 flex gap-2">
          {STEPS.map((item, index) => (
            <li key={item.title} className="flex-1">
              <div className={cn("h-1.5 rounded-full", index <= step ? "bg-[#2563EB]" : "bg-[#E2E8F0]")} />
              <p className={cn("mt-2 text-xs font-bold", index <= step ? "text-[#2563EB]" : "text-[#94A3B8]")}>
                {index < step ? <Check size={12} className="mr-1 inline" /> : `${index + 1}. `}{item.title}
              </p>
            </li>
          ))}
        </ol>

        <section className="mt-5 rounded-3xl border border-[#E2E8F0] bg-white p-6 md:p-9">
          <h1 className="text-[26px] font-bold md:text-[30px]">{STEPS[step].title}</h1>
          <p className="mt-2 text-sm leading-6 text-[#475569]">{STEPS[step].hint}</p>

          {step === 0 && (
            <div className="mt-7 grid gap-4">
              <Field label="이름"><input value={form.fullName} onChange={(event) => patch({ fullName: event.target.value })} placeholder="홍길동" className={inputClass} /></Field>
              <Field label="현재 포지션"><input value={form.position} onChange={(event) => patch({ position: event.target.value })} placeholder="대표 / 기획 / 개발" className={inputClass} /></Field>
              <Field label="팀 이름" hint="워크스페이스와 초대 코드에 표시됩니다."><input value={form.teamName} onChange={(event) => patch({ teamName: event.target.value })} placeholder="예: 성장하는 팀" className={inputClass} /></Field>
            </div>
          )}

          {step === 1 && (
            <div className="mt-7 space-y-4">
              <p className="text-sm text-[#64748B]">선택하지 않아도 시작할 수 있고, 나중에 캘린더에서 추가할 수 있습니다.</p>
              <div className="grid gap-3 sm:grid-cols-3">
                {STARTUP_PROGRAMS.map((program) => {
                  const selected = form.programIds.includes(program.id);
                  return (
                    <ChoiceChip
                      key={program.id}
                      selected={selected}
                      onClick={() => toggleProgram(program.id)}
                      className="rounded-2xl p-4 text-left"
                    >
                      {program.name}
                      <span className="mt-2 block text-xs font-semibold text-[#94A3B8]">
                        {program.requiresNoBusinessRegistration ? "사업자등록 없어야 함" : "사업자등록 무관"}
                      </span>
                    </ChoiceChip>
                  );
                })}
              </div>
              <p className="rounded-xl bg-[#F8FAFC] p-4 text-sm leading-6 text-[#475569]">
                선택한 사업의 공고 마감일을 기준으로 초안·증빙·리허설·제출 마일스톤이 자동 생성됩니다.
              </p>
            </div>
          )}

          {step === 2 && (
            <div className="mt-7 grid gap-4">
              <Field label="아이템 한 줄 소개"><input value={form.itemSummary} onChange={(event) => patch({ itemSummary: event.target.value })} placeholder="예: 소상공인을 위한 재고 예측 서비스" className={inputClass} /></Field>
              <Field label="업종"><input value={form.industry} onChange={(event) => patch({ industry: event.target.value })} placeholder="예: SaaS, 교육, 제조" className={inputClass} /></Field>
              <label className="flex items-center gap-3 rounded-2xl bg-[#F8FAFC] p-4 text-sm font-semibold">
                <input type="checkbox" className="h-4 w-4" checked={form.teamBuildingIntent} onChange={(event) => patch({ teamBuildingIntent: event.target.checked })} />
                함께할 팀원을 찾고 있어요
              </label>
              {form.teamBuildingIntent && (
                <Field label="찾는 포지션" hint="쉼표로 구분해 주세요."><input value={form.desiredPositions} onChange={(event) => patch({ desiredPositions: event.target.value })} placeholder="개발, 디자인" className={inputClass} /></Field>
              )}
            </div>
          )}

          {error && <div className="mt-5"><Notice tone="error" onDismiss={() => setError(null)}>{error}</Notice></div>}

          <div className="mt-8 flex items-center justify-between gap-3">
            <Button variant="secondary" size="lg" disabled={step === 0 || loading} onClick={() => setStep((current) => current - 1)}>
              이전
            </Button>
            {!stepValid && <StatusBadge tone="amber">필수 항목을 입력해 주세요</StatusBadge>}
            {step < STEPS.length - 1 ? (
              <Button size="lg" disabled={!stepValid} onClick={() => setStep((current) => current + 1)}>다음</Button>
            ) : (
              <Button size="lg" loading={loading} disabled={!stepValid} onClick={() => void submit()}>설정 완료</Button>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
