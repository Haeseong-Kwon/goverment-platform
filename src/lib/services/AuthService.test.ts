import { describe, expect, it } from "vitest";
import { toAuthMessage } from "./AuthService";

describe("toAuthMessage", () => {
  it("replaces Supabase English errors with the Korean user message", () => {
    expect(toAuthMessage(new Error("Invalid login credentials"), "로그인에 실패했습니다.")).toBe(
      "이메일 또는 비밀번호가 올바르지 않습니다.",
    );
    expect(toAuthMessage(new Error("Email not confirmed"), "로그인에 실패했습니다.")).toContain("이메일 인증");
  });

  it("keeps an unmapped message instead of hiding it behind the fallback", () => {
    expect(toAuthMessage(new Error("Database connection lost"), "로그인에 실패했습니다.")).toBe("Database connection lost");
  });

  it("uses the fallback when there is nothing to show", () => {
    expect(toAuthMessage(null, "로그인에 실패했습니다.")).toBe("로그인에 실패했습니다.");
    expect(toAuthMessage(new Error(""), "로그인에 실패했습니다.")).toBe("로그인에 실패했습니다.");
  });
});
