-- K-Startup 지원사업 공고 캐시.
--
-- 출처: 공공데이터포털 `창업진흥원_K-Startup(사업소개,사업공고,콘텐츠 등)_조회서비스`
--       (dataset 15125364) / `getAnnouncementInformation01`. 갱신 주기는 일 1회입니다.
--
-- 왜 `programs` 테이블에 넣지 않는가:
--   `programs`는 자격 진단 룰셋(ruleset_version)과 prep_projects·conversion_codes의
--   외래키가 걸린 축입니다. 매일 수백 건이 들어오고 사라지는 외부 공고를 같은 테이블에
--   섞으면 룰셋 없는 행이 진단 화면에 뜨고, 동기화가 지우는 순간 참조가 끊깁니다.
--   공고 목록은 읽기 전용 캐시로 분리하고, 자격 룰셋은 기존 `programs`가 계속 담당합니다.

CREATE TABLE IF NOT EXISTS kstartup_announcements (
  -- K-Startup 공고 일련번호. 원문 URL의 pbancSn과 같은 값이라 그대로 기본키로 씁니다.
  pbanc_sn BIGINT PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT,
  start_date DATE,
  end_date DATE,
  support_field TEXT,
  -- 다중값 컬럼은 쉼표 문자열 대신 배열로 저장합니다. ILIKE '%경남%'은
  -- '전남광주' 같은 이웃 토큰을 잘못 집어내지만, 배열 겹침(&&)은 토큰 단위로 정확합니다.
  regions TEXT[] NOT NULL DEFAULT '{}',
  biz_ages TEXT[] NOT NULL DEFAULT '{}',
  applicant_types TEXT[] NOT NULL DEFAULT '{}',
  target_ages TEXT[] NOT NULL DEFAULT '{}',
  organizer TEXT,
  supervising_institution TEXT,
  department TEXT,
  contact TEXT,
  apply_target TEXT,
  exclude_target TEXT,
  apply_methods JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  detail_url TEXT,
  guide_url TEXT,
  is_integrated BOOLEAN NOT NULL DEFAULT false,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 기본 정렬(마감 임박순)과 "마감 지난 공고 숨기기"가 모두 이 컬럼을 봅니다.
CREATE INDEX IF NOT EXISTS kstartup_announcements_end_date_idx ON kstartup_announcements (end_date);

-- ponytail: 배열 필터는 인덱스 없이 순차 스캔입니다. 동기화 창이 "접수 중" 수백 건이라
-- 지금은 즉시 응답합니다. 보관 기간을 늘려 수천 건이 되면 regions/applicant_types에
-- GIN 인덱스를 추가하세요.

ALTER TABLE kstartup_announcements ENABLE ROW LEVEL SECURITY;

-- 정부 공개 데이터입니다. 로그인 여부와 무관하게 읽히고, 쓰기는 service_role
-- (RLS 우회)로 도는 동기화 라우트만 합니다. 여기에 쓰기 정책을 두지 않는 것이
-- 곧 "아무 사용자도 공고를 수정할 수 없다"는 뜻입니다.
DROP POLICY IF EXISTS "anyone reads kstartup announcements" ON kstartup_announcements;
CREATE POLICY "anyone reads kstartup announcements" ON kstartup_announcements FOR SELECT USING (true);
