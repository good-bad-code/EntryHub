-- ==============================================================================
-- Entry-Hub: Fix Likes & Bookmarks RLS Policies, Triggers & Atomic Functions
-- ==============================================================================

-- 1. Ensure Table Structure & Indexes
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

CREATE INDEX IF NOT EXISTS idx_likes_user_asset ON public.likes(user_id, asset_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_asset ON public.bookmarks(user_id, asset_id);

-- 2. SECURITY DEFINER Triggers for Automatic & Atomic Counter Updates
CREATE OR REPLACE FUNCTION public.update_asset_like_count()
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
FOR EACH ROW EXECUTE FUNCTION public.update_asset_like_count();

CREATE OR REPLACE FUNCTION public.update_asset_bookmark_count()
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
FOR EACH ROW EXECUTE FUNCTION public.update_asset_bookmark_count();

-- 3. Enable RLS
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;

-- 4. Likes RLS Policies
DROP POLICY IF EXISTS "Public likes viewable" ON public.likes;
CREATE POLICY "Public likes viewable" 
  ON public.likes FOR SELECT 
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert likes" ON public.likes;
CREATE POLICY "Authenticated users can insert likes" 
  ON public.likes FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own likes" ON public.likes;
CREATE POLICY "Users can delete own likes" 
  ON public.likes FOR DELETE 
  USING (auth.uid() = user_id);

-- 5. Bookmarks RLS Policies
DROP POLICY IF EXISTS "Users can view own bookmarks" ON public.bookmarks;
CREATE POLICY "Users can view own bookmarks" 
  ON public.bookmarks FOR SELECT 
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users can insert bookmarks" ON public.bookmarks;
CREATE POLICY "Authenticated users can insert bookmarks" 
  ON public.bookmarks FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own bookmarks" ON public.bookmarks;
CREATE POLICY "Users can delete own bookmarks" 
  ON public.bookmarks FOR DELETE 
  USING (auth.uid() = user_id);

-- 6. Atomic RPC Toggle Functions (Bonus for rock-solid transaction support)
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

