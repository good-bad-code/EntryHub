'use client';

import React, { useState, useEffect } from 'react';
import { Header } from '../infrastructure/components/layout/Header';
import { Footer } from '../infrastructure/components/layout/Footer';
import { AssetCard } from '../infrastructure/components/ui/AssetCard';
import { Sparkles, Flame, ArrowRight, Code2, Download, Loader2, Puzzle } from 'lucide-react';
import { supabase } from '../infrastructure/supabase/client';
import Link from 'next/link';
import { useExtensionInstalled } from '../infrastructure/components/modal/InstallExtensionModal';
import { useTheme } from '../infrastructure/theme/ThemeContext';

// [확장프로그램 설치 링크 설정]
// 크롬 웹스토어 URL이나 확장프로그램 배포 링크를 이 곳에 넣어주시면 됩니다.
const EXTENSION_INSTALL_URL = 'https://chromewebstore.google.com/detail/gailgccpnaljgfkkfahnomggbckdjkac?utm_source=item-share-cb';

export default function HomePage() {
  const { colors } = useTheme();
  const [adminPicks, setAdminPicks] = useState<any[]>([]);
  const [popularAssets, setPopularAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const isExtInstalled = useExtensionInstalled();

  useEffect(() => {
    async function loadHomeAssets() {
      setLoading(true);
      try {
        // 관리자픽 조회
        const { data: picks } = await supabase
          .from('assets')
          .select('*')
          .eq('is_admin_pick', true)
          .order('created_at', { ascending: false })
          .limit(4);

        if (picks) {
          setAdminPicks(picks);
        }

        // 인기 에셋 조회
        const { data: popular } = await supabase
          .from('assets')
          .select('*')
          .order('like_count', { ascending: false })
          .limit(6);

        if (popular) {
          setPopularAssets(popular);
        }
      } catch (e) {
        console.warn('Home assets fetch exception:', e);
      } finally {
        setLoading(false);
      }
    }

    loadHomeAssets();
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: colors.canvas }}>
      <Header />

      {/* Hero Section */}
      <section
        style={{
          padding: '80px 24px 60px',
          textAlign: 'center',
          maxWidth: '900px',
          margin: '0 auto',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 14px',
            borderRadius: '20px',
            backgroundColor: colors.canvasSoft2,
            border: `1px solid ${colors.hairline}`,
            fontSize: '13px',
            fontWeight: 500,
            marginBottom: '20px',
          }}
        >
          <Sparkles size={14} color="#7928ca" />
          <span>엔트리 블록 코드 · 오브젝트 · 장면 공유 생태계</span>
        </div>

        <h1
          style={{
            fontSize: '52px',
            fontWeight: 800,
            lineHeight: 1.15,
            letterSpacing: '-1.8px',
            margin: '0 0 20px',
            color: colors.ink,
          }}
        >
          원하는 에셋을 찾고,
          <br />
          내 엔트리 작품에 <span style={{ background: colors.gradientDevelop, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>즉시 주입</span>하세요
        </h1>

        <p
          style={{
            fontSize: '18px',
            color: colors.body,
            lineHeight: 1.6,
            maxWidth: '640px',
            margin: '0 auto 36px',
          }}
        >
          복잡한 물리 엔진 알고리즘부터 고품질 애니메이션 스프라이트까지.
          엔트리-허브 익스텐션을 통해 클릭 한 번으로 에디터에 불러옵니다.
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <Link
            href="/list"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 24px',
              borderRadius: '8px',
              backgroundColor: colors.primary,
              color: colors.onPrimary,
              textDecoration: 'none',
              fontSize: '15px',
              fontWeight: 600,
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            }}
          >
            <span>에셋 둘러보기</span>
            <ArrowRight size={16} />
          </Link>

          {isExtInstalled ? (
            <a
              href="https://playentry.org/ws/"
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 24px',
                borderRadius: '8px',
                backgroundColor: colors.canvas,
                border: `1px solid ${colors.hairlineStrong}`,
                color: colors.ink,
                textDecoration: 'none',
                fontSize: '15px',
                fontWeight: 500,
              }}
            >
              <Download size={16} />
              <span>엔트리 에디터 바로가기</span>
            </a>
          ) : (
            <a
              href={EXTENSION_INSTALL_URL}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 24px',
                borderRadius: '8px',
                backgroundColor: '#eff6ff',
                border: '1px solid #93c5fd',
                color: '#2563eb',
                textDecoration: 'none',
                fontSize: '15px',
                fontWeight: 600,
                boxShadow: '0 2px 8px rgba(37, 99, 235, 0.08)',
                transition: 'all 0.15s ease',
              }}
              title="Entry-Hub 크롬 확장프로그램 설치하러 가기"
            >
              <Puzzle size={16} />
              <span>확장프로그램 설치하러 가기</span>
            </a>
          )}
        </div>
      </section>

      {/* Main Content Sections */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px 60px', width: '100%', boxSizing: 'border-box' }}>
        {/* Admin Picks Section */}
        <section style={{ marginBottom: '60px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={20} color="#7928ca" />
              <h2 style={{ fontSize: '22px', fontWeight: 700, margin: 0, color: colors.ink }}>
                관리자 픽 (Admin Picks)
              </h2>
            </div>
            <Link
              href="/list/adminpick"
              style={{
                fontSize: '14px',
                color: colors.link,
                textDecoration: 'none',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span>전체보기</span>
              <ArrowRight size={14} />
            </Link>
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0', color: colors.mute }}>
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : adminPicks.length === 0 ? (
            <div style={{ padding: '40px 24px', textAlign: 'center', backgroundColor: colors.canvasSoft, borderRadius: '12px', border: `1px solid ${colors.hairline}` }}>
              <p style={{ margin: 0, fontSize: '14px', color: colors.mute }}>
                아직 등록된 관리자 픽 에셋이 없습니다.
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
              {adminPicks.map((asset) => (
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
                  data={asset.data}
                />
              ))}
            </div>
          )}
        </section>

        {/* Popular Assets Section */}
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Flame size={20} color="#ff4d4d" />
              <h2 style={{ fontSize: '22px', fontWeight: 700, margin: 0, color: colors.ink }}>
                인기 급상승 에셋
              </h2>
            </div>
            <Link
              href="/list/popular"
              style={{
                fontSize: '14px',
                color: colors.link,
                textDecoration: 'none',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span>전체보기</span>
              <ArrowRight size={14} />
            </Link>
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0', color: colors.mute }}>
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : popularAssets.length === 0 ? (
            <div style={{ padding: '40px 24px', textAlign: 'center', backgroundColor: colors.canvasSoft, borderRadius: '12px', border: `1px solid ${colors.hairline}` }}>
              <p style={{ margin: 0, fontSize: '14px', color: colors.mute }}>
                아직 등록된 에셋이 없습니다. 엔트리 에디터 익스텐션에서 첫 에셋을 공유해보세요!
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
              {popularAssets.map((asset) => (
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
                  data={asset.data}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}
