import React, { useState } from 'react';
import { X, Download, Heart, Bookmark, ShieldCheck, Code2, Box, Layers, Loader2, Trash2, Edit3 } from 'lucide-react';
import { colors, formatAssetImageUrl } from '@entry-hub/shared';

import { WindowPostMessageEntryBridgeAdapter } from '../../adapters/bridge/WindowPostMessageEntryBridgeAdapter';
import { ExtensionAssetViewer } from './EntryAssetViewer';
import { supabase } from '../../infrastructure/supabase/client';
import { deleteLocalAsset } from '../../infrastructure/storage/localHubStorage';

export interface ExtensionAssetItem {
  id: string;
  title: string;
  description?: string;
  type: 'CODE' | 'OBJECT' | 'SCENE';
  authorId?: string;
  authorName: string;
  isOfficialBadge?: boolean;
  badgeName?: string;
  badgeColor?: string;
  categoryId?: string;
  isAdminPick?: boolean;
  tags?: string[];
  likeCount: number;
  bookmarkCount: number;
  previewImageUrl?: string;
  data: Record<string, unknown>;
}


interface AssetDetailModalProps {
  asset: ExtensionAssetItem | null;
  currentUser?: any;
  onClose: () => void;
  bridgeAdapter: WindowPostMessageEntryBridgeAdapter;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
  onDeleted?: () => void;
  onEdit?: (asset: ExtensionAssetItem) => void;
}

export function AssetDetailModal({
  asset,
  currentUser,
  onClose,
  bridgeAdapter,
  onSuccess,
  onError,
  onDeleted,
  onEdit,
}: AssetDetailModalProps) {
  const [injecting, setInjecting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(asset?.likeCount || 0);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [bookmarkCount, setBookmarkCount] = useState(asset?.bookmarkCount || 0);

  React.useEffect(() => {
    if (!asset) return;
    setLikeCount(asset.likeCount || 0);
    setBookmarkCount(asset.bookmarkCount || 0);

    const isLocalAsset = !asset.id || asset.id.startsWith('loc_') || asset.authorName === '로컬 에셋';

    if (currentUser?.id && !isLocalAsset) {
      const checkStatus = async () => {
        try {
          const [likeRes, bookmarkRes, assetRes] = await Promise.all([
            supabase.from('likes').select('asset_id').eq('asset_id', asset.id).eq('user_id', currentUser.id).maybeSingle(),
            supabase.from('bookmarks').select('asset_id').eq('asset_id', asset.id).eq('user_id', currentUser.id).maybeSingle(),
            supabase.from('assets').select('like_count, bookmark_count').eq('id', asset.id).maybeSingle(),
          ]);
          setIsLiked(Boolean(likeRes.data));
          setIsBookmarked(Boolean(bookmarkRes.data));
          if (assetRes.data) {
            setLikeCount(assetRes.data.like_count ?? 0);
            setBookmarkCount(assetRes.data.bookmark_count ?? 0);
          }
        } catch (e) {
          console.warn('Status check failed:', e);
        }
      };
      checkStatus();
    } else if (!isLocalAsset) {
      supabase.from('assets').select('like_count, bookmark_count').eq('id', asset.id).maybeSingle().then(({ data }) => {
        if (data) {
          setLikeCount(data.like_count ?? 0);
          setBookmarkCount(data.bookmark_count ?? 0);
        }
      });
      setIsLiked(false);
      setIsBookmarked(false);
    } else {
      setIsLiked(false);
      setIsBookmarked(false);
    }
  }, [asset?.id, currentUser?.id]);

  if (!asset) return null;

  const isLocalAsset = !asset.id || asset.id.startsWith('loc_') || asset.authorName === '로컬 에셋';

  const handleToggleLike = async () => {
    if (isLocalAsset) return;
    if (!currentUser) {
      onError('좋아요를 누르려면 먼저 로그인해 주세요.');
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
      const { data: rpcData, error: rpcError } = await supabase.rpc('toggle_like', { p_asset_id: asset.id });
      if (!rpcError && rpcData && typeof rpcData.isLiked === 'boolean') {
        setIsLiked(rpcData.isLiked);
        setLikeCount(rpcData.likeCount);
        return;
      }

      // 2. RPC 미배포 시 직접 테이블 토글 폴백
      if (nextState) {
        const { error } = await supabase.from('likes').insert({ asset_id: asset.id, user_id: currentUser.id });
        if (error) {
          if (error.code === '23505' || error.message?.includes('duplicate key') || error.message?.includes('likes_pkey')) {
            setIsLiked(true);
            const { data: updatedAsset } = await supabase.from('assets').select('like_count').eq('id', asset.id).maybeSingle();
            if (updatedAsset && typeof updatedAsset.like_count === 'number') {
              setLikeCount(updatedAsset.like_count);
            }
            return;
          }
          throw error;
        }
      } else {
        const { error } = await supabase.from('likes').delete().eq('asset_id', asset.id).eq('user_id', currentUser.id);
        if (error) throw error;
      }

      // DB 트리거 반영 최신 카운트 동기화
      const { data: updatedAsset } = await supabase.from('assets').select('like_count').eq('id', asset.id).maybeSingle();
      if (updatedAsset && typeof updatedAsset.like_count === 'number') {
        setLikeCount(updatedAsset.like_count);
      }
    } catch (e: any) {
      console.error('[Entry-Hub] Like toggle failed:', e);
      setIsLiked(prevLiked);
      setLikeCount(prevCount);
      onError(e?.message || '좋아요 반영에 실패했습니다.');
    }
  };

  const handleToggleBookmark = async () => {
    if (isLocalAsset) return;
    if (!currentUser) {
      onError('마이픽(북마크)에 저장하려면 먼저 로그인해 주세요.');
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
      const { data: rpcData, error: rpcError } = await supabase.rpc('toggle_bookmark', { p_asset_id: asset.id });
      if (!rpcError && rpcData && typeof rpcData.isBookmarked === 'boolean') {
        setIsBookmarked(rpcData.isBookmarked);
        setBookmarkCount(rpcData.bookmarkCount);
        return;
      }

      // 2. RPC 미배포 시 직접 테이블 토글 폴백
      if (nextState) {
        const { error } = await supabase.from('bookmarks').insert({ asset_id: asset.id, user_id: currentUser.id });
        if (error) {
          if (error.code === '23505' || error.message?.includes('duplicate key') || error.message?.includes('bookmarks_pkey')) {
            setIsBookmarked(true);
            const { data: updatedAsset } = await supabase.from('assets').select('bookmark_count').eq('id', asset.id).maybeSingle();
            if (updatedAsset && typeof updatedAsset.bookmark_count === 'number') {
              setBookmarkCount(updatedAsset.bookmark_count);
            }
            return;
          }
          throw error;
        }
      } else {
        const { error } = await supabase.from('bookmarks').delete().eq('asset_id', asset.id).eq('user_id', currentUser.id);
        if (error) throw error;
      }

      // DB 트리거 반영 최신 카운트 동기화
      const { data: updatedAsset } = await supabase.from('assets').select('bookmark_count').eq('id', asset.id).maybeSingle();
      if (updatedAsset && typeof updatedAsset.bookmark_count === 'number') {
        setBookmarkCount(updatedAsset.bookmark_count);
      }
    } catch (e: any) {
      console.error('[Entry-Hub] Bookmark toggle failed:', e);
      setIsBookmarked(prevBookmarked);
      setBookmarkCount(prevCount);
      onError(e?.message || '북마크 반영에 실패했습니다.');
    }
  };


  const handleDelete = async () => {
    if (!confirm(`정말로 "${asset.title}" 에셋을 삭제하시겠습니까?\n삭제 후 복구할 수 없습니다.`)) {
      return;
    }

    setDeleting(true);
    try {
      if (isLocalAsset) {
        deleteLocalAsset(asset.id);
        onSuccess(`"${asset.title}" 로컬 에셋이 삭제되었습니다.`);
      } else {
        const { error } = await supabase.from('assets').delete().eq('id', asset.id);
        if (error) throw error;
        onSuccess(`"${asset.title}" 에셋이 삭제되었습니다.`);
      }
      onClose();
      onDeleted?.();
    } catch (err: any) {
      onError(err?.message || '에셋 삭제 중 오류가 발생했습니다.');
    } finally {
      setDeleting(false);
    }
  };

  const handleInject = async () => {
    setInjecting(true);
    try {
      const isReady = await bridgeAdapter.isEditorReady();
      if (!isReady) {
        throw new Error('엔트리 에디터가 아직 준비되지 않았습니다.');
      }

      await bridgeAdapter.injectAsset(asset.type, asset.data);
      onSuccess(`"${asset.title}" 에셋이 성공적으로 작품에 주입되었습니다!`);
      onClose();
    } catch (err: any) {
      onError(err?.message || '에셋 주입 중 오류가 발생했습니다.');
    } finally {
      setInjecting(false);
    }
  };

  const getTypeBadge = () => {
    switch (asset.type) {
      case 'CODE':
        return { label: '코드', icon: <Code2 size={12} />, color: '#0070f3' };
      case 'OBJECT':
        return { label: '오브젝트', icon: <Box size={12} />, color: '#7928ca' };
      case 'SCENE':
        return { label: '장면', icon: <Layers size={12} />, color: '#ff0080' };
    }
  };

  const typeInfo = getTypeBadge();

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(3px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: colors.canvas,
          borderRadius: '12px',
          width: '100%',
          maxHeight: '90%',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 12px 32px rgba(0,0,0,0.2)',
          border: `1px solid ${colors.hairline}`,
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '14px 16px',
            borderBottom: `1px solid ${colors.hairline}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                padding: '3px 6px',
                borderRadius: '4px',
                backgroundColor: typeInfo.color,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              {typeInfo.icon}
              {typeInfo.label}
            </span>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: colors.ink }}>
              {asset.title}
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: colors.mute,
              padding: 0,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {asset.type !== 'CODE' && (() => {
            const rawData: any = asset.data || {};
            const fallbackPic =
              rawData.selectedPicture ||
              rawData.pictures?.[0] ||
              rawData.objects?.[0]?.selectedPicture ||
              rawData.objects?.[0]?.pictures?.[0];
            const displayImg = formatAssetImageUrl(asset.previewImageUrl) || formatAssetImageUrl(fallbackPic);

            return displayImg ? (
              <div style={{ height: '140px', borderRadius: '8px', overflow: 'hidden', backgroundColor: colors.canvasSoft2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img
                  src={displayImg}
                  alt={asset.title}
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://playentry.org/lib/entry-js/images/media/entrybot_walk1.png';
                  }}
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                />
              </div>
            ) : (
              <div
                style={{
                  height: '100px',
                  backgroundColor: colors.canvasSoft2,
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: colors.mute,
                  fontSize: '12px',
                  gap: '6px',
                }}
              >
                {typeInfo.icon}
                <span>미리보기 이미지 없음</span>
              </div>
            );
          })()}


          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', fontSize: '13px', color: colors.body }}>
              <span>제작자: <strong>{asset.authorName}</strong></span>
              {asset.isOfficialBadge && <ShieldCheck size={14} color="#0070f3" />}
            </div>
            <p style={{ margin: 0, fontSize: '13px', color: colors.body, lineHeight: '1.5' }}>
              {asset.description || '에셋 설명이 없습니다.'}
            </p>

            {asset.tags && asset.tags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '8px' }}>
                {asset.tags.map((t) => (
                  <span
                    key={t}
                    style={{
                      fontSize: '11px',
                      fontWeight: 500,
                      color: colors.ink,
                      backgroundColor: colors.canvasSoft2,
                      padding: '2px 7px',
                      borderRadius: '10px',
                      border: `1px solid ${colors.hairline}`,
                    }}
                  >
                    #{t}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={handleToggleLike}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 10px',
                borderRadius: '6px',
                border: `1px solid ${isLiked ? '#ff4d4d' : colors.hairline}`,
                backgroundColor: isLiked ? '#fff0f0' : colors.canvas,
                color: isLiked ? '#ff4d4d' : colors.body,
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <Heart size={14} fill={isLiked ? '#ff4d4d' : 'none'} color="#ff4d4d" />
              <span>{likeCount}</span>
            </button>

            <button
              type="button"
              onClick={handleToggleBookmark}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 10px',
                borderRadius: '6px',
                border: `1px solid ${isBookmarked ? '#7928ca' : colors.hairline}`,
                backgroundColor: isBookmarked ? '#f6f0ff' : colors.canvas,
                color: isBookmarked ? '#7928ca' : colors.body,
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <Bookmark size={14} fill={isBookmarked ? '#7928ca' : 'none'} color="#7928ca" />
              <span>{bookmarkCount}</span>
            </button>
          </div>


          {/* 에셋 내부 구조 시각화 (코드/모양/소리/장면 인스펙터) */}
          <div style={{ borderTop: `1px solid ${colors.hairline}`, paddingTop: '12px' }}>
            <ExtensionAssetViewer type={asset.type} data={asset.data} />
          </div>
        </div>

        {/* Action Button */}
        <div style={{ padding: '12px 16px', borderTop: `1px solid ${colors.hairline}`, display: 'flex', gap: '8px' }}>
          {(isLocalAsset || currentUser?.id === asset.authorId || currentUser?.entry_user_id === '6a17db19865137773fb9d8c9' || currentUser?.entry_username === 'myentrymy' || currentUser?.email === 'entry_6a17db19865137773fb9d8c9@entry-hub.local' || currentUser?.role === 'ADMIN') && (
            <>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit?.(asset);
                }}
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  backgroundColor: colors.canvas,
                  border: `1px solid ${colors.hairlineStrong}`,
                  color: colors.ink,
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
                title="에셋 수정 및 현재 데이터로 덮어쓰기"
              >
                <Edit3 size={15} />
                <span>수정</span>
              </button>

              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  backgroundColor: '#fff5f5',
                  border: '1px solid #fed7d7',
                  color: '#e53e3e',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
                title="내가 올린 에셋 삭제"
              >
                <Trash2 size={15} />
                <span>{deleting ? '삭제 중...' : '삭제'}</span>
              </button>
            </>
          )}

          <button
            onClick={handleInject}
            disabled={injecting}
            style={{
              flex: 1,
              padding: '10px 16px',
              borderRadius: '8px',
              backgroundColor: colors.primary,
              color: colors.onPrimary,
              border: 'none',
              fontSize: '14px',
              fontWeight: 600,
              cursor: injecting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              opacity: injecting ? 0.7 : 1,
            }}
          >
            {injecting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>주입 중...</span>
              </>
            ) : (
              <>
                <Download size={16} />
                <span>현재 작품으로 불러오기</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
