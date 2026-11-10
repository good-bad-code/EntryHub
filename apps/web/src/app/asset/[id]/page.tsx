'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Header } from '../../../infrastructure/components/layout/Header';
import { Footer } from '../../../infrastructure/components/layout/Footer';
import { ReportModal } from '../../../infrastructure/components/ui/ReportModal';
import { EntryAssetViewer } from '../../../infrastructure/components/ui/EntryAssetViewer';
import { formatAssetImageUrl } from '@entry-hub/shared';
import { useAuth } from '../../../infrastructure/auth/AuthContext';
import { useTheme } from '../../../infrastructure/theme/ThemeContext';
import { supabase } from '../../../infrastructure/supabase/client';
import {
  Heart,
  Bookmark,
  Share2,
  Download,
  Copy,
  Check,
  AlertTriangle,
  Sparkles,
  ShieldCheck,
  User,
  ExternalLink,
  Code2,
  Box,
  Layers,
  ArrowLeft,
  Trash2,
  Edit3,
  X,
  Tag,
} from 'lucide-react';

interface AssetDetail {
  id: string;
  title: string;
  description?: string;
  type: 'CODE' | 'OBJECT' | 'SCENE';
  author_id: string;
  author_name: string;
  is_official_badge?: boolean;
  is_admin_pick?: boolean;
  tags?: string[];
  like_count: number;
  bookmark_count: number;
  preview_image_url?: string;
  data: Record<string, unknown>;
  created_at?: string;
}

export default function AssetDetailPage() {
  const router = useRouter();
  const params = useParams();
  const assetId = params?.id as string;
  const { user, profile } = useAuth();
  const { colors } = useTheme();

  const [asset, setAsset] = useState<AssetDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [bookmarkCount, setBookmarkCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [authorBadges, setAuthorBadges] = useState<{ id: string; name: string; color: string; description?: string }[]>([]);

  // 에셋 수정 (이름, 설명) 모달 상태
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!asset) return;
    if (!editTitle.trim()) {
      alert('에셋 이름을 입력해 주세요.');
      return;
    }

    setIsSavingEdit(true);
    try {
      const { error } = await supabase
        .from('assets')
        .update({
          title: editTitle.trim(),
          description: editDescription.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', asset.id);

      if (error) throw error;

      setAsset((prev) =>
        prev
          ? {
              ...prev,
              title: editTitle.trim(),
              description: editDescription.trim() || undefined,
            }
          : null
      );

      setIsEditOpen(false);
      alert('에셋 이름 및 설명이 성공적으로 수정되었습니다.');
    } catch (err: any) {
      alert(err?.message || '에셋 수정 중 오류가 발생했습니다.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  useEffect(() => {
    async function fetchAsset() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('assets')
          .select('*')
          .eq('id', assetId)
          .single();

        if (data) {
          setAsset(data as AssetDetail);
          setLikeCount(data.like_count || 0);
          setBookmarkCount(data.bookmark_count || 0);

          // 현재 유저의 좋아요 및 북마크 여부 조회 (id 컬럼 대신 asset_id 조회)
          if (user?.id) {
            try {
              const [likeRes, bookmarkRes] = await Promise.all([
                supabase.from('likes').select('asset_id').eq('asset_id', assetId).eq('user_id', user.id).maybeSingle(),
                supabase.from('bookmarks').select('asset_id').eq('asset_id', assetId).eq('user_id', user.id).maybeSingle(),
              ]);
              setIsLiked(Boolean(likeRes.data));
              setIsBookmarked(Boolean(bookmarkRes.data));
            } catch (statusErr) {
              console.warn('Like/Bookmark status fetch error:', statusErr);
            }
          } else {
            setIsLiked(false);
            setIsBookmarked(false);
          }

          if (data.author_id) {
            try {
              const { data: bData } = await supabase
                .from('user_badges')
                .select('id, name, color, description')
                .eq('user_id', data.author_id)
                .order('created_at', { ascending: true });
              if (bData) {
                setAuthorBadges(bData);
              }
            } catch {}
          }
        } else {
          setAsset(null);
        }
      } catch (e) {
        console.warn('Asset fetch error:', e);
        setAsset(null);
      } finally {
        setLoading(false);
      }
    }

    if (assetId) {
      fetchAsset();
    }
  }, [assetId, user?.id]);

  const handleToggleLike = async () => {
    if (!user) {
      alert('좋아요를 누르려면 로그인이 필요합니다.');
      return;
    }
    const prevLiked = isLiked;
    const prevCount = likeCount;
    const nextState = !prevLiked;
    const optimisticCount = nextState ? prevCount + 1 : Math.max(0, prevCount - 1);
    setIsLiked(nextState);
    setLikeCount(optimisticCount);

    try {
      // 1. 원자적 RPC 호출 우선 시도
      const { data: rpcData, error: rpcError } = await supabase.rpc('toggle_like', { p_asset_id: assetId });
      if (!rpcError && rpcData && typeof rpcData.isLiked === 'boolean') {
        setIsLiked(rpcData.isLiked);
        setLikeCount(rpcData.likeCount);
        return;
      }

      // 2. RPC 미배포 시 직접 테이블 토글 폴백
      if (nextState) {
        const { error } = await supabase.from('likes').insert({ asset_id: assetId, user_id: user.id });
        if (error) {
          // 이미 존재하는 키(중복)인 경우 상태를 true로 동기화하고 에러 무시
          if (error.code === '23505' || error.message?.includes('duplicate key') || error.message?.includes('likes_pkey')) {
            setIsLiked(true);
            const { data: updatedAsset } = await supabase.from('assets').select('like_count').eq('id', assetId).maybeSingle();
            if (updatedAsset && typeof updatedAsset.like_count === 'number') {
              setLikeCount(updatedAsset.like_count);
            }
            return;
          }
          throw error;
        }
      } else {
        const { error } = await supabase.from('likes').delete().eq('asset_id', assetId).eq('user_id', user.id);
        if (error) throw error;
      }

      // DB 트리거 반영 최신 카운트 동기화
      const { data: updatedAsset } = await supabase.from('assets').select('like_count').eq('id', assetId).maybeSingle();
      if (updatedAsset && typeof updatedAsset.like_count === 'number') {
        setLikeCount(updatedAsset.like_count);
      }
    } catch (e: any) {
      console.warn('Like toggle sync error:', e);
      setIsLiked(prevLiked);
      setLikeCount(prevCount);
      alert(e?.message || '좋아요 반영에 실패했습니다.');
    }
  };

  const handleToggleBookmark = async () => {
    if (!user) {
      alert('마이픽(북마크)에 저장하려면 로그인이 필요합니다.');
      return;
    }
    const prevBookmarked = isBookmarked;
    const prevCount = bookmarkCount;
    const nextState = !prevBookmarked;
    const optimisticCount = nextState ? prevCount + 1 : Math.max(0, prevCount - 1);
    setIsBookmarked(nextState);
    setBookmarkCount(optimisticCount);

    try {
      // 1. 원자적 RPC 호출 우선 시도
      const { data: rpcData, error: rpcError } = await supabase.rpc('toggle_bookmark', { p_asset_id: assetId });
      if (!rpcError && rpcData && typeof rpcData.isBookmarked === 'boolean') {
        setIsBookmarked(rpcData.isBookmarked);
        setBookmarkCount(rpcData.bookmarkCount);
        return;
      }

      // 2. RPC 미배포 시 직접 테이블 토글 폴백
      if (nextState) {
        const { error } = await supabase.from('bookmarks').insert({ asset_id: assetId, user_id: user.id });
        if (error) {
          // 이미 존재하는 키(중복)인 경우 상태를 true로 동기화하고 에러 무시
          if (error.code === '23505' || error.message?.includes('duplicate key') || error.message?.includes('bookmarks_pkey')) {
            setIsBookmarked(true);
            const { data: updatedAsset } = await supabase.from('assets').select('bookmark_count').eq('id', assetId).maybeSingle();
            if (updatedAsset && typeof updatedAsset.bookmark_count === 'number') {
              setBookmarkCount(updatedAsset.bookmark_count);
            }
            return;
          }
          throw error;
        }
      } else {
        const { error } = await supabase.from('bookmarks').delete().eq('asset_id', assetId).eq('user_id', user.id);
        if (error) throw error;
      }

      // DB 트리거 반영 최신 카운트 동기화
      const { data: updatedAsset } = await supabase.from('assets').select('bookmark_count').eq('id', assetId).maybeSingle();
      if (updatedAsset && typeof updatedAsset.bookmark_count === 'number') {
        setBookmarkCount(updatedAsset.bookmark_count);
      }
    } catch (e: any) {
      console.warn('Bookmark toggle sync error:', e);
      setIsBookmarked(prevBookmarked);
      setBookmarkCount(prevCount);
      alert(e?.message || '북마크 반영에 실패했습니다.');
    }
  };


  const handleCopyJson = () => {
    if (!asset?.data) return;
    navigator.clipboard.writeText(JSON.stringify(asset.data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadJson = () => {
    if (!asset?.data) return;
    const blob = new Blob([JSON.stringify(asset.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${asset.title.replace(/\s+/g, '_')}_entry_asset.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteAsset = async () => {
    if (!asset) return;
    const isOwner = user?.id === asset.author_id;
    const isAdmin =
      profile?.role === 'ADMIN' ||
      profile?.entry_user_id === '6a17db19865137773fb9d8c9' ||
      (profile?.entry_username || '').toLowerCase() === 'myentrymy' ||
      (user?.email || '').toLowerCase() === 'entry_6a17db19865137773fb9d8c9@entry-hub.local' ||
      (user?.email || '').toLowerCase() === 'myentrymy@entry-hub.local';

    if (!isOwner && !isAdmin) return;

    if (!confirm(`정말로 "${asset.title}" 에셋을 삭제하시겠습니까?\n삭제된 에셋은 복구할 수 없습니다.`)) {
      return;
    }

    try {
      const { error } = await supabase.from('assets').delete().eq('id', asset.id);
      if (error) throw error;
      alert('에셋이 성공적으로 삭제되었습니다.');
      router.push('/');
    } catch (e: any) {
      alert(e?.message || '에셋 삭제 중 오류가 발생했습니다.');
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'CODE':
        return <Code2 size={16} color="#0070f3" />;
      case 'OBJECT':
        return <Box size={16} color="#7928ca" />;
      case 'SCENE':
        return <Layers size={16} color="#ff0080" />;
      default:
        return <Code2 size={16} />;
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: colors.canvas }}>
        <Header />
        <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: colors.mute, fontSize: '14px' }}>에셋 정보를 불러오는 중...</p>
        </main>
        <Footer />
      </div>
    );
  }

  if (!asset) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: colors.canvas }}>
        <Header />
        <main style={{ flex: 1, textAlign: 'center', padding: '80px 24px' }}>
          <h2 style={{ color: colors.ink }}>존재하지 않는 에셋입니다</h2>
          <Link href="/list" style={{ color: colors.link, textDecoration: 'none', fontWeight: 600 }}>
            목록으로 돌아가기
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: colors.canvasSoft }}>
      <Header />

      <main style={{ flex: 1, maxWidth: '1000px', width: '100%', margin: '0 auto', padding: '40px 24px' }}>
        {/* Back Link */}
        <Link
          href="/list"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            color: colors.body,
            textDecoration: 'none',
            fontSize: '14px',
            marginBottom: '24px',
          }}
        >
          <ArrowLeft size={16} />
          <span>에셋 목록으로 돌아가기</span>
        </Link>

        {/* Main Card */}
        <div
          style={{
            backgroundColor: colors.canvas,
            borderRadius: '16px',
            border: `1px solid ${colors.hairline}`,
            overflow: 'hidden',
            boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
          }}
        >
          {/* Card Header & Title */}
          <div style={{ padding: '32px 32px 24px', borderBottom: `1px solid ${colors.hairline}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '12px',
                  fontWeight: 600,
                  padding: '4px 8px',
                  borderRadius: '6px',
                  backgroundColor: colors.canvasSoft2,
                }}
              >
                {getTypeIcon(asset.type)}
                {asset.type}
              </span>

              {asset.is_admin_pick && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '12px',
                    fontWeight: 600,
                    padding: '4px 8px',
                    borderRadius: '6px',
                    backgroundColor: colors.violetSoft,
                    color: colors.violetDeep,
                  }}
                >
                  <Sparkles size={12} />
                  관리자 픽
                </span>
              )}
            </div>

            <h1
              style={{
                margin: '0 0 12px',
                fontSize: '28px',
                fontWeight: 700,
                color: colors.ink,
                letterSpacing: '-0.8px',
              }}
            >
              {asset.title}
            </h1>

            <p style={{ margin: 0, fontSize: '15px', color: colors.body, lineHeight: '1.6' }}>
              {asset.description || '작성된 설명이 없습니다.'}
            </p>

            {asset.tags && asset.tags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '12px' }}>
                {asset.tags.map((t) => (
                  <span
                    key={t}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 10px',
                      borderRadius: '16px',
                      backgroundColor: colors.canvasSoft2,
                      border: `1px solid ${colors.hairline}`,
                      fontSize: '12px',
                      fontWeight: 500,
                      color: colors.ink,
                    }}
                  >
                    #{t}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Author & Action Bar */}
          <div
            style={{
              padding: '16px 32px',
              backgroundColor: colors.canvasSoft,
              borderBottom: `1px solid ${colors.hairline}`,
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '16px',
            }}
          >
            {/* Author Info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: colors.canvasSoft2,
                  border: `1px solid ${colors.hairlineStrong}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <User size={18} color={colors.mute} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Link
                    href={`/profile/${asset.author_id}`}
                    style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: colors.ink,
                      textDecoration: 'none',
                    }}
                  >
                    {asset.author_name}
                  </Link>
                  {asset.is_official_badge && (
                    <span title="공식 배지 보유자">
                      <ShieldCheck size={14} color="#7928ca" />
                    </span>
                  )}
                  {authorBadges.map((b) => (
                    <span
                      key={b.id}
                      title={b.description || b.name}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: `${b.color}18`,
                        border: `1px solid ${b.color}`,
                        color: b.color,
                      }}
                    >
                      <Sparkles size={10} />
                      {b.name}
                    </span>
                  ))}
                </div>
                <span style={{ fontSize: '12px', color: colors.mute }}>에셋 제작자</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {/* Like Button */}
              <button
                onClick={handleToggleLike}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: isLiked ? '1px solid #fda4af' : `1px solid ${colors.hairlineStrong}`,
                  backgroundColor: isLiked ? '#fff1f2' : colors.canvas,
                  color: isLiked ? '#e11d48' : colors.ink,
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <Heart size={16} fill={isLiked ? '#e11d48' : 'none'} color={isLiked ? '#e11d48' : colors.ink} />
                <span>{likeCount}</span>
              </button>

              {/* Bookmark Button */}
              <button
                onClick={handleToggleBookmark}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: isBookmarked ? '1px solid #93c5fd' : `1px solid ${colors.hairlineStrong}`,
                  backgroundColor: isBookmarked ? '#eff6ff' : colors.canvas,
                  color: isBookmarked ? '#0070f3' : colors.ink,
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <Bookmark size={16} fill={isBookmarked ? '#0070f3' : 'none'} color={isBookmarked ? '#0070f3' : colors.ink} />
                <span>{bookmarkCount}</span>
              </button>

              {/* Copy JSON */}
              <button
                onClick={handleCopyJson}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: `1px solid ${colors.hairlineStrong}`,
                  backgroundColor: colors.canvas,
                  color: colors.ink,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
                title="JSON 클립보드 복사"
              >
                {copied ? <Check size={16} color="#38a169" /> : <Copy size={16} />}
                <span>{copied ? '복사됨' : '복사'}</span>
              </button>

              {/* Download JSON */}
              <button
                onClick={handleDownloadJson}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: `1px solid ${colors.hairlineStrong}`,
                  backgroundColor: colors.canvas,
                  color: colors.ink,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
                title="JSON 파일 다운로드"
              >
                <Download size={16} />
                <span>다운로드</span>
              </button>

              {/* Edit Button (Author or Admin) - 사이트에서는 이름과 설명만 수정 */}
              {(user?.id === asset.author_id || profile?.role === 'ADMIN' || profile?.entry_user_id === '6a17db19865137773fb9d8c9' || (profile?.entry_username || '').toLowerCase() === 'myentrymy') && (
                <button
                  onClick={() => {
                    setEditTitle(asset.title);
                    setEditDescription(asset.description || '');
                    setIsEditOpen(true);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: `1px solid ${colors.hairlineStrong}`,
                    backgroundColor: colors.canvas,
                    color: colors.ink,
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                  title="에셋 이름/설명 수정"
                >
                  <Edit3 size={15} />
                  <span>수정</span>
                </button>
              )}

              {/* Delete Button (Author or Admin) */}
              {(user?.id === asset.author_id || profile?.role === 'ADMIN' || profile?.entry_user_id === '6a17db19865137773fb9d8c9' || (profile?.entry_username || '').toLowerCase() === 'myentrymy') && (
                <button
                  onClick={handleDeleteAsset}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #fed7d7',
                    backgroundColor: '#fff5f5',
                    color: '#e53e3e',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                  title="에셋 삭제"
                >
                  <Trash2 size={15} />
                  <span>삭제</span>
                </button>
              )}

              {/* Report Button */}
              <button
                onClick={() => setIsReportOpen(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: colors.mute,
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
                title="부적절한 에셋 신고"
              >
                <AlertTriangle size={14} />
                <span>신고</span>
              </button>
            </div>
          </div>

          {/* Preview Image Banner */}
          {(() => {
            const rawData: any = asset.data || {};
            const fallbackPic =
              rawData.selectedPicture ||
              rawData.pictures?.[0] ||
              rawData.objects?.[0]?.selectedPicture ||
              rawData.objects?.[0]?.pictures?.[0];
            const heroUrl = formatAssetImageUrl(asset.preview_image_url) || formatAssetImageUrl(fallbackPic);

            if (!heroUrl) return null;

            return (
              <div
                style={{
                  padding: '32px',
                  borderBottom: `1px solid ${colors.hairline}`,
                  backgroundColor: colors.canvasSoft2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  maxHeight: '360px',
                  overflow: 'hidden',
                }}
              >
                <img
                  src={heroUrl}
                  alt={asset.title}
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (!target.dataset.triedFallback) {
                      target.dataset.triedFallback = 'true';
                      const fallback = formatAssetImageUrl(fallbackPic, { thumb: true });
                      if (fallback && fallback !== target.src) {
                        target.src = fallback;
                        return;
                      }
                    }
                    target.onerror = null;
                    target.src = 'https://playentry.org/lib/entry-js/images/media/entrybot1.svg';
                  }}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '300px',
                    objectFit: 'contain',
                    filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.08))',
                  }}
                />
              </div>
            );
          })()}

          {/* Visual Entry Asset Inspector */}
          <div style={{ padding: '24px 32px' }}>
            <EntryAssetViewer type={asset.type} data={asset.data} />
          </div>
        </div>
      </main>

      {/* Report Modal */}
      <ReportModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        assetId={asset.id}
        assetTitle={asset.title}
      />

      {/* Asset Edit Modal (사이트에서는 이름과 설명만 수정) */}
      {isEditOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            style={{
              maxWidth: '520px',
              width: '100%',
              backgroundColor: colors.canvas,
              borderRadius: '16px',
              border: `1px solid ${colors.hairline}`,
              boxShadow: '0 20px 48px rgba(0,0,0,0.25)',
              padding: '28px 24px',
              position: 'relative',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: 700, color: colors.ink }}>
                  에셋 정보 수정
                </h3>
                <p style={{ margin: 0, fontSize: '12px', color: colors.mute }}>
                  웹 사이트에서는 <strong>에셋 이름과 설명</strong>만 수정할 수 있습니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: colors.mute,
                  padding: '4px',
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div
              style={{
                padding: '10px 12px',
                borderRadius: '8px',
                backgroundColor: colors.canvasSoft2,
                border: `1px solid ${colors.hairlineStrong}`,
                fontSize: '12px',
                color: colors.body,
                marginBottom: '20px',
                lineHeight: 1.5,
              }}
            >
              코드/오브젝트 등 실제 데이터를 추출하여 덮어쓰려면 <strong>크롬 확장 프로그램</strong>의 에셋 수정 기능을 사용해 주세요.
            </div>

            <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: colors.ink, marginBottom: '6px' }}>
                  에셋 이름 (제목)
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="에셋의 제목을 입력해 주세요"
                  required
                  maxLength={60}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: `1px solid ${colors.hairlineStrong}`,
                    fontSize: '14px',
                    outline: 'none',
                    backgroundColor: colors.canvas,
                    color: colors.ink,
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: colors.ink, marginBottom: '6px' }}>
                  에셋 설명
                </label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="에셋에 대한 상세 설명이나 사용법을 적어주세요."
                  rows={5}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: `1px solid ${colors.hairlineStrong}`,
                    fontSize: '13px',
                    lineHeight: 1.5,
                    outline: 'none',
                    backgroundColor: colors.canvas,
                    color: colors.ink,
                    resize: 'vertical',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '8px',
                    border: `1px solid ${colors.hairlineStrong}`,
                    backgroundColor: colors.canvas,
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    color: colors.body,
                  }}
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit || !editTitle.trim()}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: isSavingEdit || !editTitle.trim() ? colors.mute : colors.primary,
                    color: colors.onPrimary,
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: isSavingEdit || !editTitle.trim() ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isSavingEdit ? '저장 중...' : '수정 완료'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
