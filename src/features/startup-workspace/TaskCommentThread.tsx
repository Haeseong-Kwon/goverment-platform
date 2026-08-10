"use client";

import { useEffect, useState } from "react";
import { addTaskComment, getTaskComments, type TaskComment } from "@/lib/services/WorkspaceService";
import { Button, inputClass } from "./ui";
import { cn } from "@/lib/utils";
import { toMessage } from "@/lib/errors";

/**
 * 일정 코멘트 스레드.
 *
 * 실시간 채팅 대신 업무 객체(workspace_tasks 한 행)에 붙습니다. 열었을 때만 조회해
 * 목록 로딩을 무겁게 하지 않습니다. 할 일 보드와 마감 캘린더가 같은 스레드를 공유하므로,
 * 한쪽에서 남긴 코멘트가 다른 쪽에서도 그대로 보입니다.
 */
export function TaskCommentThread({ taskId, onAdded }: { taskId: string; onAdded?: () => void }) {
  const [comments, setComments] = useState<TaskComment[] | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setComments(null);
    getTaskComments(taskId)
      .then((rows) => { if (mounted) setComments(rows); })
      .catch((reason) => { if (mounted) { setComments([]); setError(toMessage(reason, "코멘트를 불러오지 못했습니다.")); } });
    return () => { mounted = false; };
  }, [taskId]);

  const submit = async () => {
    if (saving || !draft.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const created = await addTaskComment(taskId, draft);
      setComments((current) => [...(current ?? []), created]);
      setDraft("");
      onAdded?.();
    } catch (reason) {
      setError(toMessage(reason, "코멘트를 남기지 못했습니다."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 space-y-2 rounded-lg bg-[#F8FAFC] p-3">
      {comments === null && <p className="text-xs text-[#94A3B8]">불러오는 중…</p>}
      {comments?.length === 0 && <p className="text-xs text-[#94A3B8]">첫 코멘트를 남겨 보세요.</p>}
      {comments?.map((comment) => (
        <div key={comment.id} className="rounded-lg bg-white p-2.5">
          <div className="flex items-baseline justify-between gap-2">
            <strong className="text-xs font-bold text-[#0F172A]">{comment.authorName}</strong>
            <span className="shrink-0 text-[11px] text-[#94A3B8]">{comment.createdAt.slice(0, 10)}</span>
          </div>
          <p className="mt-1 break-keep text-xs leading-5 text-[#475569]">{comment.content}</p>
        </div>
      ))}
      {error && <p className="text-xs font-semibold text-[#DC2626]">{error}</p>}
      <div className="flex gap-1.5">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter") void submit(); }}
          placeholder="코멘트 남기기"
          aria-label="코멘트 입력"
          className={cn(inputClass, "h-9 text-xs")}
        />
        <Button size="sm" loading={saving} disabled={!draft.trim()} onClick={() => void submit()}>등록</Button>
      </div>
    </div>
  );
}
