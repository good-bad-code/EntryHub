import React, { useState, useEffect } from 'react';
import { Search, Code2, Box, Layers, ShieldCheck, Heart, Bookmark, Download, Loader2 } from 'lucide-react';
import { colors } from '@entry-hub/shared';
import { ExtensionAssetItem } from '../components/AssetDetailModal';
import { supabase } from '../../infrastructure/supabase/client';

interface ExploreTabProps {
  onSelectAsset: (asset: ExtensionAssetItem) => void;
  onQuickInject: (asset: ExtensionAssetItem) => void;
}

export function ExploreTab({ onSelectAsset, onQuickInject }: ExploreTabProps) {
  const [selectedType, setSelectedType] = useState<'ALL' | 'CODE' | 'OBJECT' | 'SCENE'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBadge, setSelectedBadge] = useState<string>('');
  const [officialBadges, setOfficialBadges] = useState<{ name: string; color: string }[]>([]);
  const [assets, setAssets] = useState<ExtensionAssetItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [assetRes, badgeRes] = await Promise.all([
          supabase
            .from('assets')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50),
          supabase
            .from('user_badges')
            .select('name, color')
            .order('created_at', { ascending: true }),
        ]);

        if (assetRes.data && assetRes.data.length > 0) {
          const mapped: ExtensionAssetItem[] = assetRes.data.map((item: any) => ({
            id: item.id,
            title: item.title,
            description: item.description,
            type: item.type,
            authorId: item.author_id,
            authorName: item.author_name || '익명',
            isOfficialBadge: item.is_official_badge,
            badgeName: item.badge_name,
            badgeColor: item.badge_color,
            categoryId: item.category_id,
            isAdminPick: item.is_admin_pick,
            likeCount: item.like_count || 0,
            bookmarkCount: item.bookmark_count || 0,
            previewImageUrl: item.preview_image_url,
            data: item.data || {},
          }));
          setAssets(mapped);
        } else {
          setAssets([]);
        }

        if (badgeRes.data) {
          const unique = new Map<string, string>();
          badgeRes.data.forEach((b: any) => {
            if (b.name && !unique.has(b.name)) {
              unique.set(b.name, b.color || '#0070f3');
            }
          });
          setOfficialBadges(Array.from(unique.entries()).map(([name, color]) => ({ name, color })));
        }
      } catch (e) {
        console.warn('Explore fetch error:', e);
        setAssets([]);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const filteredAssets = assets.filter((item) => {
    if (selectedType !== 'ALL' && item.type !== selectedType) return false;
    if (selectedBadge) {
      if (!item.isOfficialBadge) return false;
      if (selectedBadge !== '__ALL_OFFICIAL__' && item.badgeName !== selectedBadge) return false;
    }
    if (searchQuery && !item.title.toLowerCase().includes(searchQuery.toLowerCase()) && !item.description?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

      {/* Search Input */}
      <div style={{ position: 'relative' }}>
        <Search size={14} color={colors.mute} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
        <input
          type="text"
          placeholder="에셋 제목 또는 키워드..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 10px 8px 32px',
            borderRadius: '6px',
            border: `1px solid ${colors.hairline}`,
            fontSize: '13px',
            boxSizing: 'border-box',
            outline: 'none',
          }}
        />
      </div>

      {/* Type Filter Buttons */}
      <div style={{ display: 'flex', gap: '4px', backgroundColor: colors.canvasSoft2, padding: '3px', borderRadius: '6px' }}>
        {(['ALL', 'CODE', 'OBJECT', 'SCENE'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setSelectedType(t)}
            style={{
              flex: 1,
              padding: '6px 4px',
              borderRadius: '4px',
              border: 'none',
              backgroundColor: selectedType === t ? colors.canvas : 'transparent',
              color: selectedType === t ? colors.ink : colors.mute,
              fontWeight: selectedType === t ? 600 : 400,
              fontSize: '12px',
              cursor: 'pointer',
              boxShadow: selectedType === t ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
            }}
          >
            {t === 'ALL' ? '전체' : t === 'CODE' ? '코드' : t === 'OBJECT' ? '오브젝트' : '장면'}
          </button>
        ))}
      </div>

      {/* Official Badges Filter Chips */}
      {officialBadges.length > 0 && (
        <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', paddingBottom: '2px' }}>
          <button
            type="button"
            onClick={() => setSelectedBadge('')}
            style={{
              flexShrink: 0,
              padding: '3px 8px',
              borderRadius: '12px',
              border: `1px solid ${!selectedBadge ? colors.primary : colors.hairline}`,
              backgroundColor: !selectedBadge ? colors.canvasSoft2 : colors.canvas,
              color: !selectedBadge ? colors.primary : colors.mute,
              fontSize: '11px',
              fontWeight: !selectedBadge ? 600 : 400,
              cursor: 'pointer',
            }}
          >
            전체
          </button>

          <button
            type="button"
            onClick={() => setSelectedBadge('__ALL_OFFICIAL__')}
            style={{
              flexShrink: 0,
              padding: '3px 8px',
              borderRadius: '12px',
              border: `1px solid ${selectedBadge === '__ALL_OFFICIAL__' ? '#0070f3' : colors.hairline}`,
              backgroundColor: selectedBadge === '__ALL_OFFICIAL__' ? '#0070f315' : colors.canvas,
              color: selectedBadge === '__ALL_OFFICIAL__' ? '#0070f3' : colors.body,
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
            }}
          >
            <ShieldCheck size={11} color="#0070f3" />
            <span>공식 배지 전체</span>
          </button>

          {officialBadges.map((badge) => {
            const isSel = selectedBadge === badge.name;
            return (
              <button
                key={badge.name}
                type="button"
                onClick={() => setSelectedBadge(isSel ? '' : badge.name)}
                style={{
                  flexShrink: 0,
                  padding: '3px 8px',
                  borderRadius: '12px',
                  border: `1px solid ${isSel ? badge.color : colors.hairline}`,
                  backgroundColor: isSel ? `${badge.color}15` : colors.canvas,
                  color: isSel ? badge.color : colors.body,
                  fontSize: '11px',
                  fontWeight: isSel ? 700 : 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                }}
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: badge.color,
                  }}
                />
                <span>{badge.name}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Asset List */}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '32px 0', gap: '6px', color: colors.mute, fontSize: '13px' }}>
            <Loader2 size={16} className="animate-spin" />
            <span>에셋 목록 로딩 중...</span>
          </div>
        ) : filteredAssets.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: colors.mute, fontSize: '13px' }}>
            일치하는 에셋이 없습니다.
          </div>
        ) : (
          filteredAssets.map((asset) => (
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
                transition: 'border-color 0.15s ease',
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <span>{asset.authorName}</span>
                  {asset.isOfficialBadge && <ShieldCheck size={12} color="#0070f3" />}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                    <Heart size={11} color="#ff4d4d" /> {asset.likeCount}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                    <Bookmark size={11} color="#7928ca" /> {asset.bookmarkCount}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
