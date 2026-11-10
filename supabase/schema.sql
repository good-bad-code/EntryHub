-- ========================================================
-- Entry-Hub Supabase 통합 데이터베이스 스키마 (DDL)
-- ========================================================

-- 1. 유저 프로필 테이블 (auth.users와 연동)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  nickname TEXT NOT NULL,
  avatar_url TEXT,
  entry_profile_url TEXT,
  role TEXT NOT NULL DEFAULT 'USER' CHECK (role IN ('USER', 'ADMIN')),
  is_banned BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 기존 테이블이 이미 생성되어 있을 경우를 대비한 컬럼 추가 보장
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS entry_profile_url TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS entry_username TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS entry_user_id TEXT; -- 엔트리 회원 고유번호 (_id)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_social BOOLEAN NOT NULL DEFAULT FALSE; -- 소셜 로그인 여부 (naver-, whale- 등)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS custom_id TEXT; -- 마이페이지에서 설정한 로그인 아이디 (소셜 유저의 경우 xxx@entry)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS has_password BOOLEAN NOT NULL DEFAULT FALSE; -- 비밀번호 설정 여부
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password_hash TEXT; -- 영구 비밀번호 해시 (엔트리 로그인 후에도 보존)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'USER';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_banned BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_users_entry_user_id ON public.users(entry_user_id);
CREATE INDEX IF NOT EXISTS idx_users_custom_id ON public.users(custom_id);

-- PostgREST 스키마 캐시 즉시 갱신
NOTIFY pgrst, 'reload schema';

-- 1-1. auth.users 생성 시 기존 트리거 삭제 (process_entry_auth_verification 함수가 직접 public.users를 관리함)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 1-2. 기존 가입된 데이터에서 구형 제약조건 및 인덱스 완전 삭제
ALTER TABLE public.users ALTER COLUMN email DROP NOT NULL;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_email_key CASCADE;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_email_partial_key CASCADE;
DROP INDEX IF EXISTS public.users_email_partial_key;
DROP INDEX IF EXISTS public.users_email_key;
UPDATE public.users SET email = NULL;

UPDATE public.users 
SET role = 'ADMIN' 
WHERE entry_user_id = '6a17db19865137773fb9d8c9'
   OR LOWER(COALESCE(entry_username, '')) = 'myentrymy' 
   OR LOWER(COALESCE(nickname, '')) = 'myentrymy';

-- 2. 카테고리 테이블
CREATE TABLE IF NOT EXISTS public.categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL DEFAULT '#0070f3',
  is_official BOOLEAN NOT NULL DEFAULT FALSE,
  creator_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. 에셋 테이블
CREATE TABLE IF NOT EXISTS public.assets (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('CODE', 'OBJECT', 'SCENE')),
  author_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL DEFAULT '익명',
  category_id TEXT REFERENCES public.categories(id) ON DELETE SET NULL,
  is_official_badge BOOLEAN NOT NULL DEFAULT FALSE,
  badge_name TEXT,
  badge_color TEXT,
  is_admin_pick BOOLEAN NOT NULL DEFAULT FALSE,
  like_count INTEGER NOT NULL DEFAULT 0,
  bookmark_count INTEGER NOT NULL DEFAULT 0,
  preview_image_url TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- assets 테이블 배지 및 태그 컬럼 추가
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS badge_name TEXT;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS badge_color TEXT;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- users 테이블 테마(다크모드) 컬럼 추가
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS theme TEXT NOT NULL DEFAULT 'light';


-- 기존 외래키가 CASCADE인 경우 SET NULL로 안전하게 변경
DO $$
BEGIN
  ALTER TABLE public.assets DROP CONSTRAINT IF EXISTS assets_author_id_fkey;
  ALTER TABLE public.assets ADD CONSTRAINT assets_author_id_fkey 
    FOREIGN KEY (author_id) REFERENCES public.users(id) ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- 4. 좋아요 (Likes) 테이블
CREATE TABLE IF NOT EXISTS public.likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id TEXT NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (asset_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id TEXT NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (asset_id, user_id)
);

-- 좋아요 수 자동 집계 함수 및 트리거
CREATE OR REPLACE FUNCTION update_asset_like_count()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.assets SET like_count = like_count + 1 WHERE id = NEW.asset_id;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.assets SET like_count = GREATEST(0, like_count - 1) WHERE id = OLD.asset_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_update_like_count ON public.likes;
CREATE TRIGGER trigger_update_like_count
AFTER INSERT OR DELETE ON public.likes
FOR EACH ROW EXECUTE FUNCTION update_asset_like_count();

-- 북마크 수 자동 집계 함수 및 트리거
CREATE OR REPLACE FUNCTION update_asset_bookmark_count()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.assets SET bookmark_count = bookmark_count + 1 WHERE id = NEW.asset_id;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.assets SET bookmark_count = GREATEST(0, bookmark_count - 1) WHERE id = OLD.asset_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_update_bookmark_count ON public.bookmarks;
CREATE TRIGGER trigger_update_bookmark_count
AFTER INSERT OR DELETE ON public.bookmarks
FOR EACH ROW EXECUTE FUNCTION update_asset_bookmark_count();


-- 6. 신고 (Reports) 테이블
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id TEXT NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  detail TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'RESOLVED', 'DISMISSED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========================================================
-- RLS (Row Level Security) 활성화
-- ========================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- ========================================================
-- 기존 정책 초기화 후 재등록 (중복 오류 방지)
-- ========================================================

-- 1) Users Policies
DROP POLICY IF EXISTS "Public users viewable" ON public.users;
CREATE POLICY "Public users viewable" ON public.users FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
CREATE POLICY "Users can insert own profile" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);

-- 2) Categories Policies
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS color TEXT NOT NULL DEFAULT '#0070f3';
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS creator_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

DROP POLICY IF EXISTS "Public categories viewable" ON public.categories;
CREATE POLICY "Public categories viewable" ON public.categories FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin or badge owners can insert categories" ON public.categories;
DROP POLICY IF EXISTS "Categories insertable by authenticated" ON public.categories;
CREATE POLICY "Categories insertable by authenticated" ON public.categories FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Categories updatable by authenticated" ON public.categories;
CREATE POLICY "Categories updatable by authenticated" ON public.categories FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Categories deletable by authenticated" ON public.categories;
CREATE POLICY "Categories deletable by authenticated" ON public.categories FOR DELETE USING (true);

-- 3) Assets Policies
DROP POLICY IF EXISTS "Public assets viewable" ON public.assets;
CREATE POLICY "Public assets viewable" ON public.assets FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert assets" ON public.assets;
CREATE POLICY "Authenticated users can insert assets" ON public.assets FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND 
  NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_banned = true)
);

DROP POLICY IF EXISTS "Authors can update own assets" ON public.assets;
CREATE POLICY "Authors can update own assets" ON public.assets FOR UPDATE USING (
  auth.uid() = author_id OR 
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'ADMIN')
);

DROP POLICY IF EXISTS "Authors can delete own assets" ON public.assets;
CREATE POLICY "Authors can delete own assets" ON public.assets FOR DELETE USING (
  auth.uid() = author_id OR 
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'ADMIN')
);

-- 4) Likes Policies
DROP POLICY IF EXISTS "Public likes viewable" ON public.likes;
CREATE POLICY "Public likes viewable" ON public.likes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert likes" ON public.likes;
CREATE POLICY "Authenticated users can insert likes" ON public.likes FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own likes" ON public.likes;
CREATE POLICY "Users can delete own likes" ON public.likes FOR DELETE USING (auth.uid() = user_id);

-- 5) Bookmarks Policies
DROP POLICY IF EXISTS "Users can view own bookmarks" ON public.bookmarks;
CREATE POLICY "Users can view own bookmarks" ON public.bookmarks FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users can insert bookmarks" ON public.bookmarks;
CREATE POLICY "Authenticated users can insert bookmarks" ON public.bookmarks FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own bookmarks" ON public.bookmarks;
CREATE POLICY "Users can delete own bookmarks" ON public.bookmarks FOR DELETE USING (auth.uid() = user_id);

-- 6) Reports Policies
DROP POLICY IF EXISTS "Authenticated users can submit reports" ON public.reports;
CREATE POLICY "Authenticated users can submit reports" ON public.reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "Admins can view reports" ON public.reports;
CREATE POLICY "Admins can view reports" ON public.reports FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'ADMIN')
);

DROP POLICY IF EXISTS "Admins can update reports" ON public.reports;
CREATE POLICY "Admins can update reports" ON public.reports FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'ADMIN')
);

-- ========================================================
-- 기본 인덱스
-- ========================================================
CREATE INDEX IF NOT EXISTS idx_assets_type ON public.assets(type);
CREATE INDEX IF NOT EXISTS idx_assets_admin_pick ON public.assets(is_admin_pick);
CREATE INDEX IF NOT EXISTS idx_assets_like_count ON public.assets(like_count DESC);
CREATE INDEX IF NOT EXISTS idx_assets_created_at ON public.assets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_likes_user_asset ON public.likes(user_id, asset_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_asset ON public.bookmarks(user_id, asset_id);
CREATE INDEX IF NOT EXISTS idx_users_nickname ON public.users(nickname);
CREATE INDEX IF NOT EXISTS idx_users_entry_username ON public.users(entry_username);

-- ========================================================
-- 7. 엔트리 계정 소유권 인증 테이블 (Proof of Ownership)
-- ========================================================
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS entry_username TEXT;

CREATE TABLE IF NOT EXISTS public.entry_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  entry_username TEXT NOT NULL,
  entry_user_id TEXT,
  verification_type TEXT NOT NULL DEFAULT 'REGISTER' CHECK (verification_type IN ('REGISTER', 'LOGIN', 'LINK_ID', 'RESET_PASSWORD')),
  nickname TEXT,
  session_token TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'VERIFIED', 'EXPIRED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes')
);

ALTER TABLE public.entry_verifications ADD COLUMN IF NOT EXISTS entry_user_id TEXT;
ALTER TABLE public.entry_verifications ADD COLUMN IF NOT EXISTS verification_type TEXT NOT NULL DEFAULT 'REGISTER';
ALTER TABLE public.entry_verifications ADD COLUMN IF NOT EXISTS nickname TEXT;
ALTER TABLE public.entry_verifications ADD COLUMN IF NOT EXISTS session_token TEXT;

ALTER TABLE public.entry_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can create verification" ON public.entry_verifications;
CREATE POLICY "Public can create verification" ON public.entry_verifications FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public can view verification" ON public.entry_verifications;
CREATE POLICY "Public can view verification" ON public.entry_verifications FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can update verification status" ON public.entry_verifications;
CREATE POLICY "Public can update verification status" ON public.entry_verifications FOR UPDATE USING (true);

CREATE INDEX IF NOT EXISTS idx_entry_verifications_username ON public.entry_verifications(entry_username, status);
CREATE INDEX IF NOT EXISTS idx_entry_verifications_code ON public.entry_verifications(code);

-- ========================================================
-- 8. 회원 탈퇴 (Account Deletion) 함수 (에셋 보존)
-- ========================================================
CREATE OR REPLACE FUNCTION public.delete_own_user()
RETURNS void AS $$
DECLARE
  current_uid UUID := auth.uid();
BEGIN
  IF current_uid IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  -- 1. 유저의 북마크 및 좋아요 정리
  DELETE FROM public.likes WHERE user_id = current_uid;
  DELETE FROM public.bookmarks WHERE user_id = current_uid;

  -- 2. 작성자가 등록한 에셋은 삭제되지 않고 author_id만 NULL로 변경되어 영구 보존됨 (author_name 유지)
  UPDATE public.assets SET author_id = NULL WHERE author_id = current_uid;

  -- 3. auth.users 삭제 (연결된 public.users는 CASCADE 자동 삭제)
  DELETE FROM auth.users WHERE id = current_uid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.delete_own_user() TO authenticated;

-- ========================================================
-- 9. 유저 공식 배지 테이블 (User Badges: 1:N 복수 배지 지원)
-- ========================================================
CREATE TABLE IF NOT EXISTS public.user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#0070f3',
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view user badges" ON public.user_badges;
CREATE POLICY "Public can view user badges" ON public.user_badges FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated can insert user badges" ON public.user_badges;
CREATE POLICY "Authenticated can insert user badges" ON public.user_badges FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated can delete user badges" ON public.user_badges;
CREATE POLICY "Authenticated can delete user badges" ON public.user_badges FOR DELETE USING (true);

CREATE INDEX IF NOT EXISTS idx_user_badges_user_id ON public.user_badges(user_id);

-- ========================================================
-- 10. 엔트리 계정 소유권 인증 기반 비밀번호 재설정 함수
-- ========================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.reset_password_via_entry_verification(
  p_verification_id UUID,
  p_new_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, auth
AS $$
DECLARE
  v_verification RECORD;
  v_user_id UUID;
BEGIN
  -- 1. 인증 레코드 확인 (VERIFIED 상태 및 15분 이내 발급)
  SELECT * INTO v_verification
  FROM public.entry_verifications
  WHERE id = p_verification_id
    AND status = 'VERIFIED'
    AND created_at >= NOW() - INTERVAL '15 minutes';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', '유효하지 않거나 이미 처리된 인증 요청입니다. 다시 인증을 시도해 주세요.');
  END IF;

  -- 2. 엔트리 아이디로 public.users에서 유저 검색
  SELECT id INTO v_user_id
  FROM public.users
  WHERE LOWER(TRIM(entry_username)) = LOWER(TRIM(v_verification.entry_username))
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', '해당 엔트리 아이디로 등록된 회원을 찾을 수 없습니다.');
  END IF;

  -- 3. 비밀번호 길이 검사
  IF length(p_new_password) < 6 THEN
    RETURN jsonb_build_object('success', false, 'message', '비밀번호는 최소 6자 이상이어야 합니다.');
  END IF;

  -- 4. auth.users 비밀번호 업데이트 (bcrypt)
  UPDATE auth.users
  SET encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf')),
      updated_at = NOW()
  WHERE id = v_user_id;

  -- 5. 인증 요청 재사용 방지 (status를 EXPIRED로 처리하여 1회성 보장)
  UPDATE public.entry_verifications
  SET status = 'EXPIRED'
  WHERE id = p_verification_id;

  RETURN jsonb_build_object('success', true, 'message', '비밀번호가 성공적으로 변경되었습니다. 새로운 비밀번호로 로그인해 주세요.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_password_via_entry_verification(UUID, TEXT) TO anon, authenticated;

-- ========================================================
-- 11. 엔트리 아이디/닉네임 기반 로그인 이메일 해석 함수
-- ========================================================
CREATE OR REPLACE FUNCTION public.get_login_email_by_identifier(p_identifier TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_email TEXT;
  v_clean TEXT := LOWER(TRIM(p_identifier));
BEGIN
  -- 1. myentrymy 마스터 관리자 매핑 (과거 구 계정 및 신규 계정 모두 지원)
  IF v_clean = 'myentrymy' THEN
    SELECT email INTO v_email FROM auth.users WHERE LOWER(email) = 'myentrymy@entry-hub.local' LIMIT 1;
    IF v_email IS NOT NULL THEN
      RETURN v_email;
    END IF;
    SELECT email INTO v_email FROM auth.users WHERE LOWER(email) = 'learn.code.ing.ing@gmail.com' LIMIT 1;
    IF v_email IS NOT NULL THEN
      RETURN v_email;
    END IF;
  END IF;

  -- 2. public.users에서 custom_id, entry_username 또는 nickname 일치 검색 후 auth.users 이메일 반환
  SELECT u.email INTO v_email
  FROM auth.users u
  JOIN public.users p ON p.id = u.id
  WHERE LOWER(COALESCE(p.custom_id, '')) = v_clean
     OR LOWER(COALESCE(p.entry_username, '')) = v_clean 
     OR LOWER(COALESCE(p.nickname, '')) = v_clean
  LIMIT 1;

  IF v_email IS NOT NULL THEN
    RETURN v_email;
  END IF;

  -- 3. auth.users 메타데이터 직접 확인
  SELECT email INTO v_email
  FROM auth.users
  WHERE LOWER(COALESCE(raw_user_meta_data->>'entry_username', '')) = v_clean
     OR LOWER(COALESCE(raw_user_meta_data->>'nickname', '')) = v_clean
  LIMIT 1;

  IF v_email IS NOT NULL THEN
    RETURN v_email;
  END IF;

  -- 4. 신규 가상 이메일 규칙 fallback
  RETURN v_clean || '@entry-hub.local';
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_login_email_by_identifier(TEXT) TO anon, authenticated;

-- ========================================================
-- 12. 엔트리 고유번호 기반 회원가입 / 로그인 처리 RPC
-- ========================================================
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

    -- auth.users 생성 (GoTrue 필수 필드 모두 기본값 지정하여 Database error querying schema 방지)
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

    -- public.users 프로필 삽입 (entry_username은 수집/저장하지 않음)
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
      CASE WHEN v_verification.entry_user_id = '6a17db19865137773fb9d8c9' THEN 'ADMIN' ELSE 'USER' END
    ) ON CONFLICT (id) DO UPDATE
    SET
      email = EXCLUDED.email,
      entry_user_id = EXCLUDED.entry_user_id,
      entry_profile_url = COALESCE(EXCLUDED.entry_profile_url, public.users.entry_profile_url),
      nickname = EXCLUDED.nickname,
      role = CASE WHEN EXCLUDED.entry_user_id = '6a17db19865137773fb9d8c9' THEN 'ADMIN' ELSE public.users.role END;

  ELSE
    -- LOGIN 또는 LINK_ID 모드: 계정이 없으면 가입 유도 안내
    IF v_user_id IS NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'message', '등록되지 않은 계정입니다. 먼저 [엔트리로 회원가입]을 진행해 주세요.'
      );
    END IF;

    -- 기존 회원: 고유번호 및 최신 정보 동기화 (관리자 지정 포함, password_hash 및 custom_id는 절대 건드리지 않음)
    UPDATE public.users
    SET
      entry_user_id = COALESCE(public.users.entry_user_id, v_verification.entry_user_id),
      entry_profile_url = COALESCE(v_entry_profile_url, public.users.entry_profile_url),
      nickname = COALESCE(public.users.nickname, v_nickname),
      role = CASE WHEN COALESCE(public.users.entry_user_id, v_verification.entry_user_id) = '6a17db19865137773fb9d8c9' THEN 'ADMIN' ELSE public.users.role END,
      updated_at = NOW()
    WHERE id = v_user_id;

    -- auth.users 존재 여부 확인 및 이메일 동기화
    SELECT email INTO v_virtual_email FROM auth.users WHERE id = v_user_id;
    IF v_virtual_email IS NULL THEN
      v_virtual_email := 'entry_' || LOWER(COALESCE(v_verification.entry_user_id, v_user_id::text)) || '@entry-hub.local';
      
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

-- ========================================================
-- 13. 마이페이지 아이디 / 비밀번호 설정 RPC
-- ========================================================
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

-- ========================================================
-- 14. 비밀번호 재설정 RPC (엔트리 인증 기반)
-- ========================================================
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

  UPDATE public.users
  SET has_password = TRUE,
      password_hash = v_pw_hash,
      updated_at = NOW()
  WHERE id = v_user.id;

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

-- ========================================================
-- 15. check_and_repair_login_password RPC
-- ========================================================
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

-- 기존 관리자 계정의 entry_username을 myentrymy로 매핑 보장 및 고유번호 관리자 지정
UPDATE public.users 
SET entry_username = 'myentrymy', nickname = COALESCE(nickname, 'myentrymy'), role = 'ADMIN'
WHERE id IN (SELECT id FROM auth.users WHERE LOWER(email) = 'learn.code.ing.ing@gmail.com' OR LOWER(email) LIKE '%myentrymy%');

UPDATE public.users
SET role = 'ADMIN'
WHERE entry_user_id = '6a17db19865137773fb9d8c9';

-- restore_user_original_password RPC
CREATE OR REPLACE FUNCTION public.restore_user_original_password(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_saved_hash TEXT;
BEGIN
  SELECT password_hash INTO v_saved_hash
  FROM public.users
  WHERE id = p_user_id;

  IF v_saved_hash IS NOT NULL AND v_saved_hash <> '' THEN
    UPDATE auth.users
    SET encrypted_password = v_saved_hash,
        updated_at = NOW()
    WHERE id = p_user_id;
    RETURN jsonb_build_object('success', true, 'restored', true);
  END IF;

  RETURN jsonb_build_object('success', true, 'restored', false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.restore_user_original_password(UUID) TO anon, authenticated;

-- toggle_like & toggle_bookmark RPC
CREATE OR REPLACE FUNCTION public.toggle_like(p_asset_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_exists BOOLEAN;
  v_new_count INTEGER;
  v_is_liked BOOLEAN;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.likes WHERE asset_id = p_asset_id AND user_id = v_user_id
  ) INTO v_exists;

  IF v_exists THEN
    DELETE FROM public.likes WHERE asset_id = p_asset_id AND user_id = v_user_id;
    v_is_liked := false;
  ELSE
    INSERT INTO public.likes (asset_id, user_id) VALUES (p_asset_id, v_user_id)
    ON CONFLICT (asset_id, user_id) DO NOTHING;
    v_is_liked := true;
  END IF;

  SELECT like_count INTO v_new_count FROM public.assets WHERE id = p_asset_id;

  RETURN jsonb_build_object(
    'isLiked', v_is_liked,
    'likeCount', COALESCE(v_new_count, 0)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.toggle_bookmark(p_asset_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_exists BOOLEAN;
  v_new_count INTEGER;
  v_is_bookmarked BOOLEAN;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.bookmarks WHERE asset_id = p_asset_id AND user_id = v_user_id
  ) INTO v_exists;

  IF v_exists THEN
    DELETE FROM public.bookmarks WHERE asset_id = p_asset_id AND user_id = v_user_id;
    v_is_bookmarked := false;
  ELSE
    INSERT INTO public.bookmarks (asset_id, user_id) VALUES (p_asset_id, v_user_id)
    ON CONFLICT (asset_id, user_id) DO NOTHING;
    v_is_bookmarked := true;
  END IF;

  SELECT bookmark_count INTO v_new_count FROM public.assets WHERE id = p_asset_id;

  RETURN jsonb_build_object(
    'isBookmarked', v_is_bookmarked,
    'bookmarkCount', COALESCE(v_new_count, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.toggle_like(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_bookmark(TEXT) TO authenticated;

