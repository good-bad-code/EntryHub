import React, { useState, useEffect } from 'react';
import {
  Folder,
  FolderPlus,
  FolderOpen,
  ChevronRight,
  FileCode,
  Box,
  Layers,
  Download,
  Trash2,
  Edit2,
  Plus,
  ArrowLeft,
  MoveRight,
  Search,
  HardDrive,
  CornerDownRight,
  X,
  Check,
  MoreVertical,
} from 'lucide-react';
import { colors, ThemeColors } from '@entry-hub/shared';
import { ExtensionAssetItem } from '../components/AssetDetailModal';
import {
  LocalAssetItem,
  LocalFolderItem,
  getLocalHubData,
  createLocalFolder,
  renameLocalFolder,
  deleteLocalFolderRecursive,
  deleteLocalAsset,
  moveLocalAsset,
  moveLocalFolder,
  updateLocalAsset,
} from '../../infrastructure/storage/localHubStorage';

interface LocalHubTabProps {
  onSelectAsset: (asset: ExtensionAssetItem) => void;
  onQuickInject: (asset: ExtensionAssetItem) => void;
  onOpenLocalUpload: (targetFolderId: string | null) => void;
  activeColors: ThemeColors;
}

export function LocalHubTab({
  onSelectAsset,
  onQuickInject,
  onOpenLocalUpload,
  activeColors,
}: LocalHubTabProps) {
  const [folders, setFolders] = useState<LocalFolderItem[]>([]);
  const [assets, setAssets] = useState<LocalAssetItem[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);

  // 폴더 생성 모달/상태
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // 폴더 이름 변경 상태
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renamingName, setRenamingName] = useState('');

  // 에셋 이름 변경 상태
  const [renamingAssetId, setRenamingAssetId] = useState<string | null>(null);
  const [renamingAssetTitle, setRenamingAssetTitle] = useState('');

  // 에셋 이동 모달 상태
  const [movingItem, setMovingItem] = useState<{ type: 'asset' | 'folder'; id: string; title: string } | null>(null);
  const [targetFolderId, setTargetFolderId] = useState<string | null>(null);

  // 검색
  const [searchQuery, setSearchQuery] = useState('');

  // 더보기 메뉴 드롭다운 상태
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const moreMenuRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setIsMoreMenuOpen(false);
      }
    };
    if (isMoreMenuOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isMoreMenuOpen]);

  // 로컬 허브 전체 데이터를 .json 파일로 백업 다운로드
  const handleExportBackupJson = () => {
    setIsMoreMenuOpen(false);
    const store = getLocalHubData();
    const backupPayload = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      folders: store.folders,
      assets: store.assets,
    };

    const jsonString = JSON.stringify(backupPayload, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const nowStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    a.href = url;
    a.download = `entry-hub-local-backup-${nowStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const refreshData = () => {
    const data = getLocalHubData();
    setFolders(data.folders);
    setAssets(data.assets);
  };

  useEffect(() => {
    refreshData();
  }, []);

  // 현재 폴더 경로 계산 (브레드크럼)
  const getBreadcrumbs = (): { id: string | null; name: string }[] => {
    const crumbs: { id: string | null; name: string }[] = [{ id: null, name: '로컬 허브' }];
    if (!currentFolderId) return crumbs;

    const path: { id: string | null; name: string }[] = [];
    let curId: string | null = currentFolderId;

    while (curId) {
      const f = folders.find((item) => item.id === curId);
      if (f) {
        path.unshift({ id: f.id, name: f.name });
        curId = f.parentId;
      } else {
        break;
      }
    }

    return [...crumbs, ...path];
  };

  const breadcrumbs = getBreadcrumbs();

  // 현재 폴더에 속한 하위 폴더 및 에셋 필터링
  const currentSubFolders = folders.filter((f) => {
    if (searchQuery.trim()) {
      return f.name.toLowerCase().includes(searchQuery.toLowerCase());
    }
    return f.parentId === currentFolderId;
  });

  const currentAssets = assets.filter((a) => {
    if (searchQuery.trim()) {
      return a.title.toLowerCase().includes(searchQuery.toLowerCase());
    }
    return a.folderId === currentFolderId;
  });

  // 새 폴더 생성 처리
  const handleCreateFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    createLocalFolder(newFolderName.trim(), currentFolderId);
    setNewFolderName('');
    setIsCreatingFolder(false);
    refreshData();
  };

  // 폴더 이름 변경 저장
  const handleSaveRenameFolder = (id: string) => {
    if (renamingName.trim()) {
      renameLocalFolder(id, renamingName.trim());
      refreshData();
    }
    setRenamingFolderId(null);
  };

  // 에셋 이름 변경 저장
  const handleSaveRenameAsset = (id: string) => {
    if (renamingAssetTitle.trim()) {
      updateLocalAsset(id, { title: renamingAssetTitle.trim() });
      refreshData();
    }
    setRenamingAssetId(null);
  };

  // 폴더 삭제 처리
  const handleDeleteFolder = (id: string, name: string) => {
    if (confirm(`"${name}" 폴더와 그 안의 모든 하위 폴더 및 에셋을 삭제하시겠습니까?`)) {
      deleteLocalFolderRecursive(id);
      refreshData();
    }
  };

  // 에셋 삭제 처리
  const handleDeleteAsset = (id: string, title: string) => {
    if (confirm(`"${title}" 에셋을 로컬에서 삭제하시겠습니까?`)) {
      deleteLocalAsset(id);
      refreshData();
    }
  };

  // 이동 실행
  const handleExecuteMove = () => {
    if (!movingItem) return;
    try {
      if (movingItem.type === 'asset') {
        moveLocalAsset(movingItem.id, targetFolderId);
      } else {
        moveLocalFolder(movingItem.id, targetFolderId);
      }
      refreshData();
      setMovingItem(null);
    } catch (e: any) {
      alert(e.message || '이동에 실패했습니다.');
    }
  };

  // 로컬 에셋을 ExtensionAssetItem 형식으로 변환하여 주입/상세 지원
  const toExtensionAsset = (local: LocalAssetItem): ExtensionAssetItem => {
    return {
      id: local.id,
      title: local.title,
      description: local.description,
      type: local.type,
      authorName: '로컬 에셋',
      isOfficialBadge: false,
      isAdminPick: false,
      likeCount: 0,
      bookmarkCount: 0,
      data: local.data,
    };
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'CODE':
        return <FileCode size={14} color="#0090f0" />;
      case 'OBJECT':
        return <Box size={14} color="#00b400" />;
      case 'SCENE':
        return <Layers size={14} color="#ff3a61" />;
      default:
        return <FileCode size={14} color="#0090f0" />;
    }
  };

  const getTypeName = (type: string) => {
    switch (type) {
      case 'CODE':
        return '블록 코드';
      case 'OBJECT':
        return '오브젝트';
      case 'SCENE':
        return '장면';
      default:
        return type;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* 상단 툴바: 브레드크럼 및 액션 버튼들 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, color: activeColors.ink }}>
            <HardDrive size={16} color={activeColors.primary} />
            <span>로컬 허브</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              onClick={() => setIsCreatingFolder(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 10px',
                borderRadius: '6px',
                backgroundColor: activeColors.canvasSoft2,
                border: `1px solid ${activeColors.hairlineStrong}`,
                color: activeColors.ink,
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <FolderPlus size={13} color={activeColors.primary} />
              <span>새 폴더</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenLocalUpload(currentFolderId)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 10px',
                borderRadius: '6px',
                backgroundColor: activeColors.primary,
                border: 'none',
                color: activeColors.onPrimary,
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Plus size={13} />
              <span>에셋 저장</span>
            </button>

            {/* 더보기 (숨겨진 백업 기능) 메뉴 */}
            <div style={{ position: 'relative' }} ref={moreMenuRef}>
              <button
                type="button"
                onClick={() => setIsMoreMenuOpen((prev) => !prev)}
                title="더보기"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '6px',
                  borderRadius: '6px',
                  backgroundColor: isMoreMenuOpen ? activeColors.canvasSoft2 : 'transparent',
                  border: `1px solid ${isMoreMenuOpen ? activeColors.hairlineStrong : 'transparent'}`,
                  color: activeColors.mute,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <MoreVertical size={14} />
              </button>

              {isMoreMenuOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '4px',
                    width: '190px',
                    backgroundColor: activeColors.canvas,
                    border: `1px solid ${activeColors.hairlineStrong}`,
                    borderRadius: '8px',
                    boxShadow: '0 8px 20px rgba(0,0,0,0.18)',
                    padding: '4px',
                    zIndex: 100,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                  }}
                >
                  <button
                    type="button"
                    onClick={handleExportBackupJson}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: 'transparent',
                      color: activeColors.ink,
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      textAlign: 'left',
                      width: '100%',
                      transition: 'background-color 0.12s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = activeColors.canvasSoft2)}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <Download size={14} color={activeColors.primary} />
                    <span>전체 백업 다운로드 (.json)</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 검색 및 경로 바 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 10px',
              borderRadius: '6px',
              backgroundColor: activeColors.canvasSoft,
              border: `1px solid ${activeColors.hairline}`,
            }}
          >
            <Search size={13} color={activeColors.mute} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="로컬 폴더 및 에셋 검색..."
              style={{
                border: 'none',
                outline: 'none',
                backgroundColor: 'transparent',
                width: '100%',
                fontSize: '11px',
                color: activeColors.ink,
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{ background: 'none', border: 'none', color: activeColors.mute, cursor: 'pointer', padding: 0 }}
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* 폴더 브레드크럼 */}
        {!searchQuery && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
              color: activeColors.mute,
              overflowX: 'auto',
              padding: '4px 2px',
            }}
          >
            {breadcrumbs.map((crumb, idx) => {
              const isLast = idx === breadcrumbs.length - 1;
              return (
                <React.Fragment key={crumb.id ?? 'root'}>
                  <button
                    type="button"
                    onClick={() => setCurrentFolderId(crumb.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: isLast ? activeColors.ink : activeColors.primary,
                      fontWeight: isLast ? 700 : 500,
                      cursor: isLast ? 'default' : 'pointer',
                      padding: 0,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {crumb.name}
                  </button>
                  {!isLast && <ChevronRight size={11} color={activeColors.mute} />}
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>

      {/* 새 폴더 생성 인라인 입력 폼 */}
      {isCreatingFolder && (
        <form
          onSubmit={handleCreateFolder}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 10px',
            backgroundColor: activeColors.canvasSoft,
            borderRadius: '8px',
            border: `1px solid ${activeColors.primary}`,
          }}
        >
          <FolderPlus size={14} color={activeColors.primary} />
          <input
            type="text"
            autoFocus
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="폴더 이름 입력..."
            style={{
              flex: 1,
              border: `1px solid ${activeColors.hairlineStrong}`,
              borderRadius: '4px',
              padding: '4px 8px',
              fontSize: '11px',
              outline: 'none',
              backgroundColor: activeColors.canvas,
              color: activeColors.ink,
            }}
          />
          <button
            type="submit"
            style={{
              padding: '4px 8px',
              borderRadius: '4px',
              border: 'none',
              backgroundColor: activeColors.primary,
              color: activeColors.onPrimary,
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            생성
          </button>
          <button
            type="button"
            onClick={() => {
              setIsCreatingFolder(false);
              setNewFolderName('');
            }}
            style={{
              padding: '4px 8px',
              borderRadius: '4px',
              border: `1px solid ${activeColors.hairline}`,
              backgroundColor: activeColors.canvas,
              color: activeColors.mute,
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            취소
          </button>
        </form>
      )}

      {/* 폴더 목록 */}
      {currentSubFolders.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: activeColors.mute }}>
            폴더 ({currentSubFolders.length})
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
            {currentSubFolders.map((folder) => {
              const isRenaming = renamingFolderId === folder.id;
              // 폴더 내부 에셋 개수
              const count = assets.filter((a) => a.folderId === folder.id).length;

              return (
                <div
                  key={folder.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    backgroundColor: activeColors.canvasSoft,
                    border: `1px solid ${activeColors.hairline}`,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div
                    onClick={() => {
                      if (!isRenaming) setCurrentFolderId(folder.id);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      flex: 1,
                      minWidth: 0,
                      cursor: 'pointer',
                    }}
                  >
                    <Folder size={16} color="#f59e0b" style={{ flexShrink: 0 }} />
                    {isRenaming ? (
                      <input
                        type="text"
                        autoFocus
                        value={renamingName}
                        onChange={(e) => setRenamingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveRenameFolder(folder.id);
                          if (e.key === 'Escape') setRenamingFolderId(null);
                        }}
                        style={{
                          width: '100%',
                          fontSize: '11px',
                          border: `1px solid ${activeColors.primary}`,
                          borderRadius: '4px',
                          padding: '2px 4px',
                          backgroundColor: activeColors.canvas,
                          color: activeColors.ink,
                        }}
                      />
                    ) : (
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '11px', fontWeight: 600, color: activeColors.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {folder.name}
                        </div>
                        <div style={{ fontSize: '9px', color: activeColors.mute }}>
                          {count}개 에셋
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 폴더 액션 버튼 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '2px', marginLeft: '4px' }}>
                    {isRenaming ? (
                      <button
                        type="button"
                        onClick={() => handleSaveRenameFolder(folder.id)}
                        style={{ background: 'none', border: 'none', color: activeColors.primary, cursor: 'pointer', padding: '2px' }}
                      >
                        <Check size={12} />
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setRenamingFolderId(folder.id);
                            setRenamingName(folder.name);
                          }}
                          title="폴더 이름 변경"
                          style={{ background: 'none', border: 'none', color: activeColors.mute, cursor: 'pointer', padding: '2px' }}
                        >
                          <Edit2 size={11} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setMovingItem({ type: 'folder', id: folder.id, title: folder.name })}
                          title="다른 위치로 이동"
                          style={{ background: 'none', border: 'none', color: activeColors.mute, cursor: 'pointer', padding: '2px' }}
                        >
                          <MoveRight size={11} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteFolder(folder.id, folder.name)}
                          title="폴더 삭제"
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px' }}
                        >
                          <Trash2 size={11} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 에셋 목록 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: activeColors.mute }}>
          에셋 ({currentAssets.length})
        </div>

        {currentAssets.length === 0 && currentSubFolders.length === 0 ? (
          <div
            style={{
              padding: '36px 16px',
              textAlign: 'center',
              backgroundColor: activeColors.canvasSoft,
              borderRadius: '8px',
              border: `1px dashed ${activeColors.hairlineStrong}`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <FolderOpen size={28} color={activeColors.mute} />
            <div style={{ fontSize: '12px', fontWeight: 600, color: activeColors.ink }}>
              이 폴더는 비어 있습니다
            </div>
            <div style={{ fontSize: '11px', color: activeColors.body }}>
              엔트리 에디터에서 에셋을 추출하여 이 폴더에 로컬 저장해보세요.
            </div>
            <button
              type="button"
              onClick={() => onOpenLocalUpload(currentFolderId)}
              style={{
                marginTop: '4px',
                padding: '6px 12px',
                borderRadius: '6px',
                backgroundColor: activeColors.primary,
                border: 'none',
                color: activeColors.onPrimary,
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              지금 에셋 저장하기
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {currentAssets.map((asset) => {
              const isRenaming = renamingAssetId === asset.id;

              return (
                <div
                  key={asset.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    backgroundColor: activeColors.canvas,
                    border: `1px solid ${activeColors.hairline}`,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                  }}
                >
                  <div
                    onClick={() => {
                      if (!isRenaming) onSelectAsset(toExtensionAsset(asset));
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      flex: 1,
                      minWidth: 0,
                      cursor: 'pointer',
                    }}
                  >
                    <div
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '6px',
                        backgroundColor: activeColors.canvasSoft2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {getTypeIcon(asset.type)}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      {isRenaming ? (
                        <input
                          type="text"
                          autoFocus
                          value={renamingAssetTitle}
                          onChange={(e) => setRenamingAssetTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveRenameAsset(asset.id);
                            if (e.key === 'Escape') setRenamingAssetId(null);
                          }}
                          style={{
                            width: '100%',
                            fontSize: '11px',
                            border: `1px solid ${activeColors.primary}`,
                            borderRadius: '4px',
                            padding: '2px 4px',
                            backgroundColor: activeColors.canvas,
                            color: activeColors.ink,
                          }}
                        />
                      ) : (
                        <>
                          <div style={{ fontSize: '12px', fontWeight: 600, color: activeColors.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {asset.title}
                          </div>
                          <div style={{ fontSize: '10px', color: activeColors.mute }}>
                            {getTypeName(asset.type)} · {new Date(asset.createdAt).toLocaleDateString()}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* 에셋 액션 버튼들 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '6px' }}>
                    {isRenaming ? (
                      <button
                        type="button"
                        onClick={() => handleSaveRenameAsset(asset.id)}
                        style={{ background: 'none', border: 'none', color: activeColors.primary, cursor: 'pointer', padding: '2px' }}
                      >
                        <Check size={13} />
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => onQuickInject(toExtensionAsset(asset))}
                          title="엔트리 에디터에 주입"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            backgroundColor: activeColors.primary,
                            color: activeColors.onPrimary,
                            border: 'none',
                            fontSize: '10px',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          <Download size={11} />
                          <span>주입</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRenamingAssetId(asset.id);
                            setRenamingAssetTitle(asset.title);
                          }}
                          title="이름 변경"
                          style={{ background: 'none', border: 'none', color: activeColors.mute, cursor: 'pointer', padding: '2px' }}
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setMovingItem({ type: 'asset', id: asset.id, title: asset.title })}
                          title="다른 폴더로 이동"
                          style={{ background: 'none', border: 'none', color: activeColors.mute, cursor: 'pointer', padding: '2px' }}
                        >
                          <MoveRight size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteAsset(asset.id, asset.title)}
                          title="삭제"
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px' }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 폴더/에셋 이동 모달 */}
      {movingItem && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={() => setMovingItem(null)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '340px',
              backgroundColor: activeColors.canvas,
              borderRadius: '10px',
              border: `1px solid ${activeColors.hairline}`,
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: activeColors.ink }}>
                "{movingItem.title}" 이동
              </div>
              <button
                type="button"
                onClick={() => setMovingItem(null)}
                style={{ background: 'none', border: 'none', color: activeColors.mute, cursor: 'pointer' }}
              >
                <X size={15} />
              </button>
            </div>

            <div style={{ fontSize: '11px', color: activeColors.body }}>
              이동할 대상 폴더를 선택하세요:
            </div>

            <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div
                onClick={() => setTargetFolderId(null)}
                style={{
                  padding: '8px',
                  borderRadius: '6px',
                  backgroundColor: targetFolderId === null ? activeColors.canvasSoft2 : 'transparent',
                  border: `1px solid ${targetFolderId === null ? activeColors.primary : activeColors.hairline}`,
                  fontSize: '11px',
                  fontWeight: 600,
                  color: activeColors.ink,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <HardDrive size={13} color={activeColors.primary} />
                <span>로컬 허브 최상위 (루트)</span>
              </div>

              {folders
                .filter((f) => f.id !== movingItem.id) // 자기 자신 제외
                .map((f) => (
                  <div
                    key={f.id}
                    onClick={() => setTargetFolderId(f.id)}
                    style={{
                      padding: '8px',
                      borderRadius: '6px',
                      backgroundColor: targetFolderId === f.id ? activeColors.canvasSoft2 : 'transparent',
                      border: `1px solid ${targetFolderId === f.id ? activeColors.primary : activeColors.hairline}`,
                      fontSize: '11px',
                      fontWeight: 500,
                      color: activeColors.ink,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <Folder size={13} color="#f59e0b" />
                    <span>{f.name}</span>
                  </div>
                ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={() => setMovingItem(null)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: `1px solid ${activeColors.hairline}`,
                  backgroundColor: activeColors.canvas,
                  fontSize: '11px',
                  cursor: 'pointer',
                  color: activeColors.body,
                }}
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleExecuteMove}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: activeColors.primary,
                  color: activeColors.onPrimary,
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                이동 완료
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

