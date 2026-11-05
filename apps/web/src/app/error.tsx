'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { AlertCircle, RotateCcw, Home } from 'lucide-react';
import { colors } from '@entry-hub/shared';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Entry-Hub] Page Error Caught:', error);
  }, [error]);

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
          backgroundColor: '#ff4d4f15',
          border: '1px solid #ff4d4f40',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '24px',
        }}
      >
        <AlertCircle size={36} color="#ff4d4f" />
      </div>

      <h1
        style={{
          fontSize: '28px',
          fontWeight: 700,
          color: colors.ink,
          letterSpacing: '-0.8px',
          margin: '0 0 12px 0',
        }}
      >
        일시적인 오류가 발생했습니다
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
        요청을 처리하는 도중 문제가 발생했습니다. 잠시 후 다시 시도해주시거나, 문제가 지속될 경우 문의해 주세요.
      </p>

      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          onClick={() => reset()}
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
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <RotateCcw size={16} />
          <span>다시 시도</span>
        </button>

        <Link
          href="/"
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
          <Home size={16} />
          <span>홈으로</span>
        </Link>
      </div>
    </div>
  );
}
