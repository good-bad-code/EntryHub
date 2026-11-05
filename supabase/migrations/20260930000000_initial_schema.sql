-- Entry-Hub Initial Supabase Schema & RLS Policies Migration

-- 1. Create User Profiles table
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  nickname TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'USER' CHECK (role IN ('ADMIN', 'USER', 'GUEST')),
  profile_image_url TEXT,
  entry_profile_url TEXT,
  official_badges TEXT[] DEFAULT '{}',
  is_banned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Create Categories table
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  is_official BOOLEAN NOT NULL DEFAULT false,
  badge_id TEXT,
  creator_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Create Assets table
CREATE TABLE IF NOT EXISTS public.assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('CODE', 'OBJECT', 'SCENE')),
  author_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  is_official_badge BOOLEAN NOT NULL DEFAULT false,
  is_admin_pick BOOLEAN NOT NULL DEFAULT false,
  like_count INT NOT NULL DEFAULT 0,
  bookmark_count INT NOT NULL DEFAULT 0,
  preview_image_url TEXT,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. Create Likes junction table
CREATE TABLE IF NOT EXISTS public.likes (
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (asset_id, user_id)
);

-- 5. Create Bookmarks junction table
CREATE TABLE IF NOT EXISTS public.bookmarks (
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (asset_id, user_id)
);

-- 6. Create Reports table
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'RESOLVED', 'REJECTED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_assets_type ON public.assets(type);
CREATE INDEX IF NOT EXISTS idx_assets_created_at ON public.assets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assets_like_count ON public.assets(like_count DESC);
CREATE INDEX IF NOT EXISTS idx_assets_is_admin_pick ON public.assets(is_admin_pick);
CREATE INDEX IF NOT EXISTS idx_assets_author_id ON public.assets(author_id);
CREATE INDEX IF NOT EXISTS idx_assets_category_id ON public.assets(category_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Assets
CREATE POLICY "Public read assets" ON public.assets
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert assets" ON public.assets
  FOR INSERT WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Authors and Admins can update assets" ON public.assets
  FOR UPDATE USING (auth.uid() = author_id OR EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'ADMIN'
  ));

CREATE POLICY "Authors and Admins can delete assets" ON public.assets
  FOR DELETE USING (auth.uid() = author_id OR EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'ADMIN'
  ));

-- RLS Policies for Users
CREATE POLICY "Public read user profiles" ON public.users
  FOR SELECT USING (true);

CREATE POLICY "Users update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- Function & Trigger to automatically update like_count
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
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_like_count
AFTER INSERT OR DELETE ON public.likes
FOR EACH ROW EXECUTE FUNCTION update_asset_like_count();
