'use client';

import React from 'react';
import Link from 'next/link';
import { useTheme } from '../../theme/ThemeContext';

export function Footer() {
  const { colors } = useTheme();

  return (
    <footer
      style={{
        borderTop: `1px solid ${colors.hairline}`,
        backgroundColor: colors.canvas,
        padding: '40px 24px',
        marginTop: '80px',
        transition: 'background-color 0.2s ease, border-color 0.2s ease',
      }}
    >
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', gap: '24px', fontSize: '14px', color: colors.mute }}>
          <Link href="/terms" style={{ textDecoration: 'none', color: colors.body }}>
            이용약관
          </Link>
          <Link href="/privacy" style={{ textDecoration: 'none', color: colors.body }}>
            개인정보 처리방침
          </Link>
          <a
            href="https://playentry.org"
            target="_blank"
            rel="noreferrer"
            style={{ textDecoration: 'none', color: colors.body }}
          >
            엔트리 공식 사이트
          </a>
        </div>

        <p style={{ margin: 0, fontSize: '13px', color: colors.mute }}>
          © 2026 Entry-Hub Platform. All rights reserved. Not affiliated directly with Entry Labs.
        </p>
      </div>
    </footer>
  );
}
