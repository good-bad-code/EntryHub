'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Header } from '../../infrastructure/components/layout/Header';
import { Footer } from '../../infrastructure/components/layout/Footer';
import { useTheme } from '../../infrastructure/theme/ThemeContext';
import { useAuth } from '../../infrastructure/auth/AuthContext';
import { supabase } from '../../infrastructure/supabase/client';
import {
  ShieldCheck,
  Sparkles,
  FolderKanban,
  AlertTriangle,
  UserX,
  Plus,
  Trash2,
  CheckCircle2,
  Lock,
  ArrowRight,
  Eye,
  ExternalLink,
  Users,
  Search,
  Check,
  X,
  Ban,
} from 'lucide-react';

interface AdminAssetItem {
  id: string;
  title: string;
  type: string;
  author_name: string;
  is_admin_pick: boolean;
  like_count: number;
}

interface AdminReportItem {
  id: string;
  asset_id: string;
  asset_title: string;
  reporter_email: string;
  reason: string;
  detail?: string;
  status: 'PENDING' | 'RESOLVED' | 'DISMISSED';
  created_at: string;
}

interface CategoryAdminItem {
  id: string;
  name: string;
  color: string;
  description: string;
}

interface UserBadgeItem {
  id: string;
  user_id: string;
  name: string;
  color: string;
  description?: string;
  created_at: string;
  user?: {
    id: string;
    email?: string;
    nickname?: string;
  };
}

interface AdminUserItem {
  id: string;
  nickname: string;
  entry_username?: string;
  entry_user_id?: string;
  custom_id?: string;
  is_social?: boolean;
  has_password?: boolean;
  role: string;
  is_banned: boolean;
  created_at: string;
  avatar_url?: string;
  entry_profile_url?: string;
}

export default function AdminDashboardPage() {
  const { colors } = useTheme();
  const { user, profile, loading: authLoading, isAdmin } = useAuth();

  const [activeTab, setActiveTab] = useState<'PICKS' | 'CATEGORIES' | 'REPORTS' | 'BADGES' | 'USERS'>('PICKS');

  const tabButtonStyle = (isActive: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: isActive ? colors.primary : 'transparent',
    color: isActive ? colors.onPrimary : colors.mute,
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  });

  const inputStyle: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '10px 14px',
    borderRadius: '8px',
    border: `1px solid ${colors.hairlineStrong}`,
    fontSize: '13px',
    outline: 'none',
    backgroundColor: colors.canvas,
    color: colors.ink,
  };

  // 1. 관리자픽 관리 상태
  const [assets, setAssets] = useState<AdminAssetItem[]>([]);

  // 2. 카테고리 관리 상태
  const [categories, setCategories] = useState<CategoryAdminItem[]>([]);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#0070f3');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [isCreatingCat, setIsCreatingCat] = useState(false);

  // 3. 신고 관리 상태
  const [reports, setReports] = useState<AdminReportItem[]>([]);

  // 4. 공식 배지 부여 상태
  const [badges, setBadges] = useState<UserBadgeItem[]>([]);
  const [badgeTargetUser, setBadgeTargetUser] = useState('');
  const [badgeName, setBadgeName] = useState('공식 크리에이터');
  const [badgeColor, setBadgeColor] = useState('#7928ca');
  const [badgeDesc, setBadgeDesc] = useState('엔트리 허브 공식 인증 창작자');
  const [isSubmittingBadge, setIsSubmittingBadge] = useState(false);
  const [allUsers, setAllUsers] = useState<{ id: string; nickname?: string; email?: string }[]>([]);

  // 5. 전체 유저 목록 상태
  const [userList, setUserList] = useState<AdminUserItem[]>([]);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [isUserLoading, setIsUserLoading] = useState(false);

  // 실시간 데이터 로드
  useEffect(() => {
    async function loadAdminData() {
      // 에셋 로드
      const { data: assetData } = await supabase
        .from('assets')
        .select('id, title, type, author_name, is_admin_pick, like_count')
        .order('created_at', { ascending: false });
      if (assetData) {
        setAssets(assetData as AdminAssetItem[]);
      }

      // 카테고리 로드
      const { data: catData } = await supabase
        .from('categories')
        .select('id, name, color, description')
        .order('created_at', { ascending: true });
      if (catData) {
        setCategories(catData as CategoryAdminItem[]);
      }

      // 신고 로드
      const { data: repData } = await supabase
        .from('reports')
        .select('*')
        .order('created_at', { ascending: false });
      if (repData) {
        setReports(
          repData.map((r: any) => ({
            id: r.id,
            asset_id: r.asset_id,
            asset_title: r.asset_id,
            reporter_email: r.reporter_id,
            reason: r.reason,
            detail: r.detail,
            status: r.status,
            created_at: new Date(r.created_at).toLocaleDateString('ko-KR'),
          }))
        );
      }

      // 배지 목록 로드 (유저 닉네임/이메일 함께 쿼리)
      try {
        const { data: bData } = await supabase
          .from('user_badges')
          .select('id, user_id, name, color, description, created_at, users(id, nickname, email)')
          .order('created_at', { ascending: false });
        if (bData) {
          setBadges(
            bData.map((b: any) => ({
              id: b.id,
              user_id: b.user_id,
              name: b.name,
              color: b.color || '#0070f3',
              description: b.description,
              created_at: new Date(b.created_at).toLocaleDateString('ko-KR'),
              user: b.users || null,
            }))
          );
        }
      } catch (e) {
        console.warn('Badges load error:', e);
      }

      // 전체 유저 후보군 및 관리자 유저 관리 데이터 로드
      try {
        setIsUserLoading(true);
        const { data: uData } = await supabase
          .from('users')
          .select('id, nickname, entry_username, entry_user_id, custom_id, is_social, has_password, role, is_banned, created_at, avatar_url, entry_profile_url')
          .order('created_at', { ascending: false });
        if (uData) {
          setUserList(uData as AdminUserItem[]);
          setAllUsers(uData.map((u) => ({ id: u.id, nickname: u.nickname })));
        }
      } catch (e) {
        console.warn('User list load error:', e);
      } finally {
        setIsUserLoading(false);
      }
    }

    loadAdminData();
  }, []);

  const toggleAdminPick = async (assetId: string) => {
    const target = assets.find((a) => a.id === assetId);
    if (!target) return;
    const nextPick = !target.is_admin_pick;

    setAssets((prev) =>
      prev.map((item) =>
        item.id === assetId ? { ...item, is_admin_pick: nextPick } : item
      )
    );

    try {
      await supabase
        .from('assets')
        .update({ is_admin_pick: nextPick })
        .eq('id', assetId);
    } catch (e) {
      console.warn('Admin pick update warning:', e);
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim() || isCreatingCat) return;

    setIsCreatingCat(true);
    // PostgreSQL UUID 컬럼 및 TEXT 컬럼 모두에 호환되는 표준 UUID 발급
    const catId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `cat_${Date.now()}`;
    const newCat: CategoryAdminItem = {
      id: catId,
      name: newCatName.trim(),
      color: newCatColor,
      description: newCatDesc.trim(),
    };

    try {
      // 1. 전체 필드 삽입 시도
      let { error } = await supabase.from('categories').insert({
        id: catId,
        name: newCat.name,
        color: newCat.color,
        description: newCat.description,
        creator_id: user?.id || null,
      });

      // 2. 만약 color 컬럼이 DB에 없는 구형 스키마일 경우 color 제외 후 재시도
      if (error && (error.message?.includes('color') || error.message?.includes('column "color"'))) {
        console.warn('Retrying category insert without color column...');
        const retryRes = await supabase.from('categories').insert({
          id: catId,
          name: newCat.name,
          description: newCat.description,
          creator_id: user?.id || null,
        });
        error = retryRes.error;
      }

      if (error) {
        throw error;
      }

      setCategories((prev) => [...prev, newCat]);
      setNewCatName('');
      setNewCatDesc('');
      alert(`'${newCat.name}' 카테고리가 생성되었습니다!`);
    } catch (err: any) {
      console.error('[Entry-Hub] Category insert failed:', err);
      alert(`카테고리 생성에 실패했습니다: ${err?.message || '알 수 없는 오류'}`);
    } finally {
      setIsCreatingCat(false);
    }
  };

  const handleDeleteCategory = async (catId: string) => {
    if (!confirm('정말 이 카테고리를 삭제하시겠습니까?')) return;
    try {
      const { error } = await supabase.from('categories').delete().eq('id', catId);
      if (error) throw error;
      setCategories((prev) => prev.filter((c) => c.id !== catId));
    } catch (err: any) {
      console.error('[Entry-Hub] Category delete error:', err);
      alert(`카테고리 삭제에 실패했습니다: ${err?.message || '오류 발생'}`);
    }
  };

  const handleResolveReport = async (reportId: string, action: 'RESOLVE' | 'DISMISS') => {
    const nextStatus = action === 'RESOLVE' ? 'RESOLVED' : 'DISMISSED';
    setReports((prev) =>
      prev.map((r) => (r.id === reportId ? { ...r, status: nextStatus } : r))
    );

    try {
      await supabase.from('reports').update({ status: nextStatus }).eq('id', reportId);
      if (action === 'RESOLVE') {
        const rep = reports.find((r) => r.id === reportId);
        if (rep?.asset_id) {
          // 에셋 삭제
          await supabase.from('assets').delete().eq('id', rep.asset_id);
          setAssets((prev) => prev.filter((a) => a.id !== rep.asset_id));
        }
      }
    } catch (e) {
      console.warn('Report resolve warning:', e);
    }
  };

  const handleGrantBadge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!badgeTargetUser.trim() || !badgeName.trim() || isSubmittingBadge) return;

    setIsSubmittingBadge(true);
    try {
      const input = badgeTargetUser.trim();
      let targetUid = input;

      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input);
      let targetUserData: any = null;

      if (isUUID) {
        const { data: u } = await supabase.from('users').select('id, nickname, email').eq('id', targetUid).single();
        targetUserData = u;
      } else {
        // 이메일 또는 닉네임으로 유저 검색
        const { data: foundUsers } = await supabase
          .from('users')
          .select('id, nickname, email')
          .or(`email.eq.${input},nickname.eq.${input},entry_username.eq.${input}`)
          .limit(1);

        if (!foundUsers || foundUsers.length === 0) {
          throw new Error(`'${input}'에 해당하는 사용자를 찾을 수 없습니다. 정확한 이메일이나 닉네임을 입력해주세요.`);
        }
        targetUid = foundUsers[0].id;
        targetUserData = foundUsers[0];
      }

      const badgeId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : (Date.now().toString());
      const newBadgeRow = {
        id: badgeId,
        user_id: targetUid,
        name: badgeName.trim(),
        color: badgeColor,
        description: badgeDesc.trim() || null,
      };

      const { error: insErr } = await supabase.from('user_badges').insert(newBadgeRow);
      if (insErr) throw insErr;

      // 로컬 상태 즉시 반영
      const createdItem: UserBadgeItem = {
        id: badgeId,
        user_id: targetUid,
        name: badgeName.trim(),
        color: badgeColor,
        description: badgeDesc.trim() || undefined,
        created_at: new Date().toLocaleDateString('ko-KR'),
        user: targetUserData || { id: targetUid, nickname: targetUid },
      };

      setBadges((prev) => [createdItem, ...prev]);
      alert(`[${targetUserData?.nickname || targetUserData?.email || targetUid}] 님에게 '${badgeName}' 공식 배지가 성공적으로 부여되었습니다!`);
      setBadgeTargetUser('');
    } catch (err: any) {
      console.error('[Entry-Hub] Grant badge error:', err);
      alert(`배지 부여 실패: ${err?.message || '알 수 없는 오류가 발생했습니다.'}`);
    } finally {
      setIsSubmittingBadge(false);
    }
  };

  const handleRevokeBadge = async (badgeId: string) => {
    if (!confirm('정말 이 배지를 회수하시겠습니까?')) return;
    try {
      const { error } = await supabase.from('user_badges').delete().eq('id', badgeId);
      if (error) throw error;
      setBadges((prev) => prev.filter((b) => b.id !== badgeId));
      alert('배지가 성공적으로 회수되었습니다.');
    } catch (err: any) {
      console.error('[Entry-Hub] Revoke badge error:', err);
      alert(`배지 회수 실패: ${err?.message || '오류가 발생했습니다.'}`);
    }
  };

  const handleToggleBanUser = async (targetUser: AdminUserItem) => {
    const nextBan = !targetUser.is_banned;
    const actionName = nextBan ? '차단' : '차단 해제';
    if (!confirm(`'${targetUser.nickname}' 사용자를 ${actionName}하시겠습니까?`)) return;

    try {
      const { error } = await supabase
        .from('users')
        .update({ is_banned: nextBan })
        .eq('id', targetUser.id);

      if (error) throw error;

      setUserList((prev) =>
        prev.map((u) => (u.id === targetUser.id ? { ...u, is_banned: nextBan } : u))
      );
      alert(`사용자가 ${actionName}되었습니다.`);
    } catch (err: any) {
      console.error('Toggle ban error:', err);
      alert(`처리 실패: ${err?.message || '오류가 발생했습니다.'}`);
    }
  };

  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: colors.canvas }}>
        <Header />
        <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: colors.mute, fontSize: '14px' }}>관리자 권한 확인 중...</p>
        </main>
        <Footer />
      </div>
    );
  }

  // 관리자 권한 확인 (비관리자일 경우 접근 차단 안내)
  const isMasterAdmin =
    (profile?.entry_username || '').toLowerCase() === 'myentrymy' ||
    (profile?.nickname || '').toLowerCase() === 'myentrymy' ||
    (user?.email || '').toLowerCase() === 'myentrymy@entry-hub.local' ||
    (user?.email || '').toLowerCase() === 'learn.code.ing.ing@gmail.com';
  if (!user || (!isAdmin && profile?.role !== 'ADMIN' && !isMasterAdmin)) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: colors.canvasSoft }}>
        <Header />
        <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
          <div
            style={{
              maxWidth: '440px',
              textAlign: 'center',
              backgroundColor: colors.canvas,
              padding: '40px',
              borderRadius: '16px',
              border: `1px solid ${colors.hairline}`,
            }}
          >
            <Lock size={44} color={colors.mute} style={{ margin: '0 auto 16px' }} />
            <h2 style={{ margin: '0 0 8px', fontSize: '20px', color: colors.ink }}>관리자 전용 페이지</h2>
            <p style={{ margin: '0 0 24px', fontSize: '14px', color: colors.mute }}>
              이 페이지는 관리자(Admin) 권한이 있는 계정만 접근할 수 있습니다.
            </p>
            <Link
              href="/"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 20px',
                borderRadius: '8px',
                backgroundColor: colors.primary,
                color: colors.onPrimary,
                textDecoration: 'none',
                fontSize: '14px',
                fontWeight: 600,
              }}
            >
              <span>홈으로 돌아가기</span>
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: colors.canvasSoft }}>
      <Header />

      <main style={{ flex: 1, maxWidth: '1100px', width: '100%', margin: '0 auto', padding: '40px 24px' }}>
        {/* Title Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
          <div
            style={{
              padding: '8px',
              borderRadius: '8px',
              backgroundColor: colors.violetSoft,
              color: colors.violetDeep,
              display: 'flex',
            }}
          >
            <ShieldCheck size={24} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: colors.ink }}>
              관리자 통합 대시보드
            </h1>
            <p style={{ margin: 0, fontSize: '13px', color: colors.mute }}>
              관리자픽 에셋 지정, 카테고리 관리, 공식 배지 부여 및 유저 신고 처리
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            backgroundColor: colors.canvas,
            padding: '6px',
            borderRadius: '10px',
            border: `1px solid ${colors.hairline}`,
            marginBottom: '28px',
          }}
        >
          <button
            onClick={() => setActiveTab('PICKS')}
            style={tabButtonStyle(activeTab === 'PICKS')}
          >
            <Sparkles size={16} />
            <span>관리자픽 관리</span>
          </button>
          <button
            onClick={() => setActiveTab('CATEGORIES')}
            style={tabButtonStyle(activeTab === 'CATEGORIES')}
          >
            <FolderKanban size={16} />
            <span>카테고리 관리</span>
          </button>
          <button
            onClick={() => setActiveTab('REPORTS')}
            style={tabButtonStyle(activeTab === 'REPORTS')}
          >
            <AlertTriangle size={16} />
            <span>신고 처리 ({reports.filter((r) => r.status === 'PENDING').length})</span>
          </button>
          <button
            onClick={() => setActiveTab('BADGES')}
            style={tabButtonStyle(activeTab === 'BADGES')}
          >
            <ShieldCheck size={16} />
            <span>공식 배지 부여</span>
          </button>
          <button
            onClick={() => setActiveTab('USERS')}
            style={tabButtonStyle(activeTab === 'USERS')}
          >
            <Users size={16} />
            <span>유저 목록 관리 ({userList.length})</span>
          </button>
        </div>

        {/* Tab 1: 관리자픽 관리 */}
        {activeTab === 'PICKS' && (
          <div
            style={{
              backgroundColor: colors.canvas,
              borderRadius: '16px',
              border: `1px solid ${colors.hairline}`,
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '20px 24px', borderBottom: `1px solid ${colors.hairline}` }}>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: colors.ink }}>
                에셋 관리자픽 지정 / 해제
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: colors.mute }}>
                관리자픽으로 선정된 에셋은 메인 페이지 최상단 캐러셀과 추천 목록에 우선 노출됩니다.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {assets.map((item) => (
                <div
                  key={item.id}
                  style={{
                    padding: '16px 24px',
                    borderBottom: `1px solid ${colors.hairline}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: colors.canvasSoft2,
                        }}
                      >
                        {item.type}
                      </span>
                      <Link
                        href={`/asset/${item.id}`}
                        style={{
                          fontSize: '15px',
                          fontWeight: 600,
                          color: colors.ink,
                          textDecoration: 'none',
                        }}
                      >
                        {item.title}
                      </Link>
                    </div>
                    <span style={{ fontSize: '12px', color: colors.mute }}>
                      제작: {item.author_name} · 좋아요 {item.like_count}
                    </span>
                  </div>

                  <button
                    onClick={() => toggleAdminPick(item.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 14px',
                      borderRadius: '8px',
                      border: `1px solid ${item.is_admin_pick ? colors.violet : colors.hairlineStrong}`,
                      backgroundColor: item.is_admin_pick ? colors.violetSoft : colors.canvas,
                      color: item.is_admin_pick ? colors.violetDeep : colors.ink,
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <Sparkles size={14} />
                    <span>{item.is_admin_pick ? '관리자픽 해제' : '관리자픽 지정'}</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 2: 카테고리 관리 */}
        {activeTab === 'CATEGORIES' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Create Category Form */}
            <div
              style={{
                backgroundColor: colors.canvas,
                borderRadius: '16px',
                border: `1px solid ${colors.hairline}`,
                padding: '24px',
              }}
            >
              <h2 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 700, color: colors.ink }}>
                새 일반 카테고리 추가
              </h2>
              <form onSubmit={handleAddCategory} style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end' }}>
                <div style={{ flex: '1 1 200px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: colors.ink, marginBottom: '6px' }}>
                    카테고리명
                  </label>
                  <input
                    type="text"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder="예: 3D 그래픽 & 렌더링"
                    required
                    style={inputStyle}
                  />
                </div>
                <div style={{ width: '100px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: colors.ink, marginBottom: '6px' }}>
                    테마 색상
                  </label>
                  <input
                    type="color"
                    value={newCatColor}
                    onChange={(e) => setNewCatColor(e.target.value)}
                    style={{ ...inputStyle, padding: '4px', height: '38px', cursor: 'pointer' }}
                  />
                </div>
                <div style={{ flex: '2 1 300px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: colors.ink, marginBottom: '6px' }}>
                    상세 설명
                  </label>
                  <input
                    type="text"
                    value={newCatDesc}
                    onChange={(e) => setNewCatDesc(e.target.value)}
                    placeholder="카테고리에 대한 설명을 입력하세요."
                    style={inputStyle}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isCreatingCat}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '10px 18px',
                    borderRadius: '8px',
                    backgroundColor: colors.primary,
                    color: colors.onPrimary,
                    fontSize: '13px',
                    fontWeight: 600,
                    border: 'none',
                    cursor: isCreatingCat ? 'not-allowed' : 'pointer',
                    opacity: isCreatingCat ? 0.7 : 1,
                    height: '38px',
                  }}
                >
                  <Plus size={16} />
                  <span>{isCreatingCat ? '생성 중...' : '카테고리 생성'}</span>
                </button>
              </form>
            </div>

            {/* Existing Categories List */}
            <div
              style={{
                backgroundColor: colors.canvas,
                borderRadius: '16px',
                border: `1px solid ${colors.hairline}`,
                overflow: 'hidden',
              }}
            >
              <div style={{ padding: '20px 24px', borderBottom: `1px solid ${colors.hairline}` }}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: colors.ink }}>
                  등록된 일반 카테고리 목록 ({categories.length})
                </h3>
              </div>
              <div>
                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    style={{
                      padding: '16px 24px',
                      borderBottom: `1px solid ${colors.hairline}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div
                        style={{
                          width: '14px',
                          height: '14px',
                          borderRadius: '50%',
                          backgroundColor: cat.color,
                        }}
                      />
                      <div>
                        <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: colors.ink }}>
                          {cat.name}
                        </h4>
                        <p style={{ margin: '2px 0 0', fontSize: '12px', color: colors.mute }}>
                          {cat.description}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteCategory(cat.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: colors.mute,
                        cursor: 'pointer',
                        padding: '6px',
                      }}
                      title="카테고리 삭제"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: 신고 처리 */}
        {activeTab === 'REPORTS' && (
          <div
            style={{
              backgroundColor: colors.canvas,
              borderRadius: '16px',
              border: `1px solid ${colors.hairline}`,
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '20px 24px', borderBottom: `1px solid ${colors.hairline}` }}>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: colors.ink }}>
                접수된 에셋 신고 목록
              </h2>
            </div>
            <div>
              {reports.map((rep) => (
                <div
                  key={rep.id}
                  style={{
                    padding: '20px 24px',
                    borderBottom: `1px solid ${colors.hairline}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '6px',
                          backgroundColor: rep.status === 'PENDING' ? colors.errorSoft : colors.canvasSoft2,
                          color: rep.status === 'PENDING' ? colors.errorDeep : colors.mute,
                        }}
                      >
                        {rep.status}
                      </span>
                      <strong style={{ fontSize: '14px', color: colors.ink }}>{rep.asset_title}</strong>
                      <Link
                        href={`/asset/${rep.asset_id}`}
                        target="_blank"
                        style={{ color: colors.link, display: 'inline-flex', alignItems: 'center' }}
                      >
                        <ExternalLink size={14} />
                      </Link>
                    </div>
                    <span style={{ fontSize: '12px', color: colors.mute }}>{rep.created_at}</span>
                  </div>

                  <p style={{ margin: 0, fontSize: '13px', color: colors.body }}>
                    <strong>사유:</strong> {rep.reason} · <strong>상세 내용:</strong> {rep.detail || '상세 사유 없음'}
                  </p>

                  {rep.status === 'PENDING' && (
                    <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                      <button
                        onClick={() => handleResolveReport(rep.id, 'RESOLVE')}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '6px',
                          border: 'none',
                          backgroundColor: colors.error,
                          color: '#fff',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        에셋 숨김 / 삭제 조치
                      </button>
                      <button
                        onClick={() => handleResolveReport(rep.id, 'DISMISS')}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '6px',
                          border: `1px solid ${colors.hairlineStrong}`,
                          backgroundColor: colors.canvas,
                          color: colors.ink,
                          fontSize: '12px',
                          cursor: 'pointer',
                        }}
                      >
                        이상 없음 (신고 기각)
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 4: 공식 배지 관리 (다중 배지, 이름/색상 선택) */}
        {activeTab === 'BADGES' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Create Badge Card */}
            <div
              style={{
                backgroundColor: colors.canvas,
                borderRadius: '16px',
                border: `1px solid ${colors.hairline}`,
                padding: '28px',
              }}
            >
              <h2 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 700, color: colors.ink }}>
                공식 배지(Official Badge) 부여 & 커스텀
              </h2>
              <p style={{ margin: '0 0 24px', fontSize: '13px', color: colors.mute, lineHeight: 1.5 }}>
                유저에게 부여할 공식 배지의 <strong>이름, 테마 색상, 설명</strong>을 자유롭게 지정할 수 있습니다. 한 계정에 여러 개의 배지를 중복 부여할 수도 있습니다.
              </p>

              <form onSubmit={handleGrantBadge} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {/* 0. 이미 생성된 공식 배지에서 선택 (동일 배지 다중 유저 부여용) */}
                {(() => {
                  const uniqueBadges = new Map<string, { name: string; color: string; description?: string; userCount: number }>();
                  badges.forEach((b) => {
                    if (!uniqueBadges.has(b.name)) {
                      uniqueBadges.set(b.name, {
                        name: b.name,
                        color: b.color,
                        description: b.description,
                        userCount: 1,
                      });
                    } else {
                      uniqueBadges.get(b.name)!.userCount += 1;
                    }
                  });
                  const list = Array.from(uniqueBadges.values());

                  if (list.length === 0) return null;

                  return (
                    <div style={{ padding: '12px 14px', borderRadius: '10px', backgroundColor: colors.canvasSoft2, border: `1px solid ${colors.hairline}` }}>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: colors.ink, marginBottom: '8px' }}>
                        이미 생성된 공식 배지에서 불러오기 (여러 유저에게 동일 배지 부여)
                      </label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {list.map((eb) => {
                          const isMatch = badgeName === eb.name;
                          return (
                            <button
                              key={eb.name}
                              type="button"
                              onClick={() => {
                                setBadgeName(eb.name);
                                setBadgeColor(eb.color);
                                setBadgeDesc(eb.description || '');
                              }}
                              style={{
                                padding: '6px 10px',
                                borderRadius: '6px',
                                border: `1.5px solid ${eb.color}`,
                                backgroundColor: isMatch ? `${eb.color}25` : colors.canvas,
                                color: eb.color,
                                fontSize: '11px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                transition: 'all 0.15s ease',
                              }}
                            >
                              <ShieldCheck size={12} color={eb.color} />
                              <span>{eb.name}</span>
                              <span style={{ fontSize: '10px', backgroundColor: eb.color, color: '#fff', padding: '1px 5px', borderRadius: '4px' }}>
                                {eb.userCount}명 소유
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* 1. 대상 유저 */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: colors.ink, marginBottom: '6px' }}>
                    대상 유저 (이메일, 닉네임, 또는 UUID)
                  </label>
                  <input
                    type="text"
                    value={badgeTargetUser}
                    onChange={(e) => setBadgeTargetUser(e.target.value)}
                    placeholder="예: learn.code.ing.ing@gmail.com 또는 유저 닉네임"
                    required
                    style={inputStyle}
                  />

                  {/* 빠른 선택 가능한 최근 유저 칩 */}
                  {allUsers.length > 0 && (
                    <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', color: colors.mute }}>최근 가입 유저:</span>
                      {allUsers.slice(0, 6).map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => setBadgeTargetUser(u.email || u.nickname || u.id)}
                          style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            border: `1px solid ${colors.hairline}`,
                            backgroundColor: colors.canvasSoft2,
                            color: colors.body,
                            fontSize: '11px',
                            cursor: 'pointer',
                          }}
                        >
                          {u.nickname || u.email?.split('@')[0]}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* 2. 배지 명칭 & 프리셋 */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: colors.ink, marginBottom: '6px' }}>
                    배지 명칭
                  </label>

                  <input
                    type="text"
                    value={badgeName}
                    onChange={(e) => setBadgeName(e.target.value)}
                    placeholder="예: 공식 크리에이터, 엔트리 장인, 우수 창작자"
                    required
                    style={inputStyle}
                  />
                  <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {['공식 크리에이터', '엔트리 마스터', '에셋 장인', '모범 창작자', '버그 헌터', '이벤트 우승자'].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setBadgeName(preset)}
                        style={{
                          padding: '3px 8px',
                          borderRadius: '6px',
                          border: `1px solid ${badgeName === preset ? colors.primary : colors.hairline}`,
                          backgroundColor: badgeName === preset ? colors.canvasSoft2 : 'transparent',
                          color: badgeName === preset ? colors.primary : colors.mute,
                          fontSize: '11px',
                          fontWeight: badgeName === preset ? 700 : 500,
                          cursor: 'pointer',
                        }}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. 배지 색상 & 팔레트 */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: colors.ink, marginBottom: '6px' }}>
                    배지 색상
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input
                      type="color"
                      value={badgeColor}
                      onChange={(e) => setBadgeColor(e.target.value)}
                      style={{ ...inputStyle, width: '60px', height: '38px', padding: '2px', cursor: 'pointer' }}
                    />
                    <input
                      type="text"
                      value={badgeColor}
                      onChange={(e) => setBadgeColor(e.target.value)}
                      style={{ ...inputStyle, width: '120px' }}
                    />
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {[
                        { name: '퍼플', code: '#7928ca' },
                        { name: '블루', code: '#0070f3' },
                        { name: '에메랄드', code: '#10b981' },
                        { name: '골드', code: '#f5a623' },
                        { name: '레드', code: '#ff4d4d' },
                        { name: '로즈', code: '#e11d48' },
                      ].map((c) => (
                        <button
                          key={c.code}
                          type="button"
                          onClick={() => setBadgeColor(c.code)}
                          title={c.name}
                          style={{
                            width: '26px',
                            height: '26px',
                            borderRadius: '50%',
                            backgroundColor: c.code,
                            border: badgeColor === c.code ? '2px solid #000' : '1px solid rgba(0,0,0,0.1)',
                            cursor: 'pointer',
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* 4. 배지 설명 */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: colors.ink, marginBottom: '6px' }}>
                    배지 상세 설명 (선택 사항)
                  </label>
                  <input
                    type="text"
                    value={badgeDesc}
                    onChange={(e) => setBadgeDesc(e.target.value)}
                    placeholder="예: 엔트리 허브 1기 공식 인증 창작자입니다."
                    style={inputStyle}
                  />
                </div>

                {/* 5. 실시간 배지 미리보기 */}
                <div
                  style={{
                    padding: '14px 18px',
                    borderRadius: '10px',
                    backgroundColor: colors.canvasSoft2,
                    border: `1px solid ${colors.hairline}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ fontSize: '12px', color: colors.mute }}>프로필 노출 미리보기:</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 10px',
                        borderRadius: '12px',
                        backgroundColor: `${badgeColor}18`,
                        border: `1px solid ${badgeColor}`,
                        color: badgeColor,
                        fontSize: '12px',
                        fontWeight: 700,
                      }}
                    >
                      <Sparkles size={12} />
                      {badgeName || '배지 이름'}
                    </span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingBadge}
                  style={{
                    alignSelf: 'flex-start',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '10px 24px',
                    borderRadius: '8px',
                    backgroundColor: colors.primary,
                    color: colors.onPrimary,
                    fontSize: '13px',
                    fontWeight: 600,
                    border: 'none',
                    cursor: isSubmittingBadge ? 'not-allowed' : 'pointer',
                    opacity: isSubmittingBadge ? 0.7 : 1,
                  }}
                >
                  <ShieldCheck size={16} />
                  <span>{isSubmittingBadge ? '배지 부여 중...' : '공식 배지 부여하기'}</span>
                </button>
              </form>
            </div>

            {/* List of Granted Badges */}
            <div
              style={{
                backgroundColor: colors.canvas,
                borderRadius: '16px',
                border: `1px solid ${colors.hairline}`,
                overflow: 'hidden',
              }}
            >
              <div style={{ padding: '20px 24px', borderBottom: `1px solid ${colors.hairline}` }}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: colors.ink }}>
                  부여된 공식 배지 목록 ({badges.length})
                </h3>
              </div>
              <div>
                {badges.length === 0 ? (
                  <div style={{ padding: '36px', textAlign: 'center', color: colors.mute, fontSize: '13px' }}>
                    부여된 공식 배지가 아직 없습니다.
                  </div>
                ) : (
                  badges.map((b) => (
                    <div
                      key={b.id}
                      style={{
                        padding: '16px 24px',
                        borderBottom: `1px solid ${colors.hairline}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 10px',
                            borderRadius: '12px',
                            backgroundColor: `${b.color}18`,
                            border: `1px solid ${b.color}`,
                            color: b.color,
                            fontSize: '12px',
                            fontWeight: 700,
                          }}
                        >
                          <Sparkles size={12} />
                          {b.name}
                        </span>

                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 600, color: colors.ink }}>
                            {b.user?.nickname || b.user?.email || b.user_id}
                          </div>
                          {b.description && (
                            <div style={{ fontSize: '12px', color: colors.mute, marginTop: '2px' }}>
                              {b.description}
                            </div>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '12px', color: colors.mute }}>{b.created_at}</span>
                        <button
                          type="button"
                          onClick={() => handleRevokeBadge(b.id)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '6px',
                            border: `1px solid ${colors.hairlineStrong}`,
                            backgroundColor: '#fff',
                            color: colors.error,
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          회수
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: 전체 유저 목록 관리 */}
        {activeTab === 'USERS' && (
          <div
            style={{
              backgroundColor: colors.canvas,
              borderRadius: '16px',
              border: `1px solid ${colors.hairline}`,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '20px 24px',
                borderBottom: `1px solid ${colors.hairline}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '16px',
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: colors.ink }}>
                  전체 유저 목록
                </h2>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: colors.mute }}>
                  가입된 모든 회원의 엔트리 고유번호, 설정된 로그인 아이디, 권한 및 계정 상태를 조회하고 관리합니다.
                </p>
              </div>

              {/* 검색창 */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: colors.canvasSoft,
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: `1px solid ${colors.hairline}`,
                  minWidth: '260px',
                }}
              >
                <Search size={16} color={colors.mute} />
                <input
                  type="text"
                  placeholder="닉네임, 아이디, 엔트리ID 검색..."
                  value={userSearchTerm}
                  onChange={(e) => setUserSearchTerm(e.target.value)}
                  style={{
                    border: 'none',
                    outline: 'none',
                    backgroundColor: 'transparent',
                    fontSize: '13px',
                    color: colors.ink,
                    width: '100%',
                  }}
                />
                {userSearchTerm && (
                  <button
                    type="button"
                    onClick={() => setUserSearchTerm('')}
                    style={{
                      border: 'none',
                      background: 'none',
                      color: colors.mute,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* 유저 테이블 */}
            <div style={{ overflowX: 'auto' }}>
              {isUserLoading ? (
                <div style={{ padding: '60px 0', textAlign: 'center', color: colors.mute, fontSize: '14px' }}>
                  유저 목록을 불러오는 중입니다...
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ backgroundColor: colors.canvasSoft, borderBottom: `1px solid ${colors.hairline}` }}>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: colors.mute }}>프로필 / 닉네임</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: colors.mute }}>엔트리 유저네임 / 고유ID</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: colors.mute }}>로그인 커스텀 ID</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, color: colors.mute }}>소셜 가입</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, color: colors.mute }}>비밀번호</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, color: colors.mute }}>역할</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, color: colors.mute }}>가입일</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, color: colors.mute }}>관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userList
                      .filter((u) => {
                        if (!userSearchTerm.trim()) return true;
                        const term = userSearchTerm.toLowerCase();
                        return (
                          u.nickname?.toLowerCase().includes(term) ||
                          u.entry_username?.toLowerCase().includes(term) ||
                          u.custom_id?.toLowerCase().includes(term) ||
                          u.entry_user_id?.toLowerCase().includes(term) ||
                          u.id?.toLowerCase().includes(term)
                        );
                      })
                      .map((item) => (
                        <tr
                          key={item.id}
                          style={{
                            borderBottom: `1px solid ${colors.hairline}`,
                            transition: 'background-color 0.15s ease',
                          }}
                        >
                          {/* 닉네임 & 아바타 */}
                          <td style={{ padding: '14px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <img
                                src={item.avatar_url || '/avatars/avatar_1.png'}
                                alt=""
                                style={{
                                  width: '32px',
                                  height: '32px',
                                  borderRadius: '50%',
                                  objectFit: 'cover',
                                  border: `1px solid ${colors.hairline}`,
                                }}
                              />
                              <div>
                                <Link
                                  href={`/profile/${item.id}`}
                                  target="_blank"
                                  style={{
                                    fontWeight: 700,
                                    color: colors.ink,
                                    textDecoration: 'none',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                  }}
                                >
                                  <span>{item.nickname}</span>
                                  <ExternalLink size={12} color={colors.mute} />
                                </Link>
                                <div style={{ fontSize: '11px', color: colors.mute, fontFamily: 'monospace' }}>
                                  {item.id.slice(0, 8)}...
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* 엔트리 정보 */}
                          <td style={{ padding: '14px 16px' }}>
                            <div style={{ fontWeight: 600, color: colors.ink }}>
                              {item.entry_username ? (
                                <a
                                  href={item.entry_profile_url || `https://playentry.org/profile/${item.entry_username}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{ color: colors.primary, textDecoration: 'none' }}
                                >
                                  @{item.entry_username}
                                </a>
                              ) : (
                                <span style={{ color: colors.mute }}>미인증</span>
                              )}
                            </div>
                            {item.entry_user_id && (
                              <div style={{ fontSize: '11px', color: colors.mute, fontFamily: 'monospace' }}>
                                ID: {item.entry_user_id}
                              </div>
                            )}
                          </td>

                          {/* 커스텀 로그인 ID */}
                          <td style={{ padding: '14px 16px' }}>
                            {item.custom_id ? (
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                  backgroundColor: colors.canvasSoft,
                                  border: `1px solid ${colors.hairline}`,
                                  fontFamily: 'monospace',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  color: colors.ink,
                                }}
                              >
                                {item.custom_id}
                              </span>
                            ) : (
                              <span style={{ color: colors.mute, fontSize: '12px' }}>미설정</span>
                            )}
                          </td>

                          {/* 소셜 가입 여부 */}
                          <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                            {item.is_social ? (
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '2px 8px',
                                  borderRadius: '12px',
                                  backgroundColor: 'rgba(3, 199, 90, 0.1)',
                                  color: '#03C75A',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                }}
                              >
                                소셜
                              </span>
                            ) : (
                              <span style={{ color: colors.mute, fontSize: '12px' }}>일반</span>
                            )}
                          </td>

                          {/* 비밀번호 등록 여부 */}
                          <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                            {item.has_password ? (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '2px',
                                  padding: '2px 8px',
                                  borderRadius: '12px',
                                  backgroundColor: `${colors.primary}15`,
                                  color: colors.primary,
                                  fontSize: '11px',
                                  fontWeight: 700,
                                }}
                              >
                                <Check size={12} /> 설정됨
                              </span>
                            ) : (
                              <span style={{ color: colors.mute, fontSize: '12px' }}>미설정</span>
                            )}
                          </td>

                          {/* 역할 */}
                          <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                            {item.role === 'ADMIN' ? (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '2px 8px',
                                  borderRadius: '12px',
                                  backgroundColor: colors.violetSoft,
                                  color: colors.violetDeep,
                                  fontSize: '11px',
                                  fontWeight: 700,
                                }}
                              >
                                <ShieldCheck size={12} /> 관리자
                              </span>
                            ) : (
                              <span style={{ color: colors.mute, fontSize: '12px' }}>일반</span>
                            )}
                          </td>

                          {/* 가입일 */}
                          <td style={{ padding: '14px 16px', textAlign: 'center', color: colors.mute, fontSize: '12px' }}>
                            {item.created_at ? new Date(item.created_at).toLocaleDateString('ko-KR') : '-'}
                          </td>

                          {/* 계정 조치 (차단 / 해제) */}
                          <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                            {item.role !== 'ADMIN' && (
                              <button
                                type="button"
                                onClick={() => handleToggleBanUser(item)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '4px 10px',
                                  borderRadius: '6px',
                                  border: `1px solid ${item.is_banned ? colors.hairlineStrong : colors.error}`,
                                  backgroundColor: item.is_banned ? colors.canvasSoft : 'rgba(235, 87, 87, 0.08)',
                                  color: item.is_banned ? colors.ink : colors.error,
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                              >
                                <Ban size={12} />
                                <span>{item.is_banned ? '차단 해제' : '활동 정지'}</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    {userList.length === 0 && !isUserLoading && (
                      <tr>
                        <td colSpan={8} style={{ padding: '40px 0', textAlign: 'center', color: colors.mute }}>
                          등록된 유저가 없습니다.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}



