'use client';

import React from 'react';
import { X, Heart, Bookmark, ShieldCheck, Download, Sparkles } from 'lucide-react';
import { colors, formatAssetImageUrl } from '@entry-hub/shared';
import { EntryAssetViewer } from './EntryAssetViewer';

export interface AssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: {
    id: string;
    title: string;
    description?: string;
    type: 'CODE' | 'OBJECT' | 'SCENE';
    authorName: string;
    isOfficialBadge?: boolean;
    isAdminPick?: boolean;
    likeCount: number;
    bookmarkCount: number;
    previewImageUrl?: string;
    data: Record<string, unknown>;
  } | null;
}

export function AssetModal({ isOpen, onClose, asset }: AssetModalProps) {
  if (!isOpen || !asset) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: colors.canvas,
          borderRadius: '16px',
          maxWidth: '720px',
          width: '100%',
          overflow: 'hidden',
          border: `1px solid ${colors.hairline}`,
          boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${colors.hairline}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, padding: '4px 8px', borderRadius: '6px', backgroundColor: colors.canvasSoft2 }}>
              {asset.type}
            </span>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600 }}>{asset.title}</h2>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: colors.mute }}>
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Preview Image */}
          <div style={{ width: '100%', height: '240px', backgroundColor: colors.canvasSoft2, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            {asset.previewImageUrl ? (
              <img
                src={formatAssetImageUrl(asset.previewImageUrl)}
                alt={asset.title}
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://playentry.org/lib/entry-js/images/media/entrybot_walk1.png';
                }}
                style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '16px' }}
              />

            ) : (
              <span style={{ color: colors.mute, fontSize: '14px' }}>미리보기 프리뷰 데이터</span>
            )}
          </div>

          {/* Description & Author */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', fontSize: '14px', color: colors.body }}>
              <span>제작자: <strong>{asset.authorName}</strong></span>
              {asset.isOfficialBadge && <ShieldCheck size={16} color="#0070f3" />}
            </div>
            <p style={{ margin: 0, fontSize: '15px', color: colors.body, lineHeight: '1.6' }}>
              {asset.description || '소개가 작성되지 않은 에셋입니다.'}
            </p>
          </div>

          {/* 에셋 내부 구조 시각화 */}
          {asset.data && (
            <div style={{ borderTop: `1px solid ${colors.hairline}`, paddingTop: '16px' }}>
              <EntryAssetViewer type={asset.type} data={asset.data} />
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
            <button style={actionBtnStyle}>
              <Heart size={18} color="#ff4d4d" />
              <span>좋아요 ({asset.likeCount})</span>
            </button>
            <button style={actionBtnStyle}>
              <Bookmark size={18} color="#7928ca" />
              <span>북마크 ({asset.bookmarkCount})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const actionBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '10px 16px',
  borderRadius: '8px',
  border: `1px solid ${colors.hairline}`,
  backgroundColor: colors.canvas,
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: 500,
};
