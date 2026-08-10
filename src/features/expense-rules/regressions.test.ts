import { describe, it, expect } from "vitest";
import { validateExpense } from "./engine";
import { parsePlanRows, resolveCategory } from "./planImport";
import { POLICY } from "./ruleset";

const base = { agreementStart: "2026-01-01", agreementEnd: "2026-12-31", executionDate: "2026-06-01" } as const;
const codes = (e: any) => validateExpense(e).findings.map((f: any) => f.code);
const one = (raw: string) => parsePlanRows(raw, { start: "2026-01-01", end: "2026-12-31" })[0];

describe("회귀 방지 — 감사에서 발견된 결함", () => {
  it("CSV 천단위 쉼표", () => {
    const r = one("A팀,재료비,시제품 원자재,1,800,000,2026-06-01,2026-06-10");
    expect(r.error).toBeUndefined();
    expect(r.expense?.amount).toBe(1_800_000);
    expect(r.expense?.executionDate).toBe("2026-06-01");
    expect(r.expense?.deliveryDate).toBe("2026-06-10");
  });
  it("따옴표로 감싼 금액", () => {
    expect(one('A팀,재료비,원자재,"2,500,000",2026-06-01').expense?.amount).toBe(2_500_000);
  });
  it("숫자로 끝나는 건명은 오결합되지 않음", () => {
    const r = one("A팀,재료비,모델3,500,2026-06-01");
    expect(r.expense?.title).toBe("모델3");
    expect(r.expense?.amount).toBe(500);
  });
  it("탭 구분 유지", () => {
    expect(one("A팀\t재료비\t원자재\t1,800,000\t2026-06-01").expense?.amount).toBe(1_800_000);
  });
  it("금액 미기재는 에러", () => {
    expect(one("A팀\t재료비\t원자재\t\t2026-06-01").error).toMatch(/숫자로 읽지 못했습니다/);
    expect(one("A팀\t재료비\t원자재\t금액미정\t2026-06-01").error).toMatch(/숫자로 읽지 못했습니다/);
  });
  it("기계장치·도구 구입비 인식", () => {
    expect(resolveCategory("기계장치·도구 구입비")).toBe("equipment");
    expect(resolveCategory("특허권 등 무형자산 취득비")).toBe("ip");
  });
  it("OUT-09 경계값 포함", () => {
    expect(codes({ ...base, category: "outsourcing", amount: POLICY.outsourcingDeliberationOver })).toContain("OUT-09");
  });
  it("office_furniture는 어느 비목에서도 차단, 순환 안내 없음", () => {
    const m = codes({ ...base, category: "material", amount: 500000, itemFlags: ["office_furniture"] });
    const e = codes({ ...base, category: "equipment", amount: 500000, itemFlags: ["office_furniture"] });
    expect(m).toContain("COM-06");
    expect(m).not.toContain("COM-05");
    expect(e).toContain("COM-06");
  });
  it("비목별 배정 잔액 초과를 차단한다", () => {
    const over = validateExpense({ ...base, category: "material", amount: 5_000_000,
      evidence: ["세금계산서", "계좌이체 확인증", "거래명세서"],
      budget: { allocated: 10_000_000, executed: 8_000_000 } } as any);
    expect(over.findings.map((f: any) => f.code)).toContain("BUD-01");
    expect(over.verdict).toBe("fail");

    const within = validateExpense({ ...base, category: "material", amount: 2_000_000,
      evidence: ["세금계산서", "계좌이체 확인증", "거래명세서"],
      budget: { allocated: 10_000_000, executed: 8_000_000 } } as any);
    expect(within.verdict).toBe("pass");
  });

  it("배정액이 없으면 한도 판정을 건너뛴다", () => {
    // 정보 부재를 위반으로 만들면 배정액을 등록하지 않은 팀이 아무것도 제출하지 못합니다.
    const noBudget = validateExpense({ ...base, category: "material", amount: 999_000_000,
      evidence: ["세금계산서", "계좌이체 확인증", "거래명세서"] } as any);
    expect(noBudget.findings.some((f: any) => f.code === "BUD-01")).toBe(false);
  });

  // AI가 설정할 수 있는 플래그인데 엔진이 검사하지 않아, 중고 기자재를 잡아내도
  // 아무 판정도 나오지 않던 구멍입니다.
  it("중고 기자재는 거래처 업종 증빙을 요구한다", () => {
    const used = validateExpense({ ...base, category: "equipment", amount: 3_000_000,
      deliveryDate: "2026-06-10", itemFlags: ["used_item"],
      evidence: ["세금계산서", "계좌이체 확인증", "거래명세서"] } as any);
    expect(used.findings.map((f: any) => f.code)).toContain("EQP-08");
    expect(used.verdict).toBe("review");
  });

  it("개인 간 중고 거래는 차단이고, 같은 지적을 두 번 하지 않는다", () => {
    const personal = validateExpense({ ...base, category: "equipment", amount: 3_000_000,
      deliveryDate: "2026-06-10", itemFlags: ["used_item", "used_from_individual"],
      evidence: ["세금계산서", "계좌이체 확인증", "거래명세서"] } as any);
    const found = personal.findings.map((f: any) => f.code);
    expect(found).toContain("EQP-05");
    expect(found).not.toContain("EQP-08");
    expect(personal.verdict).toBe("fail");
  });

  it("중고가 아니면 EQP-08은 나오지 않는다", () => {
    const fresh = validateExpense({ ...base, category: "equipment", amount: 3_000_000,
      deliveryDate: "2026-06-10", evidence: ["세금계산서", "계좌이체 확인증", "거래명세서"] } as any);
    expect(fresh.findings.map((f: any) => f.code)).not.toContain("EQP-08");
  });

  it("여비·교육훈련비 통과 가능", () => {
    const trv = validateExpense({ ...base, category: "travel", amount: 300000,
      evidence: ["출장 계획·결과 보고", "교통비 영수증", "계좌이체 확인증"],
      travel: { isOverseas: false, seatClass: "economy", isPublicTransport: true },
      labor: { insuranceEnrolled: true } } as any);
    expect(trv.unchecked).toEqual([]);
    expect(trv.verdict).toBe("pass");
    const trn = validateExpense({ ...base, category: "training", amount: 300000,
      evidence: ["교육 수료증", "4대 보험가입자명부", "계좌이체 확인증"],
      labor: { insuranceEnrolled: true } } as any);
    expect(trn.unchecked).toEqual([]);
    expect(trn.verdict).toBe("pass");
  });
});
