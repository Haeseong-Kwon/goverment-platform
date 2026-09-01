"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 워크스페이스 공용 UI 프리미티브.
 *
 * 버튼·입력·패널을 화면마다 손으로 쓰면 hover·focus·disabled 상태가 제각각이 됩니다.
 * 상호작용 상태는 전부 이 파일에서 한 번만 정의하고, 화면은 조합만 합니다.
 */

// ---------------------------------------------------------------- 공통 상호작용

/** 키보드 사용자에게만 보이는 초점 링. 모든 조작 가능한 요소가 같은 링을 씁니다. */
export const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2 focus-visible:ring-offset-white";

/** 색·투명도·변형만 전환합니다. 레이아웃을 흔드는 속성은 넣지 않습니다. */
export const interactive = "transition-[color,background-color,border-color,opacity,transform,box-shadow] duration-150 ease-out";

/**
 * 눌러서 고르는 줄(체크리스트·서류 목록·증빙 선택).
 * 커서가 올라갔을 때 "이건 누를 수 있다"가 보여야 합니다.
 * 선택된 줄은 이미 색으로 상태를 말하므로 hover 색을 덧칠하지 않습니다.
 */
export const selectableRow = cn(interactive, focusRing, "hover:border-[#CBD5E1] hover:bg-[#F8FAFC] active:scale-[.995]");

/** 표의 한 줄. 눌러서 무언가 열리는 줄에만 씁니다. 읽기 전용 줄에는 붙이지 않습니다. */
export const listRow = cn(interactive, "hover:bg-[#F8FAFC]");

/**
 * 떠오르는 카드. 이동이 목적인 카드에만 씁니다.
 * 아주 조금만 올립니다. 크게 움직이면 목록 전체가 출렁이는 것처럼 보입니다.
 */
export const liftCard = cn(interactive, "hover:-translate-y-0.5 hover:border-[#CBD5E1] hover:shadow-[0_8px_24px_rgba(15,23,42,0.08)]");

// ---------------------------------------------------------------- 버튼

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-[#2563EB] text-white shadow-sm hover:bg-[#1D4ED8] active:bg-[#1E40AF]",
  secondary: "border border-[#CBD5E1] bg-white text-[#0F172A] hover:border-[#94A3B8] hover:bg-[#F8FAFC] active:bg-[#F1F5F9]",
  ghost: "text-[#475569] hover:bg-[#F1F5F9] hover:text-[#0F172A] active:bg-[#E2E8F0]",
  danger: "border border-[#DC2626] bg-white text-[#DC2626] hover:bg-[#FEF2F2] active:bg-[#FEE2E2]",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-9 gap-1.5 rounded-lg px-3 text-xs",
  md: "h-11 gap-2 rounded-xl px-4 text-sm",
  lg: "h-12 gap-2 rounded-xl px-5 text-sm",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  block?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  block = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex shrink-0 items-center justify-center font-bold",
        interactive,
        focusRing,
        "active:scale-[.98] disabled:pointer-events-none disabled:opacity-40",
        buttonSizes[size],
        buttonVariants[variant],
        block && "w-full",
        className,
      )}
    >
      {loading ? <Loader2 size={15} className="animate-spin" /> : icon}
      {children}
    </button>
  );
}

/** 버튼처럼 보이지만 이동이 목적인 링크. 시각은 Button과 같고 의미는 링크로 남깁니다. */
export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  icon,
  block = false,
  className,
  children,
}: {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  block?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex shrink-0 items-center justify-center font-bold",
        interactive,
        focusRing,
        "active:scale-[.98]",
        buttonSizes[size],
        buttonVariants[variant],
        block && "w-full",
        className,
      )}
    >
      {icon}
      {children}
    </Link>
  );
}

/** 아이콘만 있는 버튼. 접근 가능한 이름을 반드시 받습니다. */
export function IconButton({
  label,
  icon,
  className,
  ...props
}: Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> & { label: string; icon: React.ReactNode }) {
  return (
    <button
      {...props}
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[#94A3B8]",
        interactive,
        focusRing,
        "hover:bg-[#F1F5F9] hover:text-[#475569] active:scale-95 disabled:pointer-events-none disabled:opacity-40",
        className,
      )}
    >
      {icon}
    </button>
  );
}

/**
 * 선택 칩. 지원사업 선택·폴더 선택·항목 특성·사유코드처럼
 * "여러 개 중 고르기"가 화면마다 반복되어 한 컴포넌트로 모았습니다.
 */
export function ChoiceChip({
  selected,
  tone = "blue",
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { selected: boolean; tone?: "blue" | "green" | "red" }) {
  const selectedTone = {
    blue: "border-[#2563EB] bg-[#EFF6FF] text-[#2563EB]",
    green: "border-[#16A34A] bg-[#F0FDF4] text-[#16A34A]",
    red: "border-[#DC2626] bg-[#FEF2F2] text-[#DC2626]",
  }[tone];

  return (
    <button
      {...props}
      type="button"
      aria-pressed={selected}
      className={cn(
        "rounded-lg border px-3 py-2 text-sm font-semibold",
        interactive,
        focusRing,
        "active:scale-[.98] disabled:pointer-events-none disabled:opacity-40",
        selected ? selectedTone : "border-[#E2E8F0] text-[#475569] hover:border-[#CBD5E1] hover:bg-[#F8FAFC]",
        className,
      )}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------- 입력

const controlBase = cn(
  "mt-1.5 w-full rounded-xl border border-[#CBD5E1] bg-white px-3 text-sm font-medium text-[#0F172A]",
  "placeholder:font-normal placeholder:text-[#94A3B8]",
  interactive,
  focusRing,
  "hover:border-[#94A3B8] focus-visible:border-[#2563EB] disabled:cursor-not-allowed disabled:bg-[#F8FAFC] disabled:text-[#94A3B8]",
);

export const inputClass = cn(controlBase, "h-11");
export const selectClass = cn(controlBase, "h-11 cursor-pointer");
export const textareaClass = cn(controlBase, "min-h-28 resize-y py-2.5 leading-6");

export function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-bold text-[#0F172A]">
      {label}
      {required && <span className="ml-1 text-[#DC2626]">*</span>}
      {children}
      {hint && <span className="mt-1.5 block text-xs font-medium text-[#94A3B8]">{hint}</span>}
    </label>
  );
}

// ---------------------------------------------------------------- 표시

export const statusClasses = {
  green: "bg-[#F0FDF4] text-[#16A34A] border-[#BBF7D0]",
  amber: "bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]",
  red: "bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]",
  slate: "bg-[#F8FAFC] text-[#475569] border-[#E2E8F0]",
  blue: "bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE]",
};

export type StatusTone = keyof typeof statusClasses;

const dotClasses: Record<StatusTone, string> = {
  green: "bg-[#16A34A]",
  amber: "bg-[#B45309]",
  red: "bg-[#DC2626]",
  slate: "bg-[#94A3B8]",
  blue: "bg-[#2563EB]",
};

export function StatusBadge({ tone = "slate", dot = false, children }: { tone?: StatusTone; dot?: boolean; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 py-1 text-[13px] font-semibold", statusClasses[tone])}>
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", dotClasses[tone])} />}
      {children}
    </span>
  );
}

export function Panel({
  title,
  action,
  footer,
  hoverable = false,
  className,
  children,
}: {
  title?: string;
  action?: React.ReactNode;
  footer?: React.ReactNode;
  hoverable?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
        hoverable && liftCard,
        className,
      )}
    >
      {(title || action) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {title && <h2 className="text-lg font-bold text-[#0F172A] md:text-xl">{title}</h2>}
          {action}
        </div>
      )}
      {children}
      {footer && <div className="mt-4 border-t border-[#F1F5F9] pt-4">{footer}</div>}
    </section>
  );
}

/** 워크스페이스 각 화면의 제목 영역. 배지·제목·설명·주요 액션 순서를 고정합니다. */
export function PageHeader({
  badge,
  badgeTone = "blue",
  title,
  description,
  action,
}: {
  badge: string;
  badgeTone?: StatusTone;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="animate-in mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <StatusBadge tone={badgeTone}>{badge}</StatusBadge>
        <h1 className="mt-3 text-[26px] font-bold leading-tight tracking-tight text-[#0F172A] md:text-[32px]">{title}</h1>
        {description && <p className="mt-2 text-sm leading-6 text-[#475569] md:text-base">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/** 데이터가 비어 있을 때 "없음"만 알리지 않고 다음 행동을 함께 제시합니다. */
export function EmptyState({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="animate-in rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] px-5 py-10 text-center">
      <p className="text-sm font-bold text-[#0F172A]">{title}</p>
      {description && <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#64748B]">{description}</p>}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

/** 로딩 중 자리를 유지해 콘텐츠가 갑자기 밀려나는 것을 막습니다. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-[#E2E8F0]", className)} />;
}

export function ProgressBar({ value, tone = "blue", className }: { value: number; tone?: StatusTone; className?: string }) {
  const width = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("h-2.5 overflow-hidden rounded-full bg-[#EFF6FF]", className)} role="presentation">
      <div className={cn("h-full rounded-full transition-[width] duration-500 ease-out", dotClasses[tone])} style={{ width: `${width}%` }} />
    </div>
  );
}

// ---------------------------------------------------------------- 알림

const noticeTones: Record<"info" | "success" | "warning" | "error", string> = {
  info: "border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB]",
  success: "border-[#BBF7D0] bg-[#F0FDF4] text-[#16A34A]",
  warning: "border-[#FDE68A] bg-[#FFFBEB] text-[#B45309]",
  error: "border-[#FECACA] bg-[#FEF2F2] text-[#DC2626]",
};

/** 화면에 남는 안내. 사용자가 닫을 수 있어야 오래된 메시지가 쌓이지 않습니다. */
export function Notice({
  tone = "info",
  onDismiss,
  className,
  children,
}: {
  tone?: keyof typeof noticeTones;
  onDismiss?: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("animate-in flex items-start gap-3 rounded-xl border p-4 text-sm font-semibold", noticeTones[tone], className)}
    >
      <span className="min-w-0 flex-1 leading-6">{children}</span>
      {onDismiss && <IconButton label="안내 닫기" icon={<X size={15} />} onClick={onDismiss} className="-my-1 -mr-1 h-7 w-7 hover:bg-white/60" />}
    </div>
  );
}

// ---------------------------------------------------------------- 대화상자

/**
 * 화면 위에 뜨는 대화상자.
 *
 * 화면마다 따로 만들면 Esc 처리와 바깥 클릭이 매번 빠집니다.
 * 덮개는 밝기만, 본체는 짧게 떠오릅니다 — 위치가 정해진 것을 움직이면 산만합니다.
 */
export function Modal({
  title,
  description,
  onClose,
  footer,
  wide,
  children,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  footer?: React.ReactNode;
  /** 문서 미리보기처럼 확인 문구보다 넓은 내용을 담을 때. */
  wide?: boolean;
  children?: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    // 열리면 초점을 안으로 옮깁니다. 키보드 사용자가 뒤쪽 화면을 헤매지 않도록.
    panelRef.current?.focus();
    // 뒤쪽 본문이 같이 스크롤되면 대화상자가 떠 있는 느낌이 깨집니다.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center p-4">
      <div className="animate-fade absolute inset-0 bg-[rgba(15,23,42,0.45)]" onClick={onClose} aria-hidden />
      {/*
        높이를 화면 안으로 묶고 본문만 스크롤시킵니다.

        이게 없으면 내용이 길어질수록(모집 역할을 여러 개 고르는 경우처럼) 대화상자가
        화면 아래로 자라는데, 열려 있는 동안 배경 스크롤은 잠겨 있어 등록 버튼에
        닿을 방법이 사라집니다. 제목과 버튼은 제자리에 두고 가운데만 움직입니다.

        `dvh`를 쓰는 이유: 모바일 브라우저는 주소창이 접혔다 펴지면서 `vh`가 실제
        보이는 높이보다 커집니다. 그 차이만큼 푸터가 다시 화면 밖으로 밀립니다.
      */}
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "animate-in relative flex max-h-[calc(100dvh-2rem)] w-full flex-col rounded-2xl bg-white shadow-[0_24px_64px_rgba(15,23,42,0.24)] outline-none",
          wide ? "max-w-2xl" : "max-w-md",
        )}
      >
        <div className="shrink-0 px-6 pt-6">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-lg font-bold text-[#0F172A]">{title}</h2>
            <IconButton label="닫기" icon={<X size={15} />} onClick={onClose} className="-my-1 -mr-1" />
          </div>
          {description && <p className="mt-2 text-sm leading-6 text-[#475569]">{description}</p>}
        </div>

        {/* min-h-0: 이게 없으면 flex 자식이 내용만큼 늘어나 overflow가 걸리지 않습니다. */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">{children}</div>

        {footer && (
          <div className="flex shrink-0 justify-end gap-2 border-t border-[#F1F5F9] px-6 py-4">{footer}</div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- 토스트

/**
 * 잠깐 떴다 사라지는 알림. 저장·승인 같은 결과를 알리면서
 * 본문 레이아웃을 밀지 않도록 화면 위에 띄웁니다.
 */
export function useToast(timeoutMs = 4000) {
  const [toast, setToast] = useState<{ tone: keyof typeof noticeTones; text: string; id: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((text: string, tone: keyof typeof noticeTones = "success") => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ text, tone, id: Date.now() });
    timer.current = setTimeout(() => setToast(null), timeoutMs);
  }, [timeoutMs]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const node = toast ? (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[70] flex justify-center px-4">
      <div
        key={toast.id}
        role="status"
        aria-live="polite"
        className={cn(
          "animate-in pointer-events-auto flex max-w-md items-start gap-3 rounded-xl border px-4 py-3 text-sm font-semibold shadow-[0_12px_32px_rgba(15,23,42,0.16)]",
          noticeTones[toast.tone],
        )}
      >
        <span className="min-w-0 flex-1 leading-6">{toast.text}</span>
        <IconButton label="알림 닫기" icon={<X size={14} />} onClick={() => setToast(null)} className="-my-0.5 -mr-1 h-6 w-6 hover:bg-white/60" />
      </div>
    </div>
  ) : null;

  return { show, node, dismiss: () => setToast(null) };
}
