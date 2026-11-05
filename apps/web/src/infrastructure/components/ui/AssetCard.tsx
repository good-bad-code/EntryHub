'use client';

import React, { useState } from 'react';
import { Heart, Bookmark, Sparkles, ShieldCheck, Code2, Box, Layers, Tag } from 'lucide-react';
import { formatAssetImageUrl } from '@entry-hub/shared';
import { useTheme } from '../../theme/ThemeContext';
import { useRouter } from 'next/navigation';

export interface AssetCardProps {
  id: string;
  title: string;
  description?: string;
  type: 'CODE' | 'OBJECT' | 'SCENE';
  authorName: string;
  isOfficialBadge?: boolean;
  isAdminPick?: boolean;
  tags?: string[];
  likeCount: number;
  bookmarkCount: number;
  previewImageUrl?: string;
  onClick?: () => void;
}

export function AssetCard({
  id,
  title,
  description,
  type,
  authorName,
  isOfficialBadge,
  isAdminPick,
  tags,
  likeCount,
  bookmarkCount,
  previewImageUrl,
  onClick,
}: AssetCardProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const [imgError, setImgError] = useState(false);
  const formattedImageUrl = formatAssetImageUrl(previewImageUrl);

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (id) {
      router.push(`/asset/${id}`);
    }
  };
  const getTypeBadge = () => {
    switch (type) {
      case 'CODE':
        return { label: '코드', icon: <Code2 size={12} />, bg: '#0070f3', text: '#fff' };
      case 'OBJECT':
        return { label: '오브젝트', icon: <Box size={12} />, bg: '#7928ca', text: '#fff' };
      case 'SCENE':
        return { label: '장면', icon: <Layers size={12} />, bg: '#ff0080', text: '#fff' };
    }
  };

  const typeInfo = getTypeBadge();

  return (
    <div
      onClick={handleClick}
      style={{
        border: `1px solid ${colors.hairline}`,
        borderRadius: '12px',
        backgroundColor: colors.canvas,
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Thumbnail Area */}
      <div
        style={{
          height: '160px',
          backgroundColor: colors.canvasSoft2,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {formattedImageUrl && !imgError ? (
          <img
            src={formattedImageUrl}
            alt={title}
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '10px' }}
          />
        ) : (

          <div style={{ color: colors.mute, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            {typeInfo.icon}
            <span style={{ fontSize: '12px' }}>미리보기 이미지</span>
          </div>
        )}

        {/* Type Tag */}
        <div
          style={{
            position: 'absolute',
            top: '12px',
            left: '12px',
            backgroundColor: typeInfo.bg,
            color: typeInfo.text,
            padding: '4px 8px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          {typeInfo.icon}
          <span>{typeInfo.label}</span>
        </div>

        {/* Admin Pick Badge */}
        {isAdminPick && (
          <div
            style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              background: colors.gradientPreview,
              color: '#fff',
              padding: '4px 8px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Sparkles size={12} />
            <span>관리자픽</span>
          </div>
        )}
      </div>

      {/* Body Info */}
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: colors.ink }}>{title}</h3>
        {description && (
          <p
            style={{
              margin: 0,
              fontSize: '13px',
              color: colors.body,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {description}
          </p>
        )}

        {/* Tags */}
        {tags && tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', margin: '2px 0 4px' }}>
            {tags.map((t) => (
              <span
                key={t}
                style={{
                  fontSize: '11px',
                  fontWeight: 500,
                  color: colors.mute,
                  backgroundColor: colors.canvasSoft2,
                  padding: '2px 6px',
                  borderRadius: '10px',
                  border: `1px solid ${colors.hairline}`,
                }}
              >
                #{t}
              </span>
            ))}
          </div>
        )}

        {/* Footer Meta */}
        <div style={{ marginTop: 'auto', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: colors.mute }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span>{authorName}</span>
            {isOfficialBadge && <ShieldCheck size={14} color="#0070f3" />}
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Heart size={14} color="#ff4d4d" /> {likeCount}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Bookmark size={14} color="#7928ca" /> {bookmarkCount}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
