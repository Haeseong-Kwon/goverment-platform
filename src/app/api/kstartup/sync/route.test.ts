import { describe, expect, it } from "vitest";
import { normalizeServiceKey } from "./route";

describe("normalizeServiceKey", () => {
  it("Decoding 키는 그대로 둔다", () => {
    expect(normalizeServiceKey("abc+def/ghi==")).toBe("abc+def/ghi==");
  });

  it("Encoding 키를 되돌린다 — 이게 없으면 30번(등록되지 않은 서비스키)으로 거절당한다", () => {
    // URLSearchParams가 뒤에서 한 번 더 인코딩하므로, %2B를 그대로 두면 %252B가 됩니다.
    expect(normalizeServiceKey("abc%2Bdef%2Fghi%3D%3D")).toBe("abc+def/ghi==");
  });

  it("퍼센트가 인코딩이 아닌 키는 깨뜨리지 않는다", () => {
    expect(normalizeServiceKey("abc%zzdef")).toBe("abc%zzdef");
  });
});
