"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Ban, RotateCcw, Search, ShieldAlert } from "lucide-react";
import { banMember, getCourseMembers, unbanMember, type CourseMember } from "@/lib/services/CourseService";
import { COURSE, formatDateTime, matchesQuery } from "./course";
import { CourseShell, StaffBadge, useViewer } from "./CourseChrome";
import {
  Button,
  ChoiceChip,
  EmptyState,
  Modal,
  Notice,
  Skeleton,
  StatusBadge,
  inputClass,
  textareaClass,
} from "@/features/startup-workspace/ui";
import { toMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";

type Filter = "all" | "profile" | "no-profile" | "banned";

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: "all", label: "전체" },
  { value: "profile", label: "자기소개 작성" },
  { value: "no-profile", label: "자기소개 없음" },
  { value: "banned", label: "글쓰기 제한" },
];

/**
 * 수강생 명단. 운영진 전용입니다.
 *
 * 자기소개를 안 쓴 학생도 나옵니다 — 명단이 실제 수강 인원과 맞는지 보려면 가입만 한
 * 계정도 보여야 합니다. 게시판(자기소개)은 쓴 사람만 보이므로 그것으로는 알 수 없습니다.
 */
export function CourseMembers() {
  const viewer = useViewer();
  const [members, setMembers] = useState<CourseMember[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [banning, setBanning] = useState<CourseMember | null>(null);

  const reload = useCallback(() => {
    getCourseMembers()
      .then(setMembers)
      .catch((reason) => {
        setError(toMessage(reason, "명단을 불러오지 못했습니다."));
        setMembers([]);
      });
  }, []);

  useEffect(() => {
    if (viewer.loading || !viewer.staff) return;
    reload();
  }, [viewer.loading, viewer.staff, reload]);

  const visible = useMemo(() => {
    if (!members) return [];
    return members.filter((member) => {
      if (filter === "profile" && !member.hasProfile) return false;
      if (filter === "no-profile" && member.hasProfile) return false;
      if (filter === "banned" && !member.isBanned) return false;
      return matchesQuery([member.fullName, member.email, member.major], query);
    });
  }, [members, filter, query]);

  if (viewer.loading) {
    return (
      <CourseShell active="members">
        <Skeleton className="h-10 w-52" />
        <Skeleton className="mt-4 h-64 w-full" />
      </CourseShell>
    );
  }

  // 운영진이 아니면 명단이 있다는 사실조차 알릴 이유가 없습니다.
  // (DB 함수도 FORBIDDEN으로 끊으므로 화면을 우회해도 값은 나오지 않습니다.)
  if (!viewer.staff) {
    return (
      <CourseShell active="members">
        <EmptyState
          title="접근 권한이 없습니다"
          description="수강생 명단은 담당 교수·조교만 볼 수 있습니다."
        />
      </CourseShell>
    );
  }

  const bannedCount = members?.filter((member) => member.isBanned).length ?? 0;

  return (
    <CourseShell active="members">
      <header className="mb-6">
        <h1 className="text-[26px] font-bold leading-tight tracking-tight md:text-[32px]">수강생 명단</h1>
        <p className="mt-2 text-sm leading-6 text-[#475569]">
          {COURSE.label} · 학교 메일로 가입한 계정 전체입니다. 자기소개를 쓰지 않은 학생도 포함됩니다.
        </p>
      </header>

      {error && <Notice tone="error" className="mb-4" onDismiss={() => setError(null)}>{error}</Notice>}

      <div className="mb-6 space-y-3">
        <div className="relative flex items-center">
          <Search size={18} className="pointer-events-none absolute left-4 text-[#94A3B8]" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="이름·메일·전공으로 검색"
            aria-label="수강생 검색"
            className={cn(inputClass, "mt-0 h-12 rounded-xl bg-white pl-12")}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((item) => (
            <ChoiceChip key={item.value} selected={filter === item.value} onClick={() => setFilter(item.value)}>
              {item.label}
            </ChoiceChip>
          ))}
        </div>
      </div>

      {members === null ? (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((key) => <Skeleton key={key} className="h-16 w-full" />)}
        </div>
      ) : (
        <>
          <p className="mb-3 text-sm text-[#64748B]">
            전체 <strong className="font-bold tabular-nums text-[#0F172A]">{members.length}</strong>명
            {bannedCount > 0 && <> · 글쓰기 제한 <strong className="font-bold tabular-nums text-[#DC2626]">{bannedCount}</strong>명</>}
            {query || filter !== "all" ? <> · 검색 결과 {visible.length}명</> : null}
          </p>

          {visible.length === 0 ? (
            <EmptyState title="조건에 맞는 수강생이 없습니다" description="검색어나 필터를 바꿔 보세요." />
          ) : (
            <ul className="space-y-2">
              {visible.map((member) => (
                <li
                  key={member.userId}
                  className={cn(
                    "flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border bg-white px-4 py-3.5",
                    member.isBanned ? "border-[#FECACA] bg-[#FEF2F2]" : "border-[#E2E8F0]",
                  )}
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#EFF6FF] text-sm font-bold text-[#2563EB]">
                    {member.fullName.slice(0, 1)}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <strong className="truncate text-sm font-bold">{member.fullName}</strong>
                      {member.isStaff && <StaffBadge />}
                      {member.isBanned && <StatusBadge tone="red">글쓰기 제한</StatusBadge>}
                      {!member.hasProfile && <StatusBadge tone="slate">자기소개 없음</StatusBadge>}
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-[#94A3B8]">
                      <span className="truncate">{member.email}</span>
                      {member.major && <><span aria-hidden>·</span><span>{member.major}</span></>}
                      <span aria-hidden>·</span>
                      <span className="tabular-nums">가입 {formatDateTime(member.joinedAt)}</span>
                    </span>
                    {member.isBanned && member.banReason && (
                      <span className="mt-1 block text-xs font-medium text-[#DC2626]">사유: {member.banReason}</span>
                    )}
                  </span>

                  {/* 운영진끼리는 서로 막지 못합니다. 실수로 서로를 잠그면 풀 사람이 없습니다. */}
                  {!member.isStaff && (
                    member.isBanned ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={<RotateCcw size={13} />}
                        onClick={() => void unbanMember(member.userId).then(reload).catch((reason) => setError(toMessage(reason, "해제하지 못했습니다.")))}
                      >
                        제한 해제
                      </Button>
                    ) : (
                      <Button variant="danger" size="sm" icon={<Ban size={13} />} onClick={() => setBanning(member)}>
                        글쓰기 제한
                      </Button>
                    )
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {banning && (
        <BanModal
          member={banning}
          onClose={() => setBanning(null)}
          onDone={() => { setBanning(null); reload(); }}
        />
      )}
    </CourseShell>
  );
}

/**
 * 제한 확인.
 *
 * 무엇이 일어나고 무엇이 일어나지 않는지 먼저 말합니다 — "강퇴"라는 말에서
 * 흔히 기대하는 것(글이 사라짐, 못 들어옴)과 실제 동작이 다르기 때문입니다.
 */
function BanModal({ member, onClose, onDone }: { member: CourseMember; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await banMember(member.userId, reason);
      onDone();
    } catch (reason_) {
      setError(toMessage(reason_, "제한하지 못했습니다."));
      setSaving(false);
    }
  };

  return (
    <Modal
      title={`${member.fullName} 글쓰기 제한`}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>취소</Button>
          <Button variant="danger" loading={saving} onClick={() => void submit()}>제한하기</Button>
        </>
      }
    >
      <div className="mt-4 space-y-4">
        <div className="flex items-start gap-3 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-4 text-sm leading-6 text-[#B45309]">
          <ShieldAlert size={17} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-bold">이렇게 동작합니다</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4 font-medium">
              <li>새 글·댓글·팀 등록·결과물 제출이 막힙니다.</li>
              <li>이미 올린 글과 댓글은 <strong>그대로 남습니다.</strong> 지우려면 따로 삭제해 주세요.</li>
              <li>게시판 읽기는 막지 않습니다 — 로그인 없이도 열리는 공개 게시판이라 막을 수 없습니다.</li>
              <li>언제든 한 번에 해제할 수 있습니다.</li>
            </ul>
          </div>
        </div>

        <label className="block text-sm font-bold">
          사유
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="나중에 왜 제한했는지 알아볼 수 있게 적어 두세요. 본인에게는 보이지 않습니다."
            className={cn(textareaClass, "min-h-24")}
          />
        </label>

        {error && <Notice tone="error" onDismiss={() => setError(null)}>{error}</Notice>}
      </div>
    </Modal>
  );
}
