'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Header } from '../../../infrastructure/components/layout/Header';
import { Footer } from '../../../infrastructure/components/layout/Footer';
import { AssetCard } from '../../../infrastructure/components/ui/AssetCard';
import { Sparkles, ArrowLeft, Loader2 } from 'lucide-react';
import { useTheme } from '../../../infrastructure/theme/ThemeContext';
import { supabase } from '../../../infrastructure/supabase/client';

export default function AdminPickListPage() {
  const { colors } = useTheme();
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAdminPicks() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('assets')
          .select('*')
          .eq('is_admin_pick', true)
          .order('created_at', { ascending: false });

        if (data) {
          setAssets(data);
        }
      } catch (e) {
        console.warn('Admin pick fetch error:', e);
      } finally {
        setLoading(false);
      }
    }
    fetchAdminPicks();
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
          <Sparkles size={24} color="#7928ca" />
          <h1 style={{ fontSize: '28px', fontWeight: 800, margin: 0, color: colors.ink }}>
            관리자 픽 (Admin Picks)
          </h1>
        </div>
        <p style={{ margin: '0 0 32px', fontSize: '15px', color: colors.body }}>
          Entry-Hub 운영진이 완성도와 코드 품질을 검증하여 엄선한 추천 에셋 컬렉션입니다.
        </p>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: '8px', color: colors.mute }}>
            <Loader2 size={20} className="animate-spin" />
            <span>관리자 픽 에셋 로딩 중...</span>
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
            <Sparkles size={36} color={colors.mute} style={{ margin: '0 auto 12px' }} />
            <h3 style={{ margin: '0 0 6px', fontSize: '16px', color: colors.ink }}>
              아직 선정된 관리자 픽 에셋이 없습니다
            </h3>
            <p style={{ margin: 0, fontSize: '13px', color: colors.mute }}>
              관리자 대시보드에서 우수 에셋을 관리자 픽으로 지정할 수 있습니다.
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
