'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Header } from '../../infrastructure/components/layout/Header';
import { Footer } from '../../infrastructure/components/layout/Footer';
import { useTheme } from '../../infrastructure/theme/ThemeContext';
import { useAuth } from '../../infrastructure/auth/AuthContext';
import { supabase } from '../../infrastructure/supabase/client';
import {
  LogIn,
  ArrowRight,
  AlertCircle,
  Loader2,
  ShieldCheck,
  ExternalLink,
  KeyRound,
  User,
} from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { colors } = useTheme();
  const { signIn, user } = useAuth();

  // 로그인 탭: 'ENTRY_AUTH' (엔트리 인증) | 'PASSWORD' (아이디/비번)
  const [activeTab, setActiveTab] = useState<'ENTRY_AUTH' | 'PASSWORD'>('ENTRY_AUTH');

  // 아이디/비번 로그인 상태
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // 엔트리 간편 인증 로그인 상태
  const [entryLoginStep, setEntryLoginStep] = useState<'IDLE' | 'WAITING'>('IDLE');
  const [verificationCode, setVerificationCode] = useState('');
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // 이미 로그인되어 있으면 메인 이동
  useEffect(() => {
    if (user) {
      router.push('/');
    }
  }, [user, router]);

  // 엔트리 인증으로 로그인 시작
  const handleStartEntryLogin = async () => {
    setErrorMsg(null);
    setIsLoading(true);

    try {
      const code = `EH-LOG-${Math.floor(1000 + Math.random() * 9000)}`;
      setVerificationCode(code);

      // 1. entry_verifications 테이블에 LOGIN 요청 등록
      const { data, error } = await supabase
        .from('entry_verifications')
        .insert({
          code,
          entry_username: 'ALL',
          verification_type: 'LOGIN',
          status: 'PENDING',
        })
        .select('id')
        .single();

      if (error || !data) {
        throw new Error(error?.message || '로그인 인증 요청 생성에 실패했습니다.');
      }

      const vId = data.id;
      setEntryLoginStep('WAITING');

      // 2. 엔트리 메인 홈 페이지 새 탭 오픈
      window.open('https://playentry.org?entry_hub_action=login', '_blank');

      // 3. 2초 간격으로 승인 여부 폴링
      startPolling(vId);
    } catch (err: any) {
      setErrorMsg(err.message || '엔트리 인증 요청 중 문제가 발생했습니다.');
      setEntryLoginStep('IDLE');
    } finally {
      setIsLoading(false);
    }
  };

  const startPolling = (vId: string) => {
    if (pollingRef.current) clearInterval(pollingRef.current);

    pollingRef.current = setInterval(async () => {
      try {
        const { data, error } = await supabase
          .from('entry_verifications')
          .select('status')
          .eq('id', vId)
          .single();

        if (error || !data) return;

        if (data.status === 'VERIFIED') {
          if (pollingRef.current) clearInterval(pollingRef.current);
          completeEntryLogin(vId);
        } else if (data.status === 'EXPIRED') {
          if (pollingRef.current) clearInterval(pollingRef.current);
          setErrorMsg('인증 요청이 취소되었거나 만료되었습니다.');
          setEntryLoginStep('IDLE');
        }
      } catch (e) {
        console.warn('Polling error:', e);
      }
    }, 2000);
  };

  const completeEntryLogin = async (vId: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc('process_entry_auth_verification', {
        p_verification_id: vId,
      });

      if (error || !data?.success) {
        throw new Error(error?.message || data?.message || '로그인 처리에 실패했습니다.');
      }

      if (data.email && data.temp_password) {
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: data.email,
          password: data.temp_password,
        });

        if (signInErr) {
          throw signInErr;
        }

        router.push('/');
      }
    } catch (err: any) {
      setErrorMsg(err.message || '로그인 처리 중 오류가 발생했습니다.');
      setEntryLoginStep('IDLE');
    } finally {
      setIsLoading(false);
    }
  };

  // 아이디/비밀번호 로그인 제출
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier || !password) {
      setErrorMsg('아이디와 비밀번호를 모두 입력해 주세요.');
      return;
    }

    setErrorMsg(null);
    setIsLoading(true);

    try {
      const { error } = await signIn(identifier.trim(), password);
      if (error) {
        setErrorMsg(
          error.message === 'Invalid login credentials'
            ? '아이디 또는 비밀번호가 올바르지 않습니다.'
            : error.message
        );
      } else {
        router.push('/');
      }
    } catch {
      setErrorMsg('로그인 중 문제가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: colors.canvasSoft }}>
      <Header />

      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
        <div
          style={{
            maxWidth: '440px',
            width: '100%',
            backgroundColor: colors.canvas,
            borderRadius: '16px',
            border: `1px solid ${colors.hairline}`,
            boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
            padding: '36px 32px',
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <h1
              style={{
                margin: '0 0 8px',
                fontSize: '24px',
                fontWeight: 800,
                color: colors.ink,
                letterSpacing: '-0.5px',
              }}
            >
              로그인
            </h1>
            <p style={{ margin: 0, fontSize: '14px', color: colors.mute }}>
              엔트리 인증 또는 설정한 아이디로 로그인하세요.
            </p>
          </div>

          {/* 탭 네비게이션 */}
          <div
            style={{
              display: 'flex',
              backgroundColor: colors.canvasSoft2,
              borderRadius: '8px',
              padding: '4px',
              marginBottom: '24px',
            }}
          >
            <button
              type="button"
              onClick={() => {
                setActiveTab('ENTRY_AUTH');
                setErrorMsg(null);
              }}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: activeTab === 'ENTRY_AUTH' ? colors.canvas : 'transparent',
                color: activeTab === 'ENTRY_AUTH' ? colors.ink : colors.mute,
                fontWeight: activeTab === 'ENTRY_AUTH' ? 700 : 500,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                boxShadow: activeTab === 'ENTRY_AUTH' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              <ShieldCheck size={15} color={activeTab === 'ENTRY_AUTH' ? colors.primary : undefined} />
              <span>엔트리 인증 로그인</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('PASSWORD');
                setErrorMsg(null);
              }}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: activeTab === 'PASSWORD' ? colors.canvas : 'transparent',
                color: activeTab === 'PASSWORD' ? colors.ink : colors.mute,
                fontWeight: activeTab === 'PASSWORD' ? 700 : 500,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                boxShadow: activeTab === 'PASSWORD' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              <KeyRound size={15} color={activeTab === 'PASSWORD' ? colors.primary : undefined} />
              <span>아이디 / 비밀번호</span>
            </button>
          </div>

          {errorMsg && (
            <div
              style={{
                padding: '12px 14px',
                backgroundColor: '#fef2f2',
                border: '1px solid #fee2e2',
                borderRadius: '8px',
                color: '#ef4444',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '20px',
              }}
            >
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* TAB 1: 엔트리 간편 인증 로그인 */}
          {activeTab === 'ENTRY_AUTH' && (
            <div>
              {entryLoginStep === 'IDLE' ? (
                <div>
                  <div
                    style={{
                      backgroundColor: colors.canvasSoft2,
                      borderRadius: '10px',
                      padding: '16px',
                      marginBottom: '20px',
                      border: `1px solid ${colors.hairline}`,
                      fontSize: '13px',
                      color: colors.ink,
                      lineHeight: 1.5,
                    }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: '4px' }}>비밀번호 없이 1초 로그인</div>
                    <div style={{ color: colors.mute, fontSize: '12px' }}>
                      브라우저에 엔트리가 로그인되어 있다면, 확장 프로그램을 통해 별도의 비밀번호 없이 즉시 로그인할 수 있습니다.
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleStartEntryLogin}
                    disabled={isLoading}
                    style={{
                      width: '100%',
                      padding: '14px',
                      borderRadius: '10px',
                      border: 'none',
                      backgroundColor: colors.primary,
                      color: colors.onPrimary,
                      fontSize: '15px',
                      fontWeight: 700,
                      cursor: isLoading ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 12px rgba(0, 112, 243, 0.25)',
                    }}
                  >
                    {isLoading ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
                    <span>엔트리 인증으로 로그인</span>
                  </button>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '10px 0' }}>
                  <Loader2 size={36} className="animate-spin" color={colors.primary} style={{ margin: '0 auto 16px' }} />
                  <div style={{ fontSize: '16px', fontWeight: 700, color: colors.ink, marginBottom: '6px' }}>
                    엔트리 창에서 로그인을 승인해 주세요
                  </div>
                  <div style={{ fontSize: '13px', color: colors.mute, marginBottom: '20px', lineHeight: 1.5 }}>
                    열린 엔트리 화면에서 <strong>[확인 및 로그인]</strong>을 클릭하면 자동으로 로그인이 완료됩니다.
                  </div>

                  <div
                    style={{
                      backgroundColor: colors.canvasSoft2,
                      borderRadius: '8px',
                      padding: '10px',
                      fontSize: '12px',
                      color: colors.mute,
                      marginBottom: '20px',
                    }}
                  >
                    인증 코드: <strong style={{ color: colors.primary }}>{verificationCode}</strong>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                    <button
                      type="button"
                      onClick={() => window.open('https://playentry.org?entry_hub_action=login', '_blank')}
                      style={{
                        padding: '8px 14px',
                        borderRadius: '6px',
                        border: `1px solid ${colors.hairlineStrong}`,
                        backgroundColor: colors.canvas,
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <ExternalLink size={13} />
                      <span>엔트리 창 다시 열기</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (pollingRef.current) clearInterval(pollingRef.current);
                        setEntryLoginStep('IDLE');
                      }}
                      style={{
                        padding: '8px 14px',
                        borderRadius: '6px',
                        border: 'none',
                        backgroundColor: colors.canvasSoft2,
                        fontSize: '12px',
                        cursor: 'pointer',
                        color: colors.mute,
                      }}
                    >
                      취소
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: 아이디 / 비밀번호 로그인 */}
          {activeTab === 'PASSWORD' && (
            <form onSubmit={handlePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: colors.ink, marginBottom: '6px' }}>
                  아이디
                </label>
                <div style={{ position: 'relative' }}>
                  <User size={16} color={colors.mute} style={{ position: 'absolute', left: '12px', top: '13px' }} />
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="아이디 입력 (소셜 회원은 아이디@entry)"
                    disabled={isLoading}
                    style={{
                      width: '100%',
                      padding: '11px 12px 11px 36px',
                      borderRadius: '8px',
                      border: `1px solid ${colors.hairlineStrong}`,
                      backgroundColor: colors.canvasSoft,
                      color: colors.ink,
                      fontSize: '14px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: colors.ink }}>
                    비밀번호
                  </label>
                  <Link
                    href="/reset-password"
                    style={{ fontSize: '12px', color: colors.primary, textDecoration: 'none' }}
                  >
                    비밀번호 찾기
                  </Link>
                </div>
                <div style={{ position: 'relative' }}>
                  <KeyRound size={16} color={colors.mute} style={{ position: 'absolute', left: '12px', top: '13px' }} />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="설정한 비밀번호 입력"
                    disabled={isLoading}
                    style={{
                      width: '100%',
                      padding: '11px 12px 11px 36px',
                      borderRadius: '8px',
                      border: `1px solid ${colors.hairlineStrong}`,
                      backgroundColor: colors.canvasSoft,
                      color: colors.ink,
                      fontSize: '14px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: colors.primary,
                  color: colors.onPrimary,
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  marginTop: '8px',
                  boxShadow: '0 2px 8px rgba(0, 112, 243, 0.25)',
                }}
              >
                {isLoading ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
                <span>로그인</span>
              </button>
            </form>
          )}

          <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '13px', color: colors.mute }}>
            아직 계정이 없으신가요?{' '}
            <Link href="/register" style={{ color: colors.primary, fontWeight: 600, textDecoration: 'none' }}>
              엔트리로 회원가입
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
