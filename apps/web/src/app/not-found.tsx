import React from 'react';
import Link from 'next/link';
import { FileQuestion, Home, Search } from 'lucide-react';
import { colors } from '@entry-hub/shared';

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: '65vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: '72px',
          height: '72px',
          borderRadius: '50%',
          backgroundColor: colors.canvasSoft2,
          border: `1px solid ${colors.hairline}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '24px',
        }}
      >
        <FileQuestion size={36} color={colors.mute} />
      </div>

      <h1
        style={{
          fontSize: '32px',
          fontWeight: 700,
          color: colors.ink,
          letterSpacing: '-1px',
          margin: '0 0 12px 0',
        }}
      >
        페이지를 찾을 수 없습니다
      </h1>

      <p
        style={{
          fontSize: '15px',
          color: colors.mute,
          maxWidth: '460px',
          lineHeight: 1.6,
          margin: '0 0 32px 0',
        }}
      >
        요청하신 페이지가 삭제되었거나, 주소가 잘못 입력되었을 수 있습니다.
        에셋 ID가 올바른지 다시 한 번 확인해주세요.
      </p>

      <div style={{ display: 'flex', gap: '12px' }}>
        <Link
          href="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            borderRadius: '8px',
            backgroundColor: colors.ink,
            color: colors.canvas,
            fontSize: '14px',
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          <Home size={16} />
          <span>홈으로 이동</span>
        </Link>

        <Link
          href="/list"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            borderRadius: '8px',
            backgroundColor: colors.canvasSoft,
            border: `1px solid ${colors.hairline}`,
            color: colors.ink,
            fontSize: '14px',
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          <Search size={16} />
          <span>에셋 둘러보기</span>
        </Link>
      </div>
    </div>
  );
}
