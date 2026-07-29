import type { StartupRole } from "@/features/startup-workspace/domain";

/**
 * 개발용 진입 모드.
 *
 * 로그인 없이 로그인 이후 화면을 그대로 열어 보기 위한 경로입니다.
 * 프로덕션 빌드에서는 플래그가 켜져 있어도 항상 꺼지므로 실제 배포에 새어 나가지 않습니다.
 * 켜는 법: .env.local 에 NEXT_PUBLIC_DEV_BYPASS=1
 */
export const DEV_BYPASS =
  process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_DEV_BYPASS === "1";

export const DEV_USER = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "dev@startup-pilot.local",
  fullName: "김하나",
} as const;

/**
 * 역할은 따로 저장하지 않고 현재 경로에서 읽습니다.
 * 주소가 곧 역할이라 전환 UI가 링크 3개로 끝나고, 상태가 어긋날 여지가 없습니다.
 */
export function devRoleForPath(pathname: string | null | undefined): StartupRole | null {
  if (!pathname) return null;
  if (pathname === "/manager" || pathname.startsWith("/manager/")) return "manager";
  if (pathname === "/workspace" || pathname.startsWith("/workspace/")) return "founder";
  if (pathname === "/founder" || pathname.startsWith("/founder/")) return "pre_founder";
  return null;
}

export function currentDevRole(): StartupRole {
  if (typeof window === "undefined") return "pre_founder";
  return devRoleForPath(window.location.pathname) ?? "pre_founder";
}

export const DEV_WORLDS = [
  { role: "pre_founder" as const, label: "창업자 준비", href: "/founder" },
  { role: "founder" as const, label: "선정 팀", href: "/workspace" },
  { role: "manager" as const, label: "주관기관", href: "/manager" },
];
