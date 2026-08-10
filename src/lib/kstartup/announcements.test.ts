import { describe, expect, it } from "vitest";
import {
  getAnnouncementStatus,
  matchesAnnouncementFilters,
  normalizeAnnouncement,
  splitTokens,
  toIsoDate,
  type Announcement,
} from "./announcements";

/** 실제 `getAnnouncementInformation01` 응답 한 건을 그대로 옮긴 것입니다(pbanc_sn 178845). */
const RAW_ROW: Record<string, unknown> = {
  aply_excl_trgt_ctnt: "팁스 R&amp;D 및 팁스 연계 사업에 선정되어 협약을 체결한 이력이 있는 창업기업(대표자 포함)은 신청 불가",
  aply_mthd_eml_rcpt_istc: null,
  aply_mthd_etc_istc: null,
  aply_mthd_fax_rcpt_istc: null,
  aply_mthd_onli_rcpt_istc: "https://buly.kr/HHf3KNe",
  aply_mthd_pssr_rcpt_istc: null,
  aply_mthd_vst_rcpt_istc: null,
  aply_trgt: "일반기업,1인 창조기업",
  aply_trgt_ctnt: "충청권(대전·세종·충남·충북) 소재 창업 후 2년 3개월 미만 기업",
  biz_aply_url: null,
  biz_enyy: "3년미만",
  biz_gdnc_url: null,
  biz_pbanc_nm: "2026년 웰컴 투 팁스 1차 참가기업 모집 (충청권)",
  biz_prch_dprt_nm: "프리팁스 투자육성부",
  biz_trgt_age: "만 20세 이상 ~ 만 39세 이하,만 40세 이상",
  detl_pg_url: "https://www.k-startup.go.kr/web/contents/bizpbanc-ongoing.do?schM=view&pbancSn=178845",
  intg_pbanc_biz_nm: "2026년 웰컴 투 팁스 1차 참가기업 모집 (충청권)",
  intg_pbanc_yn: "N",
  pbanc_ctnt: "충청권 소재의 유망한 기술 기반 초기 창업기업을 발굴합니다.",
  pbanc_ntrp_nm: "(주)로우파트너스",
  pbanc_rcpt_bgng_dt: "20260807",
  pbanc_rcpt_end_dt: "20260818",
  pbanc_sn: 178845,
  prch_cnpl_no: "0428629583",
  prfn_matr: null,
  rcrt_prgs_yn: "Y",
  sprv_inst: "민간",
  supt_biz_clsfc: "기술개발(R&amp;D)",
  supt_regin: "전국",
};

describe("normalizeAnnouncement", () => {
  it("실제 응답 한 건을 DB 행 모양으로 옮긴다", () => {
    const row = normalizeAnnouncement(RAW_ROW);
    expect(row).not.toBeNull();
    expect(row?.pbanc_sn).toBe(178845);
    expect(row?.start_date).toBe("2026-08-07");
    expect(row?.end_date).toBe("2026-08-18");
    expect(row?.applicant_types).toEqual(["일반기업", "1인 창조기업"]);
    expect(row?.target_ages).toEqual(["만 20세 이상 ~ 만 39세 이하", "만 40세 이상"]);
    expect(row?.apply_methods).toEqual({ 온라인: "https://buly.kr/HHf3KNe" });
    expect(row?.is_integrated).toBe(false);
  });

  it("HTML 엔티티를 디코딩한다 — 이게 없으면 분야 필터가 영원히 0건이다", () => {
    expect(normalizeAnnouncement(RAW_ROW)?.support_field).toBe("기술개발(R&D)");
    expect(normalizeAnnouncement(RAW_ROW)?.exclude_target).toContain("팁스 R&D");
  });

  it("공고 일련번호나 공고명이 없으면 버린다", () => {
    expect(normalizeAnnouncement({ ...RAW_ROW, pbanc_sn: null })).toBeNull();
    expect(normalizeAnnouncement({ ...RAW_ROW, biz_pbanc_nm: "  ", intg_pbanc_biz_nm: null })).toBeNull();
  });

  it("원문 URL이 비어 있으면 공고 일련번호로 조립한다", () => {
    expect(normalizeAnnouncement({ ...RAW_ROW, detl_pg_url: null })?.detail_url).toContain("pbancSn=178845");
  });
});

describe("toIsoDate", () => {
  it("YYYYMMDD를 DATE 문자열로 바꾼다", () => {
    expect(toIsoDate("20260818")).toBe("2026-08-18");
  });

  it("형식이 어긋나거나 없는 날짜는 null이다 — 날짜를 지어내지 않는다", () => {
    expect(toIsoDate("2026-08")).toBeNull();
    expect(toIsoDate("20260230")).toBeNull();
    expect(toIsoDate(null)).toBeNull();
  });
});

describe("splitTokens", () => {
  it("쉼표 다중값을 토큰으로 나누고 중복을 지운다", () => {
    expect(splitTokens("서울, 경기 ,서울")).toEqual(["서울", "경기"]);
    expect(splitTokens(null)).toEqual([]);
  });
});

describe("getAnnouncementStatus", () => {
  const today = "2026-08-10";

  it("마감일이 지났으면 마감이다 — upstream 플래그가 아니라 날짜로 다시 판단한다", () => {
    expect(getAnnouncementStatus({ start_date: "2026-07-01", end_date: "2026-08-09" }, today)).toBe("closed");
  });

  it("마감 당일은 아직 접수 중이다", () => {
    expect(getAnnouncementStatus({ start_date: "2026-08-01", end_date: today }, today)).toBe("open");
  });

  it("접수 시작 전이면 접수 예정이다", () => {
    expect(getAnnouncementStatus({ start_date: "2026-08-11", end_date: "2026-09-01" }, today)).toBe("upcoming");
  });

  it("기간이 비어 있으면 접수 중으로 둔다 — 상시 접수 공고가 사라지면 안 된다", () => {
    expect(getAnnouncementStatus({ start_date: null, end_date: null }, today)).toBe("open");
  });
});

describe("matchesAnnouncementFilters", () => {
  const today = "2026-08-10";
  const base = normalizeAnnouncement(RAW_ROW) as Announcement;
  const seoul: Announcement = { ...base, pbanc_sn: 2, regions: ["서울"] };
  const noFilters = {
    keyword: "",
    supportFields: [],
    regions: [],
    bizAges: [],
    applicantTypes: [],
    targetAges: [],
    includeClosed: false,
  };

  it("조건이 없으면 접수 중 공고를 모두 통과시킨다", () => {
    expect(matchesAnnouncementFilters(base, noFilters, today)).toBe(true);
  });

  it("마감 공고는 기본적으로 감추고, 켜면 보인다", () => {
    const closed: Announcement = { ...base, end_date: "2026-08-01" };
    expect(matchesAnnouncementFilters(closed, noFilters, today)).toBe(false);
    expect(matchesAnnouncementFilters(closed, { ...noFilters, includeClosed: true }, today)).toBe(true);
  });

  it("지역을 골라도 전국 공고는 함께 통과한다", () => {
    expect(matchesAnnouncementFilters(base, { ...noFilters, regions: ["서울"] }, today)).toBe(true);
    expect(matchesAnnouncementFilters(seoul, { ...noFilters, regions: ["서울"] }, today)).toBe(true);
    expect(matchesAnnouncementFilters(seoul, { ...noFilters, regions: ["부산"] }, today)).toBe(false);
  });

  it("같은 항목 안에서는 OR, 다른 항목끼리는 AND다", () => {
    expect(matchesAnnouncementFilters(base, { ...noFilters, applicantTypes: ["대학생", "일반기업"] }, today)).toBe(true);
    expect(
      matchesAnnouncementFilters(base, { ...noFilters, applicantTypes: ["일반기업"], bizAges: ["예비창업자"] }, today),
    ).toBe(false);
  });

  it("검색어는 공고명과 내용을 함께 본다", () => {
    expect(matchesAnnouncementFilters(base, { ...noFilters, keyword: "팁스" }, today)).toBe(true);
    expect(matchesAnnouncementFilters(base, { ...noFilters, keyword: "충청권 소재" }, today)).toBe(true);
    expect(matchesAnnouncementFilters(base, { ...noFilters, keyword: "존재하지않는키워드" }, today)).toBe(false);
  });
});
