import React, { useState, useEffect } from 'react';
import {
  FolderKanban,
  ShieldCheck,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Folder,
  Code2,
  Box,
  Layers,
  Heart,
  Bookmark,
  Download,
} from 'lucide-react';
import { colors, formatAssetImageUrl } from '@entry-hub/shared';
import { ExtensionAssetItem } from '../components/AssetDetailModal';
import { supabase } from '../../infrastructure/supabase/client';

export interface CategoryItem {
  id: string;
  name: string;
  description?: string;
  isOfficial?: boolean;
  color?: string;
}

export interface OfficialBadgeCategoryItem {
  name: string;
  color: string;
  description?: string;
  assetCount: number;
}

interface SelectedCategoryFilter {
  type: 'CATEGORY' | 'BADGE';
  id?: string;
  name: string;
  color?: string;
  description?: string;
}

interface CategoryTabProps {
  onSelectAsset: (asset: ExtensionAssetItem) => void;
  onQuickInject: (asset: ExtensionAssetItem) => void;
}

export function CategoryTab({ onSelectAsset, onQuickInject }: CategoryTabProps) {
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [officialBadges, setOfficialBadges] = useState<OfficialBadgeCategoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // 현재 선택된 카테고리/배지 (null이면 카테고리 목록 표시)
  const [selectedCategory, setSelectedCategory] = useState<SelectedCategoryFilter | null>(null);
  const [categoryAssets, setCategoryAssets] = useState<ExtensionAssetItem[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(false);

  // 1. 카테고리 및 공식 배지 목록 로드
  useEffect(() => {
    async function loadCategoriesAndBadges() {
      setLoading(true);
      try {
        // 일반 카테고리
        const { data: catData } = await supabase
          .from('categories')
          .select('*')
          .order('created_at', { ascending: true });

        if (catData) {
          setCategories(
            catData.map((c: any) => ({
              id: c.id,
              name: c.name,
              description: c.description,
              isOfficial: c.is_official,
              color: c.color,
            }))
          );
        } else {
          setCategories([]);
        }

        // 공식 배지 카테고리 집계
        const badgeMap = new Map<string, OfficialBadgeCategoryItem>();
        try {
          const { data: bData } = await supabase.from('user_badges').select('name, color, description');
          if (bData) {
            bData.forEach((b: any) => {
              if (b.name && !badgeMap.has(b.name)) {
                badgeMap.set(b.name, {
                  name: b.name,
                  color: b.color || '#0070f3',
                  description: b.description || '공식 인증 배지',
                  assetCount: 0,
                });
              }
            });
          }

          const { data: aData } = await supabase
            .from('assets')
            .select('badge_name, is_official_badge')
            .eq('is_official_badge', true);

          if (aData) {
            aData.forEach((a: any) => {
              if (a.badge_name) {
                if (!badgeMap.has(a.badge_name)) {
                  badgeMap.set(a.badge_name, {
                    name: a.badge_name,
                    color: '#0070f3',
                    description: '공식 인증 배지',
                    assetCount: 0,
                  });
                }
                const item = badgeMap.get(a.badge_name)!;
                item.assetCount += 1;
              }
            });
          }
          setOfficialBadges(Array.from(badgeMap.values()));
        } catch (badgeErr) {
          console.warn('Official badge load error:', badgeErr);
        }
      } catch (e) {
        console.warn('CategoryTab load error:', e);
        setCategories([]);
      } finally {
        setLoading(false);
      }
    }

    loadCategoriesAndBadges();
  }, []);

  // 2. 카테고리 클릭 시 해당 카테고리 속의 에셋 로드
  useEffect(() => {
    if (!selectedCategory) {
      setCategoryAssets([]);
      return;
    }

    async function loadAssetsForCategory() {
      setLoadingAssets(true);
      try {
        let query = supabase.from('assets').select('*');

        if (selectedCategory!.type === 'BADGE') {
          query = query.eq('is_official_badge', true).eq('badge_name', selectedCategory!.name);
        } else if (selectedCategory!.type === 'CATEGORY' && selectedCategory!.id) {
          query = query.eq('category_id', selectedCategory!.id);
        }

        query = query.order('created_at', { ascending: false });
        const { data, error } = await query;

        if (data) {
          const mapped: ExtensionAssetItem[] = data.map((item: any) => ({
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
          setCategoryAssets(mapped);
        } else {
          setCategoryAssets([]);
        }
      } catch (err) {
        console.warn('Category assets load error:', err);
        setCategoryAssets([]);
      } finally {
        setLoadingAssets(false);
      }
    }

    loadAssetsForCategory();
  }, [selectedCategory]);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'CODE':
        return <Code2 size={12} color="#0070f3" />;
      case 'OBJECT':
        return <Box size={12} color="#7928ca" />;
      case 'SCENE':
        return <Layers size={12} color="#ff0080" />;
      default:
        return <Code2 size={12} />;
    }
  };

  // ========================================================
  // 화면 2: 선택된 카테고리 속의 에셋 목록 뷰
  // ========================================================
  if (selectedCategory) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {/* Top Navigation & Category Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${colors.hairline}`, paddingBottom: '8px' }}>
          <button
            type="button"
            onClick={() => setSelectedCategory(null)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              background: 'none',
              border: 'none',
              color: colors.primary,
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              padding: '4px 6px',
              borderRadius: '6px',
            }}
          >
            <ChevronLeft size={16} />
            <span>전체 카테고리로 돌아가기</span>
          </button>

          <span style={{ fontSize: '11px', color: colors.mute }}>
            총 {categoryAssets.length}개 에셋
          </span>
        </div>

        {/* Selected Category Banner */}
        <div
          style={{
            padding: '10px 14px',
            borderRadius: '8px',
            backgroundColor: selectedCategory.type === 'BADGE' ? '#0070f310' : colors.canvasSoft2,
            border: `1px solid ${selectedCategory.color || colors.hairline}`,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          {selectedCategory.type === 'BADGE' ? (
            <ShieldCheck size={16} color={selectedCategory.color || '#0070f3'} />
          ) : (
            <div
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: selectedCategory.color || colors.primary,
              }}
            />
          )}
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: colors.ink }}>
              {selectedCategory.type === 'BADGE' ? `공식 배지: ${selectedCategory.name}` : selectedCategory.name}
            </div>
            {selectedCategory.description && (
              <div style={{ fontSize: '11px', color: colors.mute, marginTop: '2px' }}>
                {selectedCategory.description}
              </div>
            )}
          </div>
        </div>

        {/* Assets List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {loadingAssets ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px 0', gap: '6px', color: colors.mute, fontSize: '13px' }}>
              <Loader2 size={16} className="animate-spin" />
              <span>에셋 불러오는 중...</span>
            </div>
          ) : categoryAssets.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 16px', color: colors.mute, fontSize: '13px', backgroundColor: colors.canvasSoft2, borderRadius: '8px' }}>
              이 카테고리에 등록된 에셋이 아직 없습니다.
            </div>
          ) : (
            categoryAssets.map((asset) => (
              <div
                key={asset.id}
                onClick={() => onSelectAsset(asset)}
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  border: `1px solid ${colors.hairline}`,
                  backgroundColor: colors.canvas,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '6px',
                      backgroundColor: colors.canvasSoft2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      overflow: 'hidden',
                    }}
                  >
                    {(() => {
                      const rawData: any = asset.data || {};
                      const fallbackPic =
                        rawData.selectedPicture ||
                        rawData.pictures?.[0] ||
                        rawData.objects?.[0]?.selectedPicture ||
                        rawData.objects?.[0]?.pictures?.[0];
                      const isGenericBot =
                        !asset.previewImageUrl ||
                        asset.previewImageUrl.includes('entrybot_walk') ||
                        asset.previewImageUrl.includes('entrybot1');
                      const img =
                        isGenericBot && fallbackPic
                          ? formatAssetImageUrl(fallbackPic) || formatAssetImageUrl(asset.previewImageUrl)
                          : formatAssetImageUrl(asset.previewImageUrl) || formatAssetImageUrl(fallbackPic);

                      return img ? (
                        <img
                          src={img}
                          alt={asset.title}
                          referrerPolicy="no-referrer"
                          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                        />
                      ) : (
                        getTypeIcon(asset.type)
                      );
                    })()}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: colors.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {asset.title}
                      </span>
                      {asset.isOfficialBadge && (
                        <span
                          style={{
                            padding: '1px 5px',
                            borderRadius: '4px',
                            backgroundColor: asset.badgeColor || '#0070f3',
                            color: '#fff',
                            fontSize: '9px',
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                        >
                          {asset.badgeName || '공식'}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '11px', color: colors.mute, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>{asset.authorName}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                        <Heart size={10} color="#ff4d4d" /> {asset.likeCount}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                        <Bookmark size={10} color="#7928ca" /> {asset.bookmarkCount}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onQuickInject(asset);
                  }}
                  title="현재 엔트리 작품으로 즉시 주입"
                  style={{
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: colors.primary,
                    color: colors.onPrimary,
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    flexShrink: 0,
                    marginLeft: '8px',
                  }}
                >
                  <Download size={12} />
                  <span>주입</span>
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // ========================================================
  // 화면 1: 전체 카테고리 및 공식 배지 카테고리 목록 뷰
  // ========================================================
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* 1. Official Badges Category Section */}
      {officialBadges.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: '#0070f3', marginBottom: '8px' }}>
            <ShieldCheck size={14} color="#0070f3" />
            <span>공식 배지 카테고리</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {officialBadges.map((badge) => (
              <div
                key={badge.name}
                onClick={() =>
                  setSelectedCategory({
                    type: 'BADGE',
                    name: badge.name,
                    color: badge.color,
                    description: badge.description,
                  })
                }
                style={{
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: `1.5px solid ${badge.color}40`,
                  backgroundColor: colors.canvas,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      padding: '3px 8px',
                      borderRadius: '5px',
                      backgroundColor: badge.color,
                      color: '#fff',
                      fontSize: '11px',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <ShieldCheck size={12} />
                    {badge.name}
                  </span>
                  {badge.description && (
                    <span style={{ fontSize: '11px', color: colors.mute }}>
                      {badge.description}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: colors.mute }}>
                    {badge.assetCount}개
                  </span>
                  <ChevronRight size={14} color={colors.mute} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. General Theme Categories Section */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: colors.body, marginBottom: '8px' }}>
          <FolderKanban size={14} color={colors.mute} />
          <span>주제별 일반 카테고리</span>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0', color: colors.mute, fontSize: '13px', gap: '6px' }}>
            <Loader2 size={16} className="animate-spin" />
            <span>카테고리 불러오는 중...</span>
          </div>
        ) : categories.length === 0 ? (
          <div style={{ padding: '24px 12px', textAlign: 'center', color: colors.mute, fontSize: '13px', backgroundColor: colors.canvasSoft2, borderRadius: '8px' }}>
            등록된 카테고리가 없습니다.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {categories.map((cat) => (
              <div
                key={cat.id}
                onClick={() =>
                  setSelectedCategory({
                    type: 'CATEGORY',
                    id: cat.id,
                    name: cat.name,
                    color: cat.color,
                    description: cat.description,
                  })
                }
                style={{
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: `1px solid ${colors.hairline}`,
                  backgroundColor: colors.canvas,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'border-color 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      backgroundColor: cat.color || colors.primary,
                    }}
                  />
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: colors.ink }}>
                        {cat.name}
                      </span>
                    </div>
                    {cat.description && (
                      <div style={{ fontSize: '11px', color: colors.mute, marginTop: '2px' }}>
                        {cat.description}
                      </div>
                    )}
                  </div>
                </div>

                <ChevronRight size={14} color={colors.mute} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
