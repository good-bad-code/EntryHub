'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Header } from '../../infrastructure/components/layout/Header';
import { Footer } from '../../infrastructure/components/layout/Footer';
import { useTheme } from '../../infrastructure/theme/ThemeContext';
import { supabase } from '../../infrastructure/supabase/client';
import {
  KeyRound,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ExternalLink,
  X,
  ArrowLeft,
  Lock,
} from 'lucide-react';

export default function ResetPasswordPage() {
  const router = useRouter();
  const { colors } = useTheme();

  const [entryUsername, setEntryUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // 엔트리 소유권 인증 모달 상태
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationId, setVerificationId] = useState<string | null>(null);

  // URL 쿼리 파라미터 또는 로그인 유저의 entry_username 자동 주입
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const queryUsername = params.get('username');
      if (queryUsername) {
        setEntryUsername(queryUsername.trim());
        return;
      }
    }

    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.id) {
        supabase
          .from('users')
          .select('entry_username')
          .eq('id', data.user.id)
          .maybeSingle()
          .then(({ data: profile }) => {
            if (profile?.entry_username) {
              setEntryUsername(profile.entry_username.trim());
            }
          });
      }
    });
  }, []);

  // 1. 비밀번호 재설정 인증 시작
  const handleStartReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!entryUsername.trim()) {
      setErrorMsg('엔트리 실제 아이디를 입력해 주세요.');
      return;
    }
    if (newPassword.length < 6) {
      setErrorMsg('새 비밀번호는 최소 6자 이상이어야 합니다.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('새 비밀번호와 비밀번호 확인이 일치하지 않습니다.');
      return;
    }

    setIsLoading(true);

    try {
      // 해당 엔트리 아이디로 가입된 유저가 있는지 확인
      const { data: existingUser, error: searchError } = await supabase
        .from('users')
        .select('id, entry_username')
        .ilike('entry_username', entryUsername.trim())
        .maybeSingle();

      if (searchError) throw searchError;

      if (!existingUser) {
        setErrorMsg('해당 엔트리 아이디로 가입된 회원을 찾을 수 없습니다. 아이디를 다시 확인해 주세요.');
        setIsLoading(false);
        return;
      }

      // 인증 코드 생성 및 DB 등록
      const code = `EH-${Math.floor(1000 + Math.random() * 9000)}`;
      setVerificationCode(code);

      const { data, error } = await supabase
        .from('entry_verifications')
        .insert({
          code,
          entry_username: entryUsername.trim(),
          status: 'PENDING',
        })
        .select()
        .single();

      if (error) throw error;

      setVerificationId(data.id);
      setIsVerifying(true);
    } catch (err: any) {
      setErrorMsg(err?.message || '인증 요청 생성 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 2. 인증 모달 오픈 시 실시간 상태 감지 (폴링)
  useEffect(() => {
    if (!isVerifying || !verificationId) return;

    let timer: NodeJS.Timeout;

    const checkStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('entry_verifications')
          .select('status')
          .eq('id', verificationId)
          .single();

        if (error) return;

        if (data?.status === 'EXPIRED') {
          setIsVerifying(false);
          setIsLoading(false);
          setErrorMsg('엔트리 페이지에서 인증 요청이 거부되었거나 만료되었습니다.');
          return;
        }

        if (data?.status === 'VERIFIED') {
          // 인증 완료! RPC 함수 호출하여 비밀번호 재설정 실행
          setIsVerifying(false);
          setIsLoading(true);

          const { data: rpcRes, error: rpcError } = await supabase.rpc(
            'reset_password_via_entry_verification',
            {
              p_verification_id: verificationId,
              p_new_password: newPassword,
            }
          );

          if (rpcError) {
            setErrorMsg(rpcError.message || '비밀번호 재설정 처리 중 오류가 발생했습니다.');
          } else if (rpcRes && !rpcRes.success) {
            setErrorMsg(rpcRes.message || '비밀번호 재설정에 실패했습니다.');
          } else {
            setSuccessMsg('비밀번호가 성공적으로 변경되었습니다! 새 비밀번호로 로그인해 주세요.');
            setTimeout(() => {
              router.push('/login');
            }, 1800);
          }
          setIsLoading(false);
        }
      } catch (e) {
        console.warn('Verification poll error:', e);
      }
    };

    timer = setInterval(checkStatus, 1500);
    return () => clearInterval(timer);
  }, [isVerifying, verificationId, newPassword, router]);

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
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                backgroundColor: colors.canvasSoft2,
                border: `1px solid ${colors.hairlineStrong}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                color: colors.primary,
              }}
            >
              <KeyRound size={24} />
            </div>

            <h1
              style={{
                margin: '0 0 8px',
                fontSize: '24px',
                fontWeight: 700,
                color: colors.ink,
                letterSpacing: '-0.6px',
              }}
            >
              비밀번호 재설정
            </h1>
            <p style={{ margin: 0, fontSize: '13px', color: colors.mute, lineHeight: 1.5 }}>
              엔트리 계정 본인 인증을 통해 비밀번호를 안전하게 변경할 수 있습니다.
            </p>
          </div>

          {errorMsg && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 14px',
                borderRadius: '8px',
                backgroundColor: colors.errorSoft,
                border: `1px solid ${colors.error}`,
                color: colors.errorDeep,
                fontSize: '13px',
                marginBottom: '20px',
              }}
            >
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 14px',
                borderRadius: '8px',
                backgroundColor: '#f0fff4',
                border: '1px solid #c6f6d5',
                color: '#2f855a',
                fontSize: '13px',
                marginBottom: '20px',
              }}
            >
              <CheckCircle2 size={16} />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleStartReset} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* 엔트리 실제 아이디 */}
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '6px',
                }}
              >
                <label
                  style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: colors.ink,
                  }}
                >
                  엔트리 실제 아이디
                </label>
                <span style={{ fontSize: '11px', color: colors.mute, fontWeight: 500 }}>
                  가입 시 인증한 계정
                </span>
              </div>
              <input
                type="text"
                value={entryUsername}
                onChange={(e) => setEntryUsername(e.target.value)}
                placeholder="예: entry1234 (실제 로그인 ID)"
                required
                maxLength={30}
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
              <p
                style={{
                  margin: '5px 0 0',
                  fontSize: '11px',
                  color: colors.mute,
                  lineHeight: 1.4,
                }}
              >
                엔트리 공식 사이트(playentry.org) 로그인 아이디를 입력하세요.
              </p>
            </div>

            {/* 새 비밀번호 */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: colors.ink,
                  marginBottom: '6px',
                }}
              >
                새 비밀번호
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="6자 이상 입력"
                required
                minLength={6}
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

            {/* 새 비밀번호 확인 */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: colors.ink,
                  marginBottom: '6px',
                }}
              >
                새 비밀번호 확인
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="새 비밀번호 다시 입력"
                required
                minLength={6}
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
                fontWeight: 600,
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.7 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginTop: '6px',
                transition: 'opacity 0.2s ease',
              }}
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>인증 요청 확인 중...</span>
                </>
              ) : (
                <>
                  <ShieldCheck size={16} />
                  <span>엔트리 계정 인증으로 비밀번호 변경</span>
                </>
              )}
            </button>
          </form>

          <div
            style={{
              marginTop: '24px',
              paddingTop: '20px',
              borderTop: `1px solid ${colors.hairline}`,
              textAlign: 'center',
              fontSize: '13px',
              color: colors.mute,
            }}
          >
            <Link
              href="/login"
              style={{
                color: colors.mute,
                fontWeight: 500,
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <ArrowLeft size={13} />
              <span>로그인 화면으로 돌아가기</span>
            </Link>
          </div>
        </div>
      </main>

      {/* 엔트리 소유권 확인 대기 모달 */}
      {isVerifying && (
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
              maxWidth: '440px',
              width: '100%',
              backgroundColor: colors.canvas,
              borderRadius: '16px',
              border: `1px solid ${colors.hairline}`,
              boxShadow: '0 20px 48px rgba(0,0,0,0.25)',
              padding: '28px 24px',
              textAlign: 'center',
              position: 'relative',
            }}
          >
            <button
              onClick={() => setIsVerifying(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: colors.mute,
              }}
            >
              <X size={18} />
            </button>

            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                backgroundColor: colors.canvasSoft2,
                color: colors.primary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
              }}
            >
              <Loader2 size={28} className="animate-spin" />
            </div>

            <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 700, color: colors.ink }}>
              엔트리 사이트에서 인증 확인
            </h3>

            <p style={{ margin: '0 0 20px', fontSize: '13px', color: colors.mute, lineHeight: 1.5 }}>
              엔트리(<strong>{entryUsername}</strong>) 계정의 소유자임을 확인하고 있습니다.
            </p>

            {/* 인증 코드 박스 */}
            <div
              style={{
                backgroundColor: colors.canvasSoft,
                border: `1px dashed ${colors.hairlineStrong}`,
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '20px',
              }}
            >
              <div style={{ fontSize: '12px', color: colors.mute, marginBottom: '6px', fontWeight: 500 }}>
                생성된 인증 코드
              </div>
              <div
                style={{
                  fontSize: '26px',
                  fontWeight: 800,
                  letterSpacing: '3px',
                  color: colors.link,
                  fontFamily: 'monospace',
                }}
              >
                {verificationCode}
              </div>
            </div>

            {/* 단계 안내 */}
            <div
              style={{
                textAlign: 'left',
                backgroundColor: colors.canvasSoft,
                borderRadius: '10px',
                padding: '14px 16px',
                marginBottom: '20px',
                fontSize: '12px',
                color: colors.body,
                lineHeight: 1.6,
              }}
            >
              <div style={{ fontWeight: 600, color: colors.ink, marginBottom: '4px' }}>
                인증 완료 방법:
              </div>
              1. <strong>playentry.org</strong> 사이트 탭을 열어두세요.<br />
              2. 확장프로그램에서 띄우는 <strong>소유권 인증 모달</strong>에서 코드가 일치하는지 확인하세요.<br />
              3. <strong>[본인 확인 및 승인]</strong> 버튼을 누르면 비밀번호가 즉시 변경됩니다.
            </div>

            <a
              href="https://playentry.org"
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                border: `1px solid ${colors.hairlineStrong}`,
                backgroundColor: colors.canvas,
                color: colors.ink,
                fontSize: '13px',
                fontWeight: 600,
                textDecoration: 'none',
                boxSizing: 'border-box',
              }}
            >
              <span>엔트리(playentry.org) 바로가기</span>
              <ExternalLink size={14} />
            </a>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
