-- StartUp Pilot — 지나간 시드 공고 마감일 되살리기.
-- 008 이후에 실행합니다. 재실행해도 안전합니다.
--
-- 문제: 008이 넣은 공고 마감일이 고정 날짜(2026-03-31 등)였습니다.
--       적용 시점이 그 날짜를 지나면 전부 과거가 되고, 그 뒤 가입하는 팀은
--         - 자동 마일스톤 4건이 전부 "N일 지남"인 빨간 보드를 받고
--         - 홈 히어로의 "가장 임박한 공고"가 비고
--         - 캘린더 "다가오는 마감"이 빈 상태가 됩니다.
--       마감을 놓치지 않게 해 주는 제품이 첫 화면부터 지난 마감으로 차 있는 셈입니다.
--
-- 조치: 시드로 넣은 세 사업에 한해, 마감이 이미 지났으면 앞으로 당겨 둡니다.
--       사업 간 간격은 유지해 "복수 지원사업의 마감 충돌"을 계속 볼 수 있게 합니다.
--
-- ⚠ 실제 공고문 마감일을 입력한 뒤에는 이 스크립트를 다시 실행하지 마세요.
--   지난 실제 공고까지 미래로 밀어 버립니다. 아래 WHERE의 id 목록을 비우거나
--   파일을 지우는 편이 안전합니다.

UPDATE programs SET deadline = (current_date + INTERVAL '30 days')::date
  WHERE id = 'yechang-2026' AND (deadline IS NULL OR deadline < current_date);

UPDATE programs SET deadline = (current_date + INTERVAL '55 days')::date
  WHERE id = 'chocang-2026' AND (deadline IS NULL OR deadline < current_date);

UPDATE programs SET deadline = (current_date + INTERVAL '80 days')::date
  WHERE id = 'modu-2026' AND (deadline IS NULL OR deadline < current_date);

-- 이미 만들어진 자동 마일스톤도 지난 마감을 그대로 들고 있습니다.
-- 아직 끝내지 않은 것만 새 공고 마감 기준으로 역산해 다시 맞춥니다.
-- 완료한 할 일은 건드리지 않습니다. 지난 기록을 고쳐 쓰면 안 됩니다.
-- UPDATE ... FROM 의 JOIN 조건에는 대상 테이블(t)을 쓸 수 없습니다.
-- 마일스톤 이름 대응은 CROSS JOIN 뒤 WHERE에서 겁니다.
UPDATE workspace_tasks t
SET due_date = (p.deadline - (offsets.days || ' days')::interval)::date,
    updated_at = now()
FROM prep_projects pp
JOIN programs p ON p.id = pp.program_id
CROSS JOIN (VALUES
  ('사업계획서 초안 완성', 14),
  ('증빙 서류 준비', 10),
  ('발표 리허설', 7),
  ('최종 제출', 1)
) AS offsets(title, days)
WHERE t.prep_project_id = pp.id
  AND t.title = offsets.title
  AND t.task_type = 'auto'
  AND t.status <> 'done'
  AND p.deadline IS NOT NULL
  AND t.due_date < current_date;
