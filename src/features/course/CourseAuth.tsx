"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GraduationCap, Loader2, MailCheck, Presentation, Users } from "lucide-react";
import { getCurrentUser, requestPasswordReset, signIn, signUp, toAuthMessage } from "@/lib/services/AuthService";
import {
  COURSE,
  COURSE_EMAIL_DOMAIN,
  COURSE_LOGIN_HREF,
  COURSE_SIGNUP_HREF,
  COURSE_WORKSPACE_HREF,
  courseHref,
  isCourseEmail,
} from "./course";
import { Button, inputClass } from "@/features/startup-workspace/ui";
import { cn } from "@/lib/utils";

const MIN_PASSWORD_LENGTH = 6;

/**
 * 로그인 뒤 돌아갈 곳(`?next=`).
 *
 * 같은 사이트의 과목 경로만 받습니다. 값을 그대로 믿으면 `?next=https://악성사이트`로
 * 우리 로그인 화면을 거쳐 외부로 튕기는 링크를 만들 수 있습니다(열린 리다이렉트).
 * `//`로 시작하는 값도 브라우저는 외부 주소로 읽으므로 함께 막고, 과목 밖으로 나가는
 * 경로도 거절합니다 — 이 화면은 과목 전용 입구입니다.
 */
function getReturnTo(): string {
  if (typeof window === "undefined") return COURSE_WORKSPACE_HREF;
  const next = new URLSearchParams(window.location.search).get("next");
  if (!next || !next.startsWith("/course") || next.startsWith("//")) return COURSE_WORKSPACE_HREF;
  return next;
}

/**
 * 과목 전용 인증 화면의 껍데기.
 *
 * StartUp Pilot의 AuthShell을 쓰지 않습니다. 그쪽은 "정부 창업지원사업 행정"을
 * 이야기하고 로고도 그 제품의 것이라, 수업 때문에 들어온 학생에게는 다른 서비스에
 * 가입하는 것처럼 보입니다.
 */
function CourseAuthShell({ title, description, children, footer }: {
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <main className="grid min-h-screen bg-white text-[#0F172A] lg:grid-cols-2">
      <aside className="hidden flex-col justify-between bg-[#F8FAFC] p-12 lg:flex">
        <Link href={courseHref()} className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#EFF6FF] text-[#2563EB]">
            <GraduationCap size={19} />
          </span>
          <span>
            <strong className="block text-[15px] font-bold leading-tight">{COURSE.track}</strong>
            <span className="block text-xs font-semibold text-[#94A3B8]">{COURSE.school}</span>
          </span>
        </Link>

        <div>
          <h2 className="text-[32px] font-bold leading-tight">
            {COURSE.year}년 {COURSE.term}학기
            <br />
            팀빌딩부터 발표까지
          </h2>
          <ul className="mt-10 space-y-6">
            {[
              { Icon: Users, title: "팀빌딩 모집", desc: "필요한 역할을 적어 올리고 댓글로 이야기합니다." },
              { Icon: GraduationCap, title: "기업 제안 프로젝트", desc: "기업이 들고 온 실제 문제 중에서 고릅니다." },
              { Icon: Presentation, title: "중간·기말 결과물", desc: "팀별 산출물을 데모·저장소 링크와 함께 공유합니다." },
            ].map(({ Icon, title: label, desc }) => (
              <li key={label} className="flex gap-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#EFF6FF] text-[#2563EB]">
                  <Icon size={18} />
                </span>
                <span>
                  <strong className="block text-sm font-bold">{label}</strong>
                  <span className="mt-1 block text-sm leading-6 text-[#475569]">{desc}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs leading-6 text-[#94A3B8]">
          {COURSE.school} 수강생 전용입니다. {COURSE_EMAIL_DOMAIN} 메일로만 가입할 수 있습니다.
        </p>
      </aside>

      <div className="flex items-center justify-center px-5 py-12 md:px-10">
        <div className="w-full max-w-[420px]">
          <Link href={courseHref()} className="flex items-center gap-2 text-lg font-bold lg:hidden">
            <GraduationCap size={20} className="text-[#2563EB]" />
            {COURSE.track}
          </Link>
          <h1 className="mt-6 text-[28px] font-bold leading-tight lg:mt-0">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-[#475569]">{description}</p>
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-8 border-t border-[#E2E8F0] pt-6 text-sm">{footer}</div>}
        </div>
      </div>
    </main>
  );
}

function AuthField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-bold">
      {label}
      {children}
      {hint && <span className="mt-1.5 block text-xs font-medium text-[#94A3B8]">{hint}</span>}
    </label>
  );
}

function AuthError({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-3 text-sm font-semibold text-[#DC2626]">
      {children}
    </p>
  );
}

const authInputClass = cn(inputClass, "h-12 px-4");

/** 이미 로그인한 사람은 이 화면을 볼 이유가 없습니다. 세션을 확인하는 동안만 스피너를 둡니다. */
function useRedirectIfSignedIn() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;
    getCurrentUser()
      .then((user) => {
        if (!mounted) return;
        if (user) router.replace(getReturnTo());
        else setChecking(false);
      })
      .catch(() => { if (mounted) setChecking(false); });
    return () => { mounted = false; };
  }, [router]);

  return checking;
}

function Checking() {
  return (
    <main className="grid min-h-screen place-items-center bg-white">
      <Loader2 className="animate-spin text-[#2563EB]" size={28} />
    </main>
  );
}

// ---------------------------------------------------------------- 회원가입

export function CourseSignupPage() {
  const [form, setForm] = useState({ fullName: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const checking = useRedirectIfSignedIn();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    // 서버(RLS)가 최종 판단하지만, 인증 메일을 보내고 나서 거절하면 학생은
    // 메일함만 들여다보게 됩니다. 누르는 순간 이유를 말해 줍니다.
    if (!isCourseEmail(form.email)) {
      setError(`${COURSE_EMAIL_DOMAIN} 메일로만 가입할 수 있습니다. 학교 메일 주소를 입력해 주세요.`);
      return;
    }
    if (form.password.length < MIN_PASSWORD_LENGTH) {
      setError(`비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await signUp(form.email.trim(), form.password, form.fullName.trim());
      setSentTo(form.email.trim());
    } catch (reason) {
      setError(toAuthMessage(reason, "회원가입에 실패했습니다."));
    } finally {
      setLoading(false);
    }
  };

  if (checking) return <Checking />;

  if (sentTo) {
    return (
      <CourseAuthShell
        title="인증 메일을 보냈습니다"
        description="메일의 링크를 눌러야 가입이 끝납니다."
        footer={<Link href={COURSE_LOGIN_HREF} className="font-bold text-[#2563EB]">로그인 화면으로</Link>}
      >
        <div className="rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] p-5">
          <MailCheck className="text-[#16A34A]" size={20} />
          <p className="mt-3 text-sm font-bold">{sentTo} 으로 보냈습니다</p>
          <p className="mt-2 text-sm leading-6 text-[#475569]">
            메일이 보이지 않으면 스팸함을 확인해 주세요. 링크를 누르기 전까지는 글과 댓글을 쓸 수 없습니다.
          </p>
        </div>
      </CourseAuthShell>
    );
  }

  return (
    <CourseAuthShell
      title="수강생 가입"
      description={`${COURSE.label} 게시판에 글과 댓글을 남기려면 학교 메일로 가입해 주세요.`}
      footer={
        <div className="space-y-3 text-[#475569]">
          <p className="flex flex-wrap items-center justify-between gap-2">
            이미 계정이 있으신가요?
            <Link href={COURSE_LOGIN_HREF} className="font-bold text-[#2563EB]">로그인</Link>
          </p>
          <p className="flex flex-wrap items-center justify-between gap-2">
            게시판만 둘러보시겠어요?
            <Link href={courseHref()} className="font-bold text-[#2563EB]">로그인 없이 보기</Link>
          </p>
        </div>
      }
    >
      <form onSubmit={submit} className="space-y-5">
        <AuthField label="이름" hint="확정 팀 명단에 적을 이름과 같게 써 주세요.">
          <input
            required
            value={form.fullName}
            onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
            placeholder="김하나"
            className={authInputClass}
          />
        </AuthField>

        <AuthField label="학교 메일" hint={`@${COURSE_EMAIL_DOMAIN} 주소만 가입할 수 있습니다.`}>
          <input
            required
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            placeholder={`hana@${COURSE_EMAIL_DOMAIN}`}
            className={authInputClass}
          />
        </AuthField>

        <AuthField label="비밀번호" hint={`${MIN_PASSWORD_LENGTH}자 이상`}>
          <input
            required
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
            placeholder="비밀번호"
            className={authInputClass}
          />
        </AuthField>

        {error && <AuthError>{error}</AuthError>}

        <Button type="submit" size="lg" block loading={loading}>가입하고 인증 메일 받기</Button>
      </form>
    </CourseAuthShell>
  );
}

// ---------------------------------------------------------------- 로그인

export function CourseLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetMode, setResetMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const checking = useRedirectIfSignedIn();

  const submitLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
      router.replace(getReturnTo());
    } catch (reason) {
      setError(toAuthMessage(reason, "로그인에 실패했습니다."));
      setLoading(false);
    }
  };

  const submitReset = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await requestPasswordReset(email);
      setResetSent(true);
    } catch (reason) {
      setError(toAuthMessage(reason, "재설정 메일을 보내지 못했습니다."));
    } finally {
      setLoading(false);
    }
  };

  if (checking) return <Checking />;

  if (resetMode) {
    return (
      <CourseAuthShell
        title="비밀번호 재설정"
        description="가입한 학교 메일로 재설정 링크를 보내드립니다."
        footer={
          <button
            type="button"
            onClick={() => { setResetMode(false); setResetSent(false); setError(null); }}
            className="font-bold text-[#2563EB]"
          >
            로그인으로 돌아가기
          </button>
        }
      >
        {resetSent ? (
          <div className="rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] p-5">
            <MailCheck className="text-[#16A34A]" size={20} />
            <p className="mt-3 text-sm font-bold">{email} 으로 메일을 보냈습니다</p>
            <p className="mt-2 text-sm leading-6 text-[#475569]">메일이 보이지 않으면 스팸함을 확인해 주세요.</p>
          </div>
        ) : (
          <form onSubmit={submitReset} className="space-y-5">
            <AuthField label="학교 메일">
              <input
                required
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={`hana@${COURSE_EMAIL_DOMAIN}`}
                className={authInputClass}
              />
            </AuthField>
            {error && <AuthError>{error}</AuthError>}
            <Button type="submit" size="lg" block loading={loading}>재설정 링크 받기</Button>
          </form>
        )}
      </CourseAuthShell>
    );
  }

  return (
    <CourseAuthShell
      title="수강생 로그인"
      description={`${COURSE.label} 게시판에 글과 댓글을 남기려면 로그인해 주세요.`}
      footer={
        <div className="space-y-3 text-[#475569]">
          <p className="flex flex-wrap items-center justify-between gap-2">
            아직 계정이 없으신가요?
            <Link href={COURSE_SIGNUP_HREF} className="font-bold text-[#2563EB]">수강생 가입</Link>
          </p>
          <p className="flex flex-wrap items-center justify-between gap-2">
            게시판만 둘러보시겠어요?
            <Link href={courseHref()} className="font-bold text-[#2563EB]">로그인 없이 보기</Link>
          </p>
        </div>
      }
    >
      <form onSubmit={submitLogin} className="space-y-5">
        <AuthField label="학교 메일">
          <input
            required
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={`hana@${COURSE_EMAIL_DOMAIN}`}
            className={authInputClass}
          />
        </AuthField>

        <div>
          <AuthField label="비밀번호">
            <input
              required
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="비밀번호"
              className={authInputClass}
            />
          </AuthField>
          <button type="button" onClick={() => { setResetMode(true); setError(null); }} className="mt-2 text-xs font-bold text-[#2563EB]">
            비밀번호를 잊으셨나요?
          </button>
        </div>

        {error && <AuthError>{error}</AuthError>}

        <Button type="submit" size="lg" block loading={loading}>로그인</Button>
      </form>
    </CourseAuthShell>
  );
}
