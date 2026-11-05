'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Header } from '../../infrastructure/components/layout/Header';
import { Footer } from '../../infrastructure/components/layout/Footer';
import { useTheme } from '../../infrastructure/theme/ThemeContext';
import { supabase } from '../../infrastructure/supabase/client';
import { FolderKanban, ShieldCheck, ArrowRight, Loader2, Folder, Award, Sparkles } from 'lucide-react';

interface CategoryItem {
  id: string;
  name: string;
  description: string;
  color: string;
  is_official?: boolean;
  creator_name?: string;
  asset_count?: number;
}

interface OfficialBadgeCategory {
  name: string;
  color: string;
  description?: string;
  asset_count: number;
}

export default function CategoryPage() {
  const { colors } = useTheme();
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [officialBadges, setOfficialBadges] = useState<OfficialBadgeCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCategories() {
      setLoading(true);
      try {
        // 1. 일반 카테고리 로드
        const { data: catData } = await supabase
          .from('categories')
          .select('*')
          .order('created_at', { ascending: true });

        if (catData) {
          setCategories(catData as CategoryItem[]);
        } else {
          setCategories([]);
        }

        // 2. 공식 배지 카테고리 로드 및 집계
        const badgeMap = new Map<string, OfficialBadgeCategory>();

        try {
          // user_badges에 등록된 배지 정보
          const { data: bData } = await supabase
            .from('user_badges')
            .select('name, color, description');

          if (bData) {
            bData.forEach((b) => {
              if (b.name && !badgeMap.has(b.name)) {
                badgeMap.set(b.name, {
                  name: b.name,
                  color: b.color || '#0070f3',
                  description: b.description || '공식 인증 배지',
                  asset_count: 0,
                });
              }
            });
          }

          // assets 테이블에서 공식 배지가 부착된 에셋들 카운트
          const { data: aData } = await supabase
            .from('assets')
            .select('badge_name, is_official_badge')
            .eq('is_official_badge', true);

          if (aData) {
            aData.forEach((a) => {
              if (a.badge_name) {
                if (!badgeMap.has(a.badge_name)) {
                  badgeMap.set(a.badge_name, {
                    name: a.badge_name,
                    color: '#0070f3',
                    description: '공식 인증 배지',
                    asset_count: 0,
                  });
                }
                const item = badgeMap.get(a.badge_name)!;
                item.asset_count += 1;
              }
            });
          }

          setOfficialBadges(Array.from(badgeMap.values()));
        } catch (badgeErr) {
          console.warn('Official badge load error:', badgeErr);
        }
      } catch (e) {
        console.warn('Category load exception:', e);
        setCategories([]);
      } finally {
        setLoading(false);
      }
    }

    loadCategories();
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: colors.canvasSoft }}>
      <Header />

      <main style={{ flex: 1, maxWidth: '1200px', width: '100%', margin: '0 auto', padding: '60px 24px', boxSizing: 'border-box' }}>
        {/* Header Title */}
        <div style={{ marginBottom: '40px', textAlign: 'center' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '20px',
              backgroundColor: colors.canvasSoft2,
              border: `1px solid ${colors.hairline}`,
              fontSize: '12px',
              fontWeight: 600,
              color: colors.ink,
              marginBottom: '16px',
            }}
          >
            <FolderKanban size={14} color="#0070f3" />
            <span>큐레이션 카테고리</span>
          </div>

          <h1
            style={{
              margin: '0 0 12px',
              fontSize: '36px',
              fontWeight: 800,
              color: colors.ink,
              letterSpacing: '-1px',
            }}
          >
            카테고리별 에셋 탐색
          </h1>
          <p style={{ margin: 0, fontSize: '16px', color: colors.mute, maxWidth: '600px', marginInline: 'auto' }}>
            공식 인증 배지 및 테마별 카테고리를 통해 검증된 고품질 에셋을 모아보세요.
          </p>
        </div>

        {/* 1. Official Badges Category Section (공식 배지 카테고리) */}
        {!loading && officialBadges.length > 0 && (
          <div style={{ marginBottom: '48px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '28px',
                  height: '28px',
                  borderRadius: '8px',
                  backgroundColor: '#0070f315',
                  color: '#0070f3',
                }}
              >
                <ShieldCheck size={16} />
              </div>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: colors.ink }}>
                공식 배지 카테고리
              </h2>
              <span style={{ fontSize: '12px', color: colors.mute }}>
                (인증된 크리에이터 전용 공식 배지 에셋)
              </span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: '16px',
              }}
            >
              {officialBadges.map((badge) => (
                <Link
                  key={badge.name}
                  href={`/list?badge=${encodeURIComponent(badge.name)}`}
                  style={{
                    textDecoration: 'none',
                    backgroundColor: colors.canvas,
                    borderRadius: '14px',
                    border: `1.5px solid ${badge.color}40`,
                    padding: '20px 24px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
                    transition: 'all 0.2s ease',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: '4px',
                      backgroundColor: badge.color,
                    }}
                  />

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          backgroundColor: badge.color,
                          color: '#fff',
                          fontSize: '12px',
                          fontWeight: 700,
                        }}
                      >
                        <ShieldCheck size={13} />
                        {badge.name}
                      </span>

                      <span style={{ fontSize: '12px', fontWeight: 600, color: colors.mute }}>
                        {badge.asset_count}개 에셋
                      </span>
                    </div>

                    <p style={{ margin: '0 0 14px', fontSize: '13px', color: colors.body, lineHeight: 1.5 }}>
                      {badge.description || `"${badge.name}" 공식 배지가 부착된 인증 에셋 모음입니다.`}
                    </p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px', fontSize: '12px', fontWeight: 600, color: badge.color }}>
                    <span>배지 에셋 모아보기</span>
                    <ArrowRight size={14} />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* 2. General Categories Section Header */}
        {!loading && officialBadges.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '28px',
                height: '28px',
                borderRadius: '8px',
                backgroundColor: colors.canvasSoft2,
                color: colors.ink,
              }}
            >
              <FolderKanban size={16} />
            </div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: colors.ink }}>
              일반 주제 카테고리
            </h2>
          </div>
        )}

        {/* Categories Grid or Empty */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '80px 0', gap: '8px', color: colors.mute }}>
            <Loader2 size={24} className="animate-spin" />
            <span>카테고리 로딩 중...</span>
          </div>
        ) : categories.length === 0 ? (
          <div
            style={{
              padding: '80px 24px',
              textAlign: 'center',
              backgroundColor: colors.canvas,
              borderRadius: '16px',
              border: `1px solid ${colors.hairline}`,
            }}
          >
            <Folder size={40} color={colors.mute} style={{ margin: '0 auto 12px' }} />
            <h3 style={{ margin: '0 0 6px', fontSize: '18px', color: colors.ink }}>
              아직 개설된 일반 카테고리가 없습니다
            </h3>
            <p style={{ margin: 0, fontSize: '14px', color: colors.mute }}>
              관리자 대시보드에서 새로운 카테고리를 생성할 수 있습니다.
            </p>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
              gap: '24px',
            }}
          >
            {categories.map((cat) => (
              <Link
                key={cat.id}
                href={`/list?category=${encodeURIComponent(cat.id)}`}

                style={{
                  textDecoration: 'none',
                  backgroundColor: colors.canvas,
                  borderRadius: '16px',
                  border: `1px solid ${colors.hairline}`,
                  padding: '28px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '4px',
                    backgroundColor: cat.color || colors.primary,
                  }}
                />

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div
                        style={{
                          width: '10px',
                          height: '10px',
                          borderRadius: '50%',
                          backgroundColor: cat.color || colors.primary,
                        }}
                      />
                      <span style={{ fontSize: '12px', fontWeight: 600, color: colors.mute }}>
                        카테고리
                      </span>
                    </div>

                    {cat.is_official && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '11px',
                          fontWeight: 600,
                          padding: '3px 8px',
                          borderRadius: '6px',
                          backgroundColor: colors.canvasSoft2,
                          color: colors.ink,
                          border: `1px solid ${colors.hairline}`,
                        }}
                      >
                        <ShieldCheck size={12} color="#7928ca" />
                        <span>공식 배지 카테고리</span>
                      </span>
                    )}
                  </div>

                  <h3
                    style={{
                      margin: '0 0 10px',
                      fontSize: '20px',
                      fontWeight: 700,
                      color: colors.ink,
                      letterSpacing: '-0.4px',
                    }}
                  >
                    {cat.name}
                  </h3>

                  <p
                    style={{
                      margin: 0,
                      fontSize: '14px',
                      color: colors.body,
                      lineHeight: '1.5',
                    }}
                  >
                    {cat.description || '등록된 설명이 없습니다.'}
                  </p>
                </div>

                <div
                  style={{
                    marginTop: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: '16px',
                    borderTop: `1px solid ${colors.hairline}`,
                  }}
                >
                  <span style={{ fontSize: '12px', color: colors.mute }}>
                    {cat.creator_name ? `제작: ${cat.creator_name}` : '공식 카테고리'}
                  </span>

                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '13px',
                      fontWeight: 600,
                      color: colors.ink,
                    }}
                  >
                    <span>에셋 보기</span>
                    <ArrowRight size={14} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
