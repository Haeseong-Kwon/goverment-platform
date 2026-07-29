import { describe, expect, it } from "vitest";
import { parsePlanRows, resolveCategory } from "./planImport";
import { composeRejectionNotice, summarizeRejectionReasons } from "./rejection";
import { validateExpense } from "./engine";

const agreement = { start: "2026-04-01", end: "2026-12-31" };

describe("계획서 파싱", () => {
  it("표기가 다른 비목 이름을 정규화한다", () => {
    expect(resolveCategory("기계장치·도구")).toBe("equipment");
    expect(resolveCategory("외주용역비")).toBe("outsourcing");
    expect(resolveCategory("홍보비")).toBe("advertising");
    expect(resolveCategory("알수없는비목")).toBeNull();
  });

  it("탭·쉼표 구분 행을 집행 건으로 변환한다", () => {
    const rows = parsePlanRows("인벤티,외주용역비,목업 제작,25000000,2026-06-01\n# 주석\n그린루프\t홍보비\t배너광고\t1,800,000", agreement);
    expect(rows).toHaveLength(2);
    expect(rows[0].expense).toMatchObject({ category: "outsourcing", amount: 25_000_000 });
    expect(rows[1].expense).toMatchObject({ category: "advertising", amount: 1_800_000 });
  });

  it("인식할 수 없는 비목은 에러로 남긴다", () => {
    const [row] = parsePlanRows("팀A,잡비,회식,100000", agreement);
    expect(row.error).toContain("잡비");
  });
});

describe("반려 안내문", () => {
  it("검증에서 나온 조항을 인용해 안내문을 만든다", () => {
    const verdict = validateExpense({
      category: "outsourcing",
      amount: 25_000_000,
      agreementStart: agreement.start,
      agreementEnd: agreement.end,
      executionDate: "2026-06-01",
      vendor: { type: "business", industryRelated: true },
      evidence: [],
    });
    const notice = composeRejectionNotice({
      teamName: "인벤티",
      submissionTitle: "목업 제작 외주",
      managerName: "김담당",
      institutionName: "인하대학교 창업지원단",
      reasonCodes: ["E-106"],
      findings: verdict.findings,
    });
    expect(notice.subject).toContain("목업 제작 외주");
    expect(notice.body).toContain("E-106");
    expect(notice.body).toContain("2,000만원 초과 외주용역");
    expect(notice.citedCount).toBeGreaterThan(0);
  });

  it("반려 사유 분포를 비율까지 집계한다", () => {
    expect(summarizeRejectionReasons(["E-102", "E-102", "E-101"])[0]).toMatchObject({ code: "E-102", count: 2, share: 67 });
  });
});
