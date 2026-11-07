import React, { useState, useEffect } from 'react';
import {
  Code2,
  X,
  Compass,
  FolderKanban,
  Bookmark,
  Home,
  User as UserIcon,
  LogIn,
  LogOut,
  Trash2,
  ShieldCheck,
  Globe,
  ExternalLink,
  HardDrive,
  Settings,
} from 'lucide-react';
import { colors, getThemeColors, ThemeMode, ThemeColors } from '@entry-hub/shared';
import { WindowPostMessageEntryBridgeAdapter } from '../adapters/bridge/WindowPostMessageEntryBridgeAdapter';
import { ToastContainer, ToastMessage } from './components/Toast';
import { AssetDetailModal, ExtensionAssetItem } from './components/AssetDetailModal';
import { UploadModal } from './components/UploadModal';
import { AuthModal } from './components/AuthModal';
import { SettingsModal } from './components/SettingsModal';
import { LocalSaveModal } from './components/LocalSaveModal';
import { MainTab } from './tabs/MainTab';
import { ExploreTab } from './tabs/ExploreTab';
import { CategoryTab } from './tabs/CategoryTab';
import { MyPickTab } from './tabs/MyPickTab';
import { LocalHubTab } from './tabs/LocalHubTab';
import { SettingsTab } from './tabs/SettingsTab';
import { supabase } from '../infrastructure/supabase/client';
import { syncEntryNickname } from '../content/verifier';

export type TabType = 'MAIN' | 'EXPLORE' | 'CATEGORY' | 'MYPICK' | 'LOCAL_HUB' | 'SETTINGS';

export type StartupTabSetting =
  | 'MAIN'
  | 'EXPLORE'
  | 'CATEGORY'
  | 'MYPICK'
  | 'LOCAL_HUB'
  | 'LAST_ACTIVE';

const STARTUP_TAB_STORAGE_KEY = 'eh_startup_tab_setting';
const LAST_ACTIVE_TAB_STORAGE_KEY = 'eh_last_active_tab';

export function getStartupTabSetting(): StartupTabSetting {
  try {
    const saved = localStorage.getItem(STARTUP_TAB_STORAGE_KEY);
    if (
      saved === 'MAIN' ||
      saved === 'EXPLORE' ||
      saved === 'CATEGORY' ||
      saved === 'MYPICK' ||
      saved === 'LOCAL_HUB' ||
      saved === 'LAST_ACTIVE'
    ) {
      return saved;
    }
  } catch {}
  return 'MAIN';
}

export function setStartupTabSetting(setting: StartupTabSetting): void {
  try {
    localStorage.setItem(STARTUP_TAB_STORAGE_KEY, setting);
  } catch {}
}

function resolveInitialTab(): TabType {
  const setting = getStartupTabSetting();
  if (setting === 'LAST_ACTIVE') {
    try {
      const last = localStorage.getItem(LAST_ACTIVE_TAB_STORAGE_KEY);
      if (
        last === 'MAIN' ||
        last === 'EXPLORE' ||
        last === 'CATEGORY' ||
        last === 'MYPICK' ||
        last === 'LOCAL_HUB'
      ) {
        return last;
      }
    } catch {}
    return 'MAIN';
  }
  return setting;
}

declare const chrome: any;

interface AppProps {
  onClose: () => void;
}

const DEFAULT_PANEL_WIDTH = 460;
const MIN_PANEL_WIDTH = 340;

export function App({ onClose }: AppProps) {
  const [currentTab, setCurrentTab] = useState<TabType>(() => resolveInitialTab());
  const [selectedAsset, setSelectedAsset] = useState<ExtensionAssetItem | null>(null);
  const [editingAsset, setEditingAsset] = useState<ExtensionAssetItem | null>(null);
  const [editingLocalAsset, setEditingLocalAsset] = useState<ExtensionAssetItem | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLocalSaveOpen, setIsLocalSaveOpen] = useState(false);
  const [localSaveTargetFolderId, setLocalSaveTargetFolderId] = useState<string | null>(null);
  const [localHubVersion, setLocalHubVersion] = useState(0);
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // 탭 변경 시 마지막 활성 탭 저장
  const handleTabChange = (tab: TabType) => {
    setCurrentTab(tab);
    try {
      localStorage.setItem(LAST_ACTIVE_TAB_STORAGE_KEY, tab);
    } catch {}
  };

  // 사이트 테마 따라가기 (확장 프로그램 내에서는 직접 변경 불가)
  const [theme, setTheme] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem('entry_hub_theme');
      if (saved === 'dark' || saved === 'light') return saved;
    } catch {}
    return 'light';
  });

  const activeColors = getThemeColors(theme);

  useEffect(() => {
    // 웹사이트(site)와 테마 변경 실시간 동기화 (window message)
    const handleMsg = (e: MessageEvent) => {
      if (e.data?.type === 'ENTRY_HUB_THEME_CHANGED' && (e.data.theme === 'light' || e.data.theme === 'dark')) {
        setTheme(e.data.theme);
        try {
          localStorage.setItem('entry_hub_theme', e.data.theme);
        } catch {}
      }
    };
    window.addEventListener('message', handleMsg);

    return () => {
      window.removeEventListener('message', handleMsg);
    };
  }, []);

  // 로그인된 유저가 설정한 사이트 테마 동기화
  useEffect(() => {
    if (!currentUser) return;
    supabase
      .from('users')
      .select('theme')
      .eq('id', currentUser.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.theme === 'dark' || data?.theme === 'light') {
          setTheme(data.theme);
          try {
            localStorage.setItem('entry_hub_theme', data.theme);
          } catch {}
        }
      });
  }, [currentUser]);

  // 패널 너비 조절 상태 (기본 460px, 로컬스토리지 기억)
  const [panelWidth, setPanelWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('eh_panel_width');
      if (saved) {
        const parsed = Number(saved);
        if (!isNaN(parsed) && parsed >= MIN_PANEL_WIDTH) return parsed;
      }
    } catch {}
    return DEFAULT_PANEL_WIDTH;
  });
  const [isResizing, setIsResizing] = useState(false);


  // #entryButtonTab 아래에 패널 상단 맞추기 (동적 측정 + fallback 88px)
  const [topOffset, setTopOffset] = useState<number>(() => {
    try {
      const tab = document.querySelector('#entryButtonTab');
      if (tab) {
        const rect = tab.getBoundingClientRect();
        if (rect.bottom > 0) return Math.round(rect.bottom);
      }
    } catch {}
    return 88;
  });

  useEffect(() => {
    const updateTop = () => {
      try {
        const tab = document.querySelector('#entryButtonTab');
        if (tab) {
          const rect = tab.getBoundingClientRect();
          if (rect.bottom > 0) {
            setTopOffset(Math.round(rect.bottom));
          }
        }
      } catch {}
    };

    updateTop();
    window.addEventListener('resize', updateTop);
    const timer = setTimeout(updateTop, 500);

    return () => {
      window.removeEventListener('resize', updateTop);
      clearTimeout(timer);
    };
  }, []);

  // Bridge Adapter Singleton
  const bridgeAdapter = React.useMemo(() => new WindowPostMessageEntryBridgeAdapter(), []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUser(user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // 마우스 드래그로 사이드 패널 너비 실시간 조절
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      // 우측 벽(right: 0)에 밀착되어 있으므로 window.innerWidth - e.clientX가 정확한 너비
      const newWidth = window.innerWidth - e.clientX;
      const maxWidth = Math.min(window.innerWidth - 60, 950);
      if (newWidth >= MIN_PANEL_WIDTH && newWidth <= maxWidth) {
        setPanelWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      try {
        localStorage.setItem('eh_panel_width', String(panelWidth));
      } catch {}
    };

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, panelWidth]);

  // 더블 클릭 시 기본 너비(380px)로 원상 복구
  const handleResetWidth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPanelWidth(DEFAULT_PANEL_WIDTH);
    try {
      localStorage.setItem('eh_panel_width', String(DEFAULT_PANEL_WIDTH));
    } catch {}
    addToast('info', '패널 크기가 기본 너비(460px)로 복구되었습니다.');
  };

  const addToast = (type: 'success' | 'error' | 'info', message: string) => {
    const id = 'toast_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  };

  const handleDismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleQuickInject = async (asset: ExtensionAssetItem) => {
    try {
      const isReady = await bridgeAdapter.isEditorReady();
      if (!isReady) {
        throw new Error('엔트리 에디터가 아직 준비되지 않았습니다.');
      }
      await bridgeAdapter.injectAsset(asset.type, asset.data);
      addToast('success', `"${asset.title}" 주입 완료!`);
    } catch (err: any) {
      addToast('error', err?.message || '주입 실패');
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    addToast('info', '로그아웃되었습니다.');
  };

  // 엔트리 닉네임 변경 감지 시 실시간 자동 동기화
  useEffect(() => {
    if (!currentUser) return;

    const handleSync = () => {
      syncEntryNickname((newNickname) => {
        addToast('info', `엔트리 닉네임 변경이 감지되어 '${newNickname}'(으)로 자동 동기화되었습니다.`);
        setCurrentUser((prev: any) =>
          prev
            ? {
                ...prev,
                user_metadata: {
                  ...prev.user_metadata,
                  nickname: newNickname,
                },
              }
            : prev
        );
      });
    };

    // 1초 후 최초 1회 실행
    const timer = setTimeout(handleSync, 1000);
    // 60초마다 주기적 확인
    const interval = setInterval(handleSync, 60000);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [currentUser]);


  return (
    <div
      style={{
        position: 'fixed',
        top: `${topOffset}px`, // #entryButtonTab 아래에 밀착
        bottom: 0, // 화면 바닥까지 밀착
        right: 0, // 오른쪽 벽에 완벽 밀착
        width: `${panelWidth}px`,
        height: `calc(100vh - ${topOffset}px)`,
        backgroundColor: activeColors.canvas,
        boxShadow: 'none',
        borderTopLeftRadius: '12px',
        borderBottomLeftRadius: '12px',
        borderTopRightRadius: 0,
        borderBottomRightRadius: 0,
        borderLeft: `1px solid ${activeColors.hairline}`,
        borderTop: `1px solid ${activeColors.hairline}`, // #entryButtonTab 아래 경계선
        borderBottom: `1px solid ${activeColors.hairline}`,
        zIndex: 999999,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        color: activeColors.ink,
        overflow: 'hidden',
        transition: isResizing ? 'none' : 'width 0.15s ease',
      }}
    >
      {/* 너비 조절 드래그 핸들 (좌측 테두리) */}
      <div
        onMouseDown={(e) => {
          e.preventDefault();
          setIsResizing(true);
        }}
        onDoubleClick={handleResetWidth}
        title="좌우로 드래그하여 너비 조절 (더블 클릭 시 기본 크기 복구)"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '7px',
          height: '100%',
          cursor: 'col-resize',
          zIndex: 99,
          backgroundColor: isResizing ? '#0070f3' : 'transparent',
          borderLeft: isResizing ? '2px solid #0070f3' : 'none',
          transition: 'background-color 0.15s ease',
        }}
      />

      {/* Top Header */}
      <header
        style={{
          padding: '12px 16px',
          borderBottom: `1px solid ${activeColors.hairline}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: activeColors.canvas,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img
            src={(typeof chrome !== 'undefined' && chrome.runtime?.getURL) ? chrome.runtime.getURL('icons/icon48.png') : '/icon.png'}
            alt="Entry-Hub Logo"
            style={{ width: '22px', height: '22px', borderRadius: '6px', objectFit: 'cover' }}
            onError={(e) => {
              (e.currentTarget as HTMLElement).style.display = 'none';
            }}
          />
          <span style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '-0.5px' }}>
            Entry<span style={{ background: activeColors.gradientDevelop, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>-Hub</span>
          </span>
          <a
            href="https://entry-hub-site.vercel.app"
            target="_blank"
            rel="noreferrer"
            title="Entry-Hub 공식 웹사이트 방문하기"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
              padding: '2px 7px',
              borderRadius: '6px',
              backgroundColor: activeColors.canvasSoft2,
              border: `1px solid ${activeColors.hairline}`,
              color: activeColors.ink,
              fontSize: '11px',
              fontWeight: 600,
              textDecoration: 'none',
              marginLeft: '2px',
            }}
          >
            <Globe size={11} color="#0070f3" />
            <span>사이트</span>
          </a>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {currentUser ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {((currentUser.entry_username || '').toLowerCase() === 'myentrymy' || (currentUser.email || '').toLowerCase() === 'myentrymy@entry-hub.local' || currentUser.role === 'ADMIN') && (
                <a
                  href="https://entry-hub-site.vercel.app/admin"
                  target="_blank"
                  rel="noreferrer"
                  title="웹 관리자 대시보드 열기"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px',
                    padding: '3px 7px',
                    borderRadius: '6px',
                    backgroundColor: '#f5f3ff',
                    border: '1px solid #ddd6fe',
                    color: '#7c3aed',
                    fontSize: '11px',
                    fontWeight: 700,
                    textDecoration: 'none',
                  }}
                >
                  <ShieldCheck size={12} color="#7c3aed" />
                  <span>관리자</span>
                </a>
              )}
              <span style={{ fontSize: '12px', fontWeight: 600, color: activeColors.ink, maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {currentUser.user_metadata?.nickname || currentUser.email?.split('@')[0]}
              </span>
              <button
                onClick={handleSignOut}
                title="로그아웃"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  color: activeColors.mute,
                  display: 'flex',
                }}
              >
                <LogOut size={15} />
              </button>
            </div>

          ) : (
            <button
              onClick={() => setIsAuthOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '5px 10px',
                borderRadius: '6px',
                backgroundColor: activeColors.canvasSoft2,
                border: `1px solid ${activeColors.hairlineStrong}`,
                fontSize: '12px',
                fontWeight: 600,
                color: activeColors.ink,
                cursor: 'pointer',
              }}
            >
              <LogIn size={13} />
              <span>로그인</span>
            </button>
          )}

          <button
            onClick={() => handleTabChange('SETTINGS')}
            style={{
              background: currentTab === 'SETTINGS' ? activeColors.canvasSoft2 : 'none',
              border: `1px solid ${currentTab === 'SETTINGS' ? activeColors.hairlineStrong : 'transparent'}`,
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '6px',
              color: currentTab === 'SETTINGS' ? activeColors.primary : activeColors.mute,
              display: 'flex',
            }}
            title="사이드 패널 설정"
          >
            <Settings size={17} />
          </button>

          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '4px',
              color: activeColors.mute,
              display: 'flex',
            }}
            title="사이드바 닫기"
          >
            <X size={18} />
          </button>
        </div>
      </header>

      {/* Tab Navigation */}
      <nav
        style={{
          display: 'flex',
          borderBottom: `1px solid ${activeColors.hairline}`,
          backgroundColor: activeColors.canvasSoft,
          padding: '4px 8px 0',
          gap: '4px',
        }}
      >
        <TabButton
          active={currentTab === 'MAIN'}
          onClick={() => handleTabChange('MAIN')}
          icon={<Home size={14} />}
          label="홈"
          activeColors={activeColors}
        />
        <TabButton
          active={currentTab === 'EXPLORE'}
          onClick={() => handleTabChange('EXPLORE')}
          icon={<Compass size={14} />}
          label="탐색"
          activeColors={activeColors}
        />
        <TabButton
          active={currentTab === 'CATEGORY'}
          onClick={() => handleTabChange('CATEGORY')}
          icon={<FolderKanban size={14} />}
          label="카테고리"
          activeColors={activeColors}
        />
        <TabButton
          active={currentTab === 'MYPICK'}
          onClick={() => handleTabChange('MYPICK')}
          icon={<Bookmark size={14} />}
          label="마이픽"
          activeColors={activeColors}
        />
        <TabButton
          active={currentTab === 'LOCAL_HUB'}
          onClick={() => handleTabChange('LOCAL_HUB')}
          icon={<HardDrive size={14} />}
          label="로컬 허브"
          activeColors={activeColors}
        />
      </nav>

      {/* Tab Content Body */}
      <main style={{ flex: 1, overflowY: 'auto', padding: '16px', position: 'relative' }}>
        {currentTab === 'MAIN' && (
          <MainTab
            onSelectAsset={(a) => setSelectedAsset(a)}
            onOpenUpload={() => setIsUploadOpen(true)}
            onNavigateExplore={() => handleTabChange('EXPLORE')}
          />
        )}
        {currentTab === 'EXPLORE' && (
          <ExploreTab
            onSelectAsset={(a) => setSelectedAsset(a)}
            onQuickInject={handleQuickInject}
          />
        )}
        {currentTab === 'CATEGORY' && (
          <CategoryTab
            onSelectAsset={(a) => setSelectedAsset(a)}
            onQuickInject={handleQuickInject}
          />
        )}

        {currentTab === 'MYPICK' && (
          <MyPickTab
            onSelectAsset={(a) => setSelectedAsset(a)}
            onQuickInject={handleQuickInject}
            onNavigateExplore={() => handleTabChange('EXPLORE')}
          />
        )}

        {currentTab === 'LOCAL_HUB' && (
          <LocalHubTab
            onSelectAsset={(a) => setSelectedAsset(a)}
            onQuickInject={handleQuickInject}
            onOpenLocalUpload={(folderId) => {
              setLocalSaveTargetFolderId(folderId);
              setIsLocalSaveOpen(true);
            }}
            activeColors={activeColors}
            refreshTrigger={localHubVersion}
          />
        )}

        {currentTab === 'SETTINGS' && (
          <SettingsTab
            activeColors={activeColors}
            onBack={() => handleTabChange('MAIN')}
            onSaved={() => addToast('success', '시작 탭 설정이 저장되었습니다.')}
          />
        )}
      </main>

      {/* Modals & Toasts */}
      <LocalSaveModal
        isOpen={isLocalSaveOpen}
        onClose={() => {
          setIsLocalSaveOpen(false);
          setEditingLocalAsset(null);
        }}
        bridgeAdapter={bridgeAdapter}
        targetFolderId={localSaveTargetFolderId}
        editingAsset={editingLocalAsset}
        onSuccess={(msg) => {
          addToast('success', msg);
          setLocalHubVersion((v) => v + 1);
          setEditingLocalAsset(null);
        }}
        onError={(msg) => addToast('error', msg)}
        activeColors={activeColors}
      />
      <AssetDetailModal
        asset={selectedAsset}
        currentUser={currentUser}
        onClose={() => setSelectedAsset(null)}
        bridgeAdapter={bridgeAdapter}
        onSuccess={(msg) => {
          addToast('success', msg);
          setLocalHubVersion((v) => v + 1);
        }}
        onError={(msg) => addToast('error', msg)}
        onDeleted={() => {
          setSelectedAsset(null);
          setLocalHubVersion((v) => v + 1);
        }}
        onEdit={(asset) => {
          setSelectedAsset(null);
          const isLocal = !asset.id || asset.id.startsWith('local_asset_') || asset.authorName === '로컬 에셋';
          if (isLocal) {
            setEditingLocalAsset(asset);
            setIsLocalSaveOpen(true);
          } else {
            setEditingAsset(asset);
            setIsUploadOpen(true);
          }
        }}
      />

      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => {
          setIsUploadOpen(false);
          setEditingAsset(null);
        }}
        bridgeAdapter={bridgeAdapter}
        currentUser={currentUser}
        editingAsset={editingAsset}
        onRequireAuth={() => setIsAuthOpen(true)}
        onSuccess={(msg) => {
          addToast('success', msg);
          setEditingAsset(null);
        }}
        onError={(msg) => addToast('error', msg)}
        onUpdated={() => {
          setEditingAsset(null);
        }}
      />

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={(user) => {
          setCurrentUser(user);
          addToast('success', `${user.user_metadata?.nickname || '사용자'} 님 환영합니다!`);
        }}
        onError={(msg) => addToast('error', msg)}
      />

      <ToastContainer toasts={toasts} onDismiss={handleDismissToast} />
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  activeColors,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  activeColors: ThemeColors;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4px',
        padding: '8px 2px',
        border: 'none',
        borderBottom: active ? `2px solid ${activeColors.primary}` : '2px solid transparent',
        backgroundColor: 'transparent',
        color: active ? activeColors.ink : activeColors.mute,
        fontWeight: active ? 600 : 500,
        fontSize: '12px',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        transition: 'all 0.15s ease',
      }}
    >
      <span style={{ display: 'flex', flexShrink: 0 }}>{icon}</span>
      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
    </button>
  );
}
