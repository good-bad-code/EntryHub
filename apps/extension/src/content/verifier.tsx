import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { ShieldCheck, CheckCircle2, X, AlertCircle, UserCheck, Sparkles, ExternalLink } from 'lucide-react';
import { supabase } from '../infrastructure/supabase/client';

// 이미 처리되었거나 거부된 인증 요청 ID 캐시 (반복 팝업 방지)
const handledVerificationIds = new Set<string>();

interface PendingVerification {
  id: string;
  code: string;
  entry_username: string;
  verification_type?: 'REGISTER' | 'LOGIN' | 'LINK_ID' | 'RESET_PASSWORD';
  status: string;
}

export function VerificationModal({
  verification,
  user,
  onClose,
  onApproved,
}: {
  verification: PendingVerification;
  user: DetectedEntryUser;
  onClose: () => void;
  onApproved: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  // 약관 동의 상태 (회원가입 요청일 때 필수 체크)
  const isRegister = verification.verification_type === 'REGISTER' || !verification.verification_type;
  const [agreeTerms, setAgreeTerms] = useState(!isRegister);
  const [agreePrivacy, setAgreePrivacy] = useState(!isRegister);

  const isActionAllowed = !isRegister || (agreeTerms && agreePrivacy);

  const handleApprove = async () => {
    if (!isActionAllowed) {
      alert('개인정보처리방침 및 이용약관에 모두 동의해 주세요.');
      return;
    }

    setLoading(true);
    handledVerificationIds.add(verification.id);

    try {
      const nickname = user.nickname || '엔트리사용자';
      const entryUserId = user._id || user.id || null;

      // 회원가입 모드일 때 이미 존재하는 회원인지 사전 검증 (entry_user_id 기반으로만 체크)
      if (isRegister) {
        if (entryUserId) {
          const { data: existingUser } = await supabase
            .from('users')
            .select('id, nickname')
            .eq('entry_user_id', entryUserId)
            .limit(1);

          if (existingUser && existingUser.length > 0) {
            alert('이미 가입된 엔트리 계정입니다.\n로그인 페이지에서 [엔트리 인증 로그인]을 이용해 주세요.');
            setLoading(false);
            await supabase.from('entry_verifications').update({ status: 'EXPIRED' }).eq('id', verification.id);
            onClose();
            return;
          }
        }
      }

      // 엔트리 아이디(entry_username)는 절대 수집/저장하지 않음 (보안 및 개인정보 보호)
      const { error } = await supabase
        .from('entry_verifications')
        .update({
          status: 'VERIFIED',
          entry_user_id: entryUserId,
          entry_username: null,
          nickname: nickname,
        })
        .eq('id', verification.id);

      if (error) throw error;

      setDone(true);
      setTimeout(() => {
        onApproved();
      }, 1400);
    } catch (err) {
      console.error('[Entry-Hub] Verification approval failed:', err);
      alert('인증 승인 중 오류가 발생했습니다.');
      setLoading(false);
    }
  };

  const handleReject = async () => {
    setLoading(true);
    handledVerificationIds.add(verification.id);
    try {
      await supabase
        .from('entry_verifications')
        .update({ status: 'EXPIRED' })
        .eq('id', verification.id);
    } catch (err) {
      console.warn('[Entry-Hub] Verification rejection update error:', err);
    } finally {
      onClose();
    }
  };

  const displayName = user.nickname || '엔트리 사용자';

  // 제목 및 부제목 분기
  let title = '계정 인증 요청';
  let desc = `Entry-Hub에서 엔트리 계정(${displayName})의 인증을 요청했습니다.`;

  if (isRegister) {
    title = 'Entry-Hub 회원가입';
    desc = `현재 로그인된 엔트리 계정(${displayName})으로 Entry-Hub에 회원가입합니다.`;
  } else if (verification.verification_type === 'LOGIN') {
    title = 'Entry-Hub 간편 로그인';
    desc = `현재 로그인된 엔트리 계정(${displayName})으로 Entry-Hub에 로그인합니다.`;
  } else if (verification.verification_type === 'LINK_ID') {
    title = '엔트리 아이디 연동';
    desc = `마이페이지에 엔트리 계정(${displayName})의 아이디를 등록합니다.`;
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 99999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <div
        style={{
          width: '440px',
          maxWidth: '92vw',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 20px 48px rgba(0, 0, 0, 0.25)',
          border: '1px solid #eaeaea',
          overflow: 'hidden',
          animation: 'entryHubFadeIn 0.25s ease-out',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            backgroundColor: '#0070f3',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '15px' }}>
            <ShieldCheck size={18} />
            <span>Entry-Hub 보안 인증</span>
          </div>
          <button
            type="button"
            onClick={handleReject}
            style={{
              background: 'none',
              border: 'none',
              color: '#ffffff',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              opacity: 0.8,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px 20px', textAlign: 'center' }}>
          {done ? (
            <div style={{ padding: '16px 0' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  backgroundColor: '#e6f7ed',
                  color: '#00b400',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                }}
              >
                <CheckCircle2 size={32} />
              </div>
              <h4 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 700, color: '#111827' }}>
                {isRegister ? '회원가입이 완료되었습니다!' : '인증이 완료되었습니다!'}
              </h4>
              <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>
                Entry-Hub 창으로 돌아가시면 자동으로 로그인이 진행됩니다.
              </p>
            </div>
          ) : (
            <>
              <div
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '50%',
                  backgroundColor: '#f0f7ff',
                  color: '#0070f3',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 14px',
                }}
              >
                <UserCheck size={28} />
              </div>

              <h4 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 700, color: '#111827' }}>
                {title}
              </h4>

              <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#4b5563', lineHeight: 1.6 }}>
                {desc}
              </p>

              {/* 감지된 엔트리 계정 카드 */}
              <div
                style={{
                  backgroundColor: '#f9fafb',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  marginBottom: '16px',
                  border: '1px solid #e5e7eb',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontSize: '11px', color: '#6b7280' }}>연동할 엔트리 계정</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827', marginTop: '2px' }}>
                    {displayName}
                  </div>
                  {user._id && (
                    <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                      고유번호: {user._id.slice(0, 10)}...
                    </div>
                  )}
                </div>
                <div style={{ backgroundColor: '#e0f2fe', color: '#0369a1', fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '4px' }}>
                  엔트리 확인됨
                </div>
              </div>

              {/* 회원가입 시 필수 약관 동의 체크박스 */}
              {isRegister && (
                <div
                  style={{
                    backgroundColor: '#fafafa',
                    border: '1px solid #eee',
                    borderRadius: '8px',
                    padding: '12px',
                    marginBottom: '18px',
                    textAlign: 'left',
                    fontSize: '12px',
                    color: '#374151',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={agreeTerms}
                      onChange={(e) => setAgreeTerms(e.target.checked)}
                      style={{ accentColor: '#0070f3' }}
                    />
                    <span>[필수] Entry-Hub 서비스 이용약관 동의</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={agreePrivacy}
                      onChange={(e) => setAgreePrivacy(e.target.checked)}
                      style={{ accentColor: '#0070f3' }}
                    />
                    <span>[필수] 개인정보 수집 및 이용 동의</span>
                  </label>
                </div>
              )}

              {/* 인증 코드 */}
              <div
                style={{
                  fontSize: '11px',
                  color: '#9ca3af',
                  marginBottom: '18px',
                }}
              >
                인증 식별 코드: <strong style={{ color: '#0070f3' }}>{verification.code}</strong>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={handleReject}
                  disabled={loading}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid #d1d5db',
                    backgroundColor: '#ffffff',
                    color: '#374151',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: loading ? 'not-allowed' : 'pointer',
                  }}
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={loading || !isActionAllowed}
                  style={{
                    flex: 1.5,
                    padding: '10px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: isActionAllowed ? '#0070f3' : '#9ca3af',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: loading || !isActionAllowed ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.7 : 1,
                    transition: 'all 0.15s ease',
                  }}
                >
                  {loading ? '처리 중...' : isRegister ? '동의 및 계정 생성' : '확인 및 로그인'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export interface DetectedEntryUser {
  username?: string;
  nickname?: string;
  id?: string;
  _id?: string;
}

// 브릿지로부터 수신된 window.Entry.user 캐시
let cachedBridgeUser: DetectedEntryUser | null = null;

if (typeof window !== 'undefined') {
  window.addEventListener('message', (e) => {
    if (e.data?.source === 'ENTRY_HUB_EXTENSION' && e.data?.type === 'GET_ENTRY_USER_RES') {
      if (e.data.payload) {
        cachedBridgeUser = e.data.payload;
      }
    }
  });
}

export function requestBridgeEntryUser() {
  if (typeof window !== 'undefined') {
    window.postMessage({
      source: 'ENTRY_HUB_EXTENSION',
      requestId: `user_req_${Date.now()}`,
      type: 'GET_ENTRY_USER_REQ',
    }, '*');
  }
}

/**
 * 엔트리 페이지에서 현재 로그인된 유저 정보 감지
 * (절대 타인/작품 제작자 정보를 오인식하지 않으며, 비로그인 상태를 최우선 확정합니다)
 */
export function detectEntryUser(): DetectedEntryUser | null {
  // 1. 화면 상단 네비게이션/헤더에 '로그인' 버튼 또는 /signin 링크가 존재하면 무조건 비로그인 상태로 확정!
  try {
    const loginElements = document.querySelectorAll(
      'header a, header button, nav a, nav button, [class*="Header"] a, [class*="Header"] button, a[href*="/signin"], a[href*="/login"]'
    );
    for (const el of Array.from(loginElements)) {
      const text = el.textContent?.trim() || '';
      const href = el.getAttribute('href') || '';
      if (
        (text === '로그인' || text === '로그인 / 회원가입' || href.includes('/signin') || href.includes('/login')) &&
        !text.includes('로그아웃')
      ) {
        cachedBridgeUser = null;
        return null;
      }
    }
  } catch {}

  // 2. 브릿지 캐시 확인 (창작 워크스페이스인 경우)
  if (cachedBridgeUser && (cachedBridgeUser.nickname || cachedBridgeUser._id)) {
    return cachedBridgeUser;
  }
  requestBridgeEntryUser();

  const isWorkspace = typeof window !== 'undefined' && window.location.pathname.startsWith('/ws');

  // 3. 엔트리 작품 제작 페이지(/ws) 상단 바의 닉네임 감지 (워크스페이스 전용)
  if (isWorkspace) {
    try {
      const ignoreWords = [
        'file', 'save', 'help', 'print', 'undo', 'redo', '기본형', '실행', '장면',
        '로그인', '회원가입', '작품', '블록', '모양', '소리', '속성', '추가하기',
        '시작하기', '속도', '정지', '초기화', '챌린지', '만들기', '공유하기', '커뮤니티',
        '생각하기', '탐험하기', '교과서', '스토리', '도움말'
      ];

      const myButtons = document.querySelectorAll(
        'header button, header a, header span, .entryHeader button, .entryHeader a, .entryHeader span, [class*="Header"] button, [class*="Header"] a, [class*="Header"] span'
      );
      for (const btn of Array.from(myButtons)) {
        const text = btn.textContent?.trim() || '';
        const lower = text.toLowerCase();
        if (
          text &&
          text.length >= 2 &&
          text.length <= 25 &&
          !ignoreWords.some((w) => lower === w || lower.includes(w))
        ) {
          const rect = btn.getBoundingClientRect();
          if (rect.top >= 0 && rect.top < 60 && rect.left > window.innerWidth * 0.55) {
            return {
              nickname: text,
              id: text,
            };
          }
        }
      }
    } catch {}
  }

  // 4. __NEXT_DATA__ 에서 최상위 세션 유저 객체만 확인 (작품 제작자나 타인 정보 혼동 방지)
  try {
    const nextDataEl = document.getElementById('__NEXT_DATA__');
    if (nextDataEl?.textContent) {
      const nextData = JSON.parse(nextDataEl.textContent);

      // 공식 세션 유저 경로만 안전하게 확인 (deep search 절대 금지)
      const pageUser =
        nextData.props?.pageProps?.user ||
        nextData.props?.pageProps?.initialState?.user ||
        nextData.props?.pageProps?.session?.user ||
        nextData.props?.pageProps?.initialState?.auth?.user;

      if (pageUser && pageUser._id && pageUser.nickname) {
        return {
          nickname: pageUser.nickname,
          id: pageUser._id,
          _id: pageUser._id,
        };
      }
    }
  } catch (e) {
    console.warn('[Entry-Hub] __NEXT_DATA__ user detection error:', e);
  }

  // 5. window.Entry?.user 객체 확인 (워크스페이스 에디터)
  try {
    const entryUser = (window as any).Entry?.user;
    if (entryUser && entryUser._id && entryUser.nickname) {
      return {
        nickname: entryUser.nickname,
        id: entryUser._id,
        _id: entryUser._id,
      };
    }
  } catch {}

  return null;
}

/**
 * 대기 중인 인증 요청 검사 및 모달 마운트
 */
export async function checkAndShowVerificationModal() {
  const urlParams = new URLSearchParams(window.location.search);
  const action = urlParams.get('entry_hub_action');

  // URL에 entry_hub_action 파라미터가 없으면(즉, 유저가 엔트리를 평소처럼 일반 서핑 중일 때) 인증 팝업을 띄우지 않음!
  if (!action) {
    return;
  }

  const user = detectEntryUser();

  // 비로그인 상태인데 회원가입/로그인 액션으로 들어온 경우: 로그인 필요 안내 모달 띄우기
  if (!user) {
    if (!document.getElementById('entry-hub-login-required-modal-root')) {
      showLoginRequiredModal();
    }
    return;
  }

  // 매칭 후보군 (고유 _id, 닉네임, 'ALL') - 엔트리 아이디(username)는 절대 수집/사용하지 않음
  const candidateList = Array.from(
    new Set([user._id, user.id, user.nickname, 'ALL'].filter(Boolean) as string[])
  );

  if (candidateList.length === 0) return;

  try {
    // 5분 이내에 생성된 PENDING 인증 요청 검색 (현재 URL action 타입과 일치하는 것 우선)
    let query = supabase
      .from('entry_verifications')
      .select('id, code, entry_username, verification_type, status')
      .eq('status', 'PENDING')
      .in('entry_username', candidateList);

    if (action === 'signup') {
      query = query.eq('verification_type', 'REGISTER');
    } else if (action === 'login') {
      query = query.eq('verification_type', 'LOGIN');
    } else if (action === 'link_id') {
      query = query.eq('verification_type', 'LINK_ID');
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(1);

    if (error || !data || data.length === 0) return;

    const pending = data[0] as PendingVerification;

    // 이미 처리되었거나 닫은 요청이면 건너뜀
    if (handledVerificationIds.has(pending.id)) return;

    // 이미 모달이 띄워져 있다면 중복 생성 방지
    if (document.getElementById('entry-hub-verification-modal-root')) return;

    // 모달을 마운트하는 시점에 바로 ID 등록하여 이후 3초 주기 폴링 시 중복 호출 방지
    handledVerificationIds.add(pending.id);

    console.log('[Entry-Hub] Found pending verification request! Showing modal:', pending);

    const mountEl = document.createElement('div');
    mountEl.id = 'entry-hub-verification-modal-root';
    document.body.appendChild(mountEl);

    const root = createRoot(mountEl);
    const cleanup = () => {
      root.unmount();
      mountEl.remove();
    };

    root.render(
      <VerificationModal
        verification={pending}
        user={user}
        onClose={cleanup}
        onApproved={cleanup}
      />
    );
  } catch (err) {
    console.warn('[Entry-Hub] Verification check error:', err);
  }
}

/**
 * 엔트리 비로그인 상태일 때 '엔트리 로그인 필요' 안내 모달
 */
function showLoginRequiredModal() {
  if (document.getElementById('entry-hub-login-required-modal-root')) return;

  const mountEl = document.createElement('div');
  mountEl.id = 'entry-hub-login-required-modal-root';
  document.body.appendChild(mountEl);

  const root = createRoot(mountEl);
  const cleanup = () => {
    root.unmount();
    mountEl.remove();
  };

  root.render(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 99999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <div
        style={{
          width: '400px',
          maxWidth: '92vw',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 20px 48px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          padding: '24px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            backgroundColor: '#fee2e2',
            color: '#ef4444',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
          }}
        >
          <AlertCircle size={26} />
        </div>
        <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 800, color: '#111' }}>
          엔트리 로그인이 필요합니다
        </h3>
        <p style={{ margin: '0 0 24px', fontSize: '13px', color: '#666', lineHeight: 1.5 }}>
          Entry-Hub 인증을 진행하려면 먼저 <strong>엔트리(playentry.org) 사이트에 로그인</strong>되어 있어야 합니다.<br />
          로그인 후 다시 시도해 주세요.
        </p>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={cleanup}
            style={{
              flex: 1,
              padding: '10px 0',
              borderRadius: '8px',
              border: '1px solid #ddd',
              backgroundColor: '#fff',
              color: '#333',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            닫기
          </button>
          <a
            href="https://playentry.org/signin"
            style={{
              flex: 1,
              padding: '10px 0',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#0070f3',
              color: '#fff',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            엔트리 로그인하기
          </a>
        </div>
      </div>
    </div>
  );
}

/**
 * 엔트리 페이지에서 인증 요청 감시자 시작 (주기적 폴링 + 이벤트 감지)
 */
export function initVerificationWatcher() {
  // URL 파라미터로 즉시 트리거 감지 (?entry_hub_action=signup 등)
  const urlParams = new URLSearchParams(window.location.search);
  const action = urlParams.get('entry_hub_action');
  if (action) {
    setTimeout(checkAndShowVerificationModal, 500);
  }

  // 즉시 1회 확인
  checkAndShowVerificationModal();

  // Next.js 페이지 렌더링 완료 타이밍별 확인
  setTimeout(checkAndShowVerificationModal, 1000);
  setTimeout(checkAndShowVerificationModal, 2500);
  setTimeout(checkAndShowVerificationModal, 4500);

  // 3초마다 지속적으로 폴링 확인 (유저가 새 탭에서 인증 요청을 보내면 즉시 포착)
  const timer = setInterval(checkAndShowVerificationModal, 3000);

  // SPA 페이지 이동(popstate) 감지
  window.addEventListener('popstate', checkAndShowVerificationModal);

  return () => {
    clearInterval(timer);
    window.removeEventListener('popstate', checkAndShowVerificationModal);
  };
}

/**
 * 정확한 엔트리 로그인 유저 정보(_id 포함)를 비동기로 조회
 */
export async function getAccurateEntryUser(maxWaitMs = 1500): Promise<DetectedEntryUser | null> {
  const immediate = detectEntryUser();
  if (immediate && immediate._id && immediate.nickname) {
    return immediate;
  }

  requestBridgeEntryUser();

  const startTime = Date.now();
  while (Date.now() - startTime < maxWaitMs) {
    await new Promise((r) => setTimeout(r, 200));
    const user = detectEntryUser();
    if (user && user._id && user.nickname) {
      return user;
    }
  }

  return null;
}

/**
 * 엔트리에서 변경된 닉네임을 Entry-Hub에 실시간 자동 동기화
 * (현재 로그인된 Hub 계정의 entry_user_id와 현재 엔트리 유저의 _id가 일치하고, 닉네임이 다를 경우에만 갱신)
 */
export async function syncEntryNickname(onSuccess?: (newNickname: string) => void): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return false;

    const entryUser = await getAccurateEntryUser();
    if (!entryUser || !entryUser._id || !entryUser.nickname) return false;

    // 현재 사용자의 DB 프로필 조회
    const { data: profile, error } = await supabase
      .from('users')
      .select('id, entry_user_id, nickname')
      .eq('id', session.user.id)
      .maybeSingle();

    if (error || !profile) return false;

    // 연동된 엔트리 계정 고유번호가 일치하고, 닉네임이 달라졌다면 자동 갱신
    if (profile.entry_user_id === entryUser._id && profile.nickname !== entryUser.nickname) {
      console.log(`[Entry-Hub] 실시간 닉네임 동기화: '${profile.nickname}' -> '${entryUser.nickname}'`);

      const { error: updateError } = await supabase
        .from('users')
        .update({ nickname: entryUser.nickname })
        .eq('id', session.user.id);

      if (!updateError) {
        try {
          await supabase.auth.updateUser({
            data: { nickname: entryUser.nickname }
          });
        } catch {}

        if (onSuccess) {
          onSuccess(entryUser.nickname);
        }
        return true;
      }
    }
  } catch (err) {
    console.warn('[Entry-Hub] 닉네임 자동 동기화 실패:', err);
  }
  return false;
}

