import { describe, expect, it } from "vitest";
import {
  getGateReasonCodes,
  getReviewDetail,
  validateSettlement,
} from "./logic";

describe("validateSettlement", () => {
  it("returns missing evidence and over-limit messages for the default promo submission", () => {
    expect(
      validateSettlement({
        evidence: [
          { attached: true },
          { attached: true },
          { attached: false },
          { attached: false },
        ],
        limits: [{ label: "인건비", requested: 400, remaining: 320 }],
      }),
    ).toEqual({
      missingCount: 2,
      overLimitCount: 1,
      canSubmit: false,
      messages: [
        "증빙 2건이 첨부되지 않았습니다",
        "인건비 신청액이 잔여 한도를 초과했습니다",
      ],
      buttonLabel: "제출 (2건 미충족)",
    });
  });

  it("enables submission when evidence and limits are valid", () => {
    expect(
      validateSettlement({
        evidence: [{ attached: true }],
        limits: [{ label: "홍보비", requested: 80, remaining: 350 }],
      }),
    ).toMatchObject({
      missingCount: 0,
      overLimitCount: 0,
      canSubmit: true,
      messages: [],
      buttonLabel: "제출",
    });
  });
});

describe("getReviewDetail", () => {
  it("maps q3 to the machine purchase detail", () => {
    expect(getReviewDetail("q3")).toEqual({
      title: "로지스원 · #2026-0431",
      amount: "12,000,000원",
      account: "기계장치·도구",
    });
  });
});

describe("getGateReasonCodes", () => {
  it("limits accountant rejection reasons to gate 1 codes", () => {
    expect(getGateReasonCodes("accountant").map(({ code }) => code)).toEqual([
      "E-102",
      "E-104",
      "E-105",
    ]);
  });

  it("limits manager rejection reasons to gate 2 codes", () => {
    expect(getGateReasonCodes("manager").map(({ code }) => code)).toEqual([
      "E-101",
      "E-102",
      "E-103",
      "E-104",
    ]);
  });
});
