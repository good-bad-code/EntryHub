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
  } else if (verification.verification_type === 'RESET_PASSWORD') {
    title = 'Entry-Hub 비밀번호 재설정';
    desc = `현재 로그인된 엔트리 계정(${displayName})의 Entry-Hub 계정 비밀번호를 재설정합니다.`;
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
                  {loading ? '처리 중...' : isRegister ? '동의 및 계정 생성' : verification.verification_type === 'RESET_PASSWORD' ? '동의 및 비밀번호 재설정' : '확인 및 로그인'}
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

let cachedDetectedUser: DetectedEntryUser | null = null;

/**
 * 엔트리 헤더/GNB DOM 컨테이너 탐색
 */
function getEntryHeaderContainer(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  return document.querySelector<HTMLElement>(
    'header, nav, [class*="Header__"], [class*="Gnb__"], [class*="header__"], [class*="gnb__"], [class*="Header"], [class*="Gnb"], [class*="header"], [class*="gnb"]'
  );
}

/**
 * 엔트리 사이트에서 명시적으로 비로그인(게스트) 상태인지 검사
 */
export function isExplicitlyLoggedOut(): boolean {
  if (typeof document === 'undefined') return false;

  const header = getEntryHeaderContainer();
  if (header) {
    // 헤더 내에 내 프로필 링크가 있으면 확실한 로그인 상태
    const profileLink = header.querySelector('a[href*="/profile/"]');
    if (profileLink) {
      return false;
    }

    // 헤더 내에 명시적 로그인 링크나 버튼이 있는지 검사
    const signinLink = header.querySelector('a[href*="/signin"], a[href*="/login"]');
    if (signinLink) {
      return true;
    }

    const buttons = header.querySelectorAll('a, button');
    for (const btn of Array.from(buttons)) {
      const text = btn.textContent?.trim();
      if (text === '로그인' || text === '로그인 / 회원가입') {
        return true;
      }
    }
  }

  return false;
}

/**
 * playentry.org GraphQL API를 통해 현재 로그인된 세션 확인 (보조 수단)
 */
export async function fetchEntryUserViaApi(): Promise<DetectedEntryUser | null> {
  if (cachedDetectedUser) return cachedDetectedUser;

  try {
    const res = await fetch('https://playentry.org/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        query: `
          query {
            user {
              _id
              nickname
              username
            }
          }
        `,
      }),
    });
    if (res.ok) {
      const json = await res.json();
      const u = json?.data?.user;
      if (u && u._id) {
        cachedDetectedUser = {
          _id: u._id,
          id: u._id,
          nickname: u.nickname || u.username,
          username: u.username,
        };
        return cachedDetectedUser;
      }
    }
  } catch (err) {
    // API 조회 실패 시 DOM 방식으로 계속 탐색
  }
  return null;
}

/**
 * 엔트리 페이지에서 현재 로그인된 유저 정보 동기 감지
 * (헤더 컨테이너 내부만 철저히 탐색하여 타인/작품 제작자 프로필 오인식을 100% 차단)
 */
export function detectEntryUser(): DetectedEntryUser | null {
  if (cachedDetectedUser) {
    return cachedDetectedUser;
  }

  // 1. 헤더/GNB 내부의 내 프로필 아바타 링크 탐색 (가장 직관적이고 확실한 DOM 원천)
  try {
    const header = getEntryHeaderContainer();
    if (header) {
      // 중요: 반드시 header 내부에서만 쿼리! (본문 작품 카드의 프로필 링크 탐색 원천 차단)
      const myProfileLink = header.querySelector<HTMLAnchorElement>('a[href*="/profile/"]');
      if (myProfileLink) {
        const href = myProfileLink.getAttribute('href') || '';
        const match = href.match(/\/profile\/([a-zA-Z0-9_\uac00-\ud7a3]+)/);
        if (match && match[1]) {
          const img = myProfileLink.querySelector('img');
          const nick = img?.getAttribute('alt') || myProfileLink.textContent?.trim() || match[1];
          if (nick && match[1]) {
            const detected: DetectedEntryUser = {
              nickname: nick,
              id: match[1],
              _id: match[1],
            };
            cachedDetectedUser = detected;
            return detected;
          }
        }
      }
    }
  } catch (e) {
    console.warn('[Entry-Hub] Header profile detection error:', e);
  }

  // 2. 창작 워크스페이스(/ws)인 경우 브릿지 캐시 및 Entry.user 확인
  if (cachedBridgeUser && (cachedBridgeUser.nickname || cachedBridgeUser._id)) {
    return cachedBridgeUser;
  }
  requestBridgeEntryUser();

  try {
    const entryUser = (window as any).Entry?.user;
    if (entryUser && entryUser._id && entryUser.nickname) {
      const detected: DetectedEntryUser = {
        nickname: entryUser.nickname,
        id: entryUser._id,
        _id: entryUser._id,
      };
      cachedDetectedUser = detected;
      return detected;
    }
  } catch {}

  // 3. Next.js 공식 세션 스토어 (__NEXT_DATA__) 확인
  try {
    const nextDataEl = document.getElementById('__NEXT_DATA__');
    if (nextDataEl?.textContent) {
      const nextData = JSON.parse(nextDataEl.textContent);
      const props = nextData.props || {};
      const pageProps = props.pageProps || {};
      const initialState = pageProps.initialState || props.initialState || {};

      const authUser = initialState.common?.user || pageProps.user;
      if (authUser && authUser._id && authUser.nickname) {
        const detected: DetectedEntryUser = {
          nickname: authUser.nickname,
          id: authUser._id,
          _id: authUser._id,
        };
        cachedDetectedUser = detected;
        return detected;
      }
    }
  } catch (e) {
    console.warn('[Entry-Hub] __NEXT_DATA__ user detection error:', e);
  }

  return null;
}

/**
 * 정확한 엔트리 로그인 유저 정보(_id 포함)를 비동기로 조회
 * (즉시 감지 + GraphQL API + 렌더링 대기 폴링 순으로 안전하게 확인)
 */
export async function getAccurateEntryUser(maxWaitMs = 2500): Promise<DetectedEntryUser | null> {
  // 1. 헤더 DOM 또는 브릿지에서 즉시 감지 시도
  const immediate = detectEntryUser();
  if (immediate && (immediate._id || immediate.id) && immediate.nickname) {
    return immediate;
  }

  // 2. 만약 헤더에 명시적으로 '로그인' 버튼이 보이고 프로필 링크가 없다면 비로그인 판정
  if (isExplicitlyLoggedOut()) {
    cachedDetectedUser = null;
    return null;
  }

  // 3. GraphQL 세션 비동기 조회 (동시 시도)
  fetchEntryUserViaApi().then((apiUser) => {
    if (apiUser) {
      cachedDetectedUser = apiUser;
    }
  });

  // 4. Next.js 하이드레이션 및 헤더 DOM 렌더링 완료 타이밍을 고려해 최대 maxWaitMs 동안 폴링
  const startTime = Date.now();
  while (Date.now() - startTime < maxWaitMs) {
    await new Promise((r) => setTimeout(r, 200));

    const user = detectEntryUser();
    if (user && (user._id || user.id) && user.nickname) {
      return user;
    }

    if (cachedDetectedUser) {
      return cachedDetectedUser;
    }

    // 헤더에 확실하게 로그인 버튼이 나타나면 비로그인으로 조기 종료
    if (isExplicitlyLoggedOut()) {
      cachedDetectedUser = null;
      return null;
    }
  }

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

  // 비동기로 정확한 로그인 유저 조회
  const user = await getAccurateEntryUser(2000);

  // 유저가 감지되었으면 기형적으로 띄워진 '로그인 필요' 모달 즉시 제거
  if (user) {
    const existingReq = document.getElementById('entry-hub-login-required-modal-root');
    if (existingReq) {
      existingReq.remove();
    }
  } else {
    // 2초 동안 대기했는데도 유저가 없으면 로그인 필요 모달 띄우기
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
    } else if (action === 'reset_password') {
      query = query.eq('verification_type', 'RESET_PASSWORD');
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

