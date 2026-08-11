import { describe, expect, it } from "vitest";
import { CASE_DETAILS, SOLUTION_CASES, filterCases, findRelatedCaseIds, getCase, isCaseStale, type SolutionCase } from "./cases";

const at = (lastCheckedAt: string, overrides: Partial<SolutionCase> = {}): SolutionCase => ({
  id: "TST-001",
  category: "etc",
  title: "테스트 사례",
  shortLabel: "테스트",
  status: "해결",
  lastCheckedAt,
  views: 0,
  ...overrides,
});

describe("isCaseStale", () => {
  const now = new Date("2026-08-11T00:00:00Z");

  it("12개월이 지나면 재확인 필요", () => {
    expect(isCaseStale(at("2025-08"), now)).toBe(true);
    expect(isCaseStale(at("2025-07"), now)).toBe(true);
  });

  it("12개월 이내는 표시하지 않는다", () => {
    expect(isCaseStale(at("2025-09"), now)).toBe(false);
    expect(isCaseStale(at("2026-08"), now)).toBe(false);
  });

  // 연말·연초에서 월 숫자만 빼면 음수가 나옵니다.
  it("해를 넘겨도 경과 개월을 바로 센다", () => {
    expect(isCaseStale(at("2025-12"), new Date("2026-01-15T00:00:00Z"))).toBe(false);
  });
});

describe("filterCases", () => {
  it("증상 키워드로 찾는다", () => {
    const found = filterCases(SOLUTION_CASES, { category: "all", query: "실사" });
    expect(found.map((item) => item.id)).toEqual(["ACC-001"]);
  });

  it("카테고리와 검색어를 함께 적용한다", () => {
    expect(filterCases(SOLUTION_CASES, { category: "kstartup", query: "계좌" })).toEqual([]);
  });

  it("최종 확인일 최신순으로 준다", () => {
    const ordered = filterCases(SOLUTION_CASES, { category: "all", query: "" });
    expect(ordered[ordered.length - 1].id).toBe("DOC-004");
    expect(ordered[0].views).toBeGreaterThanOrEqual(ordered[1].views);
  });
});

describe("CASE_DETAILS", () => {
  it("본문이 있는 사례는 목록에도 있어야 한다", () => {
    for (const id of Object.keys(CASE_DETAILS)) expect(getCase(id), id).toBeDefined();
  });

  // 연관 사례 카드가 없는 주소로 이어지면 죽은 링크가 됩니다.
  it("연관 사례는 자기 자신이 아니고 실재해야 한다", () => {
    for (const [id, detail] of Object.entries(CASE_DETAILS)) {
      for (const relatedId of detail.relatedIds) {
        expect(relatedId, `${id} → ${relatedId}`).not.toBe(id);
        expect(getCase(relatedId), relatedId).toBeDefined();
      }
    }
  });

  it("ACC-002에는 매니저 사전 협의 주의 문구가 남아 있다", () => {
    expect(CASE_DETAILS["ACC-002"].caution).toContain("사전 협의");
  });

  it("본문 없는 사례는 다른 화면에서 꺼내지 않는다", () => {
    expect(findRelatedCaseIds("사업자등록증 업종 코드 확인")).toEqual([]);
  });

  it("설계가 지정한 표면화 지점에서 해당 사례가 걸린다", () => {
    expect(findRelatedCaseIds("법인 설립 후 사업비 계좌 개설")).toContain("ACC-001");
    expect(findRelatedCaseIds("개인 명의 카드 고액 집행 확인 필요")).toContain("ACC-002");
  });

  it("무관한 문장에는 아무 사례도 붙지 않는다", () => {
    expect(findRelatedCaseIds("발표 리허설 준비")).toEqual([]);
  });

  it("단정·보장 표현을 쓰지 않는다", () => {
    const banned = ["무조건", "100% 해결", "무반려", "반려 위험도"];
    const text = JSON.stringify(CASE_DETAILS) + JSON.stringify(SOLUTION_CASES);
    for (const word of banned) expect(text, word).not.toContain(word);
  });
});
