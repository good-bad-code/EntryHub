'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, Code2, Sparkles, Flame, FolderKanban, User, LogIn, LogOut, ShieldCheck, Puzzle, Play, Download, ExternalLink, X, Moon, Sun } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { useTheme } from '../../theme/ThemeContext';

export function Header() {
  const { user, profile, loading, isAdmin: authIsAdmin, signOut } = useAuth();
  const { theme, colors, toggleTheme } = useTheme();
  const isAdmin =
    authIsAdmin ||
    profile?.role === 'ADMIN' ||
    (profile?.entry_username || '').toLowerCase() === 'myentrymy' ||
    (profile?.nickname || '').toLowerCase() === 'myentrymy' ||
    (user?.email || '').toLowerCase() === 'myentrymy@entry-hub.local';

  const navLinkStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    textDecoration: 'none',
    color: colors.body,
    fontSize: '14px',
    fontWeight: 500,
    transition: 'color 0.15s ease',
  };

  return (
    <header
      style={{
        borderBottom: `1px solid ${colors.hairline}`,
        backgroundColor: colors.canvas,
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backdropFilter: 'blur(8px)',
      }}
    >
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '0 24px',
          height: '64px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Brand Logo */}
        <Link
          href="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            textDecoration: 'none',
            color: colors.ink,
            fontWeight: 700,
            fontSize: '20px',
            letterSpacing: '-0.8px',
          }}
        >
          <img
            src="/icon.png"
            alt="Entry-Hub Logo"
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '8px',
              objectFit: 'cover',
              transition: 'transform 0.2s ease',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLImageElement).style.transform = 'scale(1.08)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLImageElement).style.transform = 'scale(1)';
            }}
          />
          <span>
            Entry<span style={{ background: colors.gradientDevelop, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>-Hub</span>
          </span>
        </Link>

        {/* Navigation Links */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <Link href="/list" style={navLinkStyle}>
            <Search size={16} />
            <span>탐색</span>
          </Link>
          <Link href="/list/adminpick" style={navLinkStyle}>
            <Sparkles size={16} color="#7928ca" />
            <span>관리자픽</span>
          </Link>
          <Link href="/list/popular" style={navLinkStyle}>
            <Flame size={16} color="#ff4d4d" />
            <span>인기</span>
          </Link>
          <Link href="/category" style={navLinkStyle}>
            <FolderKanban size={16} />
            <span>카테고리</span>
          </Link>
        </nav>

        {/* Auth / Profile & Theme Section */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* 다크모드 토글 버튼 */}
          <button
            onClick={toggleTheme}
            style={{
              background: 'none',
              border: `1px solid ${colors.hairline}`,
              backgroundColor: colors.canvasSoft2,
              color: colors.ink,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '34px',
              height: '34px',
              borderRadius: '8px',
              transition: 'all 0.15s ease',
            }}
            title={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={17} color="#f5a623" /> : <Moon size={17} color={colors.ink} />}
          </button>

          {loading ? (
            <div style={{ width: '80px', height: '36px', backgroundColor: colors.canvasSoft2, borderRadius: '6px' }} />
          ) : user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {isAdmin && (
                <Link
                  href="/admin"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    backgroundColor: '#f5f3ff',
                    border: '1px solid #ddd6fe',
                    color: '#7c3aed',
                    fontSize: '13px',
                    fontWeight: 700,
                    textDecoration: 'none',
                    transition: 'background-color 0.15s ease',
                  }}
                  title="관리자 대시보드"
                >
                  <ShieldCheck size={15} color="#7c3aed" />
                  <span>관리자</span>
                </Link>
              )}

              <Link
                href={`/profile/${user.id}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  textDecoration: 'none',
                  color: colors.ink,
                  fontSize: '14px',
                  fontWeight: 500,
                  padding: '6px 10px',
                  borderRadius: '6px',
                  transition: 'background-color 0.15s ease',
                }}
              >
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    backgroundColor: colors.canvasSoft2,
                    border: `1px solid ${colors.hairlineStrong}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}
                >
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <User size={16} color={colors.mute} />
                  )}
                </div>
                <span>{profile?.nickname || user.email?.split('@')[0]}</span>
              </Link>

              <button
                onClick={() => signOut()}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '6px 10px',
                  color: colors.mute,
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
                title="로그아웃"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <>
              <Link
                href="/login"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: `1px solid ${colors.hairlineStrong}`,
                  color: colors.ink,
                  textDecoration: 'none',
                  fontSize: '14px',
                  fontWeight: 500,
                  backgroundColor: colors.canvas,
                  transition: 'all 0.15s ease',
                }}
              >
                <LogIn size={16} />
                <span>로그인</span>
              </Link>

              <Link
                href="/register"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  backgroundColor: colors.primary,
                  color: colors.onPrimary,
                  textDecoration: 'none',
                  fontSize: '14px',
                  fontWeight: 500,
                }}
              >
                <span>회원가입</span>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
