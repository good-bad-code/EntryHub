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
  ShieldCheck,
  CheckCircle2,
  Loader2,
  ExternalLink,
  Sparkles,
  ArrowRight,
  Puzzle,
  UserCheck,
  AlertCircle,
} from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();

  // 확장프로그램 설치 여부 감지
  const [isExtInstalled, setIsExtInstalled] = useState<boolean | null>(null);

  // 회원가입 진행 단계: 'GUIDE' | 'WAITING_ENTRY' | 'SUCCESS'
  const [step, setStep] = useState<'GUIDE' | 'WAITING_ENTRY' | 'SUCCESS'>('GUIDE');
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [registeredUserInfo, setRegisteredUserInfo] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // 폴링 인터벌 참조
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // 이미 로그인된 상태라면 메인으로 리디렉트
  useEffect(() => {
    if (user && step !== 'SUCCESS') {
      router.push('/');
    }
  }, [user, router, step]);

  // 확장프로그램 설치 여부 감지 (비콘 + DOM 속성 검사)
  useEffect(() => {
    const checkExt = () => {
      const hasAttr = document.documentElement.getAttribute('data-entry-hub-installed') === 'true';
      if (hasAttr) {
        setIsExtInstalled(true);
        return;
      }

      window.postMessage({ type: 'CHECK_ENTRY_HUB_INSTALLED' }, '*');
    };

    const handleMsg = (e: MessageEvent) => {
      if (e.data?.type === 'ENTRY_HUB_EXTENSION_INSTALLED' || e.data?.type === 'ENTRY_HUB_EXTENSION_PONG') {
        setIsExtInstalled(true);
      }
    };

    window.addEventListener('message', handleMsg);
    checkExt();

    // 1.5초 후에도 응답 없으면 미설치로 간주
    const timer = setTimeout(() => {
      setIsExtInstalled((prev) => (prev === null ? false : prev));
    }, 1500);

    return () => {
      window.removeEventListener('message', handleMsg);
      clearTimeout(timer);
    };
  }, []);

  // [엔트리로 회원가입] 시작 버튼 클릭
  const handleStartEntryRegister = async () => {
    setErrorMsg(null);
    setIsLoading(true);

    try {
      const code = `EH-REG-${Math.floor(1000 + Math.random() * 9000)}`;
      setVerificationCode(code);

      // 1. entry_verifications 테이블에 REGISTER 요청 등록
      const { data, error } = await supabase
        .from('entry_verifications')
        .insert({
          code,
          entry_username: 'ALL', // 엔트리 로그인된 누구든 매칭
          verification_type: 'REGISTER',
          status: 'PENDING',
        })
        .select('id')
        .single();

      if (error || !data) {
        throw new Error(error?.message || '인증 요청 생성에 실패했습니다.');
      }

      const vId = data.id;
      setVerificationId(vId);
      setStep('WAITING_ENTRY');

      // 2. 엔트리 메인 홈 페이지 새 탭 오픈
      window.open('https://playentry.org?entry_hub_action=signup', '_blank');

      // 3. 2초 간격으로 인증 완료 여부 폴링
      startPolling(vId);
    } catch (err: any) {
      setErrorMsg(err.message || '회원가입 요청 중 오류가 발생했습니다.');
      setStep('GUIDE');
    } finally {
      setIsLoading(false);
    }
  };

  // 엔트리 탭에서 확프 승인 완료 여부 확인
  const startPolling = (vId: string) => {
    if (pollingRef.current) clearInterval(pollingRef.current);

    pollingRef.current = setInterval(async () => {
      try {
        const { data, error } = await supabase
          .from('entry_verifications')
          .select('status, entry_username, entry_user_id, nickname')
          .eq('id', vId)
          .single();

        if (error || !data) return;

        // VERIFIED 상태 감지 -> 백엔드 RPC로 계정 생성 및 1회용 자동 로그인 수행
        if (data.status === 'VERIFIED') {
          if (pollingRef.current) clearInterval(pollingRef.current);
          completeRegistration(vId);
        } else if (data.status === 'EXPIRED') {
          if (pollingRef.current) clearInterval(pollingRef.current);
          setErrorMsg('인증 요청이 취소되었거나 만료되었습니다. 다시 시도해 주세요.');
          setStep('GUIDE');
        }
      } catch (e) {
        console.warn('Polling error:', e);
      }
    }, 2000);
  };

  // 회원가입 완료 및 자동 로그인 처리
  const completeRegistration = async (vId: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc('process_entry_auth_verification', {
        p_verification_id: vId,
      });

      if (error || !data?.success) {
        throw new Error(error?.message || data?.message || '계정 생성 처리에 실패했습니다.');
      }

      setRegisteredUserInfo(data);

      // 임시 비밀번호로 즉시 자동 로그인
      if (data.email && data.temp_password) {
        await supabase.auth.signInWithPassword({
          email: data.email,
          password: data.temp_password,
        });
      }

      setStep('SUCCESS');
    } catch (err: any) {
      setErrorMsg(err.message || '회원가입 완료 처리 중 오류가 발생했습니다.');
      setStep('GUIDE');
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
            maxWidth: '520px',
            width: '100%',
            backgroundColor: colors.canvas,
            borderRadius: '16px',
            border: `1px solid ${colors.hairline}`,
            boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
            padding: '40px 32px',
          }}
        >
          {/* STEP 1: 가이드 및 회원가입 시작 */}
          {step === 'GUIDE' && (
            <div>
              <div style={{ textAlign: 'center', marginBottom: '28px' }}>
                <div
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    backgroundColor: `${colors.primary}15`,
                    color: colors.primary,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 16px',
                  }}
                >
                  <ShieldCheck size={32} />
                </div>
                <h1 style={{ margin: '0 0 8px', fontSize: '24px', fontWeight: 800, color: colors.ink }}>
                  엔트리로 회원가입
                </h1>
                <p style={{ margin: 0, fontSize: '14px', color: colors.mute, lineHeight: 1.5 }}>
                  Entry-Hub는 안전한 이용을 위해 엔트리 공식 계정으로만 가입할 수 있습니다.
                </p>
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

              {/* 진행 순서 안내 박스 */}
              <div
                style={{
                  backgroundColor: colors.canvasSoft2,
                  borderRadius: '12px',
                  padding: '18px 20px',
                  marginBottom: '24px',
                  border: `1px solid ${colors.hairline}`,
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: 700, color: colors.ink, marginBottom: '14px' }}>
                  가입 진행 방법 (간편 3단계)
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <div
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        backgroundColor: colors.primary,
                        color: colors.onPrimary,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      1
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: colors.ink }}>
                        Entry-Hub 확장 프로그램 확인
                      </div>
                      <div style={{ fontSize: '12px', color: colors.mute, marginTop: '2px' }}>
                        브라우저에 Entry-Hub 확장 프로그램이 설치되어 있어야 합니다.
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <div
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        backgroundColor: colors.primary,
                        color: colors.onPrimary,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      2
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: colors.ink }}>
                        [엔트리로 회원가입] 버튼 클릭
                      </div>
                      <div style={{ fontSize: '12px', color: colors.mute, marginTop: '2px' }}>
                        새 탭으로 엔트리 페이지가 열리며 내 계정 확인 팝업이 표시됩니다.
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <div
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        backgroundColor: colors.primary,
                        color: colors.onPrimary,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      3
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: colors.ink }}>
                        약관 동의 및 계정 생성 완료
                      </div>
                      <div style={{ fontSize: '12px', color: colors.mute, marginTop: '2px' }}>
                        엔트리 팝업에서 약관에 동의하고 승인을 누르면 즉시 가입 및 자동 로그인됩니다.
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 확프 미설치 경고 배너 */}
              {isExtInstalled === false && (
                <div
                  style={{
                    backgroundColor: '#fffbeb',
                    border: '1px solid #fef3c7',
                    borderRadius: '8px',
                    padding: '12px 14px',
                    marginBottom: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                  }}
                >
                  <Puzzle size={18} color="#d97706" />
                  <div style={{ fontSize: '12px', color: '#92400e', lineHeight: 1.4 }}>
                    확장 프로그램이 감지되지 않았습니다. 크롬 브라우저에 Entry-Hub 확장 프로그램을 설치 후 진행해 주세요.
                  </div>
                </div>
              )}

              {/* 엔트리로 회원가입 버튼 */}
              <button
                type="button"
                onClick={handleStartEntryRegister}
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
                  transition: 'all 0.15s ease',
                }}
              >
                {isLoading ? <Loader2 size={18} className="animate-spin" /> : <ExternalLink size={18} />}
                <span>엔트리로 회원가입 시작하기</span>
              </button>

              <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px', color: colors.mute }}>
                이미 계정이 있으신가요?{' '}
                <Link href="/login" style={{ color: colors.primary, fontWeight: 600, textDecoration: 'none' }}>
                  로그인하기
                </Link>
              </div>
            </div>
          )}

          {/* STEP 2: 엔트리 탭 승인 대기 화면 */}
          {step === 'WAITING_ENTRY' && (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  backgroundColor: `${colors.primary}15`,
                  color: colors.primary,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 20px',
                }}
              >
                <Loader2 size={32} className="animate-spin" />
              </div>

              <h2 style={{ margin: '0 0 10px', fontSize: '20px', fontWeight: 800, color: colors.ink }}>
                엔트리 화면에서 승인해 주세요
              </h2>

              <p style={{ margin: '0 0 24px', fontSize: '14px', color: colors.mute, lineHeight: 1.6 }}>
                방금 열린 <strong>엔트리 탭</strong> 화면 중앙에 <strong>Entry-Hub 회원가입 팝업</strong>이 표시됩니다.<br />
                약관에 동의하고 <strong>[동의 및 계정 생성]</strong> 버튼을 눌러주세요.
              </p>

              <div
                style={{
                  backgroundColor: colors.canvasSoft2,
                  borderRadius: '10px',
                  padding: '14px',
                  border: `1px dashed ${colors.hairlineStrong}`,
                  marginBottom: '24px',
                }}
              >
                <div style={{ fontSize: '11px', color: colors.mute, marginBottom: '4px' }}>인증 식별 코드</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: colors.primary, letterSpacing: '1px' }}>
                  {verificationCode}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                <button
                  type="button"
                  onClick={() => {
                    window.open('https://playentry.org?entry_hub_action=signup', '_blank');
                  }}
                  style={{
                    padding: '10px 18px',
                    borderRadius: '8px',
                    border: `1px solid ${colors.hairlineStrong}`,
                    backgroundColor: colors.canvas,
                    color: colors.ink,
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <ExternalLink size={14} />
                  <span>엔트리 창 다시 열기</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (pollingRef.current) clearInterval(pollingRef.current);
                    setStep('GUIDE');
                  }}
                  style={{
                    padding: '10px 18px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: colors.canvasSoft2,
                    color: colors.mute,
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  취소
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: 회원가입 축하 및 자동 로그인 완료 */}
          {step === 'SUCCESS' && (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div
                style={{
                  width: '68px',
                  height: '68px',
                  borderRadius: '50%',
                  backgroundColor: '#e6f7ed',
                  color: '#00b400',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 20px',
                }}
              >
                <Sparkles size={36} />
              </div>

              <h2 style={{ margin: '0 0 10px', fontSize: '22px', fontWeight: 800, color: colors.ink }}>
                회원가입을 진심으로 축하합니다!
              </h2>

              <p style={{ margin: '0 0 24px', fontSize: '14px', color: colors.mute, lineHeight: 1.6 }}>
                <strong>{registeredUserInfo?.nickname || '회원'}</strong>님의 엔트리 계정 고유번호로 안전하게 가입되었습니다.<br />
                지금부터 Entry-Hub의 모든 에셋을 자유롭게 공유하고 사용할 수 있습니다.
              </p>

              {/* 안내 카드 */}
              <div
                style={{
                  backgroundColor: colors.canvasSoft2,
                  borderRadius: '12px',
                  padding: '16px 18px',
                  textAlign: 'left',
                  marginBottom: '28px',
                  border: `1px solid ${colors.hairline}`,
                  fontSize: '13px',
                  color: colors.ink,
                  lineHeight: 1.6,
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <UserCheck size={16} color={colors.primary} />
                  <span>아이디 및 비밀번호 설정 안내</span>
                </div>
                <div style={{ color: colors.mute, fontSize: '12px' }}>
                  아이디와 비밀번호는 아직 설정되지 않은 상태입니다.<br />
                  언제든지 <strong>[마이페이지]</strong>에서 엔트리 인증을 통해 아이디를 등록하고 비밀번호를 설정하여 아이디/비밀번호로 로그인할 수 있습니다.
                </div>
              </div>

              <button
                type="button"
                onClick={() => router.push('/')}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: colors.primary,
                  color: colors.onPrimary,
                  fontSize: '15px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 12px rgba(0, 112, 243, 0.25)',
                }}
              >
                <span>Entry-Hub 시작하기</span>
                <ArrowRight size={18} />
              </button>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
