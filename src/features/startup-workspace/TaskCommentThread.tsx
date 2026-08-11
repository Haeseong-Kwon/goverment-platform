"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRight, Paperclip, X } from "lucide-react";
import { addTaskComment, getTaskComments, type TaskComment } from "@/lib/services/WorkspaceService";
import { ATTACHMENT_ACCEPT, checkAttachment, uploadCommentFile } from "@/lib/services/FounderWorkspaceService";
import { CommentDetail, formatBytes } from "./CommentDetail";
import { Button, IconButton, focusRing, inputClass } from "./ui";
import { cn } from "@/lib/utils";
import { toMessage } from "@/lib/errors";

/**
 * 일정 코멘트 스레드.
 *
 * 실시간 채팅 대신 업무 객체(workspace_tasks 한 행)에 붙습니다. 열었을 때만 조회해
 * 목록 로딩을 무겁게 하지 않습니다. 할 일 보드와 마감 캘린더가 같은 스레드를 공유하므로,
 * 한쪽에서 남긴 코멘트가 다른 쪽에서도 그대로 보입니다.
 *
 * 한 줄은 요약만 보여 주고, 누르면 상세(전문·첨부 미리보기/다운로드)로 한 단계 들어갑니다.
 */
export function TaskCommentThread({ taskId, taskTitle, onAdded }: { taskId: string; taskTitle?: string; onAdded?: () => void }) {
  const [comments, setComments] = useState<TaskComment[] | null>(null);
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  // 같은 파일을 지웠다가 다시 고를 수 있어야 합니다. input은 값이 같으면 change를 안 냅니다.
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let mounted = true;
    setComments(null);
    getTaskComments(taskId)
      .then((rows) => { if (mounted) setComments(rows); })
      .catch((reason) => { if (mounted) { setComments([]); setError(toMessage(reason, "코멘트를 불러오지 못했습니다.")); } });
    return () => { mounted = false; };
  }, [taskId]);

  const pickFiles = (picked: FileList | null) => {
    if (!picked) return;
    const chosen = Array.from(picked);
    // 형식·용량은 고르는 순간 알려 줍니다. 등록을 누른 뒤에 거절하면 쓴 글까지 붙잡힙니다.
    const problem = chosen.map(checkAttachment).find(Boolean);
    if (problem) { setError(problem); return; }
    setError(null);
    setAttachments((current) => [...current, ...chosen]);
  };

  const submit = async () => {
    if (saving || !draft.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const created = await addTaskComment(taskId, draft);
      // 첨부는 코멘트가 생긴 뒤에 붙습니다(파일 행이 코멘트 id를 참조). 업로드가 실패해도
      // 코멘트 자체는 이미 남았으므로, 화면에는 성공한 파일만 얹고 실패는 따로 알립니다.
      const uploaded: TaskComment["files"] = [];
      const failures: string[] = [];
      for (const file of attachments) {
        try {
          uploaded.push(await uploadCommentFile(created.id, file));
        } catch (reason) {
          failures.push(toMessage(reason, `${file.name}을(를) 올리지 못했습니다.`));
        }
      }
      setComments((current) => [...(current ?? []), { ...created, files: uploaded }]);
      setDraft("");
      setAttachments([]);
      if (fileInput.current) fileInput.current.value = "";
      if (failures.length > 0) setError(failures.join(" "));
      onAdded?.();
    } catch (reason) {
      setError(toMessage(reason, "코멘트를 남기지 못했습니다."));
    } finally {
      setSaving(false);
    }
  };

  const openComment = comments?.find((comment) => comment.id === openId) ?? null;

  return (
    <div className="mt-3 space-y-2 rounded-lg bg-[#F8FAFC] p-3">
      {comments === null && <p className="text-xs text-[#94A3B8]">불러오는 중…</p>}
      {comments?.length === 0 && <p className="text-xs text-[#94A3B8]">첫 코멘트를 남겨 보세요.</p>}
      {comments?.map((comment) => (
        <button
          key={comment.id}
          type="button"
          onClick={() => setOpenId(comment.id)}
          aria-label={`${comment.authorName}의 코멘트 상세 열기`}
          className={cn("block w-full rounded-lg bg-white p-2.5 text-left transition-colors hover:bg-[#EFF6FF]", focusRing)}
        >
          <div className="flex items-baseline justify-between gap-2">
            <strong className="text-xs font-bold text-[#0F172A]">{comment.authorName}</strong>
            <span className="shrink-0 text-[11px] text-[#94A3B8]">{comment.createdAt.slice(0, 10)}</span>
          </div>
          {/* 목록은 두 줄까지만. 전문은 상세에서 봅니다. */}
          <p className="mt-1 line-clamp-2 break-keep text-xs leading-5 text-[#475569]">{comment.content}</p>
          <div className="mt-1.5 flex items-center gap-2">
            {comment.files.length > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#2563EB]">
                <Paperclip size={11} />첨부 {comment.files.length}
              </span>
            )}
            <span className="ml-auto inline-flex items-center gap-0.5 text-[11px] font-bold text-[#94A3B8]">
              상세 <ChevronRight size={11} />
            </span>
          </div>
        </button>
      ))}

      {error && <p className="text-xs font-semibold text-[#DC2626]">{error}</p>}

      {attachments.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {attachments.map((file, index) => (
            <li key={`${file.name}-${index}`} className="flex items-center gap-1 rounded-lg bg-white py-1 pl-2 pr-1 text-[11px] font-semibold text-[#475569]">
              <Paperclip size={11} className="text-[#94A3B8]" />
              <span className="max-w-[12rem] truncate">{file.name}</span>
              <span className="text-[#94A3B8]">{formatBytes(file.size)}</span>
              <IconButton
                label={`${file.name} 첨부 취소`}
                icon={<X size={12} />}
                onClick={() => setAttachments((current) => current.filter((_, at) => at !== index))}
                className="h-5 w-5"
              />
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-1.5">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter") void submit(); }}
          placeholder="코멘트 남기기"
          aria-label="코멘트 입력"
          className={cn(inputClass, "h-9 text-xs")}
        />
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
          aria-label="파일 첨부"
          className="shrink-0"
        />
        <Button size="sm" loading={saving} disabled={!draft.trim()} onClick={() => void submit()}>등록</Button>
      </div>

      {openComment && <CommentDetail comment={openComment} taskTitle={taskTitle} onClose={() => setOpenId(null)} />}
    </div>
  );
}
