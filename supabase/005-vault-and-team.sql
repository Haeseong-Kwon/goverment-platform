-- StartUp Pilot — 서류 보관함(Storage)과 팀원 초대 백엔드.
-- 002·003 이후에 실행합니다. 재실행해도 안전합니다.

-- 1) 증빙·사업계획서 파일 버킷. 공개 버킷이 아니며 만료형 서명 링크로만 열람합니다.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('vault', 'vault', false, 52428800)
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 52428800;

-- 파일 경로 규칙: {prep_team_id}/{folder}/{파일명}
-- 첫 번째 폴더 세그먼트가 팀 ID이므로, 그 팀의 멤버만 접근할 수 있습니다.
DROP POLICY IF EXISTS "team members read vault objects" ON storage.objects;
CREATE POLICY "team members read vault objects" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'vault'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    AND is_prep_team_member(((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS "team members write vault objects" ON storage.objects;
CREATE POLICY "team members write vault objects" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'vault'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    AND is_prep_team_member(((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS "team members delete vault objects" ON storage.objects;
CREATE POLICY "team members delete vault objects" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'vault'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    AND is_prep_team_member(((storage.foldername(name))[1])::uuid)
  );

-- 2) 팀원 초대. 기존 정책은 user_id = auth.uid() 만 만족하면 누구나 임의 팀에
--    자기 자신을 넣을 수 있었습니다(팀 UUID만 알면 가입). 초대 코드 경로로 대체합니다.
CREATE TABLE IF NOT EXISTS prep_team_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prep_team_id UUID NOT NULL REFERENCES prep_teams(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  max_uses INTEGER NOT NULL DEFAULT 10 CHECK (max_uses > 0),
  use_count INTEGER NOT NULL DEFAULT 0 CHECK (use_count >= 0),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE prep_team_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team members read invites" ON prep_team_invites;
CREATE POLICY "team members read invites" ON prep_team_invites
  FOR SELECT USING (is_prep_team_member(prep_team_id));

DROP POLICY IF EXISTS "team members create invites" ON prep_team_invites;
CREATE POLICY "team members create invites" ON prep_team_invites
  FOR INSERT WITH CHECK (created_by = auth.uid() AND is_prep_team_member(prep_team_id));

-- 자기 자신을 임의 팀에 넣던 경로를 닫습니다. 리더의 최초 등록(온보딩)과
-- 기존 멤버의 추가만 허용하고, 초대받은 사람은 아래 RPC로 들어옵니다.
DROP POLICY IF EXISTS "leaders add members" ON prep_team_members;
CREATE POLICY "leaders add members" ON prep_team_members
  FOR INSERT WITH CHECK (
    is_prep_team_member(prep_team_id)
    OR EXISTS (SELECT 1 FROM prep_teams t WHERE t.id = prep_team_id AND t.leader_id = auth.uid())
  );

CREATE OR REPLACE FUNCTION join_prep_team(input_code TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  invite prep_team_invites%ROWTYPE;
BEGIN
  SELECT * INTO invite FROM prep_team_invites WHERE code = upper(trim(input_code)) FOR UPDATE;
  IF NOT FOUND OR invite.expires_at <= now() OR invite.use_count >= invite.max_uses THEN
    RAISE EXCEPTION 'INVITE_CODE_INVALID';
  END IF;

  IF EXISTS (SELECT 1 FROM prep_team_members WHERE prep_team_id = invite.prep_team_id AND user_id = auth.uid()) THEN
    RETURN invite.prep_team_id;
  END IF;

  INSERT INTO prep_team_members (prep_team_id, user_id, member_role)
  VALUES (invite.prep_team_id, auth.uid(), 'member');

  UPDATE prep_team_invites SET use_count = use_count + 1 WHERE id = invite.id;
  INSERT INTO workspace_events (user_id, prep_team_id, event_name, payload)
  VALUES (auth.uid(), invite.prep_team_id, 'team_member_joined', jsonb_build_object('invite_id', invite.id));

  RETURN invite.prep_team_id;
END;
$$;

REVOKE ALL ON FUNCTION join_prep_team(TEXT) FROM public;
GRANT EXECUTE ON FUNCTION join_prep_team(TEXT) TO authenticated;

-- 3) 조회 경로 인덱스.
CREATE INDEX IF NOT EXISTS vault_documents_team_folder_idx ON vault_documents (prep_team_id, folder, created_at DESC);
CREATE INDEX IF NOT EXISTS workspace_tasks_team_due_idx ON workspace_tasks (prep_team_id, due_date);
