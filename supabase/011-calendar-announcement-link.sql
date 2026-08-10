-- 캘린더에 담은 K-Startup 공고를 팀 일정과 구분하기 위한 연결 고리.
--
-- 지금까지 "캘린더에 추가"는 공고를 그냥 할 일 한 줄로 만들었습니다. 그래서 캘린더에서
-- 공고 마감과 팀이 직접 만든 일정이 같은 색·같은 모양으로 섞였고, 원문 링크·접수 기간
-- 같은 공고 고유 정보는 제목 문자열 말고는 남지 않았습니다. 공고 일련번호를 함께 저장해
-- 캘린더가 둘을 구분하고 공고 정보를 다시 붙일 수 있게 합니다.
--
-- 외래키를 걸지 않습니다. 동기화 라우트가 마감 14일이 지난 공고를 지우는데, FK가 있으면
-- 그 삭제가 막히거나(RESTRICT) 팀이 만들어 둔 일정이 함께 사라집니다(CASCADE).
-- 팀 일정은 공고 캐시보다 오래 살아야 합니다. 공고가 정리된 뒤에도 일련번호만 있으면
-- 원문 URL은 그대로 조립되므로 화면은 깨지지 않습니다.
ALTER TABLE workspace_tasks ADD COLUMN IF NOT EXISTS announcement_sn BIGINT;

COMMENT ON COLUMN workspace_tasks.announcement_sn IS
  'K-Startup 공고 일련번호(kstartup_announcements.pbanc_sn). 공고에서 담은 일정만 값이 있으며, 의도적으로 FK를 걸지 않습니다.';

-- 같은 공고를 두 번 담지 못하게 합니다. 눌린 줄 모르고 다시 누르면 같은 마감이 두 줄로
-- 쌓여 캘린더가 지저분해집니다(화면의 "캘린더에 있음" 표시는 새로고침하면 사라집니다).
CREATE UNIQUE INDEX IF NOT EXISTS workspace_tasks_team_announcement_key
  ON workspace_tasks (prep_team_id, announcement_sn)
  WHERE announcement_sn IS NOT NULL;
