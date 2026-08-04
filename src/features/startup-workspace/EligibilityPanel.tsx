"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarPlus } from "lucide-react";
import { evaluateEligibility, recommendPrograms, STARTUP_PROGRAMS } from "./rules";
import { getDday } from "./logic";
import type { EligibilityAnswers, EligibilityReport, EligibilityState } from "./domain";
import { Button, ChoiceChip, Notice, Panel, StatusBadge, type StatusTone } from "./ui";
import { getLatestEligibilityReport, saveEligibilityReport, createWorkspaceTask } from "@/lib/services/WorkspaceService";
import { getProgramDeadlines, getSelectedPrograms } from "@/lib/services/FounderWorkspaceService";
import { toMessage } from "@/lib/errors";

const stateTone: Record<EligibilityState, StatusTone> = { eligible: "green", review: "amber", ineligible: "red", pending: "slate" };
const stateLabel: Record<EligibilityState, string> = { eligible: "신청 가능", review: "확인 필요", ineligible: "신청 불가", pending: "룰셋 준비 중" };
const ringColor: Record<EligibilityState, string> = { eligible: "#16A34A", review: "#B45309", ineligible: "#DC2626", pending: "#94A3B8" };

const QUESTIONS = [
  { key: "hasBusinessRegistration", label: "사업자등록을 한 적이 있나요?", hint: "예비창업패키지는 신청일 기준 사업자등록이 없어야 합니다." },
  { key: "hasPriorBenefit", label: "동일 사업에 선정된 적이 있나요?", hint: "기수혜 이력은 대부분의 사업에서 재지원을 제한합니다." },
  { key: "hasClosureHistory", label: "폐업 이력이 있나요?", hint: "공고문의 재창업 관련 예외 조항 확인이 필요합니다." },
  { key: "isEmployed", label: "대표자가 현재 재직 중인가요?", hint: "재직 상태에 따라 대표자 요건이 달라질 수 있습니다." },
  { key: "hasCoRepresentative", label: "공동대표가 있나요?", hint: "공동대표 구성은 자격 판단에 영향을 줄 수 있습니다." },
] as const satisfies ReadonlyArray<{ key: keyof EligibilityAnswers; label: string; hint: string }>;

const EMPTY: EligibilityAnswers = {
  hasBusinessRegistration: null,
  hasPriorBenefit: null,
  hasClosureHistory: null,
  isEmployed: null,
  hasCoRepresentative: null,
};

function ScoreRing({ score, state }: { score: number; state: EligibilityState }) {
  return (
    <div className="flex items-center gap-5">
      <div
        className="grid h-28 w-28 shrink-0 place-items-center rounded-full transition-[background] duration-500 ease-out"
        style={{ background: `conic-gradient(${ringColor[state]} ${score * 3.6}deg, #E2E8F0 0deg)` }}
        role="img"
        aria-label={`자격 진단 점수 ${score}점`}
      >
        <div className="grid h-20 w-20 place-items-center rounded-full bg-white">
          <strong className="text-2xl font-bold tabular-nums text-[#0F172A]">{score}</strong>
        </div>
      </div>
      <div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge tone={stateTone[state]}>{stateLabel[state]}</StatusBadge>
          <StatusBadge tone="blue">규정 룰셋 판정</StatusBadge>
        </div>
        <p className="mt-3 text-sm leading-6 text-[#475569]">입력한 답변을 사업별 자격 룰셋에 대조한 결과입니다.</p>
      </div>
    </div>
  );
}

function TriStateRow({ label, hint, value, onChange }: { label: string; hint: string; value: boolean | null | undefined; onChange: (next: boolean | null) => void }) {
  const options = [
    ["예", true],
    ["아니오", false],
    ["모름", null],
  ] as const;
  return (
    <div className="rounded-xl border border-[#E2E8F0] p-4">
      <p className="text-sm font-bold text-[#0F172A]">{label}</p>
      <p className="mt-1 text-xs leading-5 text-[#94A3B8]">{hint}</p>
      <div className="mt-3 flex gap-2">
        {options.map(([optionLabel, optionValue]) => (
          <ChoiceChip key={optionLabel} selected={value === optionValue} onClick={() => onChange(optionValue)}>
            {optionLabel}
          </ChoiceChip>
        ))}
      </div>
    </div>
  );
}

function ReportBody({ report }: { report: EligibilityReport }) {
  return (
    <>
      <ScoreRing score={report.score} state={report.state} />

      {report.blockers.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-3 text-xl font-semibold text-[#0F172A]">결격 사유</h3>
          <ul className="space-y-2">
            {report.blockers.map((blocker) => (
              <li key={blocker} className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-3 text-sm font-semibold text-[#DC2626]">{blocker}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6">
        <h3 className="mb-3 text-xl font-semibold text-[#0F172A]">왜 이렇게 판단했나요</h3>
        <ul className="space-y-2">
          {report.reasons.map((reason) => (
            <li key={reason.clause} className="rounded-xl border border-[#E2E8F0] p-3">
              <StatusBadge tone="slate">{reason.clause}</StatusBadge>
              <p className="mt-2 text-sm leading-6 text-[#475569]">{reason.text}</p>
            </li>
          ))}
        </ul>
      </div>

      {report.unchecked.length > 0 && (
        <div className="mt-6 rounded-xl bg-[#F8FAFC] p-4">
          <h3 className="text-sm font-bold text-[#0F172A]">아직 확인하지 못한 데이터</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {report.unchecked.map((item) => <li key={item}><StatusBadge tone="slate">{item}</StatusBadge></li>)}
          </ul>
        </div>
      )}

      <div className="mt-6">
        <h3 className="mb-3 text-xl font-semibold text-[#0F172A]">다음 액션</h3>
        <ul className="space-y-2">
          {report.nextActions.map((action) => (
            <li key={action} className="rounded-xl border border-[#E2E8F0] p-3 text-sm font-medium text-[#0F172A]">{action}</li>
          ))}
        </ul>
      </div>
    </>
  );
}

export function EligibilityPanel() {
  const [programId, setProgramId] = useState<string>(STARTUP_PROGRAMS[0].id);
  const [answers, setAnswers] = useState<EligibilityAnswers>(EMPTY);
  const [status, setStatus] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [restored, setRestored] = useState<string | null>(null);
  const [programDeadlines, setProgramDeadlines] = useState<Record<string, string | null>>({});
  const [addedPrograms, setAddedPrograms] = useState<string[]>([]);
  const [addingProgram, setAddingProgram] = useState<string | null>(null);
  const [calendarMessage, setCalendarMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  // 추천 카드에 공고 시기를 띄우고, 이미 담은 사업은 다시 담지 않게 합니다.
  useEffect(() => {
    let mounted = true;
    getProgramDeadlines()
      .then((rows) => { if (mounted) setProgramDeadlines(rows); })
      .catch(() => undefined);
    getSelectedPrograms()
      .then((rows) => { if (mounted) setAddedPrograms(rows.map((row) => row.id)); })
      .catch(() => undefined);
    return () => { mounted = false; };
  }, []);

  /** 추천 → 캘린더 → TODO로 이어지는 지점. 공고 마감일을 팀 할 일로 만들어 캘린더에 올립니다. */
  const addToCalendar = useCallback(async (programId: string, programName: string) => {
    const deadline = programDeadlines[programId];
    if (!deadline) {
      setCalendarMessage({ tone: "error", text: "이 사업은 아직 공고 일정이 등록되지 않았습니다." });
      return;
    }
    setAddingProgram(programId);
    setCalendarMessage(null);
    try {
      await createWorkspaceTask(`${programName} 신청 마감`, deadline);
      setAddedPrograms((current) => (current.includes(programId) ? current : [...current, programId]));
      setCalendarMessage({ tone: "success", text: `${programName} 마감(${deadline})을 캘린더와 팀 TODO에 추가했습니다.` });
    } catch (reason) {
      setCalendarMessage({ tone: "error", text: toMessage(reason, "캘린더에 추가하지 못했습니다.") });
    } finally {
      setAddingProgram(null);
    }
  }, [programDeadlines]);

  useEffect(() => {
    let mounted = true;
    getLatestEligibilityReport()
      .then((saved) => {
        if (!mounted || !saved) return;
        setAnswers({ ...EMPTY, ...saved.answers });
        if (saved.programId) setProgramId(saved.programId);
        setRestored(saved.createdAt.slice(0, 10));
      })
      .catch(() => undefined);
    return () => { mounted = false; };
  }, []);

  const report = useMemo(() => evaluateEligibility(programId, answers), [programId, answers]);
  const recommendations = useMemo(() => recommendPrograms(answers), [answers]);
  const answered = Object.values(answers).filter((value) => value !== null && value !== undefined).length;

  const save = async () => {
    setSaving(true);
    setStatus(null);
    try {
      await saveEligibilityReport(programId, answers, report);
      setStatus({ tone: "success", text: "진단 결과를 팀 보관함에 저장했습니다." });
    } catch (reason) {
      setStatus({ tone: "error", text: toMessage(reason, "저장하지 못했습니다.") });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
      <div className="space-y-5">
        <Panel title="지원사업 선택">
          <div className="flex flex-wrap gap-2">
            {STARTUP_PROGRAMS.map((program) => (
              <ChoiceChip key={program.id} selected={programId === program.id} onClick={() => setProgramId(program.id)}>
                {program.name}
              </ChoiceChip>
            ))}
          </div>
        </Panel>

        <Panel title="자격 문항" action={<StatusBadge tone={answered === QUESTIONS.length ? "green" : "amber"}>{answered}/{QUESTIONS.length} 응답</StatusBadge>}>
          {restored && <p className="mb-3 rounded-xl bg-[#EFF6FF] p-3 text-sm font-semibold text-[#2563EB]">{restored}에 저장한 진단을 불러왔습니다.</p>}
          <div className="space-y-3">
            {QUESTIONS.map((question) => (
              <TriStateRow
                key={question.key}
                label={question.label}
                hint={question.hint}
                value={answers[question.key]}
                onChange={(next) => setAnswers((current) => ({ ...current, [question.key]: next }))}
              />
            ))}
          </div>
          <Button block loading={saving} onClick={() => void save()} className="mt-4">
            {saving ? "저장 중…" : "진단 결과 저장"}
          </Button>
          {status && <div className="mt-3"><Notice tone={status.tone} onDismiss={() => setStatus(null)}>{status.text}</Notice></div>}
        </Panel>
      </div>

      <div className="space-y-5">
        <Panel>
          <ReportBody report={report} />
        </Panel>

        <Panel title="지원 가능한 다른 사업">
          <div className="grid gap-3 md:grid-cols-3">
            {recommendations.map((item) => {
              const deadline = programDeadlines[item.programId] ?? null;
              const dday = getDday(deadline);
              const added = addedPrograms.includes(item.programId);
              return (
                <article key={item.programId} className="rounded-2xl border border-[#E2E8F0] p-4">
                  <StatusBadge tone={stateTone[item.state]}>{stateLabel[item.state]}</StatusBadge>
                  <h4 className="mt-3 font-bold text-[#0F172A]">{item.programName}</h4>
                  <p className="mt-1 text-sm text-[#475569]">
                    {item.report.blockers.length > 0 ? item.report.blockers[0] : item.report.unchecked.length > 0 ? `미확인 ${item.report.unchecked.length}건` : "즉시 결격 사유 없음"}
                  </p>
                  {/* 공고 시기를 함께 보여야 "이 사업 지금 되나"까지 한 카드에서 판단됩니다. */}
                  <p className="mt-2 text-xs font-semibold text-[#94A3B8]">
                    {deadline ? `공고 마감 ${deadline}${dday !== null && dday >= 0 ? ` · D-${dday}` : dday !== null ? " · 마감 지남" : ""}` : "공고 일정 미정"}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setProgramId(item.programId)} className="-ml-3 text-[#2563EB] hover:text-[#1D4ED8]">
                      이 사업으로 진단
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<CalendarPlus size={14} />}
                      disabled={added || addingProgram === item.programId || !deadline}
                      loading={addingProgram === item.programId}
                      onClick={() => void addToCalendar(item.programId, item.programName)}
                      className="text-[#475569] hover:text-[#0F172A]"
                    >
                      {added ? "캘린더에 있음" : "캘린더에 추가"}
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
          {calendarMessage && <div className="mt-3"><Notice tone={calendarMessage.tone} onDismiss={() => setCalendarMessage(null)}>{calendarMessage.text}</Notice></div>}
        </Panel>

        <p className="text-[13px] font-medium text-[#94A3B8]">
          본 진단은 사업별 자격 룰셋에 따른 참고용 판정이며, 최종 적격 여부는 각 사업 공고문과 관리지침을 따릅니다.
        </p>
      </div>
    </div>
  );
}
