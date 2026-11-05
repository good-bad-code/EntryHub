'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Header } from '../../infrastructure/components/layout/Header';
import { Footer } from '../../infrastructure/components/layout/Footer';
import { AssetCard } from '../../infrastructure/components/ui/AssetCard';
import { Search, Loader2, Sparkles, Filter, ShieldCheck, X } from 'lucide-react';
import { useTheme } from '../../infrastructure/theme/ThemeContext';
import { supabase } from '../../infrastructure/supabase/client';

function AssetListContent() {
  const { colors } = useTheme();
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get('category') || '';
  const initialBadge = searchParams.get('badge') || '';
  const initialQuery = searchParams.get('q') || '';

  const [selectedType, setSelectedType] = useState<'ALL' | 'CODE' | 'OBJECT' | 'SCENE'>('ALL');
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [selectedBadge, setSelectedBadge] = useState(initialBadge);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [officialBadges, setOfficialBadges] = useState<{ name: string; color: string }[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // 카테고리 및 공식 배지 목록 조회
  useEffect(() => {
    async function loadFilters() {
      const { data: catData } = await supabase.from('categories').select('id, name');
      if (catData) setCategories(catData);

      try {
        const { data: bData } = await supabase.from('user_badges').select('name, color');
        if (bData) {
          const unique = new Map<string, string>();
          bData.forEach((b) => {
            if (b.name && !unique.has(b.name)) unique.set(b.name, b.color || '#0070f3');
          });
          setOfficialBadges(Array.from(unique.entries()).map(([name, color]) => ({ name, color })));
        }
      } catch (err) {
        console.warn('Badge list error:', err);
      }
    }
    loadFilters();
  }, []);

  // 에셋 목록 조회
  useEffect(() => {
    async function fetchAssets() {
      setLoading(true);
      try {
        let query = supabase.from('assets').select('*');

        if (selectedType !== 'ALL') {
          query = query.eq('type', selectedType);
        }

        if (selectedCategory) {
          query = query.eq('category_id', selectedCategory);
        }

        if (selectedBadge) {
          query = query.eq('is_official_badge', true).eq('badge_name', selectedBadge);
        }

        if (searchQuery.trim()) {
          query = query.ilike('title', `%${searchQuery.trim()}%`);
        }

        query = query.order('created_at', { ascending: false });

        const { data, error } = await query;
        if (data) {
          setAssets(data);
        } else {
          setAssets([]);
        }
      } catch (e) {
        console.warn('Asset fetch error:', e);
        setAssets([]);
      } finally {
        setLoading(false);
      }
    }

    fetchAssets();
  }, [selectedType, selectedCategory, selectedBadge, searchQuery]);


  return (
    <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 24px', width: '100%', flex: 1, boxSizing: 'border-box' }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 800, margin: '0 0 8px', color: colors.ink }}>
          에셋 탐색
        </h1>
        <p style={{ margin: 0, fontSize: '15px', color: colors.mute }}>
          엔트리-허브의 모든 코드, 오브젝트, 장면 에셋을 검색하고 필터링해 보세요.
        </p>
      </div>

      {/* Filter & Search Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '32px',
          gap: '16px',
          flexWrap: 'wrap',
        }}
      >
        {/* Type Tabs */}
        <div style={{ display: 'flex', gap: '4px', backgroundColor: colors.canvasSoft2, padding: '4px', borderRadius: '8px' }}>
          {(['ALL', 'CODE', 'OBJECT', 'SCENE'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: selectedType === type ? colors.canvas : 'transparent',
                color: selectedType === type ? colors.ink : colors.mute,
                fontWeight: selectedType === type ? 600 : 500,
                fontSize: '14px',
                cursor: 'pointer',
                boxShadow: selectedType === type ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              {type === 'ALL' ? '전체' : type === 'CODE' ? '코드' : type === 'OBJECT' ? '오브젝트' : '장면'}
            </button>
          ))}
        </div>

        {/* Category Select & Search Box */}
        <div style={{ display: 'flex', gap: '10px', flex: '1 1 360px', maxWidth: '500px' }}>
          <select
            value={selectedBadge ? `badge:${selectedBadge}` : selectedCategory ? `cat:${selectedCategory}` : ''}
            onChange={(e) => {
              const val = e.target.value;
              if (val.startsWith('badge:')) {
                setSelectedBadge(val.replace('badge:', ''));
                setSelectedCategory('');
              } else if (val.startsWith('cat:')) {
                setSelectedCategory(val.replace('cat:', ''));
                setSelectedBadge('');
              } else {
                setSelectedCategory('');
                setSelectedBadge('');
              }
            }}
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              border: `1px solid ${colors.hairline}`,
              fontSize: '14px',
              backgroundColor: colors.canvas,
              outline: 'none',
              color: colors.ink,
            }}
          >
            <option value="">모든 에셋 및 카테고리</option>
            {officialBadges.length > 0 && (
              <optgroup label="공식 배지 카테고리">
                {officialBadges.map((b) => (
                  <option key={b.name} value={`badge:${b.name}`}>
                    {b.name}
                  </option>
                ))}
              </optgroup>
            )}
            {categories.length > 0 && (
              <optgroup label="일반 주제 카테고리">
                {categories.map((c) => (
                  <option key={c.id} value={`cat:${c.id}`}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>


          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={16} color={colors.mute} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="에셋 제목 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '10px 14px 10px 36px',
                borderRadius: '8px',
                border: `1px solid ${colors.hairline}`,
                fontSize: '14px',
                outline: 'none',
                backgroundColor: colors.canvas,
                color: colors.ink,
              }}
            />
          </div>
        </div>
      </div>


      {/* Active Official Badge Filter Indicator */}
      {selectedBadge && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '20px',
              backgroundColor: '#0070f315',
              border: '1px solid #0070f340',
              fontSize: '13px',
              fontWeight: 600,
              color: '#0070f3',
            }}
          >
            <ShieldCheck size={14} />
            <span>공식 배지 카테고리: &quot;{selectedBadge}&quot;</span>
            <button
              onClick={() => setSelectedBadge('')}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '0 0 0 4px',
                display: 'flex',
                alignItems: 'center',
                color: '#0070f3',
              }}
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Asset Cards Grid or Empty State */}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '100px 0', gap: '8px', color: colors.mute }}>
          <Loader2 size={24} className="animate-spin" />
          <span>에셋 목록을 불러오는 중...</span>
        </div>
      ) : assets.length === 0 ? (
        <div
          style={{
            padding: '80px 24px',
            textAlign: 'center',
            backgroundColor: colors.canvasSoft,
            borderRadius: '16px',
            border: `1px solid ${colors.hairline}`,
          }}
        >
          <Filter size={36} color={colors.mute} style={{ margin: '0 auto 12px' }} />
          <h3 style={{ margin: '0 0 6px', fontSize: '18px', color: colors.ink }}>
            조건에 맞는 에셋이 없습니다
          </h3>
          <p style={{ margin: 0, fontSize: '14px', color: colors.mute }}>
            다른 검색어를 입력하거나 필터를 변경해 보세요.
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
  );
}

export default function AssetListPage() {
  const { colors } = useTheme();
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: colors.canvas }}>
      <Header />
      <Suspense fallback={<div style={{ padding: '80px', textAlign: 'center', color: colors.mute }}>로딩 중...</div>}>
        <AssetListContent />
      </Suspense>
      <Footer />
    </div>
  );
}
