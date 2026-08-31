"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Building2, ClipboardList, Presentation, Users } from "lucide-react";
import { getCourseStats, type CourseStats } from "@/lib/services/CourseService";
import { BOARDS, BOARD_ORDER, COURSE, courseHref, type BoardId } from "./course";
import { CourseShell } from "./CourseChrome";
import { Skeleton, StatusBadge, focusRing, liftCard } from "@/features/startup-workspace/ui";
import { cn } from "@/lib/utils";

const BOARD_ICONS: Record<BoardId, typeof Users> = {
  recruit: Users,
  proposal: Building2,
  team: ClipboardList,
  showcase: Presentation,
};

/** 홈의 숫자 네 개. 어느 게시판을 먼저 열지 정하는 데 쓰는 값이라 게시판 순서와 같게 둡니다. */
const STAT_LABELS: Record<BoardId, string> = {
  recruit: "모집 중인 팀",
  proposal: "기업 제안",
  team: "확정 팀",
  showcase: "등록된 결과물",
};

const statValue = (stats: CourseStats, board: BoardId) =>
  board === "recruit" ? stats.recruitOpen
  : board === "proposal" ? stats.proposalCount
  : board === "team" ? stats.teamCount
  : stats.deliverableCount;

/** 수업의 흐름. 학생이 지금 어느 단계에 있는지 알면 어느 게시판을 볼지도 정해집니다. */
const FLOW = [
  { step: "01", title: "팀 찾기", desc: "모집글을 올리거나 댓글로 지원합니다.", board: "recruit" as BoardId },
  { step: "02", title: "아이템 정하기", desc: "기업 제안 중에서 고르거나 자체 아이템으로 갑니다.", board: "proposal" as BoardId },
  { step: "03", title: "팀 확정", desc: "구성이 끝나면 팀장이 팀을 등록합니다.", board: "team" as BoardId },
  { step: "04", title: "중간 · 기말 발표", desc: "결과물을 올려 다른 팀과 공유합니다.", board: "showcase" as BoardId },
];

export function CourseHome() {
  const [stats, setStats] = useState<CourseStats | null>(null);

  useEffect(() => {
    let mounted = true;
    getCourseStats()
      .then((loaded) => { if (mounted) setStats(loaded); })
      // 숫자는 장식입니다. 못 읽어도 게시판 카드는 그대로 열려야 합니다.
      .catch(() => { if (mounted) setStats({ recruitOpen: 0, proposalCount: 0, teamCount: 0, deliverableCount: 0 }); });
    return () => { mounted = false; };
  }, []);

  return (
    <CourseShell active="home">
      <section className="rounded-3xl border border-[#E2E8F0] bg-white p-7 md:p-10">
        <StatusBadge tone="blue" dot>{COURSE.year}년 {COURSE.term}학기 운영 중</StatusBadge>
        <h1 className="mt-5 text-[30px] font-bold leading-tight tracking-tight md:text-[42px]">
          {COURSE.track}
          <br className="hidden sm:block" />
          <span className="text-[#2563EB]"> 팀빌딩부터 발표까지</span> 한 곳에서
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-8 text-[#475569]">
          {COURSE.school} {COURSE.label} 수강생을 위한 게시판입니다. 팀원을 찾고, 기업이 제안한 프로젝트를 고르고,
          확정된 팀과 중간·기말 결과물을 같은 자리에서 공유합니다.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {BOARD_ORDER.map((board) => (
            <div key={board} className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-4">
              <p className="text-xs font-bold text-[#64748B]">{STAT_LABELS[board]}</p>
              {stats === null ? (
                <Skeleton className="mt-2 h-8 w-16" />
              ) : (
                <p className="mt-1 text-[28px] font-bold leading-none tabular-nums text-[#0F172A]">
                  {statValue(stats, board)}
                  <span className="ml-1 text-base font-semibold text-[#94A3B8]">건</span>
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-bold md:text-2xl">게시판</h2>
        <div className="animate-in-stagger mt-4 grid gap-4 md:grid-cols-2">
          {BOARD_ORDER.map((board) => {
            const config = BOARDS[board];
            const Icon = BOARD_ICONS[board];
            return (
              <Link
                key={board}
                href={courseHref(board)}
                className={cn("group rounded-2xl border border-[#E2E8F0] bg-white p-6", liftCard, focusRing)}
              >
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#EFF6FF] text-[#2563EB]">
                  <Icon size={21} />
                </span>
                <h3 className="mt-4 text-lg font-bold">{config.label}</h3>
                <p className="mt-2 text-sm leading-6 text-[#475569]">{config.description}</p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-[#2563EB]">
                  열기
                  <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-bold md:text-2xl">수업이 흘러가는 순서</h2>
        <ol className="mt-4 grid gap-3 md:grid-cols-4">
          {FLOW.map((item) => (
            <li key={item.step}>
              <Link
                href={courseHref(item.board)}
                className={cn("block h-full rounded-2xl border border-[#E2E8F0] bg-white p-5", liftCard, focusRing)}
              >
                <span className="text-xs font-bold tracking-widest text-[#2563EB]">{item.step}</span>
                <strong className="mt-2 block text-base font-bold">{item.title}</strong>
                <span className="mt-2 block text-sm leading-6 text-[#475569]">{item.desc}</span>
              </Link>
            </li>
          ))}
        </ol>
      </section>
    </CourseShell>
  );
}
