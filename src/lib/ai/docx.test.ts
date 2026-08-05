import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { extractDocxText } from "./docx";

/** 실제 워드 파일 구조(ZIP+XML)를 만들어 넣습니다. 손으로 만든 가짜가 아니라 진짜 docx여야 합니다. */
function makeDocx(paragraphs: string[]): Buffer {
  const script = `
import zipfile, io, sys, json
paras = json.loads(sys.argv[1])
body = "".join('<w:p><w:r><w:t xml:space="preserve">' + p + '</w:t></w:r></w:p>' for p in paras)
doc = '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' + body + '</w:body></w:document>'
buf = io.BytesIO()
with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
    z.writestr("[Content_Types].xml", "<Types/>")
    z.writestr("_rels/.rels", "<Relationships/>")
    z.writestr("word/document.xml", doc)
sys.stdout.buffer.write(buf.getvalue())
`;
  return execFileSync("python3", ["-c", script, JSON.stringify(paragraphs)], { maxBuffer: 8 * 1024 * 1024 });
}

describe("워드 파일 본문 추출", () => {
  it("문단을 줄로 살려 글자만 남긴다", () => {
    const text = extractDocxText(makeDocx([
      "문제인식: 소상공인은 재고의 12%를 손실합니다.",
      "팀구성: 물류 SaaS 5년 경력 개발자 3명.",
    ]));
    expect(text).toContain("소상공인은 재고의 12%를 손실합니다");
    expect(text).toContain("물류 SaaS 5년 경력 개발자 3명");
    expect(text).not.toContain("<w:"); // 태그가 남으면 안 됩니다
    expect(text.split("\n").filter(Boolean)).toHaveLength(2);
  });

  it("XML 이스케이프를 원래 문자로 되돌린다", () => {
    expect(extractDocxText(makeDocx(["매출 &gt; 비용 &amp; 흑자 전환"]))).toBe("매출 > 비용 & 흑자 전환");
  });

  it("docx가 아니면 알아들을 수 있는 오류를 낸다", () => {
    expect(() => extractDocxText(Buffer.from("이건 워드 파일이 아닙니다"))).toThrow(/본문을 찾지 못했습니다|읽지 못했습니다/);
  });
});
