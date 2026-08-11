import { describe, expect, it } from "vitest";
import { ATTACHMENT_ACCEPT, checkAttachment } from "./FounderWorkspaceService";

const MB = 1024 * 1024;

describe("checkAttachment", () => {
  it("문서·표·이미지 형식은 통과시킨다", () => {
    for (const name of ["계획서.hwp", "계획서.HWPX", "증빙.pdf", "내역.xlsx", "발표.pptx", "화면.png"]) {
      expect(checkAttachment({ name, size: 1024 })).toBeNull();
    }
  });

  it("실행 파일처럼 허용하지 않은 확장자는 막는다", () => {
    expect(checkAttachment({ name: "설치.exe", size: 1024 })).toContain("올릴 수 없는 형식");
    expect(checkAttachment({ name: "확장자없음", size: 1024 })).toContain("올릴 수 없는 형식");
    // 이름에 허용 확장자가 섞여 있어도 판단은 마지막 조각으로 합니다.
    expect(checkAttachment({ name: "보고서.pdf.exe", size: 1024 })).toContain("올릴 수 없는 형식");
  });

  it("빈 파일과 50MB 초과 파일은 막는다", () => {
    expect(checkAttachment({ name: "빈파일.pdf", size: 0 })).toContain("빈 파일");
    expect(checkAttachment({ name: "대용량.pdf", size: 50 * MB + 1 })).toContain("너무 큽니다");
    expect(checkAttachment({ name: "딱맞음.pdf", size: 50 * MB })).toBeNull();
  });

  it("파일 선택 창 accept 값은 점을 붙인 확장자 목록이다", () => {
    expect(ATTACHMENT_ACCEPT.startsWith(".pdf,")).toBe(true);
    expect(ATTACHMENT_ACCEPT).toContain(".hwp,");
  });
});
