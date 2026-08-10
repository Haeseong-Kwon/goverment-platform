import { describe, expect, it } from "vitest";
import { sanitizeKeyword, toArrayLiteral } from "./AnnouncementService";

describe("sanitizeKeyword", () => {
  it("한글·영숫자·공백·하이픈만 남긴다", () => {
    expect(sanitizeKeyword("예비창업 package-2026")).toBe("예비창업 package-2026");
  });

  it("PostgREST 필터 문법을 깨뜨릴 문자를 지운다", () => {
    // 쉼표·괄호·마침표가 그대로 들어가면 or= 조건이 갈라져 엉뚱한 결과가 나옵니다.
    expect(sanitizeKeyword("팁스,title.ilike.*x*")).toBe("팁스 title ilike x");
    expect(sanitizeKeyword("a)or(b")).toBe("a or b");
    expect(sanitizeKeyword("%_*")).toBe("");
  });

  it("길이를 제한한다", () => {
    expect(sanitizeKeyword("가".repeat(200))).toHaveLength(60);
  });
});

describe("toArrayLiteral", () => {
  it("원소를 큰따옴표로 감싼 Postgres 배열 리터럴을 만든다", () => {
    expect(toArrayLiteral(["서울", "전국"])).toBe('{"서울","전국"}');
  });

  it("공백·물결이 든 실제 연령 구간 값을 그대로 담는다", () => {
    expect(toArrayLiteral(["만 20세 이상 ~ 만 39세 이하"])).toBe('{"만 20세 이상 ~ 만 39세 이하"}');
  });

  it("쉼표가 든 값이 두 원소로 쪼개지지 않는다", () => {
    expect(toArrayLiteral(["a,b"])).toBe('{"a,b"}');
  });

  it("따옴표와 역슬래시를 이스케이프한다", () => {
    expect(toArrayLiteral(['a"b', "c\\d"])).toBe('{"a\\"b","c\\\\d"}');
  });
});
