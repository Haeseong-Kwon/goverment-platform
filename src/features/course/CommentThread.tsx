"use client";

import { useEffect, useState } from "react";
import { MessageSquare, Trash2 } from "lucide-react";
import { addComment, deleteComment, getComments } from "@/lib/services/CourseService";
import { formatDateTime, type BoardId, type CourseComment } from "./course";
import { AuthorLabel, MembershipNotice, SignInPrompt, useStaffIds, useViewer } from "./CourseChrome";
import { Button, IconButton, Skeleton, textareaClass } from "@/features/startup-workspace/ui";
import { toMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";

/**
 * 네 게시판이 함께 쓰는 댓글.
 *
 * 대상은 (board, targetId) 한 쌍으로만 지정합니다. 게시판마다 스레드를 따로 만들면
 * 같은 화면 네 벌을 계속 맞춰 줘야 합니다.
 *
 * 지운 댓글의 자리는 남기지 않습니다. 수업 게시판에서 "삭제된 댓글입니다"가 쌓이면
 * 대화가 읽히지 않습니다.
 */
export function CommentThread({ board, targetId }: { board: BoardId; targetId: string }) {
  const viewer = useViewer();
  const staffIds = useStaffIds();
  const [comments, setComments] = useState<CourseComment[] | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setComments(null);
    getComments(board, targetId)
      .then((rows) => { if (mounted) setComments(rows); })
      .catch((reason) => {
        if (mounted) { setComments([]); setError(toMessage(reason, "댓글을 불러오지 못했습니다.")); }
      });
    return () => { mounted = false; };
  }, [board, targetId]);

  const submit = async () => {
    if (saving || !draft.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const created = await addComment(board, targetId, draft);
      setComments((current) => [...(current ?? []), created]);
      setDraft("");
    } catch (reason) {
      setError(toMessage(reason, "댓글을 남기지 못했습니다."));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    // 되돌릴 수 없는 삭제라 한 번 묻습니다. 목록에서 바로 사라지는 편이 확인 후 새로고침보다 낫습니다.
    if (!window.confirm("이 댓글을 삭제할까요?")) return;
    const previous = comments;
    setComments((current) => current?.filter((item) => item.id !== id) ?? null);
    try {
      await deleteComment(id);
    } catch (reason) {
      setComments(previous ?? null);
      setError(toMessage(reason, "댓글을 삭제하지 못했습니다."));
    }
  };

  return (
    <section className="rounded-2xl border border-[#E2E8F0] bg-white p-5 md:p-6">
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <MessageSquare size={18} className="text-[#2563EB]" />
        댓글
        {comments && <span className="tabular-nums text-[#94A3B8]">{comments.length}</span>}
      </h2>

      <div className="mt-4 space-y-3">
        {comments === null && (
          <div className="space-y-2" aria-live="polite" aria-busy>
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        )}

        {comments?.length === 0 && (
          <p className="rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] px-4 py-8 text-center text-sm text-[#64748B]">
            첫 댓글을 남겨 보세요. 궁금한 점을 물어보면 작성자가 답합니다.
          </p>
        )}

        {comments?.map((comment) => (
          <article key={comment.id} className="animate-in rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#EFF6FF] text-xs font-bold text-[#2563EB]">
                {comment.authorName.slice(0, 1)}
              </span>
              <AuthorLabel
                name={comment.authorName}
                authorId={comment.authorId}
                staffIds={staffIds}
                className="min-w-0 text-sm font-bold"
              />
              <span className="ml-auto shrink-0 text-xs tabular-nums text-[#94A3B8]">
                {formatDateTime(comment.createdAt, true)}
              </span>
              {viewer.id === comment.authorId && (
                <IconButton
                  label="내 댓글 삭제"
                  icon={<Trash2 size={14} />}
                  onClick={() => void remove(comment.id)}
                  className="-my-1 -mr-1 h-7 w-7 hover:text-[#DC2626]"
                />
              )}
            </div>
            {/* 줄바꿈을 그대로 살립니다. 여러 줄로 쓴 질문이 한 덩어리로 붙으면 읽히지 않습니다. */}
            <p className="mt-2.5 whitespace-pre-wrap break-words text-sm leading-6 text-[#334155]">{comment.content}</p>
          </article>
        ))}
      </div>

      {error && <p className="mt-3 text-sm font-semibold text-[#DC2626]">{error}</p>}

      <div className="mt-5 border-t border-[#F1F5F9] pt-5">
        {viewer.loading ? (
          <Skeleton className="h-24 w-full" />
        ) : !viewer.id ? (
          <SignInPrompt action="댓글 남기기" />
        ) : !viewer.member ? (
          <MembershipNotice action="댓글을 남길" />
        ) : (
          <>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="댓글을 남겨 주세요"
              aria-label="댓글 입력"
              className={cn(textareaClass, "mt-0 min-h-24")}
            />
            <div className="mt-2 flex justify-end">
              <Button loading={saving} disabled={!draft.trim()} onClick={() => void submit()}>댓글 등록</Button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
