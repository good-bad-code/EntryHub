'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Header } from '../../../infrastructure/components/layout/Header';
import { Footer } from '../../../infrastructure/components/layout/Footer';
import { AssetCard } from '../../../infrastructure/components/ui/AssetCard';
import { Flame, ArrowLeft, Loader2 } from 'lucide-react';
import { useTheme } from '../../../infrastructure/theme/ThemeContext';
import { supabase } from '../../../infrastructure/supabase/client';

export default function PopularListPage() {
  const { colors } = useTheme();
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPopular() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('assets')
          .select('*')
          .order('like_count', { ascending: false })
          .limit(50);

        if (data) {
          setAssets(data);
        }
      } catch (e) {
        console.warn('Popular fetch error:', e);
      } finally {
        setLoading(false);
      }
    }
    fetchPopular();
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: colors.canvas }}>
      <Header />

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 24px', width: '100%', flex: 1, boxSizing: 'border-box' }}>
        <Link
          href="/list"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            color: colors.mute,
            textDecoration: 'none',
            fontSize: '13px',
            marginBottom: '16px',
          }}
        >
          <ArrowLeft size={14} />
          <span>전체 에셋 목록</span>
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <Flame size={24} color="#ff4d4d" />
          <h1 style={{ fontSize: '28px', fontWeight: 800, margin: 0, color: colors.ink }}>
            인기 에셋 (Popular)
          </h1>
        </div>
        <p style={{ margin: '0 0 32px', fontSize: '15px', color: colors.body }}>
          엔트리 창작자들에게 가장 많은 좋아요와 북마크를 받은 인기 에셋 순위입니다.
        </p>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: '8px', color: colors.mute }}>
            <Loader2 size={20} className="animate-spin" />
            <span>인기 에셋 순위 로딩 중...</span>
          </div>
        ) : assets.length === 0 ? (
          <div
            style={{
              padding: '60px 24px',
              textAlign: 'center',
              backgroundColor: colors.canvasSoft,
              borderRadius: '12px',
              border: `1px solid ${colors.hairline}`,
            }}
          >
            <Flame size={36} color={colors.mute} style={{ margin: '0 auto 12px' }} />
            <h3 style={{ margin: '0 0 6px', fontSize: '16px', color: colors.ink }}>
              아직 등록된 인기 에셋이 없습니다
            </h3>
            <p style={{ margin: 0, fontSize: '13px', color: colors.mute }}>
              새로운 에셋을 업로드하고 첫 번째 좋아요의 주인공이 되어보세요!
            </p>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: '24px',
            }}
          >
            {assets.map((asset) => (
              <AssetCard
                key={asset.id}
                id={asset.id}
                title={asset.title}
                description={asset.description}
                type={asset.type}
                authorName={asset.author_name}
                isOfficialBadge={asset.is_official_badge}
                isAdminPick={asset.is_admin_pick}
                likeCount={asset.like_count || 0}
                bookmarkCount={asset.bookmark_count || 0}
                previewImageUrl={asset.preview_image_url}
              />
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
