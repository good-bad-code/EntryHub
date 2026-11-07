-- Auth v2: 엔트리 아이디 수집 금지 정책 및 계정 인증/비밀번호 재설정 완결
-- 1. entry_username 컬럼 nullable 처리
ALTER TABLE public.users ALTER COLUMN entry_username DROP NOT NULL;
ALTER TABLE IF EXISTS public.entry_verifications ALTER COLUMN entry_username DROP NOT NULL;

-- 2. get_login_email_by_identifier RPC
-- custom_id 대소문자 무시 조회 (레거시 @entry 접미사 호환 포함)
-- auth.users의 실제 이메일을 우선 반환하고 없으면 entry_{entry_user_id}@entry-hub.local 가상 이메일 반환
CREATE OR REPLACE FUNCTION public.get_login_email_by_identifier(p_identifier TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid UUID;
  v_auth_email TEXT;
  v_entry_user_id TEXT;
  v_clean_id TEXT;
BEGIN
  v_clean_id := TRIM(p_identifier);
  IF v_clean_id IS NULL OR v_clean_id = '' THEN
    RETURN NULL;
  END IF;

  -- custom_id로 사용자 검색 (대소문자 무시, 접미사 호환)
  SELECT id, entry_user_id INTO v_uid, v_entry_user_id
  FROM public.users
  WHERE LOWER(custom_id) = LOWER(v_clean_id)
     OR LOWER(custom_id) = LOWER(v_clean_id || '@entry')
  LIMIT 1;

  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;

  -- auth.users의 실제 이메일 조회
  SELECT email INTO v_auth_email
  FROM auth.users
  WHERE id = v_uid;

  IF v_auth_email IS NOT NULL AND v_auth_email <> '' THEN
    RETURN v_auth_email;
  END IF;

  -- 가상 이메일 폴백
  IF v_entry_user_id IS NOT NULL THEN
    RETURN 'entry_' || v_entry_user_id || '@entry-hub.local';
  END IF;

  RETURN NULL;
END;
$$;

-- 3. set_user_credentials RPC
-- 마이페이지에서 사용자가 아이디(custom_id)와 비밀번호를 자유롭게 설정 (@entry 강제 부여 제거)
CREATE OR REPLACE FUNCTION public.set_user_credentials(
  p_custom_id TEXT,
  p_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_clean_id TEXT;
  v_exists_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', '로그인이 필요합니다.');
  END IF;

  -- 1. 아이디 설정 (있는 경우)
  IF p_custom_id IS NOT NULL AND TRIM(p_custom_id) <> '' THEN
    v_clean_id := TRIM(p_custom_id);

    -- 중복 검사 (다른 사용자가 사용 중인지 대소문자 무시 확인)
    SELECT id INTO v_exists_id
    FROM public.users
    WHERE LOWER(custom_id) = LOWER(v_clean_id)
      AND id <> v_uid
    LIMIT 1;

    IF v_exists_id IS NOT NULL THEN
      RETURN jsonb_build_object('success', false, 'message', '이미 사용 중인 아이디입니다.');
    END IF;

    UPDATE public.users
    SET custom_id = v_clean_id,
        updated_at = NOW()
    WHERE id = v_uid;
  END IF;

  -- 2. 비밀번호 설정 (bcrypt)
  IF p_password IS NOT NULL AND TRIM(p_password) <> '' THEN
    IF length(p_password) < 6 THEN
      RETURN jsonb_build_object('success', false, 'message', '비밀번호는 최소 6자 이상이어야 합니다.');
    END IF;

    UPDATE auth.users
    SET encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
        updated_at = NOW()
    WHERE id = v_uid;

    UPDATE public.users
    SET has_password = TRUE,
        updated_at = NOW()
    WHERE id = v_uid;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', '계정 정보가 성공적으로 설정되었습니다.',
    'custom_id', v_clean_id
  );
END;
$$;

-- 4. reset_password_via_entry_verification RPC
-- 엔트리 본인 인증(VERIFIED)을 완료한 후 비밀번호를 안전하게 재설정
CREATE OR REPLACE FUNCTION public.reset_password_via_entry_verification(
  p_verification_id UUID,
  p_new_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_verif RECORD;
  v_user RECORD;
BEGIN
  IF p_verification_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', '인증 식별자가 누락되었습니다.');
  END IF;

  IF p_new_password IS NULL OR length(TRIM(p_new_password)) < 6 THEN
    RETURN jsonb_build_object('success', false, 'message', '비밀번호는 최소 6자 이상이어야 합니다.');
  END IF;

  -- 인증 내역 확인 (VERIFIED 상태 및 RESET_PASSWORD 타입 확인)
  SELECT * INTO v_verif
  FROM public.entry_verifications
  WHERE id = p_verification_id
    AND status = 'VERIFIED'
    AND verification_type = 'RESET_PASSWORD'
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', '유효하지 않거나 만료된 인증 요청입니다.');
  END IF;

  IF v_verif.entry_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', '엔트리 계정 고유번호가 확인되지 않았습니다.');
  END IF;

  -- 해당 entry_user_id와 연동된 사용자 조회
  SELECT * INTO v_user
  FROM public.users
  WHERE entry_user_id = v_verif.entry_user_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', '인증된 엔트리 계정으로 가입된 Entry-Hub 계정을 찾을 수 없습니다.');
  END IF;

  -- auth.users 비밀번호 재설정
  UPDATE auth.users
  SET encrypted_password = extensions.crypt(TRIM(p_new_password), extensions.gen_salt('bf')),
      updated_at = NOW()
  WHERE id = v_user.id;

  -- public.users has_password 활성화
  UPDATE public.users
  SET has_password = TRUE,
      updated_at = NOW()
  WHERE id = v_user.id;

  -- 재사용 방지를 위해 인증 상태를 COMPLETED로 변경
  UPDATE public.entry_verifications
  SET status = 'COMPLETED',
      updated_at = NOW()
  WHERE id = p_verification_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', '비밀번호가 성공적으로 재설정되었습니다.'
  );
END;
$$;

-- 5. update_entry_account RPC (마이페이지 엔트리 계정 연동 변경)
CREATE OR REPLACE FUNCTION public.update_entry_account(
  p_new_entry_user_id TEXT,
  p_new_nickname TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller_id UUID;
  v_new_virtual_email TEXT;
  v_conflict_user_id UUID;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', '로그인이 필요합니다.');
  END IF;

  -- 중복 체크
  SELECT id INTO v_conflict_user_id
  FROM public.users
  WHERE entry_user_id = p_new_entry_user_id
    AND id <> v_caller_id;

  IF v_conflict_user_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'message', '이미 다른 계정에 연동된 엔트리 계정입니다.');
  END IF;

  -- public.users 갱신 (entry_username은 수집하지 않음)
  UPDATE public.users
  SET
    entry_user_id = p_new_entry_user_id,
    nickname = p_new_nickname,
    entry_username = NULL,
    updated_at = NOW()
  WHERE id = v_caller_id;

  -- auth.users 이메일 동기화 (가상 이메일 사용 시)
  v_new_virtual_email := 'entry_' || p_new_entry_user_id || '@entry-hub.local';
  UPDATE auth.users
  SET email = v_new_virtual_email
  WHERE id = v_caller_id
    AND email LIKE '%@entry-hub.local';

  RETURN jsonb_build_object('success', true, 'message', '엔트리 계정이 성공적으로 변경되었습니다.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_login_email_by_identifier(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_credentials(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_password_via_entry_verification(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_entry_account(TEXT, TEXT) TO authenticated;
