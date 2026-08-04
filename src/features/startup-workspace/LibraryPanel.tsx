"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, ExternalLink } from "lucide-react";
import {
  LIBRARY_CATEGORIES,
  getLibraryDownloadUrl,
  listLibraryDocuments,
  type LibraryCategory,
  type LibraryDocument,
} from "@/lib/services/LibraryService";
import { captureLead, trackWorkspaceEvent } from "@/lib/services/WorkspaceService";
import { Button, ChoiceChip, EmptyState, Field, Notice, Panel, Skeleton, StatusBadge, inputClass } from "./ui";
import { cn } from "@/lib/utils";
import { toMessage } from "@/lib/errors";

/**
 * 무료 자료실.
 *
 * 감수·출처가 표기된 표준 양식만 둡니다. 사용자 업로드 대상이 아닙니다(그건 서류 보관함).
 * 로그인 없이 열리며, 다운로드 시 이메일을 남기는 것은 선택입니다.
 */
export function LibraryPanel() {
  const [documents, setDocuments] = useState<LibraryDocument[] | null>(null);
  const [category, setCategory] = useState<LibraryCategory | "all">("all");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [emailFor, setEmailFor] = useState<LibraryDocument | null>(null);

  useEffect(() => {
    let mounted = true;
    listLibraryDocuments()
      .then((rows) => { if (mounted) setDocuments(rows); })
      .catch((reason) => { if (mounted) { setDocuments([]); setError(toMessage(reason, "자료 목록을 불러오지 못했습니다.")); } });
    return () => { mounted = false; };
  }, []);

  const visible = useMemo(
    () => (documents ?? []).filter((item) => category === "all" || item.category === category),
    [documents, category],
  );

  const open = async (document: LibraryDocument) => {
    setPending(document.slug);
    setError(null);
    try {
      const url = await getLibraryDownloadUrl(document);
      if (!url) {
        setError("이 자료는 아직 파일이 준비되지 않았습니다.");
        return;
      }
      // 이벤트 기록 실패가 다운로드를 막지 않아야 합니다.
      void trackWorkspaceEvent("library_download", undefined, { slug: document.slug }).catch(() => undefined);
      window.open(url, "_blank", "noopener,noreferrer");
      setEmailFor(document);
    } catch (reason) {
      setError(toMessage(reason, "자료를 열지 못했습니다."));
    } finally {
      setPending(null);
    }
  };

  if (documents === null) {
    return <div className="grid gap-4 md:grid-cols-2">{[0, 1, 2, 3].map((key) => <Skeleton key={key} className="h-32" />)}</div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <ChoiceChip selected={category === "all"} onClick={() => setCategory("all")}>전체</ChoiceChip>
        {LIBRARY_CATEGORIES.map((item) => (
          <ChoiceChip key={item.id} selected={category === item.id} onClick={() => setCategory(item.id)}>{item.label}</ChoiceChip>
        ))}
      </div>

      {error && <Notice tone="error" onDismiss={() => setError(null)}>{error}</Notice>}

      {visible.length === 0 ? (
        <EmptyState title="해당 분류의 자료가 없습니다" description="다른 분류를 선택해 보세요." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {visible.map((document) => (
            <div key={document.slug} className="flex flex-col rounded-2xl border border-[#E2E8F0] bg-white p-5">
              <StatusBadge tone="slate">{LIBRARY_CATEGORIES.find((item) => item.id === document.category)?.label}</StatusBadge>
              <h3 className="mt-3 text-lg font-bold text-[#0F172A]">{document.title}</h3>
              <p className="mt-2 flex-1 text-sm leading-6 text-[#475569]">{document.description}</p>
              <p className="mt-3 text-xs text-[#94A3B8]">출처 · {document.sourceLabel}</p>
              <Button
                className="mt-4 self-start"
                variant="secondary"
                size="sm"
                loading={pending === document.slug}
                icon={document.storagePath ? <Download size={14} /> : <ExternalLink size={14} />}
                onClick={() => void open(document)}
              >
                {document.storagePath ? "내려받기" : "원본 출처 열기"}
              </Button>
            </div>
          ))}
        </div>
      )}

      <Panel title="법적 고지">
        <p className="text-sm leading-6 text-[#475569]">
          표준 양식은 참고 자료입니다. 개별 사안에 그대로 쓰기 전 전문가 검토를 권합니다.
          StartUp Pilot은 변호사 소개나 중개를 하지 않으며, 상담 신청은 광고 표기된 신청 접수만 운영합니다.
        </p>
      </Panel>

      {emailFor && <LibraryEmailPrompt document={emailFor} onClose={() => setEmailFor(null)} />}
    </div>
  );
}

/** 다운로드 후에만 뜹니다. 자료를 받기 위한 조건이 아니라 업데이트 수신 제안입니다. */
function LibraryEmailPrompt({ document, onClose }: { document: LibraryDocument; onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await captureLead(email, `library_${document.slug}`);
      onClose();
    } catch (reason) {
      setError(toMessage(reason, "저장하지 못했습니다."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(15,23,42,0.45)] p-4" onClick={onClose}>
      <div className={cn("w-full max-w-md rounded-2xl bg-white p-6")} onClick={(event) => event.stopPropagation()}>
        <h2 className="text-lg font-bold text-[#0F172A]">새 자료가 올라오면 알려드릴까요?</h2>
        <p className="mt-2 text-sm leading-6 text-[#475569]">
          방금 자료는 새 탭에서 열렸습니다. 주소를 남기시면 자료실이 갱신될 때 알려드립니다. 남기지 않아도 자료 이용에는 제한이 없습니다.
        </p>
        <div className="mt-4">
          <Field label="이메일">
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className={inputClass} />
          </Field>
        </div>
        {error && <div className="mt-3"><Notice tone="error">{error}</Notice></div>}
        <p className="mt-3 text-xs leading-5 text-[#94A3B8]">수신 동의 후 저장되며, 언제든 수신 거부할 수 있습니다.</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>괜찮습니다</Button>
          <Button loading={saving} disabled={!email.trim()} onClick={() => void submit()}>등록</Button>
        </div>
      </div>
    </div>
  );
}
