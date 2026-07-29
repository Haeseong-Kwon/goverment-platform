"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Archive, Download, Upload, UserPlus } from "lucide-react";
import {
  VAULT_FOLDERS,
  createTeamInvite,
  getActiveTeamInvite,
  getCalendarItems,
  getTeamMembers,
  getTrackedSubmissions,
  getVaultDownloadUrl,
  joinTeamByInvite,
  listVaultDocuments,
  uploadVaultDocument,
  type CalendarItem,
  type TeamInvite,
  type TeamMember,
  type TrackedSubmission,
  type VaultDocument,
  type VaultFolder,
} from "@/lib/services/FounderWorkspaceService";
import { STARTUP_PROGRAMS } from "./rules";
import { Panel, StatusBadge, inputClass, type StatusTone } from "./ui";
import { cn } from "@/lib/utils";

/** 서비스 호출 상태를 한 곳에서 다룹니다. 각 패널이 같은 방식으로 로딩·에러를 보여줍니다. */
function useLoader<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    let mounted = true;
    setError(null);
    load()
      .then((value) => { if (mounted) setData(value); })
      .catch((reason) => { if (mounted) setError(reason instanceof Error ? reason.message : "데이터를 불러오지 못했습니다."); });
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey, ...deps]);
  return { data, error, reload: () => setReloadKey((key) => key + 1), setError };
}

function Notice({ error, empty, loading }: { error: string | null; empty?: boolean; loading: boolean }) {
  if (error) return <p className="rounded-xl bg-[#FEF2F2] p-4 text-sm font-semibold text-[#DC2626]">{error}</p>;
  if (loading) return <p className="rounded-xl bg-[#F8FAFC] p-4 text-sm font-semibold text-[#475569]">불러오는 중입니다…</p>;
  if (empty) return <p className="rounded-xl bg-[#F8FAFC] p-4 text-sm font-semibold text-[#94A3B8]">아직 등록된 항목이 없습니다.</p>;
  return null;
}

// ---------------------------------------------------------------- 마감 캘린더

const MS_DAY = 86_400_000;
const toKey = (date: Date) => date.toISOString().slice(0, 10);

export function CalendarPanel() {
  const { data, error, reload } = useLoader(getCalendarItems);
  const [monthOffset, setMonthOffset] = useState(0);
  const items = useMemo(() => data ?? [], [data]);

  const { cells, label } = useMemo(() => {
    const base = new Date();
    const view = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + monthOffset, 1));
    const firstWeekday = view.getUTCDay();
    const daysInMonth = new Date(Date.UTC(view.getUTCFullYear(), view.getUTCMonth() + 1, 0)).getUTCDate();
    const start = new Date(view.getTime() - firstWeekday * MS_DAY);
    return {
      label: `${view.getUTCFullYear()}년 ${view.getUTCMonth() + 1}월`,
      cells: Array.from({ length: 42 }, (_, index) => {
        const date = new Date(start.getTime() + index * MS_DAY);
        return { key: toKey(date), day: date.getUTCDate(), inMonth: date.getUTCMonth() === view.getUTCMonth(), isToday: toKey(date) === toKey(base) };
      }).slice(0, firstWeekday + daysInMonth > 35 ? 42 : 35),
    };
  }, [monthOffset]);

  const byDate = useMemo(() => items.reduce<Record<string, CalendarItem[]>>((acc, item) => ({ ...acc, [item.date]: [...(acc[item.date] ?? []), item] }), {}), [items]);
  const upcoming = items.filter((item) => item.date >= toKey(new Date())).slice(0, 6);

  return (
    <div className="space-y-5">
      <Panel
        title={label}
        action={
          <div className="flex gap-2">
            <button onClick={() => setMonthOffset((value) => value - 1)} className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-sm font-bold text-[#475569]">이전</button>
            <button onClick={() => setMonthOffset(0)} className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-sm font-bold text-[#475569]">오늘</button>
            <button onClick={() => setMonthOffset((value) => value + 1)} className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-sm font-bold text-[#475569]">다음</button>
          </div>
        }
      >
        <Notice error={error} loading={!data && !error} />
        <div className="mt-2 grid grid-cols-7 gap-1 text-center text-xs font-bold text-[#94A3B8]">
          {["일", "월", "화", "수", "목", "금", "토"].map((day) => <div key={day} className="py-2">{day}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-sm">
          {cells.map((cell) => {
            const dayItems = byDate[cell.key] ?? [];
            return (
              <div key={cell.key} className={cn("min-h-16 rounded-xl p-2", cell.inMonth ? "bg-[#F8FAFC]" : "bg-white text-[#CBD5E1]", cell.isToday && "ring-2 ring-[#2563EB]")}>
                <span className="tabular-nums">{cell.day}</span>
                <div className="mt-1 flex flex-wrap justify-center gap-1">
                  {dayItems.map((item) => (
                    <span key={item.id} title={item.title} className={cn("h-1.5 w-1.5 rounded-full", item.kind === "program" ? "bg-[#DC2626]" : item.status === "done" ? "bg-[#16A34A]" : "bg-[#2563EB]")} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap gap-3 text-xs font-semibold text-[#475569]">
          <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-[#DC2626]" />공고 마감</span>
          <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-[#2563EB]" />할 일</span>
          <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-[#16A34A]" />완료</span>
        </div>
      </Panel>

      <Panel title="다가오는 마감" action={<button onClick={reload} className="text-sm font-bold text-[#2563EB]">새로고침</button>}>
        <Notice error={null} loading={!data && !error} empty={Boolean(data) && upcoming.length === 0} />
        <div className="space-y-2">
          {upcoming.map((item) => {
            const dday = Math.ceil((new Date(`${item.date}T00:00:00Z`).getTime() - Date.now()) / MS_DAY);
            return (
              <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#E2E8F0] p-3">
                <div className="min-w-0">
                  <strong className="block truncate text-sm font-bold text-[#0F172A]">{item.title}</strong>
                  <span className="text-xs text-[#94A3B8]">{item.date}</span>
                </div>
                <StatusBadge tone={dday <= 3 ? "red" : dday <= 7 ? "amber" : "slate"}>D-{Math.max(0, dday)}</StatusBadge>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

// ---------------------------------------------------------------- 서류 보관함

export function VaultPanel() {
  const { data, error, reload, setError } = useLoader(listVaultDocuments);
  const [folder, setFolder] = useState<VaultFolder>("bizplan");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const documents = data ?? [];

  const upload = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      await uploadVaultDocument(folder, file);
      reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "업로드에 실패했습니다.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const download = async (document: VaultDocument) => {
    try {
      window.open(await getVaultDownloadUrl(document.storagePath), "_blank", "noopener,noreferrer");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "다운로드 링크를 만들지 못했습니다.");
    }
  };

  return (
    <div className="space-y-5">
      <Panel title="파일 업로드" action={<StatusBadge tone="blue">만료형 보안 링크</StatusBadge>}>
        <div className="flex flex-wrap gap-2">
          {VAULT_FOLDERS.map((item) => (
            <button key={item.id} type="button" onClick={() => setFolder(item.id)} className={cn("rounded-lg border px-3 py-2 text-sm font-semibold", folder === item.id ? "border-[#2563EB] bg-[#EFF6FF] text-[#2563EB]" : "border-[#E2E8F0] text-[#475569]")}>
              {item.label}
            </button>
          ))}
        </div>
        <p className="mt-3 text-sm text-[#475569]">{VAULT_FOLDERS.find((item) => item.id === folder)?.hint}</p>
        <input ref={fileRef} type="file" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} className="mt-4 block w-full text-sm" />
        <p className="mt-2 text-xs font-medium text-[#94A3B8]">같은 이름으로 올리면 버전이 올라갑니다. 최대 50MB.</p>
        {busy && <p className="mt-3 text-sm font-semibold text-[#2563EB]"><Upload size={14} className="mr-1 inline" />업로드 중…</p>}
      </Panel>

      <Panel title={`보관 파일 ${documents.length}건`} action={<button onClick={reload} className="text-sm font-bold text-[#2563EB]">새로고침</button>}>
        <Notice error={error} loading={!data && !error} empty={Boolean(data) && documents.length === 0} />
        <div className="space-y-2">
          {VAULT_FOLDERS.map((group) => {
            const files = documents.filter((item) => item.folder === group.id);
            if (files.length === 0) return null;
            return (
              <div key={group.id}>
                <p className="mt-3 text-sm font-bold text-[#0F172A]">{group.label}</p>
                {files.map((item) => (
                  <div key={item.id} className="mt-2 flex items-center gap-3 rounded-xl border border-[#E2E8F0] p-3">
                    <Archive size={17} className="shrink-0 text-[#475569]" />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[#0F172A]">{item.fileName}</span>
                    <StatusBadge tone="slate">v{item.version}</StatusBadge>
                    <span className="hidden text-xs text-[#94A3B8] sm:inline">{item.createdAt.slice(0, 10)}</span>
                    <button onClick={() => void download(item)} className="shrink-0 rounded-lg border border-[#2563EB] px-3 py-1.5 text-xs font-bold text-[#2563EB]">
                      <Download size={12} className="mr-1 inline" />열기
                    </button>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

// ---------------------------------------------------------------- 상태 트래커

const TRACKER_STEPS = [
  { key: "validated", label: "사전검증 통과" },
  { key: "in_review", label: "매니저 검토" },
  { key: "approved", label: "승인" },
] as const;

const statusTone: Record<TrackedSubmission["status"], StatusTone> = {
  draft: "slate",
  validated: "blue",
  in_review: "amber",
  approved: "green",
  rejected: "red",
};
const statusLabel: Record<TrackedSubmission["status"], string> = {
  draft: "작성 중",
  validated: "검토 대기",
  in_review: "매니저 검토 중",
  approved: "승인",
  rejected: "반려",
};

function stepIndex(status: TrackedSubmission["status"]) {
  if (status === "approved") return 3;
  if (status === "in_review") return 2;
  if (status === "validated" || status === "rejected") return 1;
  return 0;
}

export function TrackerPanel() {
  const { data, error, reload } = useLoader(getTrackedSubmissions);
  const submissions = data ?? [];

  return (
    <div className="space-y-5">
      <Panel title={`내 정산 건 ${submissions.length}건`} action={<button onClick={reload} className="text-sm font-bold text-[#2563EB]">새로고침</button>}>
        <Notice error={error} loading={!data && !error} empty={Boolean(data) && submissions.length === 0} />
        <div className="space-y-4">
          {submissions.map((item) => {
            const reached = stepIndex(item.status);
            return (
              <article key={item.id} className={cn("rounded-2xl border p-4", item.status === "rejected" ? "border-[#FECACA]" : "border-[#E2E8F0]")}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong className="text-sm font-bold text-[#0F172A]">{item.title}</strong>
                  <div className="flex gap-2">
                    <StatusBadge tone="slate">{new Intl.NumberFormat("ko-KR").format(item.amount)}원</StatusBadge>
                    <StatusBadge tone={statusTone[item.status]}>{statusLabel[item.status]}</StatusBadge>
                  </div>
                </div>

                <div className="mt-4 flex items-center">
                  {TRACKER_STEPS.map((step, index) => (
                    <div key={step.key} className="flex flex-1 items-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className={cn("grid h-8 w-8 place-items-center rounded-full text-sm font-bold", index < reached ? "bg-[#2563EB] text-white" : "bg-[#F8FAFC] text-[#94A3B8]")}>{index + 1}</span>
                        <span className="whitespace-nowrap text-xs font-semibold text-[#475569]">{step.label}</span>
                      </div>
                      {index < TRACKER_STEPS.length - 1 && <div className={cn("mx-2 h-0.5 flex-1", index + 1 < reached ? "bg-[#2563EB]" : "bg-[#E2E8F0]")} />}
                    </div>
                  ))}
                </div>

                {item.decision && (
                  <div className={cn("mt-4 rounded-xl p-3", item.decision.decision === "rejected" ? "bg-[#FEF2F2]" : "bg-[#F0FDF4]")}>
                    <p className="text-sm font-bold text-[#0F172A]">
                      {item.decision.decision === "rejected" ? "반려" : "승인"} · {item.decision.createdAt.slice(0, 10)}
                      {item.decision.reasonCode && <span className="ml-2 text-[#DC2626]">{item.decision.reasonCode}</span>}
                    </p>
                    {item.decision.feedback && <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-sm leading-6 text-[#475569]">{item.decision.feedback}</pre>}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

// ---------------------------------------------------------------- 팀 설정

export function TeamSettingsPanel({ founder }: { founder: boolean }) {
  const members = useLoader(getTeamMembers);
  const invite = useLoader(getActiveTeamInvite);
  const [joinCode, setJoinCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const issue = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const created: TeamInvite = await createTeamInvite();
      setMessage(`초대 코드 ${created.code} 를 발급했습니다.`);
      invite.reload();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "초대 코드를 발급하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const join = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await joinTeamByInvite(joinCode);
      setMessage("팀에 합류했습니다.");
      setJoinCode("");
      members.reload();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "합류하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const list = (members.data ?? []) as TeamMember[];

  return (
    <div className="space-y-5">
      <Panel title={founder ? "협약 팀 구성원" : "준비 팀 구성원"} action={<StatusBadge tone="slate">{list.length}명</StatusBadge>}>
        <Notice error={members.error} loading={!members.data && !members.error} empty={Boolean(members.data) && list.length === 0} />
        <div className="space-y-2">
          {list.map((member) => (
            <div key={member.userId} className="flex items-center gap-3 rounded-xl border border-[#E2E8F0] p-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#EFF6FF] text-xs font-bold text-[#2563EB]">{member.fullName.slice(0, 1)}</span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[#0F172A]">{member.fullName}</span>
              <StatusBadge tone={member.role === "leader" ? "blue" : "slate"}>{member.role === "leader" ? "리더" : "팀원"}</StatusBadge>
              <span className="hidden text-xs text-[#94A3B8] sm:inline">{member.joinedAt.slice(0, 10)}</span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="팀원 초대">
        {invite.data ? (
          <div className="rounded-xl bg-[#F8FAFC] p-4">
            <p className="text-sm font-bold text-[#0F172A]">활성 초대 코드</p>
            <p className="mt-2 font-mono text-2xl font-bold tracking-widest text-[#2563EB]">{(invite.data as TeamInvite).code}</p>
            <p className="mt-2 text-xs text-[#94A3B8]">
              {(invite.data as TeamInvite).expiresAt.slice(0, 10)}까지 · {(invite.data as TeamInvite).useCount}/{(invite.data as TeamInvite).maxUses}명 사용
            </p>
          </div>
        ) : (
          <p className="rounded-xl bg-[#F8FAFC] p-4 text-sm text-[#475569]">아직 발급된 초대 코드가 없습니다.</p>
        )}
        <button onClick={() => void issue()} disabled={busy} className="mt-4 rounded-[10px] bg-[#2563EB] px-4 py-3 text-sm font-bold text-white disabled:opacity-50">
          <UserPlus size={14} className="mr-1 inline" />새 초대 코드 발급
        </button>
      </Panel>

      <Panel title="다른 팀 초대 코드로 합류">
        <div className="flex gap-2">
          <input value={joinCode} onChange={(event) => setJoinCode(event.target.value.toUpperCase())} placeholder="초대 코드" className={cn(inputClass, "mt-0 flex-1 font-mono")} />
          <button onClick={() => void join()} disabled={busy || !joinCode.trim()} className="rounded-[10px] border border-[#2563EB] px-4 text-sm font-bold text-[#2563EB] disabled:opacity-40">합류</button>
        </div>
      </Panel>

      {message && <p className="rounded-xl bg-[#EFF6FF] p-4 text-sm font-semibold text-[#2563EB]">{message}</p>}

      <Panel title="데이터 공개 범위">
        <p className="text-sm leading-6 text-[#475569]">
          준비 데이터(연습 진단·초안·할 일)는 주관기관에 공개되지 않습니다. 매니저는 팀이 <strong>검토 요청</strong>한 정산 건만 볼 수 있으며, 증빙 파일은 만료형 보안 링크로만 열람됩니다.
        </p>
      </Panel>
    </div>
  );
}

// ---------------------------------------------------------------- 법인 설립

const INCORPORATION_STEPS = [
  { label: "상호·사업목적 확인", note: "중복 상호 조회 후 정관 목적에 사업 아이템을 포함시킵니다." },
  { label: "정관 작성·공증", note: "발기인·주식 수·액면가를 확정합니다." },
  { label: "주금 납입", note: "잔액증명서는 지급수수료(법인설립비)로 집행 가능합니다." },
  { label: "설립 등기", note: "등록면허세·등기수수료도 법인설립비 범위입니다." },
  { label: "사업자등록", note: "이 시점부터 '예비창업자' 자격은 사라집니다." },
];

export function IncorporationPanel() {
  const [programId, setProgramId] = useState<string>(STARTUP_PROGRAMS[0].id);
  const [done, setDone] = useState<number[]>([]);
  const program = STARTUP_PROGRAMS.find((item) => item.id === programId)!;

  return (
    <div className="space-y-5">
      <Panel title="설립 타이밍 확인">
        <div className="flex flex-wrap gap-2">
          {STARTUP_PROGRAMS.map((item) => (
            <button key={item.id} type="button" onClick={() => setProgramId(item.id)} className={cn("rounded-lg border px-3 py-2 text-sm font-semibold", programId === item.id ? "border-[#2563EB] bg-[#EFF6FF] text-[#2563EB]" : "border-[#E2E8F0] text-[#475569]")}>
              {item.name}
            </button>
          ))}
        </div>
        {program.requiresNoBusinessRegistration ? (
          <p className="mt-4 rounded-xl bg-[#FEF2F2] p-4 text-sm font-semibold leading-6 text-[#DC2626]">
            {program.name}은 신청일 기준 사업자등록이 없어야 합니다. <strong>선정 통보 이후에 설립</strong>하세요. 지금 5단계를 끝내면 신청 자격이 사라집니다.
          </p>
        ) : (
          <p className="mt-4 rounded-xl bg-[#F0FDF4] p-4 text-sm font-semibold leading-6 text-[#16A34A]">
            {program.name}은 사업자등록 상태에서도 신청할 수 있습니다. 협약 전 설립을 진행해도 자격에 영향이 없습니다.
          </p>
        )}
      </Panel>

      <Panel title="절차 체크리스트" action={<StatusBadge tone={done.length === INCORPORATION_STEPS.length ? "green" : "slate"}>{done.length}/{INCORPORATION_STEPS.length}</StatusBadge>}>
        <div className="space-y-2">
          {INCORPORATION_STEPS.map((step, index) => {
            const checked = done.includes(index);
            return (
              <button
                key={step.label}
                type="button"
                onClick={() => setDone((current) => (checked ? current.filter((item) => item !== index) : [...current, index]))}
                className={cn("flex w-full items-start gap-3 rounded-xl border p-3 text-left", checked ? "border-[#16A34A] bg-[#F0FDF4]" : "border-[#E2E8F0]")}
              >
                <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold", checked ? "bg-[#16A34A] text-white" : "bg-[#F8FAFC] text-[#94A3B8]")}>{checked ? "✓" : index + 1}</span>
                <span className="min-w-0">
                  <strong className="block text-sm font-bold text-[#0F172A]">{step.label}</strong>
                  <span className="text-xs leading-5 text-[#475569]">{step.note}</span>
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-4 text-xs font-medium text-[#94A3B8]">체크 상태는 이 화면에서만 유지되는 참고용입니다. 최종 기준은 각 사업 공고문입니다.</p>
      </Panel>
    </div>
  );
}
