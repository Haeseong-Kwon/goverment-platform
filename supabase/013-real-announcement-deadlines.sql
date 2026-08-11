-- StartUp Pilot — 지원사업 마감일의 출처를 K-Startup 실공고로 옮깁니다.
-- 012 이후에 실행합니다. 재실행해도 안전합니다.
--
-- 문제: `programs.deadline`에 임시 날짜(current_date + 30/55/80일)가 시드로 들어가 있었습니다.
--       어떤 공고문에도 없는 값인데 대시보드 히어로가 이 값을 "가장 임박한 공고 마감"으로
--       D-day와 함께 띄웠고, 온보딩 자동 마일스톤 4건도 이 날짜에서 역산되었습니다.
--       마감을 놓치지 않게 해 주는 제품이 존재하지 않는 마감을 안내하고 있었습니다.
--
-- 조치: `programs`는 자격 판정 룰셋만 담당하고, 일정은 `kstartup_announcements`
--       (K-Startup 공개 API 캐시)에서 사업명으로 찾아 씁니다. 접수 중인 공고가 없으면
--       날짜를 지어내지 않고 화면이 "접수 중인 공고 없음"이라고 말합니다.
--
-- 선행 조건: 010-kstartup-announcements.sql이 적용되어 있고 공고 동기화가 한 번은
--            돌아 있어야 합니다. 비어 있으면 2번 블록이 아무 행도 바꾸지 않습니다
--            (오류가 아니라 "아직 맞출 공고가 없음"입니다).

-- ── 1. 임시 마감일 제거 + 사업명에서 연도 접두사 제거 ──────────────────────────
-- 이름은 실공고 제목 매칭의 열쇠말로도 쓰입니다(title ILIKE '%' || name || '%').
-- 연도가 붙어 있으면 "2026년 예비창업패키지 …" 공고와 영원히 매칭되지 않습니다.

UPDATE programs SET deadline = NULL WHERE deadline IS NOT NULL;

UPDATE programs SET name = '예비창업패키지' WHERE id = 'yechang-2026' AND name <> '예비창업패키지';
UPDATE programs SET name = '초기창업패키지' WHERE id = 'chocang-2026' AND name <> '초기창업패키지';
UPDATE programs SET name = '창업도약패키지' WHERE id = 'modu-2026'    AND name <> '창업도약패키지';

-- ── 2. 가짜 마감일에서 역산된 자동 마일스톤을 실공고 기준으로 다시 맞춤 ────────
-- 이미 만들어진 할 일들은 여전히 임시 날짜를 들고 있습니다. 사업별로 접수 중인
-- 공고 중 가장 이른 마감을 골라, 코드(createMilestones)와 같은 간격으로 다시 계산합니다.
--
-- 완료한 할 일은 건드리지 않습니다. 지난 기록을 고쳐 쓰면 안 됩니다.
-- 접수 중인 공고가 없는 사업은 대상에서 빠지고 기존 날짜가 그대로 남습니다
-- (지우면 팀이 하던 일이 사라지므로, 틀린 날짜를 남기는 쪽이 덜 위험합니다).

WITH next_announcement AS (
  SELECT DISTINCT ON (p.id)
         p.id       AS program_id,
         a.end_date AS end_date
  FROM programs p
  JOIN kstartup_announcements a
    ON a.title ILIKE '%' || p.name || '%'
  WHERE a.end_date IS NOT NULL
    AND a.end_date >= current_date
  ORDER BY p.id, a.end_date ASC
)
UPDATE workspace_tasks t
SET due_date = (na.end_date - (offsets.days || ' days')::interval)::date,
    updated_at = now()
FROM prep_projects pp
JOIN next_announcement na ON na.program_id = pp.program_id
CROSS JOIN (VALUES
  ('사업계획서 초안 완성', 14),
  ('증빙 서류 준비', 10),
  ('발표 리허설', 7),
  ('최종 제출', 1)
) AS offsets(title, days)
WHERE t.prep_project_id = pp.id
  AND t.title = offsets.title
  AND t.task_type = 'auto'
  AND t.status <> 'done';

-- ── 3. 확인 ───────────────────────────────────────────────────────────────────
-- deadline은 전부 비어 있어야 하고, announcement_end_date는 접수 중 공고가 있는
-- 사업에만 채워집니다. 여기 뜨는 날짜가 곧 대시보드에 나가는 D-day의 근거입니다.

SELECT p.id,
       p.name,
       p.deadline AS legacy_deadline,
       (SELECT MIN(a.end_date)
          FROM kstartup_announcements a
         WHERE a.title ILIKE '%' || p.name || '%'
           AND a.end_date >= current_date) AS announcement_end_date
FROM programs p
ORDER BY p.id;
