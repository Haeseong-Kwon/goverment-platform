"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Paperclip, Plus, X } from "lucide-react";
import {
  createProposal,
  createRecruitPost,
  createTeam,
  getMyLedTeams,
  saveDeliverable,
  createNotice,
  saveSemesterProfile,
  uploadProposalFile,
} from "@/lib/services/CourseService";
import {
  DELIVERABLE_PHASE_LABEL,
  PROJECT_PHASE_LABEL,
  PROPOSAL_CATEGORIES,
  ROLE_PRESETS,
  ATTACHMENT_ACCEPT,
  MAX_ATTACHMENT_BYTES,
  STUDENT_STATUS_LABEL,
  checkAttachment,
  courseHref,
  formatBytes,
  emptyToNull,
  splitTags,
  validateOptionalUrl,
  validateTitleAndBody,
  type CourseTeam,
  type DeliverablePhase,
  type ProjectPhase,
  type RecruitRole,
  type SemesterProfile,
  type StudentStatus,
  type TeamMember,
} from "./course";
import {
  Button,
  ChoiceChip,
  Field,
  IconButton,
  Modal,
  Notice,
  Skeleton,
  inputClass,
  selectClass,
  textareaClass,
} from "@/features/startup-workspace/ui";
import { toMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";

/**
 * 글쓰기 폼 네 개.
 *
 * 모두 같은 모양입니다 — 모달로 열리고, 저장에 성공하면 만들어진 글의 id를 돌려주고
 * 닫힙니다. 목록 화면은 그 id로 상세로 보냅니다. 실패는 모달 안에서 알리고 닫지
 * 않습니다. 쓰던 내용을 지운 채 "실패했습니다"만 남기면 다시 쓸 수가 없습니다.
 */
interface FormProps {
  onClose: () => void;
  onCreated: (id: string) => void;
}

/** 저장 버튼 하나에 붙는 상태(진행 중·오류)를 폼마다 다시 쓰지 않게 모읍니다. */
function useSubmit(onCreated: (id: string) => void) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (validate: () => string | null, save: () => Promise<string>) => {
    const problem = validate();
    if (problem) { setError(problem); return; }
    setSaving(true);
    setError(null);
    try {
      onCreated(await save());
    } catch (reason) {
      setError(toMessage(reason, "저장하지 못했습니다. 잠시 후 다시 시도해 주세요."));
    } finally {
      setSaving(false);
    }
  };

  return { saving, error, setError, run };
}

// ---------------------------------------------------------------- 공지

export function NoticeForm({ onClose, onCreated }: FormProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isPinned, setIsPinned] = useState(false);
  const { saving, error, setError, run } = useSubmit(onCreated);

  const submit = () =>
    run(() => validateTitleAndBody(title, content), () => createNotice({ title, content, isPinned }));

  return (
    <Modal
      title="공지 올리기"
      description="수강생 전체가 보는 공지입니다. 마감일이나 발표 순서처럼 계속 확인해야 하는 내용은 상단 고정을 켜 주세요."
      onClose={onClose}
      wide
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>취소</Button>
          <Button loading={saving} onClick={() => void submit()}>공지 등록</Button>
        </>
      }
    >
      <div className="mt-5 space-y-4">
        <Field label="제목" required>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="예: 3주차 — 팀 확정 등록 마감 안내"
            className={inputClass}
          />
        </Field>

        <Field label="내용" required hint="언제까지 무엇을 해야 하는지 분명히 적어 주세요.">
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder={"제출 기한, 대상, 방법을 적어 주세요.\n예) 9월 22일(월) 23:59까지 확정 팀 게시판에 팀장이 등록"}
            className={cn(textareaClass, "min-h-48")}
          />
        </Field>

        <label className="flex cursor-pointer items-start gap-2.5 text-sm leading-6 text-[#475569]">
          <input
            type="checkbox"
            checked={isPinned}
            onChange={(event) => setIsPinned(event.target.checked)}
            className="mt-1 accent-[#2563EB]"
          />
          <span>
            <strong className="font-bold text-[#0F172A]">상단 고정</strong>
            <span className="block text-xs text-[#94A3B8]">목록 맨 위에 계속 표시됩니다. 마감 안내에 씁니다.</span>
          </span>
        </label>

        {error && <Notice tone="error" onDismiss={() => setError(null)}>{error}</Notice>}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- 팀빌딩 모집

export function RecruitForm({ onClose, onCreated }: FormProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [phase, setPhase] = useState<ProjectPhase>("IDEA");
  const [roles, setRoles] = useState<RecruitRole[]>([]);
  const [tags, setTags] = useState("");
  const { saving, error, setError, run } = useSubmit(onCreated);

  const toggleRole = (role: string) =>
    setRoles((current) =>
      current.some((item) => item.role === role)
        ? current.filter((item) => item.role !== role)
        : [...current, { role, count: 1 }],
    );

  const setCount = (role: string, count: number) =>
    setRoles((current) => current.map((item) => (item.role === role ? { ...item, count: Math.max(1, count) } : item)));

  const submit = () =>
    run(
      () => validateTitleAndBody(title, content) ?? (roles.length === 0 ? "모집할 역할을 하나 이상 골라 주세요." : null),
      () => createRecruitPost({ title, content, tags: splitTags(tags), projectPhase: phase, recruitingRoles: roles }),
    );

  return (
    <Modal
      title="팀원 모집글 쓰기"
      description="아이디어가 아직 한 줄이어도 괜찮습니다. 어떤 역할이 필요한지가 가장 중요합니다."
      onClose={onClose}
      wide
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>취소</Button>
          <Button loading={saving} onClick={() => void submit()}>모집글 등록</Button>
        </>
      }
    >
      <div className="mt-5 space-y-4">
        <Field label="제목" required hint="한 줄로 무엇을 만들 팀인지 알 수 있게 적어 주세요.">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="예: 캠퍼스 중고거래 앱, 프론트엔드 2명 찾습니다"
            className={inputClass}
          />
        </Field>

        <Field label="아이디어 소개" required hint="어떤 문제를 풀고 싶은지, 지금 어디까지 되어 있는지.">
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="풀고 싶은 문제, 지금까지 준비한 것, 팀 운영 방식(회의 시간 등)을 적으면 지원자가 판단하기 쉽습니다."
            className={cn(textareaClass, "min-h-40")}
          />
        </Field>

        <fieldset>
          <legend className="text-sm font-bold">진행 단계</legend>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {(Object.keys(PROJECT_PHASE_LABEL) as ProjectPhase[]).map((item) => (
              <ChoiceChip key={item} selected={phase === item} onClick={() => setPhase(item)}>
                {PROJECT_PHASE_LABEL[item]}
              </ChoiceChip>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-bold">
            모집 역할 <span className="text-[#DC2626]">*</span>
          </legend>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {ROLE_PRESETS.map((role) => (
              <ChoiceChip key={role} selected={roles.some((item) => item.role === role)} onClick={() => toggleRole(role)}>
                {role}
              </ChoiceChip>
            ))}
          </div>
          {roles.length > 0 && (
            <ul className="mt-3 space-y-2">
              {roles.map((item) => (
                <li key={item.role} className="flex items-center gap-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{item.role}</span>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-[#64748B]">
                    모집
                    <input
                      type="number"
                      min={1}
                      max={9}
                      value={item.count}
                      onChange={(event) => setCount(item.role, Number(event.target.value))}
                      aria-label={`${item.role} 모집 인원`}
                      className={cn(inputClass, "mt-0 h-9 w-16 text-center tabular-nums")}
                    />
                    명
                  </label>
                  <IconButton label={`${item.role} 제외`} icon={<X size={14} />} onClick={() => toggleRole(item.role)} />
                </li>
              ))}
            </ul>
          )}
        </fieldset>

        <Field label="태그" hint="쉼표로 구분합니다. 예: React, 헬스케어, 하드웨어">
          <input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="React, 헬스케어" className={inputClass} />
        </Field>

        {error && <Notice tone="error" onDismiss={() => setError(null)}>{error}</Notice>}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- 기업 제안

export function ProposalForm({ onClose, onCreated }: FormProps) {
  const [companyName, setCompanyName] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [uploadNote, setUploadNote] = useState<string | null>(null);
  // 같은 파일을 뺐다가 다시 고를 수 있어야 합니다. input은 값이 같으면 change를 안 냅니다.
  const fileInput = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [deadline, setDeadline] = useState("");
  const [contact, setContact] = useState("");
  const { saving, error, setError, run } = useSubmit(onCreated);

  const toggleCategory = (value: string) =>
    setCategories((current) => (current.includes(value) ? current.filter((item) => item !== value) : [...current, value]));

  const pickFiles = (picked: FileList | null) => {
    if (!picked) return;
    const chosen = Array.from(picked);
    // 형식·용량은 고르는 순간 알려 줍니다.
    const problem = chosen.map(checkAttachment).find(Boolean);
    if (problem) { setError(problem); return; }
    setError(null);
    setFiles((current) => [...current, ...chosen]);
  };

  const submit = () =>
    run(
      () => (companyName.trim().length < 2 ? "기업·기관명을 입력해 주세요." : validateTitleAndBody(title, content)),
      async () => {
        const id = await createProposal({
          companyName,
          title,
          content,
          categories,
          deadline: emptyToNull(deadline),
          contact: emptyToNull(contact),
        });
        /*
         * 첨부는 제안이 생긴 뒤에 붙습니다(파일 행이 제안 id를 참조).
         * 업로드가 실패해도 제안 자체는 이미 남았으므로, 실패한 파일만 따로 알리고
         * 등록은 그대로 진행합니다 — 여기서 통째로 실패시키면 쓴 글이 사라집니다.
         */
        const failures: string[] = [];
        for (const file of files) {
          try {
            await uploadProposalFile(id, file);
          } catch (reason) {
            failures.push(toMessage(reason, `${file.name}을(를) 올리지 못했습니다.`));
          }
        }
        if (failures.length > 0) setUploadNote(failures.join(" "));
        return id;
      },
    );

  return (
    <Modal
      title="기업 제안 올리기"
      description="기업이 실제로 겪는 문제와 기대하는 결과물을 적어 주세요. 팀이 지원 여부를 판단할 수 있어야 합니다."
      onClose={onClose}
      wide
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>취소</Button>
          <Button loading={saving} onClick={() => void submit()}>제안 등록</Button>
        </>
      }
    >
      <div className="mt-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="기업·기관명" required>
            <input value={companyName} onChange={(event) => setCompanyName(event.target.value)} placeholder="예: (주)한양테크" className={inputClass} />
          </Field>
          <Field label="지원 마감일" hint="비워 두면 상시 모집으로 표시됩니다.">
            <input type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} className={cn(selectClass, "tabular-nums")} />
          </Field>
        </div>

        <Field label="제안 제목" required>
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="예: 물류창고 재고 오차를 줄이는 비전 검수 도구" className={inputClass} />
        </Field>

        <Field label="제안 내용" required hint="문제 상황, 기대하는 결과물, 제공 가능한 데이터·지원을 적어 주세요.">
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="현재 어떤 방식으로 처리하고 있고 무엇이 문제인지, 학기 말에 어떤 산출물을 기대하는지 적어 주세요."
            className={cn(textareaClass, "min-h-40")}
          />
        </Field>

        <fieldset>
          <legend className="text-sm font-bold">분야</legend>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {PROPOSAL_CATEGORIES.map((item) => (
              <ChoiceChip key={item} selected={categories.includes(item)} onClick={() => toggleCategory(item)}>
                {item}
              </ChoiceChip>
            ))}
          </div>
        </fieldset>

        <Field label="담당자 연락처" hint="이메일이나 연락 방법. 공개 게시판에 그대로 표시됩니다.">
          <input value={contact} onChange={(event) => setContact(event.target.value)} placeholder="pm@example.com" className={inputClass} />
        </Field>

        <fieldset>
          <legend className="text-sm font-bold">첨부파일</legend>
          <p className="mt-1 text-xs font-medium text-[#94A3B8]">
            과업지시서·데이터 명세 등을 올릴 수 있습니다. 파일당 {Math.floor(MAX_ATTACHMENT_BYTES / 1024 / 1024)}MB 이하.
            <strong className="text-[#B45309]"> 공개 게시판이라 첨부도 누구나 내려받을 수 있습니다.</strong>
          </p>

          {files.length > 0 && (
            <ul className="mt-2 space-y-1.5">
              {files.map((file, index) => (
                <li key={`${file.name}-${index}`} className="flex items-center gap-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] py-2 pl-3 pr-1.5 text-xs font-semibold text-[#475569]">
                  <Paperclip size={13} className="shrink-0 text-[#94A3B8]" />
                  <span className="min-w-0 flex-1 truncate">{file.name}</span>
                  <span className="shrink-0 tabular-nums text-[#94A3B8]">{formatBytes(file.size)}</span>
                  <IconButton
                    label={`${file.name} 첨부 취소`}
                    icon={<X size={13} />}
                    onClick={() => setFiles((current) => current.filter((_, at) => at !== index))}
                    className="h-6 w-6"
                  />
                </li>
              ))}
            </ul>
          )}

          <input
            ref={fileInput}
            type="file"
            multiple
            accept={ATTACHMENT_ACCEPT}
            onChange={(event) => pickFiles(event.target.files)}
            className="hidden"
            aria-hidden
            tabIndex={-1}
          />
          <Button
            variant="secondary"
            size="sm"
            icon={<Paperclip size={14} />}
            onClick={() => fileInput.current?.click()}
            className="mt-2"
          >
            파일 선택
          </Button>
        </fieldset>

        {uploadNote && <Notice tone="warning" onDismiss={() => setUploadNote(null)}>{uploadNote}</Notice>}
        {error && <Notice tone="error" onDismiss={() => setError(null)}>{error}</Notice>}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- 확정 팀

const EMPTY_MEMBER: TeamMember = { name: "", role: "" };

export function TeamForm({ onClose, onCreated }: FormProps) {
  const [teamName, setTeamName] = useState("");
  const [projectItem, setProjectItem] = useState("");
  const [members, setMembers] = useState<TeamMember[]>([EMPTY_MEMBER, EMPTY_MEMBER]);
  const { saving, error, setError, run } = useSubmit(onCreated);

  const editMember = (index: number, changes: Partial<TeamMember>) =>
    setMembers((current) => current.map((item, at) => (at === index ? { ...item, ...changes } : item)));

  const filled = members.filter((item) => item.name.trim());

  const submit = () =>
    run(
      () => {
        if (teamName.trim().length < 2) return "팀 이름을 입력해 주세요.";
        if (projectItem.trim().length < 2) return "프로젝트 아이템을 입력해 주세요.";
        if (filled.length === 0) return "팀원을 한 명 이상 입력해 주세요.";
        return null;
      },
      () =>
        createTeam({
          teamName,
          projectItem,
          members: filled.map((item) => ({ name: item.name.trim(), role: item.role.trim() })),
        }),
    );

  return (
    <Modal
      title="우리 팀 등록"
      description="팀 구성이 끝났다면 팀장이 등록합니다. 등록한 팀에만 중간·기말 결과물을 올릴 수 있습니다."
      onClose={onClose}
      wide
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>취소</Button>
          <Button loading={saving} onClick={() => void submit()}>팀 등록</Button>
        </>
      }
    >
      <div className="mt-5 space-y-4">
        <Field label="팀 이름" required>
          <input value={teamName} onChange={(event) => setTeamName(event.target.value)} placeholder="예: 오르카랩스" className={inputClass} />
        </Field>

        <Field label="프로젝트 아이템" required hint="무엇을 만드는 팀인지 한 줄로.">
          <input value={projectItem} onChange={(event) => setProjectItem(event.target.value)} placeholder="예: 캠퍼스 중고거래 앱" className={inputClass} />
        </Field>

        <fieldset>
          <legend className="text-sm font-bold">
            팀원 <span className="text-[#DC2626]">*</span>
          </legend>
          <p className="mt-1 text-xs font-medium text-[#94A3B8]">등록하는 사람이 팀장입니다. 본인도 명단에 포함해 주세요.</p>
          <ul className="mt-2 space-y-2">
            {members.map((member, index) => (
              <li key={index} className="flex gap-2">
                <input
                  value={member.name}
                  onChange={(event) => editMember(index, { name: event.target.value })}
                  placeholder="이름"
                  aria-label={`팀원 ${index + 1} 이름`}
                  className={cn(inputClass, "mt-0 flex-1")}
                />
                <input
                  value={member.role}
                  onChange={(event) => editMember(index, { role: event.target.value })}
                  placeholder="역할 (예: 백엔드)"
                  aria-label={`팀원 ${index + 1} 역할`}
                  className={cn(inputClass, "mt-0 flex-1")}
                />
                <IconButton
                  label={`팀원 ${index + 1} 삭제`}
                  icon={<X size={15} />}
                  disabled={members.length <= 1}
                  onClick={() => setMembers((current) => current.filter((_, at) => at !== index))}
                  className="h-11 w-11 shrink-0"
                />
              </li>
            ))}
          </ul>
          <Button
            variant="secondary"
            size="sm"
            icon={<Plus size={14} />}
            onClick={() => setMembers((current) => [...current, EMPTY_MEMBER])}
            className="mt-2"
          >
            팀원 추가
          </Button>
        </fieldset>

        {error && <Notice tone="error" onDismiss={() => setError(null)}>{error}</Notice>}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- 수강생 프로필

/**
 * 이번 학기 프로필.
 *
 * 다른 폼과 달리 이미 있는 값을 채워 열립니다 — 등록과 수정이 같은 화면입니다.
 * 학기당 한 장이라 "새로 쓰기"가 따로 없습니다.
 */
export function SemesterProfileForm({
  current,
  onClose,
  onSaved,
}: {
  current: SemesterProfile | null;
  onClose: () => void;
  onSaved: (profile: SemesterProfile) => void;
}) {
  const [fullName, setFullName] = useState(current?.fullName ?? "");
  const [major, setMajor] = useState(current?.major ?? "");
  const [role, setRole] = useState(current && current.role !== "Student" ? current.role : "");
  const [bio, setBio] = useState(current?.bio ?? "");
  const [techStack, setTechStack] = useState((current?.techStack ?? []).join(", "));
  const [github, setGithub] = useState(current?.githubUrl ?? "");
  const [portfolio, setPortfolio] = useState(current?.portfolioUrl ?? "");
  const [status, setStatus] = useState<StudentStatus>(current?.status ?? "LOOKING");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const problem =
      fullName.trim().length < 2 ? "이름을 입력해 주세요."
      : validateOptionalUrl(github, "GitHub") ?? validateOptionalUrl(portfolio, "포트폴리오");
    if (problem) { setError(problem); return; }

    setSaving(true);
    setError(null);
    try {
      onSaved(
        await saveSemesterProfile({
          fullName,
          major,
          role,
          bio,
          techStack: splitTags(techStack),
          githubUrl: emptyToNull(github),
          portfolioUrl: emptyToNull(portfolio),
          status,
        }),
      );
    } catch (reason) {
      setError(toMessage(reason, "프로필을 저장하지 못했습니다."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={current ? "수강생 프로필 수정" : "수강생 프로필 등록"}
      description="팀빌딩 게시판에서 다른 팀이 보는 정보입니다. 학기마다 따로 저장되어 지난 학기 기록은 그대로 남습니다."
      onClose={onClose}
      wide
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>취소</Button>
          <Button loading={saving} onClick={() => void submit()}>{current ? "저장" : "등록"}</Button>
        </>
      }
    >
      <div className="mt-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="이름" required hint="확정 팀 명단에 적는 이름과 같게 써 주세요.">
            <input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="김하나" className={inputClass} />
          </Field>
          <Field label="전공">
            <input value={major} onChange={(event) => setMajor(event.target.value)} placeholder="컴퓨터학부" className={inputClass} />
          </Field>
        </div>

        <fieldset>
          <legend className="text-sm font-bold">희망 역할</legend>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {ROLE_PRESETS.map((item) => (
              <ChoiceChip key={item} selected={role === item} onClick={() => setRole(role === item ? "" : item)}>
                {item}
              </ChoiceChip>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-bold">지금 상태</legend>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {(Object.keys(STUDENT_STATUS_LABEL) as StudentStatus[]).map((item) => (
              <ChoiceChip key={item} selected={status === item} onClick={() => setStatus(item)}>
                {STUDENT_STATUS_LABEL[item]}
              </ChoiceChip>
            ))}
          </div>
        </fieldset>

        <Field label="한 줄 소개" hint="관심 분야나 해보고 싶은 아이템을 적으면 연락이 옵니다.">
          <textarea
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            placeholder="헬스케어 쪽 앱을 만들어 보고 싶습니다. React Native 경험이 있습니다."
            className={cn(textareaClass, "min-h-28")}
          />
        </Field>

        <Field label="기술 스택" hint="쉼표로 구분합니다. 예: React, Python, Figma">
          <input value={techStack} onChange={(event) => setTechStack(event.target.value)} placeholder="React, Python" className={inputClass} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="GitHub">
            <input type="url" value={github} onChange={(event) => setGithub(event.target.value)} placeholder="https://github.com/id" className={inputClass} />
          </Field>
          <Field label="포트폴리오">
            <input type="url" value={portfolio} onChange={(event) => setPortfolio(event.target.value)} placeholder="https://notion.so/..." className={inputClass} />
          </Field>
        </div>

        {error && <Notice tone="error" onDismiss={() => setError(null)}>{error}</Notice>}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- 결과물

const LINK_FIELDS = [
  { key: "demoUrl", label: "데모 · 배포 주소", placeholder: "https://our-demo.vercel.app" },
  { key: "repoUrl", label: "저장소", placeholder: "https://github.com/team/repo" },
  { key: "deckUrl", label: "발표자료", placeholder: "https://drive.google.com/..." },
  { key: "videoUrl", label: "시연 영상", placeholder: "https://youtu.be/..." },
] as const;

type LinkKey = (typeof LINK_FIELDS)[number]["key"];

export function DeliverableForm({ onClose, onCreated }: FormProps) {
  const [teams, setTeams] = useState<CourseTeam[] | null>(null);
  const [teamId, setTeamId] = useState("");
  const [phase, setPhase] = useState<DeliverablePhase>("midterm");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [techStack, setTechStack] = useState("");
  const [links, setLinks] = useState<Record<LinkKey, string>>({ demoUrl: "", repoUrl: "", deckUrl: "", videoUrl: "" });
  const { saving, error, setError, run } = useSubmit(onCreated);

  useEffect(() => {
    let mounted = true;
    getMyLedTeams()
      .then((rows) => {
        if (!mounted) return;
        setTeams(rows);
        if (rows[0]) setTeamId(rows[0].id);
      })
      .catch(() => { if (mounted) setTeams([]); });
    return () => { mounted = false; };
  }, []);

  const submit = () =>
    run(
      () => {
        if (!teamId) return "결과물을 등록할 팀을 골라 주세요.";
        if (title.trim().length < 2) return "제목을 입력해 주세요.";
        if (summary.trim().length < 10) return "요약은 10자 이상 입력해 주세요.";
        return LINK_FIELDS.map((field) => validateOptionalUrl(links[field.key], field.label)).find(Boolean) ?? null;
      },
      () =>
        saveDeliverable({
          teamId,
          phase,
          title,
          summary,
          techStack: splitTags(techStack),
          demoUrl: emptyToNull(links.demoUrl),
          repoUrl: emptyToNull(links.repoUrl),
          deckUrl: emptyToNull(links.deckUrl),
          videoUrl: emptyToNull(links.videoUrl),
        }),
    );

  // 팀이 없으면 폼을 보여 줄 이유가 없습니다. 팀 등록으로 보내는 편이 빠릅니다.
  if (teams !== null && teams.length === 0) {
    return (
      <Modal title="결과물 등록" onClose={onClose} footer={<Button variant="ghost" onClick={onClose}>닫기</Button>}>
        <div className="mt-4">
          <Notice tone="info">
            결과물은 등록된 팀의 팀장만 올릴 수 있습니다. 먼저 확정 팀을 등록해 주세요.
          </Notice>
          <Link href={courseHref("team")} className="mt-4 inline-block text-sm font-bold text-[#2563EB] hover:underline">
            확정 팀 게시판으로 이동
          </Link>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title="결과물 등록"
      description="같은 팀·같은 단계로 다시 등록하면 새 글이 아니라 기존 글이 갱신됩니다."
      onClose={onClose}
      wide
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>취소</Button>
          <Button loading={saving} disabled={teams === null} onClick={() => void submit()}>결과물 저장</Button>
        </>
      }
    >
      <div className="mt-5 space-y-4">
        {teams === null ? (
          <Skeleton className="h-11 w-full" />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="팀" required>
              <select value={teamId} onChange={(event) => setTeamId(event.target.value)} className={selectClass}>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>{team.teamName}</option>
                ))}
              </select>
            </Field>
            <Field label="단계" required>
              <select
                value={phase}
                onChange={(event) => setPhase(event.target.value as DeliverablePhase)}
                className={selectClass}
              >
                {(Object.keys(DELIVERABLE_PHASE_LABEL) as DeliverablePhase[]).map((item) => (
                  <option key={item} value={item}>{DELIVERABLE_PHASE_LABEL[item]}</option>
                ))}
              </select>
            </Field>
          </div>
        )}

        <Field label="제목" required>
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="예: 중고거래 앱 MVP — 실사용자 40명 검증" className={inputClass} />
        </Field>

        <Field label="요약" required hint="무엇을 만들었고 무엇이 확인되었는지.">
          <textarea
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            placeholder="구현 범위, 실제로 검증한 것, 다음 단계에 남은 것을 적어 주세요."
            className={cn(textareaClass, "min-h-32")}
          />
        </Field>

        <Field label="기술 스택" hint="쉼표로 구분합니다. 예: Next.js, Supabase, YOLOv8">
          <input value={techStack} onChange={(event) => setTechStack(event.target.value)} placeholder="Next.js, Supabase" className={inputClass} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          {LINK_FIELDS.map((field) => (
            <Field key={field.key} label={field.label}>
              <input
                type="url"
                value={links[field.key]}
                onChange={(event) => setLinks((current) => ({ ...current, [field.key]: event.target.value }))}
                placeholder={field.placeholder}
                className={inputClass}
              />
            </Field>
          ))}
        </div>

        {error && <Notice tone="error" onDismiss={() => setError(null)}>{error}</Notice>}
      </div>
    </Modal>
  );
}
