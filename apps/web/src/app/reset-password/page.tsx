'use client';

import React, { useState, useEffect, useRef } from 'react';
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

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // 엔트리 소유권 인증 모달 상태
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationId, setVerificationId] = useState<string | null>(null);

  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // 컴포넌트 언마운트 시 폴링 정리
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  // 1. 비밀번호 재설정 시작 (엔트리 계정 인증 요청)
  const handleStartReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanPassword = newPassword.trim();
    const cleanConfirm = confirmPassword.trim();

    if (cleanPassword.length < 6) {
      setErrorMsg('새 비밀번호는 최소 6자 이상이어야 합니다.');
      return;
    }
    if (cleanPassword !== cleanConfirm) {
      setErrorMsg('새 비밀번호와 비밀번호 확인이 일치하지 않습니다.');
      return;
    }

    setIsLoading(true);

    // [팝업 차단 방지] 사용자 클릭 이벤트 동기 컨텍스트에서 즉시 빈 창 선오픈
    const popup = typeof window !== 'undefined' ? window.open('about:blank', '_blank') : null;

    try {
      const code = `EH-PWD-${Math.floor(1000 + Math.random() * 9000)}`;
      setVerificationCode(code);

      // entry_verifications 테이블에 RESET_PASSWORD 요청 등록 (엔트리 아이디 수집 금지 정책 준수)
      const { data, error } = await supabase
        .from('entry_verifications')
        .insert({
          code,
          entry_username: 'ALL',
          verification_type: 'RESET_PASSWORD',
          status: 'PENDING',
        })
        .select('id')
        .single();

      if (error || !data) {
        if (popup) popup.close();
        throw new Error(error?.message || '인증 요청 생성 중 오류가 발생했습니다.');
      }

      const vId = data.id;
      setVerificationId(vId);
      setIsVerifying(true);

      // 엔트리 메인 페이지 팝업 주소 이동 (확장프로그램이 액션을 포착하여 인증 모달 표시)
      const targetUrl = 'https://playentry.org?entry_hub_action=reset_password';
      if (popup) {
        popup.location.href = targetUrl;
      }

      // 인증 승인 여부 실시간 폴링 시작
      startPolling(vId, cleanPassword);
    } catch (err: any) {
      if (popup) popup.close();
      setErrorMsg(err?.message || '인증 요청 생성 중 오류가 발생했습니다.');
      setIsVerifying(false);
    } finally {
      setIsLoading(false);
    }
  };

  // 2. 인증 승인 상태 폴링
  const startPolling = (vId: string, targetPassword: string) => {
    if (pollingRef.current) clearInterval(pollingRef.current);

    pollingRef.current = setInterval(async () => {
      try {
        const { data, error } = await supabase
          .from('entry_verifications')
          .select('status, entry_user_id')
          .eq('id', vId)
          .single();

        if (error || !data) return;

        if (data.status === 'EXPIRED') {
          if (pollingRef.current) clearInterval(pollingRef.current);
          setIsVerifying(false);
          setIsLoading(false);
          setErrorMsg('엔트리 사이트에서 인증 요청이 취소되었거나 만료되었습니다.');
          return;
        }

        if (data.status === 'VERIFIED') {
          if (pollingRef.current) clearInterval(pollingRef.current);
          setIsVerifying(false);
          setIsLoading(true);

          // RPC 호출하여 해당 엔트리 계정의 비밀번호 재설정 실행
          const { data: rpcRes, error: rpcError } = await supabase.rpc(
            'reset_password_via_entry_verification',
            {
              p_verification_id: vId,
              p_new_password: targetPassword,
            }
          );

          if (rpcError) {
            setErrorMsg(rpcError.message || '비밀번호 재설정 처리 중 오류가 발생했습니다.');
          } else if (rpcRes && !rpcRes.success) {
            setErrorMsg(rpcRes.message || '비밀번호 재설정에 실패했습니다.');
          } else {
            setSuccessMsg('비밀번호가 안전하게 재설정되었습니다! 새 비밀번호로 로그인해 주세요.');
            setTimeout(() => {
              router.push('/login');
            }, 1800);
          }
          setIsLoading(false);
        }
      } catch (e) {
        console.warn('[ResetPassword] Polling error:', e);
      }
    }, 1500);
  };

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
            {/* 안내 배너 */}
            <div
              style={{
                padding: '12px 14px',
                borderRadius: '8px',
                backgroundColor: colors.canvasSoft2,
                border: `1px solid ${colors.hairlineStrong}`,
                fontSize: '12px',
                color: colors.mute,
                lineHeight: 1.5,
              }}
            >
              아이디를 입력할 필요 없이, 엔트리(playentry.org)에 로그인된 계정 인증을 통해 본인 확인 후 비밀번호를 재설정합니다.
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
              disabled={isLoading || isVerifying}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: colors.primary,
                color: colors.onPrimary,
                fontSize: '14px',
                fontWeight: 600,
                cursor: isLoading || isVerifying ? 'not-allowed' : 'pointer',
                opacity: isLoading || isVerifying ? 0.7 : 1,
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
                  <span>처리 중...</span>
                </>
              ) : (
                <>
                  <ShieldCheck size={16} />
                  <span>엔트리 계정 인증으로 비밀번호 재설정</span>
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
              onClick={() => {
                setIsVerifying(false);
                if (pollingRef.current) clearInterval(pollingRef.current);
              }}
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
              새로 열린 엔트리 사이트 창에서 비밀번호 재설정 승인 팝업을 확인해 주세요.
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
                보안 인증 식별 코드
              </div>
              <div
                style={{
                  fontSize: '24px',
                  fontWeight: 800,
                  letterSpacing: '2px',
                  color: colors.primary,
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
                진행 방법:
              </div>
              1. 열린 엔트리(playentry.org) 창에 로그인되어 있는지 확인합니다.<br />
              2. 화면에 나타난 Entry-Hub 보안 인증 팝업에서 <strong>[동의 및 비밀번호 재설정]</strong>을 누릅니다.<br />
              3. 승인이 완료되면 이 창에서 자동으로 비밀번호가 재설정됩니다.
            </div>

            <a
              href="https://playentry.org?entry_hub_action=reset_password"
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
              <span>엔트리 인증 창 다시 열기</span>
              <ExternalLink size={14} />
            </a>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
