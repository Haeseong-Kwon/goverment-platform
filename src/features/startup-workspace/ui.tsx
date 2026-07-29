import { cn } from "@/lib/utils";

export const statusClasses = {
  green: "bg-[#F0FDF4] text-[#16A34A] border-[#BBF7D0]",
  amber: "bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]",
  red: "bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]",
  slate: "bg-[#F8FAFC] text-[#475569] border-[#E2E8F0]",
  blue: "bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE]",
};

export type StatusTone = keyof typeof statusClasses;

export function StatusBadge({ tone = "slate", children }: { tone?: StatusTone; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex shrink-0 whitespace-nowrap rounded-lg border px-2.5 py-1 text-[13px] font-semibold", statusClasses[tone])}>
      {children}
    </span>
  );
}

export function Panel({ title, action, children }: { title?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[#E2E8F0] bg-white p-5">
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="text-xl font-bold text-[#0F172A]">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-bold text-[#0F172A]">
      {label}
      {children}
      {hint && <span className="mt-1 block text-xs font-medium text-[#94A3B8]">{hint}</span>}
    </label>
  );
}

export const inputClass = "mt-1 w-full rounded-xl border border-[#CBD5E1] px-3 py-2.5 text-sm font-medium text-[#0F172A]";
