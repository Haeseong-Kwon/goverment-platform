"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GraduationCap, Loader2, MailCheck, Presentation, TriangleAlert, Users } from "lucide-react";
import { completeAuthFromUrl, requestPasswordReset, signIn, toAuthMessage } from "@/lib/services/AuthService";
import { signOutViewer, signUpViewer } from "@/lib/services/CourseService";
import {
  COURSE,
  COURSE_EMAIL_DOMAIN,
  COURSE_LOGIN_HREF,
  COURSE_SIGNUP_HREF,
  COURSE_WORKSPACE_HREF,
  courseHref,
  isCourseEmail,
} from "./course";
import { useViewer } from "./CourseChrome";
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

/**
 * 이 화면을 건너뛸 사람만 돌려보냅니다.
 *
 * 조건이 "로그인했는가"가 아니라 "로그인했고 **자격도 있는가**"입니다.
 * 전자로 두면, 다른 메일로 가입해 자격이 없는 사람이 안내를 보고 가입 화면에
 * 들어오는 순간 "이미 로그인됨"으로 튕겨 나갑니다 — 정작 가입시켜야 할 사람입니다.
 *
 * 세션은 `useViewer`가 읽습니다. 과목 화면 전체가 같은 출처를 봐야
 * 헤더는 "로그인하세요"라 하고 로그인 화면은 "이미 로그인됨"이라 하는 일이 없습니다.
 *
 * **폼을 이 확인 뒤로 미루지 않습니다.** 세션 조회가 끝날 때까지 스피너를 보여 주면,
 * 조회가 느리거나 어긋나는 순간 사용자에게는 "가입 화면이 안 뜨는" 것과 똑같습니다.
 * 폼을 먼저 그리고, 자격이 확인된 사람만 나중에 조용히 워크스페이스로 보냅니다.
 */
function useSkipIfReady() {
  const router = useRouter();
  const viewer = useViewer();

  useEffect(() => {
    if (!viewer.loading && viewer.id && viewer.member) router.replace(getReturnTo());
  }, [viewer.loading, viewer.id, viewer.member, router]);

  return viewer;
}

/**
 * 자격 없는 계정으로 로그인한 채 가입·로그인 화면에 온 경우.
 * 무엇이 문제인지(어느 계정인지)를 먼저 말해야 다음 행동을 정할 수 있습니다.
 */
function SignedInAsOther({ email, mode }: { email: string | null; mode: "signup" | "login" }) {
  return (
    <div className="mb-6 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-4 text-sm leading-6 text-[#B45309]">
      <p className="font-bold">
        지금 {email ?? "다른 계정"}으로 로그인되어 있습니다
      </p>
      <p className="mt-1 font-medium">
        이 계정은 @{COURSE_EMAIL_DOMAIN} 주소가 아니거나 메일 인증이 끝나지 않아 글을 쓸 수 없습니다.
        {mode === "signup"
          ? " 아래에서 학교 메일로 새로 가입하면 지금 계정은 로그아웃됩니다."
          : " 학교 메일 계정으로 다시 로그인해 주세요."}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------- 인증 메일 콜백

/**
 * 인증 메일 링크가 돌아오는 곳.
 *
 * 파일럿 콜백(`/auth/callback`)으로 보내면 안 됩니다. 그 화면은 `startup_profiles`를
 * 읽어 온보딩 여부로 갈 곳을 정하기 때문에, 과목 학생은 창업자 "팀 설정"으로
 * 떨어집니다. 여기서는 세션만 세우고 과목 메인으로 보냅니다.
 */
export function CourseAuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    completeAuthFromUrl(new URLSearchParams(typeof window === "undefined" ? "" : window.location.search))
      .then((authenticated) => {
        if (!mounted) return;
        if (!authenticated) throw new Error("인증 정보가 올바르지 않거나 링크가 만료되었습니다.");
        router.replace(courseHref());
      })
      .catch((reason) => {
        if (mounted) setError(toAuthMessage(reason, "이메일 인증을 처리하지 못했습니다."));
      });
    return () => { mounted = false; };
  }, [router]);

  return (
    <CourseAuthShell
      title={error ? "인증 실패" : "이메일 인증 확인 중"}
      description={error ?? "잠시만 기다려 주세요. 확인이 끝나면 과목 게시판으로 이동합니다."}
      footer={error ? <Link href={COURSE_LOGIN_HREF} className="font-bold text-[#2563EB]">로그인 화면으로</Link> : undefined}
    >
      <div className="flex items-center gap-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-5">
        {error ? <TriangleAlert className="text-[#DC2626]" size={20} /> : <Loader2 className="animate-spin text-[#2563EB]" size={20} />}
        <span className="text-sm font-semibold text-[#475569]">
          {error ? "링크를 다시 요청하거나 로그인 화면에서 재시도해 주세요." : "이 화면을 닫지 말아 주세요."}
        </span>
      </div>
    </CourseAuthShell>
  );
}

// ---------------------------------------------------------------- 회원가입

export function CourseSignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ fullName: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const viewer = useSkipIfReady();

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
      // 다른 계정 세션을 쥔 채 가입하면 새 계정과 옛 세션이 섞여 "로그인은 되어 있는데
      // 자격은 없는" 상태가 그대로 남습니다. 먼저 끊고 시작합니다.
      if (viewer.id) await signOutViewer().catch(() => undefined);
      const result = await signUpViewer(form.email, form.password, form.fullName);
      /*
       * 이메일 확인이 켜져 있는지는 프로젝트 설정이라 코드가 알 수 없습니다.
       * 응답에 세션이 실려 오면 확인 없이 가입이 끝난 것이므로 곧장 게시판으로 보냅니다
       * — 그 경우에도 "메일을 확인하세요" 화면을 띄우면 오지 않을 메일을 기다리게 됩니다.
       * 세션이 없으면 확인 메일이 나간 것이고, 그때만 안내 화면을 보여 줍니다.
       */
      if (result.session) {
        router.replace(courseHref());
        return;
      }
      setSentTo(form.email.trim());
    } catch (reason) {
      setError(toAuthMessage(reason, "회원가입에 실패했습니다."));
    } finally {
      setLoading(false);
    }
  };

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
      {!viewer.loading && viewer.id && !viewer.member && <SignedInAsOther email={viewer.email} mode="signup" />}

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
  const viewer = useSkipIfReady();

  const submitLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (viewer.id) await signOutViewer().catch(() => undefined);
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
      {!viewer.loading && viewer.id && !viewer.member && <SignedInAsOther email={viewer.email} mode="login" />}

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
