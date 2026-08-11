"use client";

import { useState } from "react";
import { trackWorkspaceEvent } from "@/lib/services/WorkspaceService";
import { STARTUP_PROGRAMS } from "./rules";
import { Button, Field, Modal, Notice, selectClass, textareaClass } from "./ui";
import { cn } from "@/lib/utils";
import { toMessage } from "@/lib/errors";

const RESOLUTIONS = ["해결", "부분해결", "미해결"] as const;

const PROGRAM_OPTIONS = [...STARTUP_PROGRAMS.map((item) => item.name), "해당 없음 · 기타"];

/** 증상만으로는 사례가 되지 않습니다. 최소한 무슨 상황이었는지는 적혀야 검수할 수 있습니다. */
const MIN_SYMPTOM_LENGTH = 5;

/**
 * 내 사례 제보.
 *
 * 목록과 상세 양쪽에서 같은 모달로 열립니다.
 * 제보는 바로 게시되지 않고 검수를 거칩니다 — 그래서 등록 즉시 사례가 늘지 않습니다.
 */
export function ReportCaseModal({ onClose, onSubmitted }: { onClose: () => void; onSubmitted: () => void }) {
  const [symptom, setSymptom] = useState("");
  const [tried, setTried] = useState("");
  const [resolution, setResolution] = useState<(typeof RESOLUTIONS)[number]>("해결");
  const [program, setProgram] = useState(PROGRAM_OPTIONS[0]);
  const [occurredAt, setOccurredAt] = useState("");
  const [contactOk, setContactOk] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = symptom.trim().length >= MIN_SYMPTOM_LENGTH;

  const submit = async () => {
    if (!ready) return;
    setSaving(true);
    setError(null);
    try {
      await trackWorkspaceEvent("case_report", undefined, {
        symptom: symptom.trim(),
        tried: tried.trim(),
        resolution,
        program,
        occurredAt,
        contactOk,
      });
      onSubmitted();
    } catch (reason) {
      setError(toMessage(reason, "제보를 접수하지 못했습니다. 잠시 후 다시 시도해 주세요."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="내 사례 제보하기"
      description="겪으신 문제를 적어주시면 검수 후 사례로 정리합니다."
      onClose={onClose}
      wide
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>취소</Button>
          <Button loading={saving} disabled={!ready} onClick={() => void submit()}>제보 등록</Button>
        </>
      }
    >
      <div className="mt-5 space-y-4">
        <Field label="증상" required hint="어떤 상황에서 무엇이 막혔는지 적어주세요.">
          <textarea
            value={symptom}
            onChange={(event) => setSymptom(event.target.value)}
            placeholder="어떤 상황에서 무엇이 막혔는지 적어주세요"
            className={textareaClass}
          />
        </Field>

        <Field label="시도한 것들" hint="해결하려고 했던 순서대로 적어주시면 좋아요.">
          <textarea
            value={tried}
            onChange={(event) => setTried(event.target.value)}
            placeholder="해결하려고 했던 순서대로 적어주시면 좋아요"
            className={textareaClass}
          />
        </Field>

        <fieldset>
          <legend className="text-sm font-bold text-[#0F172A]">해결 여부</legend>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {RESOLUTIONS.map((item) => (
              <label
                key={item}
                className={cn(
                  "inline-flex cursor-pointer items-center gap-2 rounded-[10px] border px-4 py-2.5 text-sm font-semibold transition-colors",
                  resolution === item
                    ? "border-[#2563EB] bg-[#EFF6FF] text-[#1D4ED8]"
                    : "border-[#E2E8F0] text-[#475569] hover:bg-[#F8FAFC]",
                )}
              >
                <input
                  type="radio"
                  name="case-report-resolution"
                  value={item}
                  checked={resolution === item}
                  onChange={() => setResolution(item)}
                  className="accent-[#2563EB]"
                />
                {item}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="관련 사업">
            <select value={program} onChange={(event) => setProgram(event.target.value)} className={selectClass}>
              {PROGRAM_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </Field>
          <Field label="발생 시기">
            <input
              type="month"
              value={occurredAt}
              onChange={(event) => setOccurredAt(event.target.value)}
              className={cn(selectClass, "tabular-nums")}
            />
          </Field>
        </div>

        <label className="flex cursor-pointer items-start gap-2.5 text-sm leading-6 text-[#475569]">
          <input
            type="checkbox"
            checked={contactOk}
            onChange={(event) => setContactOk(event.target.checked)}
            className="mt-1 accent-[#2563EB]"
          />
          추가 확인이 필요할 때 연락받는 데 동의합니다 (선택)
        </label>

        {error && <Notice tone="error" onDismiss={() => setError(null)}>{error}</Notice>}

        <p className="text-[13px] leading-6 text-[#94A3B8]">
          제보 내용은 검수 후 게시되며, 기관·개인 정보는 마스킹됩니다. 채택 시 AI 진단 1회권을 드려요
        </p>
      </div>
    </Modal>
  );
}

export const REPORT_SUBMITTED_MESSAGE = "제보 감사합니다! 검수 후 사례로 등록되면 알려드릴게요";
