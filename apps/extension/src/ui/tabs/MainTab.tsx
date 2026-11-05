import React, { useState, useEffect } from 'react';
import { Sparkles, Flame, Upload, ArrowRight, Code2, Box, Layers, ShieldCheck, Heart, Bookmark, Loader2 } from 'lucide-react';
import { colors } from '@entry-hub/shared';
import { ExtensionAssetItem } from '../components/AssetDetailModal';
import { supabase } from '../../infrastructure/supabase/client';

interface MainTabProps {
  onSelectAsset: (asset: ExtensionAssetItem) => void;
  onOpenUpload: () => void;
  onNavigateExplore: () => void;
}

export function MainTab({ onSelectAsset, onOpenUpload, onNavigateExplore }: MainTabProps) {
  const [adminPicks, setAdminPicks] = useState<ExtensionAssetItem[]>([]);
  const [popularAssets, setPopularAssets] = useState<ExtensionAssetItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadMainData() {
      setLoading(true);
      try {
        const { data: picks } = await supabase
          .from('assets')
          .select('*')
          .eq('is_admin_pick', true)
          .order('created_at', { ascending: false })
          .limit(2);

        if (picks && picks.length > 0) {
          setAdminPicks(
            picks.map((p: any) => ({
              id: p.id,
              title: p.title,
              description: p.description,
              type: p.type,
              authorName: p.author_name || '익명',
              isOfficialBadge: p.is_official_badge,
              isAdminPick: p.is_admin_pick,
              likeCount: p.like_count || 0,
              bookmarkCount: p.bookmark_count || 0,
              data: p.data || {},
            }))
          );
        } else {
          setAdminPicks([]);
        }

        const { data: popular } = await supabase
          .from('assets')
          .select('*')
          .order('like_count', { ascending: false })
          .limit(2);

        if (popular && popular.length > 0) {
          setPopularAssets(
            popular.map((p: any) => ({
              id: p.id,
              title: p.title,
              description: p.description,
              type: p.type,
              authorName: p.author_name || '익명',
              isOfficialBadge: p.is_official_badge,
              isAdminPick: p.is_admin_pick,
              likeCount: p.like_count || 0,
              bookmarkCount: p.bookmark_count || 0,
              data: p.data || {},
            }))
          );
        } else {
          setPopularAssets([]);
        }
      } catch (e) {
        console.warn('MainTab load error:', e);
      } finally {
        setLoading(false);
      }
    }

    loadMainData();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Upload Trigger Banner */}
      <div
        style={{
          padding: '12px 14px',
          borderRadius: '10px',
          background: 'linear-gradient(135deg, #171717 0%, #333333 100%)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
        }}
      >
        <div style={{ flex: 1, minWidth: 0, paddingRight: '4px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            내 작품 에셋 공유하기
          </div>
          <div style={{ fontSize: '11px', color: '#ffffffbb', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            에디터 코드/오브젝트/장면 추출
          </div>
        </div>
        <button
          onClick={onOpenUpload}
          style={{
            flexShrink: 0,
            whiteSpace: 'nowrap',
            padding: '6px 10px',
            borderRadius: '6px',
            backgroundColor: '#0070f3',
            color: '#fff',
            border: 'none',
            fontSize: '11.5px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            lineHeight: 1.2,
            transition: 'background-color 0.15s ease',
          }}
        >
          <Upload size={13} style={{ flexShrink: 0 }} />
          <span style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>추출/업로드</span>
        </button>
      </div>

      {/* Admin Picks Section */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sparkles size={16} color="#7928ca" />
            <span style={{ fontSize: '14px', fontWeight: 600, color: colors.ink }}>관리자픽 에셋</span>
          </div>
          <button
            onClick={onNavigateExplore}
            style={{ background: 'none', border: 'none', color: colors.link, fontSize: '12px', cursor: 'pointer' }}
          >
            더보기
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0', color: colors.mute, fontSize: '12px' }}>
              <Loader2 size={14} className="animate-spin" />
            </div>
          ) : adminPicks.length === 0 ? (
            <div style={{ padding: '12px', textAlign: 'center', color: colors.mute, fontSize: '12px', backgroundColor: colors.canvasSoft2, borderRadius: '6px' }}>
              선정된 관리자픽 에셋이 없습니다.
            </div>
          ) : (
            adminPicks.map((item) => (
              <AssetCompactCard key={item.id} asset={item} onClick={() => onSelectAsset(item)} />
            ))
          )}
        </div>
      </div>

      {/* Popular Assets Section */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Flame size={16} color="#ff4d4d" />
            <span style={{ fontSize: '14px', fontWeight: 600, color: colors.ink }}>인기 에셋</span>
          </div>
          <button
            onClick={onNavigateExplore}
            style={{ background: 'none', border: 'none', color: colors.link, fontSize: '12px', cursor: 'pointer' }}
          >
            더보기
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0', color: colors.mute, fontSize: '12px' }}>
              <Loader2 size={14} className="animate-spin" />
            </div>
          ) : popularAssets.length === 0 ? (
            <div style={{ padding: '12px', textAlign: 'center', color: colors.mute, fontSize: '12px', backgroundColor: colors.canvasSoft2, borderRadius: '6px' }}>
              아직 등록된 인기 에셋이 없습니다.
            </div>
          ) : (
            popularAssets.map((item) => (
              <AssetCompactCard key={item.id} asset={item} onClick={() => onSelectAsset(item)} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function AssetCompactCard({ asset, onClick }: { asset: ExtensionAssetItem; onClick: () => void }) {
  const getTypeIcon = () => {
    switch (asset.type) {
      case 'CODE':
        return <Code2 size={12} color="#0070f3" />;
      case 'OBJECT':
        return <Box size={12} color="#7928ca" />;
      case 'SCENE':
        return <Layers size={12} color="#ff0080" />;
    }
  };

  return (
    <div
      onClick={onClick}
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
          {getTypeIcon()}
          <span style={{ fontSize: '13px', fontWeight: 600, color: colors.ink }}>{asset.title}</span>
        </div>
        {asset.isAdminPick && (
          <span style={{ fontSize: '10px', fontWeight: 600, color: '#7928ca', backgroundColor: '#f3e8ff', padding: '2px 5px', borderRadius: '4px' }}>
            PICK
          </span>
        )}
      </div>

      <div style={{ fontSize: '12px', color: colors.body, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {asset.description}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: colors.mute, marginTop: '2px' }}>
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
  );
}
