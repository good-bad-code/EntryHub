-- ==============================================================================
-- Migration: 20261108000000_fix_auth_persistence_and_schema.sql
-- 1. Database error querying schema 원인 해결 (auth.users 컬럼 NULL 보정 및 auth.identities 동기화)
-- 2. 엔트리 로그인 시 기존 아이디/비밀번호 파괴 방지 (password_hash 영구 보존 및 자동 복구 RPC)
-- 3. 엔트리 실제 아이디(entry_username) 수집/저장 절대 금지 정책 완벽 준수
-- ==============================================================================

-- 1. public.users 테이블에 password_hash 컬럼 추가 (영구 비밀번호 해시 보존)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- 2. auth.users 기존 데이터 널값 보정 (GoTrue의 Scan 에러 / Database error querying schema 방지)
UPDATE auth.users
SET confirmation_token = COALESCE(confirmation_token, ''),
    recovery_token = COALESCE(recovery_token, ''),
    email_change_token_new = COALESCE(email_change_token_new, ''),
    email_change = COALESCE(email_change, ''),
    email_change_token_current = COALESCE(email_change_token_current, ''),
    phone_change = COALESCE(phone_change, ''),
    phone_change_token = COALESCE(phone_change_token, ''),
    reauthentication_token = COALESCE(reauthentication_token, ''),
    is_sso_user = COALESCE(is_sso_user, FALSE),
    is_anonymous = COALESCE(is_anonymous, FALSE)
WHERE confirmation_token IS NULL
   OR recovery_token IS NULL
   OR email_change_token_new IS NULL
   OR email_change IS NULL
   OR email_change_token_current IS NULL
   OR phone_change IS NULL
   OR phone_change_token IS NULL
   OR reauthentication_token IS NULL
   OR is_sso_user IS NULL
   OR is_anonymous IS NULL;

-- 3. auth.users 레거시 충돌 트리거 정리
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;

-- 4. auth.identities 누락 사용자 보강 (GoTrue 로그인 시 identities 스캔 실패 방지)
DO $$
BEGIN
  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  )
  SELECT
    u.id::text,
    u.id,
    jsonb_build_object('sub', u.id::text, 'email', u.email),
    'email',
    u.email,
    NOW(),
    u.created_at,
    NOW()
  FROM auth.users u
  WHERE u.email IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM auth.identities i WHERE i.user_id = u.id AND i.provider = 'email'
    )
  ON CONFLICT DO NOTHING;
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;

-- 5. 기존 비밀번호가 설정되어 있던 유저의 password_hash 1회 복사 보존
UPDATE public.users u
SET password_hash = a.encrypted_password
FROM auth.users a
WHERE u.id = a.id
  AND u.has_password = TRUE
  AND u.password_hash IS NULL
  AND a.encrypted_password IS NOT NULL
  AND a.encrypted_password NOT LIKE '%autologin%';

-- ==============================================================================
-- 6. process_entry_auth_verification 함수 개선
--    - GoTrue 스키마 필수 컬럼 빈 문자열 기본값 보장
--    - auth.identities 자동 생성
--    - public.users.password_hash 영구 보존
--    - entry_username 수집/저장 절대 금지
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.process_entry_auth_verification(p_verification_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_verification RECORD;
  v_user_id UUID;
  v_virtual_email TEXT;
  v_temp_password TEXT;
  v_nickname TEXT;
  v_entry_profile_url TEXT;
  v_is_social BOOLEAN := FALSE;
  v_auth_exists BOOLEAN;
BEGIN
  -- 1. 인증 레코드 확인 (VERIFIED 상태 및 15분 이내)
  SELECT * INTO v_verification
  FROM public.entry_verifications
  WHERE id = p_verification_id
    AND status = 'VERIFIED'
    AND created_at >= NOW() - INTERVAL '15 minutes';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', '유효하지 않거나 만료된 인증 요청입니다.');
  END IF;

  v_nickname := COALESCE(v_verification.nickname, '엔트리사용자');

  -- 엔트리 프로필 공식 URL 자동 설정 (고유 ID 기반)
  IF v_verification.entry_user_id IS NOT NULL AND v_verification.entry_user_id <> '' THEN
    v_entry_profile_url := 'https://playentry.org/profile/' || v_verification.entry_user_id;
  ELSE
    v_entry_profile_url := NULL;
  END IF;

  -- 2. 엔트리 고유 ID(entry_user_id)로 기존 회원 검색
  IF v_verification.entry_user_id IS NOT NULL AND v_verification.entry_user_id <> '' THEN
    SELECT id INTO v_user_id
    FROM public.users
    WHERE entry_user_id = v_verification.entry_user_id
    LIMIT 1;
  END IF;

  -- 고유 가상 이메일 생성
  IF v_verification.entry_user_id IS NOT NULL AND v_verification.entry_user_id <> '' THEN
    v_virtual_email := 'entry_' || LOWER(v_verification.entry_user_id) || '@entry-hub.local';
  ELSE
    v_virtual_email := 'entry_' || LOWER(REPLACE(gen_random_uuid()::text, '-', '')) || '@entry-hub.local';
  END IF;

  -- 3. 회원가입 또는 기존 회원 로그인/동기화 분기
  IF v_verification.verification_type = 'REGISTER' THEN
    IF v_user_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'message', '이미 가입된 엔트리 계정입니다. 로그인 페이지에서 [엔트리 인증으로 로그인]을 이용해 주세요.'
      );
    END IF;

    -- 신규 회원 등록
    v_user_id := gen_random_uuid();
    v_temp_password := 'entry_temp_' || encode(extensions.gen_random_bytes(16), 'hex');

    -- auth.users 생성 (GoTrue 필수 필드 모두 기본값 지정하여 스키마 에러 원천 방지)
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      aud,
      role,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change,
      email_change_token_current,
      phone_change,
      phone_change_token,
      reauthentication_token,
      is_sso_user,
      is_anonymous
    ) VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      v_virtual_email,
      extensions.crypt(v_temp_password, extensions.gen_salt('bf')),
      NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object(
        'nickname', v_nickname,
        'entry_user_id', v_verification.entry_user_id,
        'entry_profile_url', v_entry_profile_url
      ),
      NOW(),
      NOW(),
      'authenticated',
      'authenticated',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      FALSE,
      FALSE
    );

    -- auth.identities 등록
    BEGIN
      INSERT INTO auth.identities (
        id,
        user_id,
        identity_data,
        provider,
        provider_id,
        last_sign_in_at,
        created_at,
        updated_at
      ) VALUES (
        v_user_id::text,
        v_user_id,
        jsonb_build_object('sub', v_user_id::text, 'email', v_virtual_email),
        'email',
        v_virtual_email,
        NOW(),
        NOW(),
        NOW()
      ) ON CONFLICT DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

    -- public.users 프로필 삽입 (entry_username은 저장하지 않음)
    INSERT INTO public.users (
      id,
      email,
      nickname,
      entry_username,
      entry_user_id,
      entry_profile_url,
      is_social,
      custom_id,
      has_password,
      password_hash,
      role
    ) VALUES (
      v_user_id,
      v_virtual_email,
      v_nickname,
      NULL,
      v_verification.entry_user_id,
      v_entry_profile_url,
      FALSE,
      NULL,
      FALSE,
      NULL,
      'USER'
    ) ON CONFLICT (id) DO UPDATE
    SET
      email = EXCLUDED.email,
      entry_user_id = EXCLUDED.entry_user_id,
      entry_profile_url = COALESCE(EXCLUDED.entry_profile_url, public.users.entry_profile_url),
      nickname = EXCLUDED.nickname;

  ELSE
    -- LOGIN 또는 LINK_ID 모드: 계정이 없으면 가입 유도 안내
    IF v_user_id IS NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'message', '등록되지 않은 계정입니다. 먼저 [엔트리로 회원가입]을 진행해 주세요.'
      );
    END IF;

    -- 기존 회원: 고유번호 및 최신 정보 동기화 (password_hash 및 custom_id는 절대 건드리지 않음)
    UPDATE public.users
    SET
      entry_user_id = COALESCE(public.users.entry_user_id, v_verification.entry_user_id),
      entry_profile_url = COALESCE(v_entry_profile_url, public.users.entry_profile_url),
      nickname = COALESCE(public.users.nickname, v_nickname),
      updated_at = NOW()
    WHERE id = v_user_id;

    -- auth.users 존재 여부 확인 및 이메일 동기화
    SELECT email INTO v_virtual_email FROM auth.users WHERE id = v_user_id;
    IF v_virtual_email IS NULL THEN
      v_virtual_email := 'entry_' || LOWER(COALESCE(v_verification.entry_user_id, v_user_id::text)) || '@entry-hub.local';
      
      -- 혹시 auth.users 레코드가 유실되었을 경우 안전하게 재삽입
      INSERT INTO auth.users (
        id,
        instance_id,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        aud,
        role,
        confirmation_token,
        recovery_token,
        email_change_token_new,
        email_change,
        email_change_token_current,
        phone_change,
        phone_change_token,
        reauthentication_token,
        is_sso_user,
        is_anonymous
      ) VALUES (
        v_user_id,
        '00000000-0000-0000-0000-000000000000',
        v_virtual_email,
        extensions.crypt('entry_temp_fallback', extensions.gen_salt('bf')),
        NOW(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('nickname', v_nickname, 'entry_user_id', v_verification.entry_user_id),
        NOW(),
        NOW(),
        'authenticated',
        'authenticated',
        '', '', '', '', '', '', '', '', FALSE, FALSE
      ) ON CONFLICT (id) DO UPDATE SET email = v_virtual_email;
    END IF;
  END IF;

  -- 4. 1회용 자동 로그인 임시 비밀번호 갱신 및 토큰 컬럼 정리
  v_temp_password := 'autologin_' || encode(extensions.gen_random_bytes(20), 'hex');
  UPDATE auth.users
  SET encrypted_password = extensions.crypt(v_temp_password, extensions.gen_salt('bf')),
      updated_at = NOW(),
      confirmation_token = COALESCE(confirmation_token, ''),
      recovery_token = COALESCE(recovery_token, ''),
      email_change_token_new = COALESCE(email_change_token_new, ''),
      email_change = COALESCE(email_change, ''),
      email_change_token_current = COALESCE(email_change_token_current, ''),
      phone_change = COALESCE(phone_change, ''),
      phone_change_token = COALESCE(phone_change_token, ''),
      reauthentication_token = COALESCE(reauthentication_token, ''),
      is_sso_user = COALESCE(is_sso_user, FALSE),
      is_anonymous = COALESCE(is_anonymous, FALSE)
  WHERE id = v_user_id;

  -- auth.identities 확인 보장
  BEGIN
    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      v_user_id::text,
      v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', v_virtual_email),
      'email',
      v_virtual_email,
      NOW(),
      NOW(),
      NOW()
    ) ON CONFLICT (provider, provider_id) DO UPDATE
    SET
      user_id = EXCLUDED.user_id,
      identity_data = EXCLUDED.identity_data,
      updated_at = NOW();
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- 5. 인증 레코드 만료 처리
  UPDATE public.entry_verifications
  SET status = 'EXPIRED',
      entry_user_id = v_verification.entry_user_id
  WHERE id = p_verification_id;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_user_id,
    'email', v_virtual_email,
    'temp_password', v_temp_password,
    'is_new_user', (v_verification.verification_type = 'REGISTER'),
    'nickname', v_nickname
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_entry_auth_verification(UUID) TO anon, authenticated;

-- ==============================================================================
-- 7. set_user_credentials 함수 개선 (password_hash 동시 저장)
-- ==============================================================================
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
  v_pw_hash TEXT;
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

  -- 2. 비밀번호 설정 (bcrypt 해시를 auth.users 와 public.users 에 모두 저장)
  IF p_password IS NOT NULL AND TRIM(p_password) <> '' THEN
    IF length(p_password) < 6 THEN
      RETURN jsonb_build_object('success', false, 'message', '비밀번호는 최소 6자 이상이어야 합니다.');
    END IF;

    v_pw_hash := extensions.crypt(p_password, extensions.gen_salt('bf'));

    UPDATE auth.users
    SET encrypted_password = v_pw_hash,
        updated_at = NOW(),
        confirmation_token = COALESCE(confirmation_token, ''),
        recovery_token = COALESCE(recovery_token, ''),
        email_change_token_new = COALESCE(email_change_token_new, ''),
        email_change = COALESCE(email_change, ''),
        email_change_token_current = COALESCE(email_change_token_current, ''),
        phone_change = COALESCE(phone_change, ''),
        phone_change_token = COALESCE(phone_change_token, ''),
        reauthentication_token = COALESCE(reauthentication_token, ''),
        is_sso_user = COALESCE(is_sso_user, FALSE),
        is_anonymous = COALESCE(is_anonymous, FALSE)
    WHERE id = v_uid;

    UPDATE public.users
    SET has_password = TRUE,
        password_hash = v_pw_hash,
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

GRANT EXECUTE ON FUNCTION public.set_user_credentials(TEXT, TEXT) TO authenticated;

-- ==============================================================================
-- 8. reset_password_via_entry_verification 함수 개선 (password_hash 동시 저장)
-- ==============================================================================
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
  v_pw_hash TEXT;
BEGIN
  IF p_verification_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', '인증 식별자가 누락되었습니다.');
  END IF;

  IF p_new_password IS NULL OR length(TRIM(p_new_password)) < 6 THEN
    RETURN jsonb_build_object('success', false, 'message', '비밀번호는 최소 6자 이상이어야 합니다.');
  END IF;

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

  SELECT * INTO v_user
  FROM public.users
  WHERE entry_user_id = v_verif.entry_user_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', '인증된 엔트리 계정으로 가입된 계정을 찾을 수 없습니다.');
  END IF;

  v_pw_hash := extensions.crypt(TRIM(p_new_password), extensions.gen_salt('bf'));

  -- auth.users 비밀번호 재설정
  UPDATE auth.users
  SET encrypted_password = v_pw_hash,
      updated_at = NOW(),
      confirmation_token = COALESCE(confirmation_token, ''),
      recovery_token = COALESCE(recovery_token, ''),
      email_change_token_new = COALESCE(email_change_token_new, ''),
      email_change = COALESCE(email_change, ''),
      email_change_token_current = COALESCE(email_change_token_current, ''),
      phone_change = COALESCE(phone_change, ''),
      phone_change_token = COALESCE(phone_change_token, ''),
      reauthentication_token = COALESCE(reauthentication_token, ''),
      is_sso_user = COALESCE(is_sso_user, FALSE),
      is_anonymous = COALESCE(is_anonymous, FALSE)
  WHERE id = v_user.id;

  -- public.users has_password 및 영구 password_hash 활성화
  UPDATE public.users
  SET has_password = TRUE,
      password_hash = v_pw_hash,
      updated_at = NOW()
  WHERE id = v_user.id;

  -- 재사용 방지를 위해 인증 상태 완료 처리
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

GRANT EXECUTE ON FUNCTION public.reset_password_via_entry_verification(UUID, TEXT) TO anon, authenticated;

-- ==============================================================================
-- 9. check_and_repair_login_password RPC 신설
--    엔트리 로그인으로 인해 auth.users의 encrypted_password가 autologin 임시 비밀번호로
--    덮어써졌을 때, 사용자가 입력한 아이디/비밀번호를 public.users.password_hash와 대조하여
--    즉시 복구해주는 자동 힐링 함수
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.check_and_repair_login_password(
  p_identifier TEXT,
  p_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_uid UUID;
  v_pw_hash TEXT;
  v_clean_id TEXT;
  v_auth_email TEXT;
BEGIN
  v_clean_id := TRIM(p_identifier);
  IF v_clean_id IS NULL OR v_clean_id = '' OR p_password IS NULL OR p_password = '' THEN
    RETURN jsonb_build_object('success', false, 'message', '아이디 또는 비밀번호가 누락되었습니다.');
  END IF;

  -- 1. 사용자 식별 (custom_id, email, entry_user_id 기반)
  SELECT id, password_hash INTO v_uid, v_pw_hash
  FROM public.users
  WHERE LOWER(custom_id) = LOWER(v_clean_id)
     OR LOWER(custom_id) = LOWER(v_clean_id || '@entry')
     OR LOWER(email) = LOWER(v_clean_id)
     OR LOWER(COALESCE(entry_username, '')) = LOWER(v_clean_id)
  LIMIT 1;

  IF v_uid IS NULL THEN
    SELECT id INTO v_uid
    FROM auth.users
    WHERE LOWER(email) = LOWER(v_clean_id)
    LIMIT 1;

    IF v_uid IS NOT NULL THEN
      SELECT password_hash INTO v_pw_hash
      FROM public.users
      WHERE id = v_uid;
    END IF;
  END IF;

  IF v_uid IS NULL OR v_pw_hash IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', '저장된 비밀번호가 없습니다.');
  END IF;

  -- 2. bcrypt 해시 대조 검증
  IF extensions.crypt(p_password, v_pw_hash) = v_pw_hash THEN
    -- 일치하면 auth.users 비밀번호를 영구 해시로 즉시 복구!
    UPDATE auth.users
    SET encrypted_password = v_pw_hash,
        updated_at = NOW(),
        confirmation_token = COALESCE(confirmation_token, ''),
        recovery_token = COALESCE(recovery_token, ''),
        email_change_token_new = COALESCE(email_change_token_new, ''),
        email_change = COALESCE(email_change, ''),
        email_change_token_current = COALESCE(email_change_token_current, ''),
        phone_change = COALESCE(phone_change, ''),
        phone_change_token = COALESCE(phone_change_token, ''),
        reauthentication_token = COALESCE(reauthentication_token, ''),
        is_sso_user = COALESCE(is_sso_user, FALSE),
        is_anonymous = COALESCE(is_anonymous, FALSE)
    WHERE id = v_uid;

    SELECT email INTO v_auth_email FROM auth.users WHERE id = v_uid;

    RETURN jsonb_build_object('success', true, 'email', v_auth_email);
  ELSE
    RETURN jsonb_build_object('success', false, 'message', '비밀번호가 일치하지 않습니다.');
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_and_repair_login_password(TEXT, TEXT) TO anon, authenticated;

