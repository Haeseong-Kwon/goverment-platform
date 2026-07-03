import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import { Check, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={cn("sim-card", className)}>{children}</section>;
}

type ButtonVariant = "primary" | "outline" | "danger" | "success" | "disabled";
export function SimButton({ variant = "primary", className, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return <button className={cn("sim-button", `sim-button--${variant}`, className)} disabled={variant === "disabled" || props.disabled} {...props}>{children}</button>;
}

const statusKinds: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  "완료": "success", "승인": "success", "정산완료": "success",
  "진행중": "warning", "준비중": "warning", "검토 대기": "warning", "검증 대기": "warning",
  "반려": "danger", "초과": "danger", "지연": "danger", "경고": "danger",
  "대기": "neutral", "미시작": "neutral", "비활성": "neutral",
};
export function StatusPill({ children, status, dot = false }: { children?: ReactNode; status: string; dot?: boolean }) {
  const kind = statusKinds[status] ?? "neutral";
  return <span className={`status-pill status-pill--${kind}`}>{dot && <i aria-hidden="true" />}{children ?? status}</span>;
}

export function RoleBadge({ role }: { role: "창업자" | "매니저" | "회계사" }) {
  return <span className={cn("role-badge", role === "매니저" && "role-badge--manager")}>{role}</span>;
}

export function PageHeader({ role, title, description, actions }: { role: "창업자" | "매니저" | "회계사"; title: string; description: string; actions?: ReactNode }) {
  return <header className="page-header"><div><RoleBadge role={role} /><h1>{title}</h1><p>{description}</p></div>{actions && <div className="page-header__actions">{actions}</div>}</header>;
}

export function StatCard({ label, value, detail, tone = "default" }: { label: string; value: string; detail: ReactNode; tone?: "default" | "warn" | "danger" }) {
  return <Card className={cn("stat-card", tone === "danger" && "stat-card--danger")}><p>{label}</p><strong className={`stat-card__value stat-card__value--${tone}`}>{value}</strong><div>{detail}</div></Card>;
}

export function DonutChart({ gradient, value, label, size = 150, inset = 19, ariaLabel }: { gradient: string; value: string; label: string; size?: number; inset?: number; ariaLabel: string }) {
  return <div className="donut" role="img" aria-label={ariaLabel} style={{ "--donut-gradient": gradient, "--donut-size": `${size}px`, "--donut-inset": `${inset}px` } as CSSProperties}><div><strong>{value}</strong><span>{label}</span></div></div>;
}

export function ProgressBar({ percent, tone }: { percent: number; tone: "danger" | "success" | "neutral" }) {
  return <div className="progress" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}><span className={`progress__fill progress__fill--${tone}`} style={{ width: `${percent}%` }} /></div>;
}

export function DocRow({ name, subtitle, state, action }: { name: string; subtitle?: string; state: "complete" | "preparing" | "missing" | "idle"; action?: ReactNode }) {
  return <div className={cn("doc-row", state === "missing" && "doc-row--missing")}><span className={`doc-dot doc-dot--${state}`}>{state === "complete" && <Check size={12} />}</span><div className="doc-row__copy"><strong>{name}</strong>{subtitle && <small>{subtitle}</small>}</div>{action}</div>;
}

export function EvidenceFile({ name }: { name: string }) {
  return <div className="evidence-file"><FileText size={17} /><strong>{name}</strong><button type="button">열기</button></div>;
}

export function Stepper({ steps, current, onSelect }: { steps: string[]; current: number; onSelect?: (step: number) => void }) {
  return <div className="stepper">{steps.map((label, index) => { const step = index + 1; const done = step < current; return <div className="stepper__item" key={label}><button type="button" className={cn("stepper__dot", step <= current && "is-active")} onClick={() => onSelect?.(step)} aria-current={step === current ? "step" : undefined}>{done ? <Check size={18} /> : step}</button><span className={cn(step === current && "is-active")}>{label}</span>{index < steps.length - 1 && <i />}</div>; })}</div>;
}

