import React, { useState, useEffect } from 'react';
import { X, LogIn, UserPlus, AlertCircle, Loader2, CheckCircle2, ShieldCheck, KeyRound, ArrowRight } from 'lucide-react';
import { colors } from '@entry-hub/shared';
import { supabase } from '../../infrastructure/supabase/client';
import { detectEntryUser, getAccurateEntryUser, requestBridgeEntryUser } from '../../content/verifier';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: any) => void;
  onError: (msg: string) => void;
}

export function AuthModal({ isOpen, onClose, onSuccess, onError }: AuthModalProps) {
  // 모드: 'ENTRY_AUTH' (엔트리 1초 인증 - 기본값) | 'PASSWORD_LOGIN' (아이디/비번 로그인)
  const [authMode, setAuthMode] = useState<'ENTRY_AUTH' | 'PASSWORD_LOGIN'>('ENTRY_AUTH');
  
  // 엔트리 1초 인증 탭: 'LOGIN' | 'REGISTER'
  const [entryTab, setEntryTab] = useState<'LOGIN' | 'REGISTER'>('LOGIN');

  // 아이디/비밀번호 폼 상태
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  // 회원가입 약관 동의 상태
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);

  // 로딩 및 상태
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [detectedUser, setDetectedUser] = useState<any>(null);

  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      // 브릿지에 Entry.user 최신 데이터 요청
      requestBridgeEntryUser();

      // 즉시 1회 감지
      const u = detectEntryUser();
      setDetectedUser(u);

      // 정확한 유저 비동기 조회 (GraphQL 및 세션 검증)
      getAccurateEntryUser(1500).then((accUser) => {
        setDetectedUser(accUser);
      });

      // 브릿지 응답 대기 및 DOM 렌더링 타이밍을 고려해 300ms, 800ms 후 재확인
      const t1 = setTimeout(() => {
        setDetectedUser(detectEntryUser());
      }, 300);
      const t2 = setTimeout(() => {
        setDetectedUser(detectEntryUser());
      }, 800);

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // 1. 엔트리 기반 1초 회원가입 / 로그인 처리 (엔트리 내부이므로 즉시 원클릭 실행)
  const handleEntryOneClickAuth = async () => {
    setErrorMsg(null);
    setLoading(true);

    try {
      const user = (await getAccurateEntryUser(1000)) || detectEntryUser();
      if (!user || (!user.username && !user.nickname && !user._id)) {
        throw new Error(
          '엔트리에 로그인되어 있지 않습니다.\n엔트리(playentry.org) 사이트에 먼저 로그인해 주세요.'
        );
      }

      if (entryTab === 'REGISTER' && (!agreeTerms || !agreePrivacy)) {
        throw new Error('이용약관 및 개인정보처리방침에 모두 동의해 주세요.');
      }

      const username = user.username || user.id || '';
      const nickname = user.nickname || username || '엔트리사용자';
      const entryUserId = user._id || user.id || null;

      // 1) 1회용 인증 티켓 생성
      const code = `EH-EXT-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const { data: vData, error: vErr } = await supabase
        .from('entry_verifications')
        .insert({
          code,
          entry_username: username,
          entry_user_id: entryUserId,
          nickname,
          verification_type: entryTab,
          status: 'VERIFIED', // 엔트리 내부에서 직접 버튼을 눌렀으므로 즉시 VERIFIED 승인 처리
        })
        .select('id')
        .single();

      if (vErr || !vData) {
        throw new Error(vErr?.message || '인증 요청 생성에 실패했습니다.');
      }

      // 2) process_entry_auth_verification RPC 실행하여 세션 및 계정 처리
      const { data: authResult, error: rpcErr } = await supabase.rpc('process_entry_auth_verification', {
        p_verification_id: vData.id,
      });

      if (rpcErr || !authResult?.success) {
        throw new Error(rpcErr?.message || authResult?.message || '계정 처리에 실패했습니다.');
      }

      // 3) 발급받은 임시 1회용 비밀번호로 Supabase Auth 자동 로그인
      if (authResult.email && authResult.temp_password) {
        let { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
          email: authResult.email,
          password: authResult.temp_password,
        });

        // Database error querying schema 발생 시 스키마 자동 복구 RPC 1회 시도 후 재로그인
        if (signInErr && signInErr.message?.toLowerCase().includes('schema')) {
          try {
            await supabase.rpc('repair_auth_user_schema', { p_email: authResult.email });
            const retryRes = await supabase.auth.signInWithPassword({
              email: authResult.email,
              password: authResult.temp_password,
            });
            signInData = retryRes.data;
            signInErr = retryRes.error;
          } catch {}
        }

        if (signInErr) {
          throw signInErr;
        }

        // 엔트리 로그인 완료 즉시, 유저의 원래 비밀번호 해시가 있다면 복원 (아이디/비밀번호 깨짐 영구 방지)
        if (signInData?.user?.id) {
          try {
            await supabase.rpc('restore_user_original_password', { p_user_id: signInData.user.id });
          } catch {}
        }

        onSuccess(signInData.user);
        onClose();
      } else {
        throw new Error('로그인 세션 토큰을 발급받지 못했습니다.');
      }
    } catch (err: any) {
      console.error('[Entry-Hub] Extension Auth error:', err);
      setErrorMsg(err?.message || '인증 처리 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 2. 아이디 / 비밀번호 수동 로그인 처리
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const rawId = identifier.trim();
      const cleanId = rawId.toLowerCase();
      let targetEmail = `${cleanId}@entry-hub.local`;

      // 1) RPC로 custom_id / entry_username에 매핑된 실제 auth email 조회
      try {
        const { data: rpcEmail, error: rpcErr } = await supabase.rpc('get_login_email_by_identifier', {
          p_identifier: rawId,
        });
        if (!rpcErr && rpcEmail) {
          targetEmail = rpcEmail;
        }
      } catch {}

      // 2) public.users fallback
      if (targetEmail === `${cleanId}@entry-hub.local` && !rawId.includes('@')) {
        try {
          const { data: userRow } = await supabase
            .from('users')
            .select('email, entry_username, nickname, custom_id')
            .or(`custom_id.ilike.${rawId},entry_username.ilike.${rawId},nickname.ilike.${rawId}`)
            .limit(1)
            .maybeSingle();

          if (userRow?.email) {
            targetEmail = userRow.email;
          }
        } catch {}
      }

      // 3) Supabase Auth 로그인
      let { data, error } = await supabase.auth.signInWithPassword({
        email: targetEmail,
        password,
      });

      // 관리자 계정 특별 fallback (환경변수로 설정)
      const adminEntryId = import.meta.env.VITE_ADMIN_ENTRY_ID || '';
      const adminEmail = import.meta.env.VITE_ADMIN_EMAIL || '';
      if (error && adminEntryId && adminEmail && cleanId === adminEntryId && targetEmail !== adminEmail) {
        const fallbackResult = await supabase.auth.signInWithPassword({
          email: adminEmail,
          password,
        });
        if (!fallbackResult.error && fallbackResult.data.user) {
          data = fallbackResult.data;
          error = null;
        }
      }

      if (error) {
        throw error;
      }

      if (data?.user) {
        onSuccess(data.user);
        onClose();
      }
    } catch (err: any) {
      const msg =
        err?.message === 'Invalid login credentials'
          ? '아이디 또는 비밀번호가 올바르지 않습니다.'
          : err?.message || '로그인에 실패했습니다.';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: colors.canvas,
          borderRadius: '16px',
          width: '100%',
          maxWidth: '380px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 48px rgba(0,0,0,0.25)',
          border: `1px solid ${colors.hairline}`,
          overflow: 'hidden',
          padding: '24px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: colors.primary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
              }}
            >
              <ShieldCheck size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: colors.ink }}>
                Entry-Hub 시작하기
              </h3>
              <p style={{ margin: 0, fontSize: '11px', color: colors.mute }}>
                엔트리 공식 계정으로 간편하게 연결
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: colors.mute }}
          >
            <X size={18} />
          </button>
        </div>

        {/* 상단 인증 모드 탭 (엔트리 1초 인증 vs 아이디/비밀번호) */}
        <div
          style={{
            display: 'flex',
            backgroundColor: colors.canvasSoft2,
            padding: '4px',
            borderRadius: '10px',
            marginBottom: '18px',
            border: `1px solid ${colors.hairline}`,
          }}
        >
          <button
            type="button"
            onClick={() => {
              setAuthMode('ENTRY_AUTH');
              setErrorMsg(null);
            }}
            style={{
              flex: 1,
              padding: '8px 0',
              borderRadius: '7px',
              border: 'none',
              backgroundColor: authMode === 'ENTRY_AUTH' ? colors.canvas : 'transparent',
              color: authMode === 'ENTRY_AUTH' ? colors.ink : colors.mute,
              fontWeight: authMode === 'ENTRY_AUTH' ? 700 : 500,
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '5px',
              boxShadow: authMode === 'ENTRY_AUTH' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <ShieldCheck size={14} color={authMode === 'ENTRY_AUTH' ? colors.primary : colors.mute} />
            <span>엔트리 1초 인증</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMode('PASSWORD_LOGIN');
              setErrorMsg(null);
            }}
            style={{
              flex: 1,
              padding: '8px 0',
              borderRadius: '7px',
              border: 'none',
              backgroundColor: authMode === 'PASSWORD_LOGIN' ? colors.canvas : 'transparent',
              color: authMode === 'PASSWORD_LOGIN' ? colors.ink : colors.mute,
              fontWeight: authMode === 'PASSWORD_LOGIN' ? 700 : 500,
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '5px',
              boxShadow: authMode === 'PASSWORD_LOGIN' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <KeyRound size={14} />
            <span>아이디 / 비번</span>
          </button>
        </div>

        {errorMsg && (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: '8px',
              backgroundColor: colors.errorSoft,
              color: colors.errorDeep,
              fontSize: '12px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              lineHeight: 1.4,
            }}
          >
            <AlertCircle size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* 1. 엔트리 1초 인증 화면 (확장 프로그램 내 원클릭) */}
        {authMode === 'ENTRY_AUTH' && (
          <div>
            {/* 로그인 / 회원가입 소분류 */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <button
                type="button"
                onClick={() => {
                  setEntryTab('LOGIN');
                  setErrorMsg(null);
                }}
                style={{
                  flex: 1,
                  padding: '6px 0',
                  borderRadius: '6px',
                  border: `1px solid ${entryTab === 'LOGIN' ? colors.primary : colors.hairlineStrong}`,
                  backgroundColor: entryTab === 'LOGIN' ? `${colors.primary}12` : 'transparent',
                  color: entryTab === 'LOGIN' ? colors.primary : colors.mute,
                  fontSize: '12px',
                  fontWeight: entryTab === 'LOGIN' ? 700 : 500,
                  cursor: 'pointer',
                }}
              >
                간편 로그인
              </button>
              <button
                type="button"
                onClick={() => {
                  setEntryTab('REGISTER');
                  setErrorMsg(null);
                }}
                style={{
                  flex: 1,
                  padding: '6px 0',
                  borderRadius: '6px',
                  border: `1px solid ${entryTab === 'REGISTER' ? colors.primary : colors.hairlineStrong}`,
                  backgroundColor: entryTab === 'REGISTER' ? `${colors.primary}12` : 'transparent',
                  color: entryTab === 'REGISTER' ? colors.primary : colors.mute,
                  fontSize: '12px',
                  fontWeight: entryTab === 'REGISTER' ? 700 : 500,
                  cursor: 'pointer',
                }}
              >
                엔트리로 회원가입
              </button>
            </div>

            {/* 감지된 엔트리 계정 안내 카드 */}
            <div
              style={{
                padding: '14px',
                borderRadius: '10px',
                backgroundColor: colors.canvasSoft2,
                border: `1px solid ${colors.hairline}`,
                marginBottom: '16px',
              }}
            >
              <div style={{ fontSize: '11px', color: colors.mute, marginBottom: '4px' }}>
                현재 엔트리 브라우저 계정
              </div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: colors.ink }}>
                {detectedUser?.nickname || detectedUser?.username || '엔트리 계정 감지 중...'}
              </div>
              {detectedUser?.username && (
                <div style={{ fontSize: '11px', color: colors.primary, marginTop: '2px' }}>
                  @{detectedUser.username}
                </div>
              )}
            </div>

            {/* 회원가입 시 약관 동의 체크 */}
            {entryTab === 'REGISTER' && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  marginBottom: '16px',
                  padding: '12px',
                  borderRadius: '10px',
                  backgroundColor: colors.canvasSoft2,
                  border: `1px solid ${agreeTerms && agreePrivacy ? colors.primary : colors.hairline}`,
                  fontSize: '12px',
                  transition: 'border-color 0.2s ease',
                }}
              >
                <div
                  onClick={() => setAgreeTerms(!agreeTerms)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    userSelect: 'none',
                    color: agreeTerms ? colors.primary : colors.ink,
                    fontWeight: agreeTerms ? 700 : 500,
                  }}
                >
                  <div
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '4px',
                      border: `2px solid ${agreeTerms ? colors.primary : colors.hairlineStrong}`,
                      backgroundColor: agreeTerms ? colors.primary : colors.canvas,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      transition: 'all 0.15s ease',
                      flexShrink: 0,
                    }}
                  >
                    {agreeTerms && <CheckCircle2 size={13} />}
                  </div>
                  <span>[필수] Entry-Hub 이용약관 동의</span>
                </div>

                <div
                  onClick={() => setAgreePrivacy(!agreePrivacy)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    userSelect: 'none',
                    color: agreePrivacy ? colors.primary : colors.ink,
                    fontWeight: agreePrivacy ? 700 : 500,
                  }}
                >
                  <div
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '4px',
                      border: `2px solid ${agreePrivacy ? colors.primary : colors.hairlineStrong}`,
                      backgroundColor: agreePrivacy ? colors.primary : colors.canvas,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      transition: 'all 0.15s ease',
                      flexShrink: 0,
                    }}
                  >
                    {agreePrivacy && <CheckCircle2 size={13} />}
                  </div>
                  <span>[필수] 개인정보처리방침 동의</span>
                </div>
              </div>
            )}

            {/* 원클릭 실행 버튼 */}
            <button
              type="button"
              onClick={handleEntryOneClickAuth}
              disabled={loading || (entryTab === 'REGISTER' && (!agreeTerms || !agreePrivacy))}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                backgroundColor: colors.primary,
                color: '#fff',
                fontSize: '13px',
                fontWeight: 700,
                border: 'none',
                cursor: loading || (entryTab === 'REGISTER' && (!agreeTerms || !agreePrivacy)) ? 'not-allowed' : 'pointer',
                opacity: entryTab === 'REGISTER' && (!agreeTerms || !agreePrivacy) ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(0, 112, 243, 0.25)',
              }}
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : entryTab === 'REGISTER' ? (
                <>
                  <UserPlus size={16} />
                  <span>엔트리 계정으로 회원가입 완료</span>
                </>
              ) : (
                <>
                  <LogIn size={16} />
                  <span>엔트리 인증으로 1초 로그인</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* 2. 아이디 / 비밀번호 로그인 화면 */}
        {authMode === 'PASSWORD_LOGIN' && (
          <form onSubmit={handlePasswordLogin} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: colors.ink, marginBottom: '6px' }}>
                아이디 또는 이메일
              </label>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="마이페이지에서 설정한 아이디"
                required
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: `1px solid ${colors.hairlineStrong}`,
                  fontSize: '13px',
                  outline: 'none',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: colors.ink, marginBottom: '6px' }}>
                비밀번호
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호"
                required
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: `1px solid ${colors.hairlineStrong}`,
                  fontSize: '13px',
                  outline: 'none',
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: '6px',
                padding: '12px',
                borderRadius: '8px',
                backgroundColor: colors.primary,
                color: colors.onPrimary,
                fontSize: '13px',
                fontWeight: 700,
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>
                  <LogIn size={16} />
                  <span>로그인</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
