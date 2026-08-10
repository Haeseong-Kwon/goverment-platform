"use client";

import { useEffect, useRef, useState } from "react";
import { Archive, ClipboardCopy, Download, RefreshCw, Upload, UserPlus } from "lucide-react";
import {
  VAULT_FOLDERS,
  createTeamInvite,
  getActiveTeamInvite,
  getSelectedPrograms,
  getTeamMembers,
  getTrackedSubmissions,
  getVaultDownloadUrl,
  joinTeamByInvite,
  listVaultDocuments,
  uploadVaultDocument,
  type TeamInvite,
  type TeamMember,
  type TrackedSubmission,
  type VaultDocument,
  type VaultFolder,
} from "@/lib/services/FounderWorkspaceService";
import { requestConsultation } from "@/lib/services/WorkspaceService";
import { STARTUP_PROGRAMS } from "./rules";
import { Button, ChoiceChip, EmptyState, Field, LinkButton, Notice, Panel, Skeleton, StatusBadge, inputClass, selectableRow, type StatusTone } from "./ui";
import { cn } from "@/lib/utils";
import { toMessage } from "@/lib/errors";

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
      .catch((reason) => { if (mounted) setError(toMessage(reason, "데이터를 불러오지 못했습니다.")); });
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey, ...deps]);
  return { data, error, reload: () => setReloadKey((key) => key + 1), setError };
}

function LoadState({
  error,
  empty,
  loading,
  emptyTitle = "아직 등록된 항목이 없습니다",
  emptyDescription,
  emptyAction,
}: {
  error: string | null;
  empty?: boolean;
  loading: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
}) {
  if (error) return <p className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-4 text-sm font-semibold text-[#DC2626]">{error}</p>;
  if (loading) return <div className="space-y-2">{[0, 1, 2].map((key) => <Skeleton key={key} className="h-14" />)}</div>;
  if (empty) return <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />;
  return null;
}

// ---------------------------------------------------------------- 서류 보관함

export function VaultPanel() {
  const { data, error, reload, setError } = useLoader(listVaultDocuments);
  const [folder, setFolder] = useState<VaultFolder>("bizplan");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const documents = data ?? [];

  const upload = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      await uploadVaultDocument(folder, file);
      reload();
    } catch (reason) {
      setError(toMessage(reason, "업로드에 실패했습니다."));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const download = async (document: VaultDocument) => {
    try {
      window.open(await getVaultDownloadUrl(document.storagePath), "_blank", "noopener,noreferrer");
    } catch (reason) {
      setError(toMessage(reason, "다운로드 링크를 만들지 못했습니다."));
    }
  };

  return (
    <div className="space-y-5">
      <Panel title="파일 업로드" action={<StatusBadge tone="blue">만료형 보안 링크</StatusBadge>}>
        <div className="flex flex-wrap gap-2">
          {VAULT_FOLDERS.map((item) => (
            <ChoiceChip key={item.id} selected={folder === item.id} onClick={() => setFolder(item.id)}>
              {item.label}
            </ChoiceChip>
          ))}
        </div>
        <p className="mt-3 text-sm text-[#475569]">{VAULT_FOLDERS.find((item) => item.id === folder)?.hint}</p>

        <input
          ref={fileRef}
          type="file"
          className="sr-only"
          disabled={busy}
          onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            const file = event.dataTransfer.files?.[0];
            if (file) void upload(file);
          }}
          className={cn(
            "mt-4 flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed px-5 py-8 transition-colors disabled:opacity-60",
            dragging ? "border-[#2563EB] bg-[#EFF6FF]" : "border-[#CBD5E1] bg-[#F8FAFC] hover:border-[#2563EB]",
          )}
        >
          <Upload size={20} className={cn(busy && "animate-pulse", dragging ? "text-[#2563EB]" : "text-[#94A3B8]")} />
          <span className="text-sm font-bold text-[#0F172A]">
            {busy ? "업로드 중…" : "파일을 끌어다 놓거나 클릭해 선택하세요"}
          </span>
          <span className="text-xs font-medium text-[#94A3B8]">같은 이름으로 올리면 버전이 올라갑니다 · 최대 50MB</span>
        </button>
      </Panel>

      <Panel title={`보관 파일 ${documents.length}건`} action={<Button variant="ghost" size="sm" onClick={reload} icon={<RefreshCw size={13} />}>새로고침</Button>}>
        <LoadState
          error={error}
          loading={!data && !error}
          empty={Boolean(data) && documents.length === 0}
          emptyTitle="보관된 파일이 없습니다"
          emptyDescription="위에서 폴더를 고르고 파일을 올리면 버전과 함께 이곳에 쌓입니다."
        />
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
                    <Button variant="secondary" size="sm" onClick={() => void download(item)} icon={<Download size={12} />}>열기</Button>
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

const MS_DAY = 86_400_000;

/** 제출 후 며칠 지났는지. 매니저 대기가 길어지는지를 팀이 스스로 판단할 수 있어야 합니다. */
function waitingDays(from: string, to = new Date().toISOString()) {
  return Math.max(0, Math.floor((Date.parse(to) - Date.parse(from)) / MS_DAY));
}

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
      <Panel title={`내 정산 건 ${submissions.length}건`} action={<Button variant="ghost" size="sm" onClick={reload} icon={<RefreshCw size={13} />}>새로고침</Button>}>
        <LoadState
          error={error}
          loading={!data && !error}
          empty={Boolean(data) && submissions.length === 0}
          emptyTitle="제출한 정산 건이 없습니다"
          emptyDescription="정산 사전검증을 통과한 집행 건을 검토 요청하면 여기에서 단계별 상태를 추적할 수 있습니다."
          emptyAction={<LinkButton href="/workspace/precheck">정산 사전검증 시작</LinkButton>}
        />
        <div className="space-y-4">
          {submissions.map((item) => {
            const reached = stepIndex(item.status);
            return (
              <article key={item.id} className={cn("rounded-2xl border p-4", item.status === "rejected" ? "border-[#FECACA]" : "border-[#E2E8F0]")}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <strong className="block text-sm font-bold text-[#0F172A]">{item.title}</strong>
                    <p className="mt-1 text-xs text-[#94A3B8]">
                      {item.createdAt.slice(0, 10)} 제출
                      {item.decision
                        ? ` · ${item.decision.createdAt.slice(0, 10)} 판정 (${waitingDays(item.createdAt, item.decision.createdAt)}일 소요)`
                        : ` · 대기 ${waitingDays(item.createdAt)}일째`}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
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
  const [copied, setCopied] = useState(false);

  // 클립보드는 보안 컨텍스트·권한에 따라 거부됩니다. 조용히 실패하면 사용자는 복사됐다고 믿습니다.
  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setMessage(`클립보드에 복사하지 못했습니다. 코드를 직접 입력해 주세요: ${code}`);
    }
  };

  const issue = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const created: TeamInvite = await createTeamInvite();
      setMessage(`초대 코드 ${created.code} 를 발급했습니다.`);
      invite.reload();
    } catch (reason) {
      setMessage(toMessage(reason, "초대 코드를 발급하지 못했습니다."));
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
      setMessage(toMessage(reason, "합류하지 못했습니다."));
    } finally {
      setBusy(false);
    }
  };

  const list = (members.data ?? []) as TeamMember[];

  return (
    <div className="space-y-5">
      <Panel title={founder ? "협약 팀 구성원" : "준비 팀 구성원"} action={<StatusBadge tone="slate">{list.length}명</StatusBadge>}>
        <LoadState error={members.error} loading={!members.data && !members.error} empty={Boolean(members.data) && list.length === 0} />
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
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <p className="font-mono text-2xl font-bold tracking-widest text-[#2563EB]">{(invite.data as TeamInvite).code}</p>
              <button
                type="button"
                onClick={() => void copyCode((invite.data as TeamInvite).code)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#2563EB] px-3 py-1.5 text-xs font-bold text-[#2563EB]"
              >
                <ClipboardCopy size={12} />{copied ? "복사됨" : "복사"}
              </button>
            </div>
            <p className="mt-2 text-xs text-[#94A3B8]">
              {(invite.data as TeamInvite).expiresAt.slice(0, 10)}까지 · {(invite.data as TeamInvite).useCount}/{(invite.data as TeamInvite).maxUses}명 사용
            </p>
          </div>
        ) : (
          <EmptyState title="발급된 초대 코드가 없습니다" description="코드를 발급해 팀원에게 전달하면 같은 워크스페이스에 합류합니다." />
        )}
        <Button className="mt-4" loading={busy} onClick={() => void issue()} icon={<UserPlus size={14} />}>새 초대 코드 발급</Button>
      </Panel>

      <Panel title="다른 팀 초대 코드로 합류">
        <div className="flex gap-2">
          <input value={joinCode} onChange={(event) => setJoinCode(event.target.value.toUpperCase())} placeholder="초대 코드" className={cn(inputClass, "mt-0 flex-1 font-mono")} />
          <Button variant="secondary" onClick={() => void join()} disabled={busy || !joinCode.trim()}>합류</Button>
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
  { label: "4대보험 사업장 성립신고", note: "직원 채용 전이라도 대표자 1인 사업장 신고가 필요합니다. 부담액은 계산기에서 확인하세요." },
];

export function IncorporationPanel() {
  const { data: selected } = useLoader(getSelectedPrograms);
  const [programId, setProgramId] = useState<string | null>(null);
  const [done, setDone] = useState<number[]>([]);

  // 팀이 실제로 고른 사업만 후보로 둡니다. 아직 못 읽었으면 전체 목록을 보여 줍니다.
  const candidates = selected?.length
    ? STARTUP_PROGRAMS.filter((item) => selected.some((row) => row.id === item.id))
    : [];
  const options = candidates.length ? candidates : STARTUP_PROGRAMS;
  const program = options.find((item) => item.id === programId) ?? options[0];
  const isTeamProgram = candidates.some((item) => item.id === program.id);

  return (
    <div className="space-y-5">
      <Panel title="설립 타이밍 확인">
        <div className="flex flex-wrap gap-2">
          {options.map((item) => (
            <ChoiceChip key={item.id} selected={program.id === item.id} onClick={() => setProgramId(item.id)}>
              {item.name}
            </ChoiceChip>
          ))}
        </div>
        {candidates.length === 0 && (
          <p className="mt-3 text-xs font-medium text-[#94A3B8]">
            준비 중인 사업을 아직 읽지 못했습니다. 아래 경고는 선택한 사업 기준이며, 최종 기준은 각 공고문입니다.
          </p>
        )}
        {program.requiresNoBusinessRegistration ? (
          <p className="mt-4 rounded-xl bg-[#FEF2F2] p-4 text-sm font-semibold leading-6 text-[#DC2626]">
            {program.name}은 신청일 기준 사업자등록이 없어야 합니다. <strong>선정 통보 이후에 설립</strong>하세요. 지금 절차를 끝내면 신청 자격이 사라집니다.
            {isTeamProgram && " 팀이 준비 중인 사업입니다."}
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
                className={cn("flex w-full items-start gap-3 rounded-xl border p-3 text-left", selectableRow, checked ? "border-[#16A34A] bg-[#F0FDF4]" : "border-[#E2E8F0]")}
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

      <ConsultationForm defaultTopic="incorporation" />
    </div>
  );
}

const CONSULTATION_TOPICS = [
  { id: "incorporation" as const, label: "법인 설립" },
  { id: "contract" as const, label: "계약서 검토" },
  { id: "ip" as const, label: "특허·상표" },
  { id: "labor" as const, label: "인사·노무" },
];

/**
 * 제휴 법무법인 상담 신청.
 *
 * 변호사법 제34조상 소개 대가를 받을 수 없어 중개나 매칭이 아니라 신청 접수만 합니다.
 * 광고 표기를 지우지 마세요. 연결 여부와 비용은 제휴처가 직접 안내합니다.
 */
export function ConsultationForm({ defaultTopic }: { defaultTopic: "incorporation" | "contract" | "ip" | "labor" }) {
  const [topic, setTopic] = useState(defaultTopic);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await requestConsultation({ topic, contactEmail: email, contactName: name, message });
      setDone(true);
    } catch (reason) {
      setError(toMessage(reason, "상담 신청을 접수하지 못했습니다."));
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    return (
      <Panel title="상담 신청 접수됨">
        <p className="text-sm leading-6 text-[#475569]">
          신청을 접수했습니다. 제휴 법무법인이 남겨 주신 주소로 직접 연락드리며, 상담 진행 여부와 비용은 제휴처가 안내합니다.
        </p>
        <Button className="mt-4" variant="secondary" size="sm" onClick={() => { setDone(false); setName(""); setEmail(""); setMessage(""); }}>
          다른 주제로 다시 신청
        </Button>
      </Panel>
    );
  }

  return (
    <Panel title="제휴 법무법인 상담 신청" action={<StatusBadge tone="slate">광고</StatusBadge>}>
      <p className="mb-4 text-sm leading-6 text-[#475569]">
        StartUp Pilot은 변호사를 소개하고 대가를 받지 않습니다. 신청 내용을 제휴 법무법인에 전달만 하며, 상담 진행과 비용은 제휴처가 직접 안내합니다.
      </p>
      <div className="mb-4 flex flex-wrap gap-2">
        {CONSULTATION_TOPICS.map((item) => (
          <ChoiceChip key={item.id} selected={topic === item.id} onClick={() => setTopic(item.id)}>{item.label}</ChoiceChip>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="이름">
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="홍길동" className={inputClass} />
        </Field>
        <Field label="이메일">
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className={inputClass} />
        </Field>
      </div>
      <div className="mt-4">
        <Field label="상담 내용" hint="선택 항목입니다">
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={3}
            placeholder="예) 예비창업패키지 선정 후 법인 전환 시점을 상담하고 싶습니다."
            className={cn(inputClass, "h-auto py-3")}
          />
        </Field>
      </div>
      {error && <div className="mt-3"><Notice tone="error" onDismiss={() => setError(null)}>{error}</Notice></div>}
      <p className="mt-3 text-xs leading-5 text-[#94A3B8]">
        입력하신 이름·이메일·상담 내용은 상담 연결 목적으로만 제휴 법무법인에 전달됩니다.
      </p>
      <Button className="mt-4" loading={saving} disabled={!name.trim() || !email.trim()} onClick={() => void submit()}>
        상담 신청
      </Button>
    </Panel>
  );
}
