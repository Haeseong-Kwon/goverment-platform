import { inflateRawSync } from "node:zlib";

/**
 * 워드(.docx) 본문에서 글자만 뽑습니다.
 *
 * docx는 ZIP 안에 `word/document.xml`이 들어 있는 구조라, 압축 해제는 Node의 zlib으로,
 * 태그 제거는 문자열 처리로 끝납니다. 이 하나를 위해 문서 파싱 라이브러리를 더 넣지 않습니다.
 * 서식·이미지·표 구조는 버립니다. 진단은 문장만 읽으면 됩니다.
 *
 * 한글(.hwp)은 여기서 다루지 않습니다. 바이너리 독자 포맷이라 같은 방법이 통하지 않습니다.
 * (.hwpx는 docx처럼 ZIP+XML이라 나중에 같은 틀로 확장할 수 있습니다.)
 */

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;

/** ZIP 꼬리의 중앙 디렉터리 위치. 주석이 붙어 있을 수 있어 뒤에서부터 훑습니다. */
function findCentralDirectory(buffer: Buffer) {
  const maxCommentLength = 0xffff;
  const start = Math.max(0, buffer.length - maxCommentLength - 22);
  for (let offset = buffer.length - 22; offset >= start; offset -= 1) {
    if (buffer.readUInt32LE(offset) === EOCD_SIGNATURE) {
      return { entryCount: buffer.readUInt16LE(offset + 10), offset: buffer.readUInt32LE(offset + 16) };
    }
  }
  return null;
}

/** 원하는 이름의 항목 하나만 풀어 냅니다. 나머지 항목은 건드리지 않습니다. */
function readEntry(buffer: Buffer, entryName: string): Buffer | null {
  const directory = findCentralDirectory(buffer);
  if (!directory) return null;

  let cursor = directory.offset;
  for (let index = 0; index < directory.entryCount; index += 1) {
    if (cursor + 46 > buffer.length || buffer.readUInt32LE(cursor) !== CENTRAL_SIGNATURE) return null;
    const method = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localOffset = buffer.readUInt32LE(cursor + 42);
    const name = buffer.toString("utf8", cursor + 46, cursor + 46 + nameLength);

    if (name === entryName) {
      // 로컬 헤더의 이름·부가 필드 길이는 중앙 디렉터리와 다를 수 있어 다시 읽습니다.
      const localNameLength = buffer.readUInt16LE(localOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localOffset + 28);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      const data = buffer.subarray(dataStart, dataStart + compressedSize);
      if (method === 0) return Buffer.from(data);
      if (method === 8) return inflateRawSync(data);
      return null;
    }
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return null;
}

/** 문단·줄바꿈 태그는 줄로 살리고 나머지 태그는 지웁니다. */
function xmlToText(xml: string) {
  return xml
    .replace(/<w:p[ >]/g, "\n<w:p ")
    .replace(/<w:br\s*\/?>/g, "\n")
    .replace(/<w:tab\s*\/?>/g, "\t")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function extractDocxText(buffer: Buffer): string {
  let xml: Buffer | null;
  try {
    xml = readEntry(buffer, "word/document.xml");
  } catch {
    throw new Error("워드 파일을 읽지 못했습니다. 파일이 손상되었을 수 있습니다.");
  }
  if (!xml) throw new Error("워드 파일에서 본문을 찾지 못했습니다. .docx 형식인지 확인해 주세요.");
  return xmlToText(xml.toString("utf8"));
}
