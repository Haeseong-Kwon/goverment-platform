"use client";

import { useState } from "react";
import { Download, FileText, Image as ImageIcon, Paperclip } from "lucide-react";
import type { TaskComment, TaskCommentFile } from "@/lib/services/WorkspaceService";
import { getVaultDownloadUrl } from "@/lib/services/FounderWorkspaceService";
import { Button, Modal, focusRing } from "./ui";
import { cn } from "@/lib/utils";
import { toMessage } from "@/lib/errors";

/** 서명 링크 유효 시간. 미리보기를 열어 둔 채 읽는 시간까지 감안해 보관함(5분)보다 길게 둡니다. */
const LINK_TTL_SECONDS = 900;

const extensionOf = (fileName: string) => (fileName.includes(".") ? fileName.split(".").pop()!.toLowerCase() : "");

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp"];

/**
 * 브라우저가 그대로 그릴 수 있는 형식인지.
 *
 * hwp·docx는 브라우저가 못 엽니다. 그럴 때 빈 미리보기 상자를 띄우면 "파일이 깨졌나"로
 * 읽히므로, 미리보기 버튼 자체를 만들지 않고 내려받기만 남깁니다.
 */
function previewKindOf(file: TaskCommentFile): "image" | "pdf" | null {
  const extension = extensionOf(file.fileName);
  if (IMAGE_EXTENSIONS.includes(extension)) return "image";
  if (extension === "pdf") return "pdf";
  return null;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

/** ISO 시각을 한국 시간 기준 "2026.08.10 14:30"으로. 코멘트 순서를 분 단위까지 봐야 할 때가 있습니다. */
function formatKstDateTime(iso: string) {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso.slice(0, 16).replace("T", " ");
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(parsed).replace(/\. /g, ".").replace(/\.$/, "");
}

/**
 * 첨부 한 줄.
 *
 * 서명 링크는 열어 볼 때 만듭니다. 스레드를 여는 것만으로 첨부 수만큼 링크를 미리 발급하면
 * 아무도 안 보는 파일까지 만료 시계를 돌리게 되고, 목록 로딩도 그만큼 느려집니다.
 */
function AttachmentRow({ file }: { file: TaskCommentFile }) {
  const kind = previewKindOf(file);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolveUrl = async () => {
    if (url) return url;
    setLoading(true);
    setError(null);
    try {
      const signed = await getVaultDownloadUrl(file.storagePath, LINK_TTL_SECONDS);
      setUrl(signed);
      return signed;
    } catch (reason) {
      setError(toMessage(reason, "파일 링크를 만들지 못했습니다."));
      return null;
    } finally {
      setLoading(false);
    }
  };

  const togglePreview = async () => {
    if (open) { setOpen(false); return; }
    if (await resolveUrl()) setOpen(true);
  };

  return (
    <li className="rounded-xl border border-[#E2E8F0] p-3">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 text-[#94A3B8]">{kind === "image" ? <ImageIcon size={15} /> : <FileText size={15} />}</span>
        <div className="min-w-0 flex-1">
          <p className="break-all text-sm font-semibold text-[#0F172A]">{file.fileName}</p>
          <p className="mt-0.5 text-xs text-[#94A3B8]">
            {extensionOf(file.fileName).toUpperCase() || "파일"} · {formatBytes(file.sizeBytes)}
          </p>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {kind && (
          <Button variant="secondary" size="sm" loading={loading && !open} onClick={() => void togglePreview()}>
            {open ? "미리보기 닫기" : "미리보기"}
          </Button>
        )}
        {url ? (
          // 링크가 준비된 뒤에는 진짜 <a>로 내려받습니다. await 뒤 window.open은 팝업 차단에 걸립니다.
          <a
            href={url}
            download={file.fileName}
            target="_blank"
            rel="noreferrer noopener"
            className={cn("inline-flex h-8 items-center gap-1 rounded-lg bg-[#EFF6FF] px-3 text-xs font-bold text-[#2563EB] hover:bg-[#DBEAFE]", focusRing)}
          >
            <Download size={13} /> 다운로드
          </a>
        ) : (
          <Button variant="secondary" size="sm" icon={<Download size={13} />} loading={loading} onClick={() => void resolveUrl()}>
            다운로드 링크 만들기
          </Button>
        )}
      </div>

      {error && <p className="mt-2 text-xs font-semibold text-[#DC2626]">{error}</p>}

      {open && url && (
        <div className="mt-2 overflow-hidden rounded-lg border border-[#E2E8F0] bg-[#F8FAFC]">
          {kind === "image" ? (
            // 원본 크기를 모르는 외부 이미지라 next/image의 width·height를 채울 수 없습니다.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={`${file.fileName} 미리보기`} className="max-h-[60vh] w-full object-contain" />
          ) : (
            <iframe src={url} title={`${file.fileName} 미리보기`} className="h-[60vh] w-full" />
          )}
        </div>
      )}
    </li>
  );
}

/**
 * 코멘트 상세.
 *
 * 스레드 한 줄은 좁아서 긴 글과 첨부 목록을 함께 담지 못합니다. 줄을 누르면 한 단계 들어와
 * 전문과 파일을 보여 줍니다. 라우트 대신 대화상자인 이유는, 캘린더와 할 일 보드 양쪽에서
 * 같은 스레드를 여는데 그 두 화면의 선택 상태(날짜·필터)를 잃지 않아야 하기 때문입니다.
 */
export function CommentDetail({ comment, taskTitle, onClose }: { comment: TaskComment; taskTitle?: string; onClose: () => void }) {
  return (
    <Modal title="코멘트 상세" description={taskTitle} onClose={onClose} wide>
      {/* 첨부가 여러 개면 대화상자가 화면 밖으로 넘칩니다. 본문 영역만 스크롤합니다. */}
      <div className="mt-4 max-h-[70vh] space-y-4 overflow-y-auto">
        <div className="rounded-xl bg-[#F8FAFC] p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <strong className="text-sm font-bold text-[#0F172A]">{comment.authorName}</strong>
            <span className="text-xs tabular-nums text-[#94A3B8]">{formatKstDateTime(comment.createdAt)}</span>
          </div>
          <p className="mt-2 whitespace-pre-wrap break-keep text-sm leading-6 text-[#334155]">{comment.content}</p>
        </div>

        <div>
          <p className="flex items-center gap-1.5 text-xs font-bold text-[#475569]">
            <Paperclip size={13} /> 첨부 파일 {comment.files.length}개
          </p>
          {comment.files.length === 0 ? (
            <p className="mt-2 text-xs text-[#94A3B8]">첨부된 파일이 없습니다.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {comment.files.map((file) => <AttachmentRow key={file.id} file={file} />)}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
