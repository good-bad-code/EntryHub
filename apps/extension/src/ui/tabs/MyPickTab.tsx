import React, { useState, useEffect } from 'react';
import { Bookmark, Code2, Box, Layers, Download, Loader2 } from 'lucide-react';
import { colors } from '@entry-hub/shared';
import { ExtensionAssetItem } from '../components/AssetDetailModal';
import { supabase } from '../../infrastructure/supabase/client';

interface MyPickTabProps {
  onSelectAsset: (asset: ExtensionAssetItem) => void;
  onQuickInject: (asset: ExtensionAssetItem) => void;
  onNavigateExplore: () => void;
}

export function MyPickTab({ onSelectAsset, onQuickInject, onNavigateExplore }: MyPickTabProps) {
  const [bookmarks, setBookmarks] = useState<ExtensionAssetItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadBookmarks() {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: bRows } = await supabase
            .from('bookmarks')
            .select('asset_id')
            .eq('user_id', user.id);

          if (bRows && bRows.length > 0) {
            const assetIds = bRows.map((r: any) => r.asset_id);
            const { data: assets } = await supabase
              .from('assets')
              .select('*')
              .in('id', assetIds);

            if (assets) {
              setBookmarks(
                assets.map((a: any) => ({
                  id: a.id,
                  title: a.title,
                  description: a.description,
                  type: a.type,
                  authorName: a.author_name || '작성자',
                  isOfficialBadge: a.is_official_badge,
                  isAdminPick: a.is_admin_pick,
                  likeCount: a.like_count || 0,
                  bookmarkCount: a.bookmark_count || 0,
                  data: a.data || {},
                }))
              );
            } else {
              setBookmarks([]);
            }
          } else {
            setBookmarks([]);
          }
        } else {
          setBookmarks([]);
        }
      } catch (e) {
        console.warn('Bookmarks load error:', e);
        setBookmarks([]);
      } finally {
        setLoading(false);
      }
    }

    loadBookmarks();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '48px 0', gap: '6px', color: colors.mute, fontSize: '13px' }}>
        <Loader2 size={16} className="animate-spin" />
        <span>마이픽 불러오는 중...</span>
      </div>
    );
  }

  if (bookmarks.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
        <Bookmark size={32} color={colors.mute} />
        <div style={{ fontSize: '14px', fontWeight: 600, color: colors.ink }}>
          아직 북마크한 에셋이 없습니다
        </div>
        <div style={{ fontSize: '12px', color: colors.body }}>
          웹 사이트나 탐색 탭에서 마음에 드는 에셋을 북마크해보세요.
        </div>
        <button
          onClick={onNavigateExplore}
          style={{
            marginTop: '8px',
            padding: '8px 14px',
            borderRadius: '6px',
            backgroundColor: colors.primary,
            color: colors.onPrimary,
            border: 'none',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          에셋 탐색하기
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ fontSize: '13px', fontWeight: 600, color: colors.body, marginBottom: '4px' }}>
        저장한 에셋 ({bookmarks.length})
      </div>

      {bookmarks.map((asset) => (
        <div
          key={asset.id}
          onClick={() => onSelectAsset(asset)}
          style={{
            padding: '12px',
            borderRadius: '8px',
            border: `1px solid ${colors.hairline}`,
            backgroundColor: colors.canvas,
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {asset.type === 'CODE' && <Code2 size={13} color="#0070f3" />}
              {asset.type === 'OBJECT' && <Box size={13} color="#7928ca" />}
              {asset.type === 'SCENE' && <Layers size={13} color="#ff0080" />}
              <span style={{ fontSize: '13px', fontWeight: 600, color: colors.ink }}>{asset.title}</span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onQuickInject(asset);
              }}
              title="바로 작품에 주입"
              style={{
                padding: '4px 8px',
                borderRadius: '4px',
                backgroundColor: colors.canvasSoft2,
                border: `1px solid ${colors.hairlineStrong}`,
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                color: colors.ink,
              }}
            >
              <Download size={11} />
              <span>주입</span>
            </button>
          </div>

          <div style={{ fontSize: '12px', color: colors.body, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {asset.description}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: colors.mute }}>
            <span>{asset.authorName}</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <span>좋아요 {asset.likeCount}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
