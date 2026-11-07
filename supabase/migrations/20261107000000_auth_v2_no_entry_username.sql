-- Auth v2: 엔트리 아이디 수집 금지 정책 적용
-- entry_username 컬럼을 nullable로 변경하고,
-- get_login_email_by_identifier RPC를 custom_id 전용으로 단순화합니다.

-- 1. entry_username NOT NULL 제약 제거 (nullable로 변경)
ALTER TABLE public.users ALTER COLUMN entry_username DROP NOT NULL;
ALTER TABLE IF EXISTS public.entry_verifications ALTER COLUMN entry_username DROP NOT NULL;

-- 2. get_login_email_by_identifier RPC 재정의
--    custom_id 로만 조회하여 entry_{entry_user_id}@entry-hub.local 형식의 가상 이메일을 반환합니다.
--    엔트리 아이디(entry_username) 기반 조회는 완전히 제거합니다.
CREATE OR REPLACE FUNCTION public.get_login_email_by_identifier(p_identifier TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry_user_id TEXT;
  v_virtual_email TEXT;
BEGIN
  -- custom_id 로 사용자 조회
  SELECT entry_user_id INTO v_entry_user_id
  FROM public.users
  WHERE custom_id = p_identifier
    AND has_password = true
  LIMIT 1;

  IF v_entry_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  v_virtual_email := 'entry_' || v_entry_user_id || '@entry-hub.local';
  RETURN v_virtual_email;
END;
$$;

-- 3. update_entry_account RPC 추가
--    마이페이지에서 연동된 엔트리 계정(entry_user_id, nickname)을 변경합니다.
--    엔트리 아이디(entry_username)는 저장하지 않습니다.
CREATE OR REPLACE FUNCTION public.update_entry_account(
  p_new_entry_user_id TEXT,
  p_new_nickname TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_old_entry_user_id TEXT;
  v_new_virtual_email TEXT;
  v_conflict_user_id UUID;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', '로그인이 필요합니다.');
  END IF;

  -- 현재 entry_user_id 조회
  SELECT entry_user_id INTO v_old_entry_user_id
  FROM public.users
  WHERE id = v_caller_id;

  -- 중복 체크 (다른 계정이 이미 사용 중인지)
  SELECT id INTO v_conflict_user_id
  FROM public.users
  WHERE entry_user_id = p_new_entry_user_id
    AND id != v_caller_id;

  IF v_conflict_user_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'message', '이미 다른 계정에 연동된 엔트리 계정입니다.');
  END IF;

  -- public.users 갱신 (entry_username은 저장하지 않음)
  UPDATE public.users
  SET
    entry_user_id = p_new_entry_user_id,
    nickname = p_new_nickname,
    entry_username = NULL
  WHERE id = v_caller_id;

  -- auth.users 이메일 갱신
  v_new_virtual_email := 'entry_' || p_new_entry_user_id || '@entry-hub.local';
  UPDATE auth.users
  SET email = v_new_virtual_email
  WHERE id = v_caller_id;

  RETURN jsonb_build_object('success', true, 'message', '엔트리 계정이 변경되었습니다.');
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

COMMENT ON FUNCTION public.get_login_email_by_identifier IS 'custom_id로 로그인 가상 이메일 조회. 엔트리 아이디(entry_username) 미사용.';
COMMENT ON FUNCTION public.update_entry_account IS '연동된 엔트리 계정 변경. entry_user_id와 nickname만 갱신하며 엔트리 아이디는 저장하지 않음.';

