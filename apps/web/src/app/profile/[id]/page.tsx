'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Header } from '../../../infrastructure/components/layout/Header';
import { Footer } from '../../../infrastructure/components/layout/Footer';
import { AssetCard } from '../../../infrastructure/components/ui/AssetCard';
import { useTheme } from '../../../infrastructure/theme/ThemeContext';
import { useAuth, UserProfile } from '../../../infrastructure/auth/AuthContext';
import { supabase } from '../../../infrastructure/supabase/client';
import {
  User,
  ShieldCheck,
  ExternalLink,
  Edit3,
  Bookmark,
  Package,
  Check,
  X,
  Sparkles,
  Loader2,
  Trash2,
  AlertTriangle,
  KeyRound,
  Lock,
  UserCheck,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';

// 10종 기본 프로필 아바타 프리셋 (/avatars/avatar_1.png ~ avatar_10.png)
const DEFAULT_AVATARS = [
  '/avatars/avatar_1.png',
  '/avatars/avatar_2.png',
  '/avatars/avatar_3.png',
  '/avatars/avatar_4.png',
  '/avatars/avatar_5.png',
  '/avatars/avatar_6.png',
  '/avatars/avatar_7.png',
  '/avatars/avatar_8.png',
  '/avatars/avatar_9.png',
  '/avatars/avatar_10.png',
];

interface AssetSummary {
  id: string;
  title: string;
  description?: string;
  type: 'CODE' | 'OBJECT' | 'SCENE';
  authorName: string;
  isOfficialBadge?: boolean;
  isAdminPick?: boolean;
  likeCount: number;
  bookmarkCount: number;
}

export default function ProfilePage() {
  const router = useRouter();
  const params = useParams();
  const profileId = params?.id as string;
  const { user, profile: myProfile, refreshProfile, deleteAccount, setCredentials } = useAuth();
  const { colors } = useTheme();

  const isOwner = user?.id === profileId;

  const [profileData, setProfileData] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'UPLOADS' | 'BOOKMARKS'>('UPLOADS');
  const [uploadedAssets, setUploadedAssets] = useState<AssetSummary[]>([]);
  const [bookmarkedAssets, setBookmarkedAssets] = useState<AssetSummary[]>([]);
  const [userBadges, setUserBadges] = useState<{ id: string; name: string; color: string; description?: string }[]>([]);

  // 프로필 수정 모달 상태
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editNickname, setEditNickname] = useState('');
  const [editEntryUrl, setEditEntryUrl] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(DEFAULT_AVATARS[0]);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // 계정 보안 설정 (아이디 & 비밀번호 설정) 상태
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [customIdInput, setCustomIdInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordConfirmInput, setPasswordConfirmInput] = useState('');
  const [securityError, setSecurityError] = useState<string | null>(null);
  const [securitySuccess, setSecuritySuccess] = useState<string | null>(null);
  const [isSecuritySaving, setIsSecuritySaving] = useState(false);

  // 엔트리 아이디 자동 추출 폴링 상태
  const [isVerifyingEntryId, setIsVerifyingEntryId] = useState(false);
  const idPollingRef = useRef<NodeJS.Timeout | null>(null);

  const handleDeleteAccount = async () => {
    if (!isOwner) return;

    const confirmed = confirm(
      '정말로 Entry-Hub에서 회원 탈퇴하시겠습니까?\n\n' +
      '• 회원 정보 및 북마크, 좋아요 내역이 모두 영구 삭제됩니다.\n' +
      '• 단, 엔트리 커뮤니티의 연속성을 위해 기존에 등록하신 에셋은 삭제되지 않고 안전하게 보존됩니다.\n\n' +
      '탈퇴를 진행하시려면 [확인]을 눌러주세요.'
    );

    if (!confirmed) return;

    setIsDeleting(true);
    try {
      const { error } = await deleteAccount();
      if (error) throw error;

      alert('계정 탈퇴가 성공적으로 완료되었습니다. 그동안 이용해 주셔서 감사합니다.');
      setIsEditOpen(false);
      router.push('/');
    } catch (err: any) {
      alert(err?.message || '탈퇴 처리 중 오류가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    async function loadProfile() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', profileId)
          .single();

        if (data) {
          setProfileData(data as UserProfile);
          setEditNickname(data.nickname || '');
          setEditEntryUrl(data.entry_profile_url || '');
          setSelectedAvatar(data.avatar_url || DEFAULT_AVATARS[0]);
          setCustomIdInput(data.custom_id || '');
        } else {
          const fallback: UserProfile = {
            id: profileId,
            nickname: isOwner ? (myProfile?.nickname || '사용자') : '사용자',
            avatar_url: DEFAULT_AVATARS[0],
            role: 'USER',
          };
          setProfileData(fallback);
          setEditNickname(fallback.nickname);
          setSelectedAvatar(fallback.avatar_url || DEFAULT_AVATARS[0]);
        }

        // 유저 배지 목록 쿼리
        try {
          const { data: bData } = await supabase
            .from('user_badges')
            .select('id, name, color, description')
            .eq('user_id', profileId)
            .order('created_at', { ascending: true });
          if (bData) {
            setUserBadges(bData);
          }
        } catch (e) {
          console.warn('User badges query error:', e);
        }

        // 유저 업로드 에셋 실제 쿼리
        const { data: uploads } = await supabase
          .from('assets')
          .select('*')
          .eq('author_id', profileId)
          .order('created_at', { ascending: false });

        if (uploads) {
          setUploadedAssets(
            uploads.map((u: any) => ({
              id: u.id,
              title: u.title,
              description: u.description,
              type: u.type,
              authorName: u.author_name || '작성자',
              isOfficialBadge: u.is_official_badge,
              isAdminPick: u.is_admin_pick,
              likeCount: u.like_count || 0,
              bookmarkCount: u.bookmark_count || 0,
            }))
          );
        }

        // 유저 북마크 에셋 실제 쿼리
        const { data: bookmarkRows } = await supabase
          .from('bookmarks')
          .select('asset_id')
          .eq('user_id', profileId);

        if (bookmarkRows && bookmarkRows.length > 0) {
          const assetIds = bookmarkRows.map((b: any) => b.asset_id);
          const { data: bAssets } = await supabase
            .from('assets')
            .select('*')
            .in('id', assetIds);

          if (bAssets) {
            setBookmarkedAssets(
              bAssets.map((u: any) => ({
                id: u.id,
                title: u.title,
                description: u.description,
                type: u.type,
                authorName: u.author_name || '작성자',
                isOfficialBadge: u.is_official_badge,
                isAdminPick: u.is_admin_pick,
                likeCount: u.like_count || 0,
                bookmarkCount: u.bookmark_count || 0,
              }))
            );
          } else {
            setBookmarkedAssets([]);
          }
        } else {
          setBookmarkedAssets([]);
        }
      } catch (e) {
        console.warn('Profile load error:', e);
        setUploadedAssets([]);
        setBookmarkedAssets([]);
      } finally {
        setLoading(false);
      }
    }

    if (profileId) {
      loadProfile();
    }
  }, [profileId, isOwner, myProfile]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const { data: authData } = await supabase.auth.getUser();
      const currentUser = authData?.user;

      if (!currentUser) {
        throw new Error('프로필을 수정하려면 로그인이 필요합니다.');
      }

      // 1. Supabase public.users 테이블 upsert
      const { error: dbError } = await supabase
        .from('users')
        .upsert(
          {
            id: currentUser.id,
            email: currentUser.email,
            nickname: editNickname.trim(),
            entry_profile_url: editEntryUrl.trim() || null,
            avatar_url: selectedAvatar,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );

      if (dbError) {
        console.error('Profile DB save error:', dbError);
        throw dbError;
      }

      // 2. Supabase Auth 메타데이터 동기화
      await supabase.auth.updateUser({
        data: {
          nickname: editNickname.trim(),
          avatar_url: selectedAvatar,
        },
      });

      setProfileData((prev) =>
        prev
          ? {
              ...prev,
              nickname: editNickname.trim(),
              entry_profile_url: editEntryUrl.trim(),
              avatar_url: selectedAvatar,
            }
          : null
      );
      await refreshProfile();
      alert('프로필 정보가 저장되었습니다!');
      setIsEditOpen(false);
    } catch (e: any) {
      console.warn('Profile save exception:', e);
      alert(e?.message || '프로필 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // 엔트리 계정 연동 변경 (entry_user_id + nickname 갱신)
  const handleChangeEntryAccount = async () => {
    setSecurityError(null);
    setIsVerifyingEntryId(true);

    // [팝업 차단 방지] 사용자 클릭 직후 동기적으로 빈 창 선오픈
    const popup = typeof window !== 'undefined' ? window.open('about:blank', '_blank') : null;

    try {
      const code = `EH-CHG-${Math.floor(1000 + Math.random() * 9000)}`;

      const { data, error } = await supabase
        .from('entry_verifications')
        .insert({
          code,
          entry_username: 'ALL',
          verification_type: 'LINK_ID',
          status: 'PENDING',
        })
        .select('id')
        .single();

      if (error || !data) {
        if (popup) popup.close();
        throw new Error('인증 요청 생성 실패');
      }

      const vId = data.id;

      // 엔트리 메인 홈 탭 주소 이동
      const targetUrl = 'https://playentry.org?entry_hub_action=link_id';
      if (popup) {
        popup.location.href = targetUrl;
      }

      // 폴링 시작
      if (idPollingRef.current) clearInterval(idPollingRef.current);
      idPollingRef.current = setInterval(async () => {
        try {
          const { data: pollData } = await supabase
            .from('entry_verifications')
            .select('status, entry_user_id, nickname')
            .eq('id', vId)
            .single();

          if (pollData?.status === 'VERIFIED') {
            if (idPollingRef.current) clearInterval(idPollingRef.current);
            setIsVerifyingEntryId(false);

            const fetchedEntryUserId = pollData.entry_user_id || '';
            const fetchedNickname = pollData.nickname || '엔트리사용자';

            if (!fetchedEntryUserId) {
              setSecurityError('엔트리 고유번호를 가져오지 못했습니다. 다시 시도해 주세요.');
              return;
            }

            // DB에서 중복 체크 (다른 계정이 이미 사용 중인 entry_user_id인지 확인)
            const { data: dupCheck } = await supabase
              .from('users')
              .select('id')
              .eq('entry_user_id', fetchedEntryUserId)
              .neq('id', user!.id)
              .maybeSingle();

            if (dupCheck) {
              setSecurityError('이미 다른 계정에 연동된 엔트리 계정입니다.');
              return;
            }

            // entry_user_id, nickname 갱신 (entry_username은 저장하지 않음)
            if (user?.id) {
              await supabase
                .from('users')
                .update({
                  entry_user_id: fetchedEntryUserId,
                  nickname: fetchedNickname,
                })
                .eq('id', user.id);

              setProfileData((prev) =>
                prev ? { ...prev, entry_user_id: fetchedEntryUserId, nickname: fetchedNickname } : null
              );
              setEditNickname(fetchedNickname);
              await refreshProfile();

              alert(
                `엔트리 계정이 변경되었습니다.\n닉네임: ${fetchedNickname}\n\n변경 사항을 완전히 적용하려면 다시 로그인해 주세요.`
              );
            }
          } else if (pollData?.status === 'EXPIRED') {
            if (idPollingRef.current) clearInterval(idPollingRef.current);
            setIsVerifyingEntryId(false);
            setSecurityError('엔트리 인증이 취소되었습니다.');
          }
        } catch (e) {
          console.warn('Account change polling error:', e);
        }
      }, 2000);
    } catch (err: any) {
      if (popup) popup.close();
      setSecurityError(err.message || '인증 요청 생성 중 오류가 발생했습니다.');
      setIsVerifyingEntryId(false);
    }
  };

  // 계정 보안 (아이디 & 비밀번호) 저장 처리
  const handleSaveSecurity = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecurityError(null);
    setSecuritySuccess(null);

    // 비밀번호 입력 시 일치 확인
    if (passwordInput || passwordConfirmInput) {
      if (passwordInput.length < 6) {
        setSecurityError('비밀번호는 최소 6자 이상이어야 합니다.');
        return;
      }
      if (passwordInput !== passwordConfirmInput) {
        setSecurityError('비밀번호와 비밀번호 확인이 일치하지 않습니다.');
        return;
      }
    }

    setIsSecuritySaving(true);
    try {
      const finalId = customIdInput.trim() || undefined;

      const { error, customId } = await setCredentials(
        finalId,
        passwordInput.trim() || undefined
      );

      if (error) {
        throw error;
      }

      setSecuritySuccess('아이디와 비밀번호가 성공적으로 저장되었습니다!');
      if (customId) {
        setCustomIdInput(customId);
      }
      setPasswordInput('');
      setPasswordConfirmInput('');

      setTimeout(() => {
        setIsSecurityModalOpen(false);
        setSecuritySuccess(null);
      }, 1500);
    } catch (err: any) {
      setSecurityError(err.message || '저장 중 오류가 발생했습니다.');
    } finally {
      setIsSecuritySaving(false);
    }
  };

  useEffect(() => {
    return () => {
      if (idPollingRef.current) clearInterval(idPollingRef.current);
    };
  }, []);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: colors.canvas }}>
        <Header />
        <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: colors.mute, fontSize: '14px' }}>프로필 정보를 불러오는 중...</p>
        </main>
        <Footer />
      </div>
    );
  }

  // 소셜 계정 여부 판단 (is_social 필드만 사용, entry_username 의존 제거)
  const isSocial = profileData?.is_social ?? false;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: colors.canvasSoft }}>
      <Header />

      <main style={{ flex: 1, maxWidth: '1000px', width: '100%', margin: '0 auto', padding: '40px 24px' }}>
        {/* Profile Card Header */}
        <div
          style={{
            backgroundColor: colors.canvas,
            borderRadius: '16px',
            border: `1px solid ${colors.hairline}`,
            padding: '32px',
            marginBottom: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '24px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
            {/* Avatar */}
            <div
              style={{
                width: '84px',
                height: '84px',
                borderRadius: '50%',
                backgroundColor: colors.canvasSoft2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                border: `2px solid ${colors.hairlineStrong}`,
                flexShrink: 0,
              }}
            >
              {profileData?.avatar_url ? (
                <img
                  src={profileData.avatar_url}
                  alt={profileData.nickname}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <User size={40} color={colors.mute} />
              )}
            </div>

            {/* User Meta */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
                <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: colors.ink }}>
                  {profileData?.nickname || '사용자'}
                </h1>
                {profileData?.role === 'ADMIN' && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: '6px',
                      backgroundColor: colors.violetSoft,
                      color: colors.violetDeep,
                    }}
                  >
                    <ShieldCheck size={12} />
                    ADMIN
                  </span>
                )}
                {userBadges.map((b) => (
                  <span
                    key={b.id}
                    title={b.description || b.name}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: '6px',
                      backgroundColor: `${b.color}18`,
                      border: `1px solid ${b.color}`,
                      color: b.color,
                    }}
                  >
                    <Sparkles size={11} />
                    {b.name}
                  </span>
                ))}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', fontSize: '13px', color: colors.mute }}>
                {profileData?.custom_id ? (
                  <span>로그인 ID: <strong style={{ color: colors.ink }}>{profileData.custom_id}</strong></span>
                ) : (
                  <span>로그인 ID: <span style={{ color: colors.mute }}>미설정 (엔트리 인증 로그인 사용 중)</span></span>
                )}

                {profileData?.entry_profile_url ? (
                  <a
                    href={profileData.entry_profile_url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      color: colors.link,
                      textDecoration: 'none',
                      fontWeight: 500,
                    }}
                  >
                    <span>엔트리 프로필 방문</span>
                    <ExternalLink size={12} />
                  </a>
                ) : (
                  <span>엔트리 프로필 미연동</span>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons (for Owner) */}
          {isOwner && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => {
                  setSecurityError(null);
                  setSecuritySuccess(null);
                  setIsSecurityModalOpen(true);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: `1px solid ${colors.primary}`,
                  backgroundColor: `${colors.primary}10`,
                  color: colors.primary,
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <KeyRound size={15} />
                <span>아이디 / 비밀번호 설정</span>
              </button>

              <button
                type="button"
                onClick={() => setIsEditOpen(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: `1px solid ${colors.hairlineStrong}`,
                  backgroundColor: colors.canvas,
                  color: colors.ink,
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Edit3 size={15} />
                <span>프로필 수정</span>
              </button>
            </div>
          )}
        </div>

        {/* Tabs Bar */}
        <div style={{ display: 'flex', gap: '16px', borderBottom: `1px solid ${colors.hairline}`, marginBottom: '24px' }}>
          <button
            onClick={() => setActiveTab('UPLOADS')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '12px 16px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'UPLOADS' ? `2px solid ${colors.ink}` : '2px solid transparent',
              color: activeTab === 'UPLOADS' ? colors.ink : colors.mute,
              fontWeight: 600,
              fontSize: '15px',
              cursor: 'pointer',
            }}
          >
            <Package size={16} />
            <span>업로드 에셋 ({uploadedAssets.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('BOOKMARKS')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '12px 16px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'BOOKMARKS' ? `2px solid ${colors.ink}` : '2px solid transparent',
              color: activeTab === 'BOOKMARKS' ? colors.ink : colors.mute,
              fontWeight: 600,
              fontSize: '15px',
              cursor: 'pointer',
            }}
          >
            <Bookmark size={16} />
            <span>북마크 ({bookmarkedAssets.length})</span>
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'UPLOADS' && (
          <div>
            {uploadedAssets.length === 0 ? (
              <div style={{ padding: '60px 0', textAlign: 'center', color: colors.mute, fontSize: '14px' }}>
                아직 등록한 에셋이 없습니다.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                {uploadedAssets.map((asset) => (
                  <AssetCard key={asset.id} {...asset} />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'BOOKMARKS' && (
          <div>
            {bookmarkedAssets.length === 0 ? (
              <div style={{ padding: '60px 0', textAlign: 'center', color: colors.mute, fontSize: '14px' }}>
                북마크한 에셋이 없습니다.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                {bookmarkedAssets.map((asset) => (
                  <AssetCard key={asset.id} {...asset} />
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* 계정 보안 설정 (아이디 & 비밀번호 설정) 모달 */}
      {isSecurityModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
          }}
          onClick={() => setIsSecurityModalOpen(false)}
        >
          <div
            style={{
              backgroundColor: colors.canvas,
              borderRadius: '16px',
              maxWidth: '480px',
              width: '100%',
              overflow: 'hidden',
              border: `1px solid ${colors.hairline}`,
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: '20px 24px',
                borderBottom: `1px solid ${colors.hairline}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <KeyRound size={18} color={colors.primary} />
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: colors.ink }}>
                  아이디 및 비밀번호 설정
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSecurityModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: colors.mute }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveSecurity} style={{ padding: '24px' }}>
              {securityError && (
                <div
                  style={{
                    padding: '10px 12px',
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fee2e2',
                    borderRadius: '8px',
                    color: '#ef4444',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    marginBottom: '16px',
                  }}
                >
                  <AlertCircle size={14} />
                  <span>{securityError}</span>
                </div>
              )}

              {securitySuccess && (
                <div
                  style={{
                    padding: '10px 12px',
                    backgroundColor: '#f0fdf4',
                    border: '1px solid #dcfce7',
                    borderRadius: '8px',
                    color: '#15803d',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    marginBottom: '16px',
                  }}
                >
                  <Check size={14} />
                  <span>{securitySuccess}</span>
                </div>
              )}

              {/* 1. 아이디 설정 */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: colors.ink, marginBottom: '6px' }}>
                  로그인 아이디
                </label>
                <input
                  type="text"
                  value={customIdInput}
                  onChange={(e) => setCustomIdInput(e.target.value.trim())}
                  placeholder="원하는 아이디 입력 (영문, 숫자, 언더스코어)"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: `1px solid ${colors.hairlineStrong}`,
                    backgroundColor: colors.canvasSoft,
                    color: colors.ink,
                    fontSize: '14px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                <p style={{ margin: '6px 0 0', fontSize: '11px', color: colors.mute, lineHeight: 1.4 }}>
                  아이디를 설정하면 엔트리 인증 없이도 아이디+비밀번호로 로그인할 수 있습니다.
                </p>
              </div>

              {/* 연동된 엔트리 계정 정보 */}
              <div
                style={{
                  marginBottom: '20px',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  backgroundColor: colors.canvasSoft2,
                  border: `1px solid ${colors.hairline}`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: colors.mute, marginBottom: '2px' }}>연동된 엔트리 계정</div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: colors.ink }}>
                      {profileData?.nickname || '(닉네임 없음)'}
                    </div>
                    {profileData?.entry_user_id && (
                      <div style={{ fontSize: '10px', color: colors.mute, marginTop: '2px' }}>
                        고유번호: {profileData.entry_user_id.slice(0, 12)}...
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleChangeEntryAccount}
                    disabled={isVerifyingEntryId}
                    style={{
                      padding: '6px 10px',
                      borderRadius: '6px',
                      border: `1px solid ${colors.hairlineStrong}`,
                      backgroundColor: colors.canvas,
                      color: colors.ink,
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: isVerifyingEntryId ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      flexShrink: 0,
                    }}
                  >
                    {isVerifyingEntryId ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />}
                    <span>다른 계정으로 변경</span>
                  </button>
                </div>
              </div>

              {/* 2. 비밀번호 설정 */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: colors.ink, marginBottom: '6px' }}>
                  새 비밀번호
                </label>
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="최소 6자 이상"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: `1px solid ${colors.hairlineStrong}`,
                    fontSize: '14px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* 비밀번호 확인 */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: colors.ink, marginBottom: '6px' }}>
                  비밀번호 확인
                </label>
                <input
                  type="password"
                  value={passwordConfirmInput}
                  onChange={(e) => setPasswordConfirmInput(e.target.value)}
                  placeholder="비밀번호 다시 입력"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: `1px solid ${colors.hairlineStrong}`,
                    fontSize: '14px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsSecurityModalOpen(false)}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '8px',
                    border: `1px solid ${colors.hairlineStrong}`,
                    backgroundColor: colors.canvas,
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isSecuritySaving}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: colors.primary,
                    color: colors.onPrimary,
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: isSecuritySaving ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {isSecuritySaving ? <Loader2 size={14} className="animate-spin" /> : null}
                  <span>설정 저장</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Profile Edit Modal */}
      {isEditOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
          }}
          onClick={() => setIsEditOpen(false)}
        >
          <div
            style={{
              backgroundColor: colors.canvas,
              borderRadius: '16px',
              maxWidth: '520px',
              width: '100%',
              overflow: 'hidden',
              border: `1px solid ${colors.hairline}`,
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: '20px 24px',
                borderBottom: `1px solid ${colors.hairline}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: colors.ink }}>
                프로필 수정
              </h3>
              <button
                onClick={() => setIsEditOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: colors.mute }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} style={{ padding: '24px' }}>
              {/* Avatar Selector (10 Presets) */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: colors.ink, marginBottom: '10px' }}>
                  기본 프로필 아바타 선택 (10종)
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
                  {DEFAULT_AVATARS.map((avatarUrl, idx) => (
                    <div
                      key={idx}
                      onClick={() => setSelectedAvatar(avatarUrl)}
                      style={{
                        width: '60px',
                        height: '60px',
                        borderRadius: '50%',
                        cursor: 'pointer',
                        border: selectedAvatar === avatarUrl ? `3px solid ${colors.primary}` : `1px solid ${colors.hairlineStrong}`,
                        padding: '2px',
                        backgroundColor: colors.canvasSoft2,
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <img src={avatarUrl} alt={`Avatar ${idx + 1}`} style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
                      {selectedAvatar === avatarUrl && (
                        <div
                          style={{
                            position: 'absolute',
                            bottom: 0,
                            right: 0,
                            backgroundColor: colors.primary,
                            borderRadius: '50%',
                            width: '18px',
                            height: '18px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Check size={12} color="#ffffff" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Nickname Input (수정 불가, 엔트리 인증으로만 동기화) */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: colors.ink }}>
                    닉네임
                  </label>
                  <button
                    type="button"
                    onClick={handleChangeEntryAccount}
                    disabled={isVerifyingEntryId}
                    style={{
                      padding: '3px 8px',
                      borderRadius: '6px',
                      border: `1px solid ${colors.primary}`,
                      backgroundColor: `${colors.primary}10`,
                      color: colors.primary,
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: isVerifyingEntryId ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    {isVerifyingEntryId ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />}
                    <span>엔트리 인증으로 닉네임 동기화</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={editNickname}
                  readOnly
                  disabled
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: `1px solid ${colors.hairlineStrong}`,
                    backgroundColor: colors.canvasSoft2,
                    color: colors.ink,
                    fontSize: '14px',
                    outline: 'none',
                    cursor: 'not-allowed',
                  }}
                />
                <p style={{ margin: '4px 0 0', fontSize: '11px', color: colors.mute }}>
                  닉네임은 직접 수정할 수 없으며, [엔트리 인증으로 닉네임 동기화]를 통해 엔트리 닉네임과 자동으로 일치됩니다.
                </p>
              </div>

              {/* Entry Profile Link Input */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: colors.ink, marginBottom: '6px' }}>
                  엔트리 프로필 링크
                </label>
                <input
                  type="url"
                  value={editEntryUrl}
                  onChange={(e) => setEditEntryUrl(e.target.value)}
                  placeholder="https://playentry.org/profile/..."
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: `1px solid ${editEntryUrl.trim() && !editEntryUrl.trim().startsWith('https://playentry.org/profile/') ? '#e53e3e' : colors.hairlineStrong}`,
                    fontSize: '14px',
                    outline: 'none',
                  }}
                />
                {editEntryUrl.trim() && !editEntryUrl.trim().startsWith('https://playentry.org/profile/') && (
                  <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#e53e3e', fontWeight: 500 }}>
                    올바른 엔트리 프로필 주소(https://playentry.org/profile/...)를 입력해 주세요.
                  </p>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  style={{
                    padding: '10px 18px',
                    borderRadius: '8px',
                    border: `1px solid ${colors.hairlineStrong}`,
                    backgroundColor: colors.canvas,
                    fontSize: '14px',
                    cursor: 'pointer',
                  }}
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isSaving || (Boolean(editEntryUrl.trim()) && !editEntryUrl.trim().startsWith('https://playentry.org/profile/'))}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '10px 20px',
                    borderRadius: '8px',
                    backgroundColor: isSaving || (Boolean(editEntryUrl.trim()) && !editEntryUrl.trim().startsWith('https://playentry.org/profile/')) ? colors.mute : colors.primary,
                    color: colors.onPrimary,
                    fontSize: '14px',
                    fontWeight: 600,
                    border: 'none',
                    cursor: isSaving || (Boolean(editEntryUrl.trim()) && !editEntryUrl.trim().startsWith('https://playentry.org/profile/')) ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isSaving ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>저장 중...</span>
                    </>
                  ) : (
                    <span>저장하기</span>
                  )}
                </button>
              </div>

              {/* Danger Zone: 계정 탈퇴 */}
              <div
                style={{
                  marginTop: '24px',
                  paddingTop: '20px',
                  borderTop: `1px solid ${colors.hairline}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <h4 style={{ margin: '0 0 4px', fontSize: '13px', fontWeight: 600, color: '#e53e3e' }}>
                      계정 탈퇴
                    </h4>
                    <p style={{ margin: 0, fontSize: '11px', color: colors.mute, lineHeight: 1.4 }}>
                      탈퇴 시 북마크 및 계정 정보가 삭제됩니다.<br />
                      <strong>작성하신 에셋은 삭제되지 않고 안전하게 보존됩니다.</strong>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleDeleteAccount}
                    disabled={isDeleting}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid #fed7d7',
                      backgroundColor: '#fff5f5',
                      color: '#e53e3e',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: isDeleting ? 'not-allowed' : 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    <Trash2 size={13} />
                    <span>{isDeleting ? '탈퇴 처리 중...' : '회원 탈퇴'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
