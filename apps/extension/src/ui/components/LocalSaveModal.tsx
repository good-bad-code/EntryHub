import React, { useState } from 'react';
import { X, Code2, Box, Layers, Loader2, HardDrive, CheckCircle2 } from 'lucide-react';
import { colors, ThemeColors, filterFunctionsForBlock } from '@entry-hub/shared';
import { AssetType } from '@entry-hub/core';
import { WindowPostMessageEntryBridgeAdapter } from '../../adapters/bridge/WindowPostMessageEntryBridgeAdapter';
import {
  createLocalAsset,
  updateLocalAsset,
  LocalFolderItem,
  getLocalHubData,
  LocalAssetItem,
} from '../../infrastructure/storage/localHubStorage';
import { ExtensionAssetItem } from './AssetDetailModal';

interface LocalSaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  bridgeAdapter: WindowPostMessageEntryBridgeAdapter;
  targetFolderId: string | null;
  editingAsset?: ExtensionAssetItem | null;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
  activeColors: ThemeColors;
}

export function LocalSaveModal({
  isOpen,
  onClose,
  bridgeAdapter,
  targetFolderId,
  editingAsset,
  onSuccess,
  onError,
  activeColors,
}: LocalSaveModalProps) {
  const isEditMode = Boolean(editingAsset);
  const [selectedType, setSelectedType] = useState<AssetType>('CODE');
  const [extracting, setExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedBlockIndex, setSelectedBlockIndex] = useState<number>(0);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(targetFolderId);

  const folders: LocalFolderItem[] = React.useMemo(() => {
    if (!isOpen) return [];
    return getLocalHubData().folders;
  }, [isOpen]);

  React.useEffect(() => {
    if (!isOpen) return;

    if (editingAsset) {
      setSelectedType(editingAsset.type);
      setTitle(editingAsset.title || '');
      setDescription(editingAsset.description || '');
      setExtractedData(editingAsset.data);
      setSelectedBlockIndex(0);

      // 기존 로컬 에셋의 folderId 조회
      const store = getLocalHubData();
      const existing = store.assets.find((a) => a.id === editingAsset.id);
      setSelectedFolderId(existing ? existing.folderId : targetFolderId);
    } else {
      setSelectedFolderId(targetFolderId);
      setTitle('');
      setDescription('');
      setExtractedData(null);
      setSelectedBlockIndex(0);
    }
  }, [isOpen, targetFolderId, editingAsset]);

  if (!isOpen) return null;

  const handleExtract = async () => {
    setExtracting(true);
    try {
      const isReady = await bridgeAdapter.isEditorReady();
      if (!isReady) {
        throw new Error('엔트리 에디터가 아직 준비되지 않았습니다.');
      }
      const data = await bridgeAdapter.extractCurrentAsset(selectedType);
      if (!data) {
        throw new Error('에셋 데이터를 가져오지 못했습니다.');
      }

      setExtractedData(data);
      const rawData = data as any;
      if (selectedType === 'CODE') {
        const blocks = Array.isArray(data) ? data : [data];
        const blockName = blocks[selectedBlockIndex]?.type || '블록 코드';
        setTitle((prev) => prev || `내 로컬 ${blockName}`);
      } else if (selectedType === 'OBJECT') {
        setTitle((prev) => prev || rawData?.name || '내 로컬 오브젝트');
      } else if (selectedType === 'SCENE') {
        setTitle((prev) => prev || rawData?.name || rawData?.sceneName || '내 로컬 장면');
      }
    } catch (err: any) {
      onError(err?.message || '에셋 추출 실패');
    } finally {
      setExtracting(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!extractedData) {
      onError('먼저 [현재 에디터에서 추출] 버튼을 눌러 에셋을 가져와주세요.');
      return;
    }
    if (!title.trim()) {
      onError('에셋 제목을 입력해 주세요.');
      return;
    }

    // 에셋 타입별 실제 데이터 페이로드 언래핑 및 정규화
    let assetData = extractedData?.data !== undefined ? extractedData.data : extractedData;
    if (selectedType === 'CODE') {
      const parsedBlocks =
        assetData?.availableBlocks ||
        (Array.isArray(assetData) ? assetData : [assetData]);
      if (parsedBlocks.length > 1) {
        const chosen = parsedBlocks[selectedBlockIndex] || parsedBlocks[0];
        assetData = {
          ...assetData,
          block: chosen.blockJson || chosen.block || chosen,
        };
      }
      // 선택된 블록과 연관된 함수만 선별 (저장 당시 작품의 무관한 함수 n개 전부 포함 차단)
      assetData = {
        ...assetData,
        functions: filterFunctionsForBlock(
          assetData.block,
          assetData.functions || []
        ),
      };
    }

    try {
      if (isEditMode && editingAsset) {
        updateLocalAsset(editingAsset.id, {
          title: title.trim(),
          description: description.trim(),
          type: selectedType,
          data: assetData,
          folderId: selectedFolderId,
        });
        onSuccess(`"${title.trim()}" 에셋이 성공적으로 수정되었습니다.`);
      } else {
        createLocalAsset(title.trim(), selectedType, assetData, selectedFolderId, description.trim());
        onSuccess(`"${title.trim()}" 에셋이 로컬 허브에 안전하게 저장되었습니다.`);
      }
      onClose();
    } catch (err: any) {
      onError(err?.message || (isEditMode ? '로컬 수정 중 오류가 발생했습니다.' : '로컬 저장 중 오류가 발생했습니다.'));
    }
  };

  const parsedBlocks =
    selectedType === 'CODE' && extractedData
      ? extractedData?.data?.availableBlocks ||
        (Array.isArray(extractedData) ? extractedData : [extractedData])
      : [];

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        backdropFilter: 'blur(3px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxHeight: '90%',
          backgroundColor: activeColors.canvas,
          borderRadius: '12px',
          border: `1px solid ${activeColors.hairline}`,
          boxShadow: '0 12px 32px rgba(0,0,0,0.25)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 16px',
            borderBottom: `1px solid ${activeColors.hairline}`,
            backgroundColor: activeColors.canvasSoft,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 700, color: activeColors.ink }}>
            <HardDrive size={16} color={activeColors.primary} />
            <span>{isEditMode ? '로컬 에셋 수정' : '로컬 허브에 에셋 저장'}</span>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: activeColors.mute, cursor: 'pointer', padding: '4px', display: 'flex' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* 본문 폼 */}
        <form onSubmit={handleSave} style={{ padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* 에셋 종류 선택 */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: activeColors.ink, marginBottom: '6px' }}>
              저장할 에셋 종류
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
              <button
                type="button"
                onClick={() => { setSelectedType('CODE'); setExtractedData(null); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  padding: '8px 4px',
                  borderRadius: '6px',
                  border: `1px solid ${selectedType === 'CODE' ? activeColors.primary : activeColors.hairlineStrong}`,
                  backgroundColor: selectedType === 'CODE' ? activeColors.canvasSoft2 : activeColors.canvas,
                  color: selectedType === 'CODE' ? activeColors.primary : activeColors.ink,
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Code2 size={13} /> <span>블록 코드</span>
              </button>
              <button
                type="button"
                onClick={() => { setSelectedType('OBJECT'); setExtractedData(null); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  padding: '8px 4px',
                  borderRadius: '6px',
                  border: `1px solid ${selectedType === 'OBJECT' ? activeColors.primary : activeColors.hairlineStrong}`,
                  backgroundColor: selectedType === 'OBJECT' ? activeColors.canvasSoft2 : activeColors.canvas,
                  color: selectedType === 'OBJECT' ? activeColors.primary : activeColors.ink,
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Box size={13} /> <span>오브젝트</span>
              </button>
              <button
                type="button"
                onClick={() => { setSelectedType('SCENE'); setExtractedData(null); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  padding: '8px 4px',
                  borderRadius: '6px',
                  border: `1px solid ${selectedType === 'SCENE' ? activeColors.primary : activeColors.hairlineStrong}`,
                  backgroundColor: selectedType === 'SCENE' ? activeColors.canvasSoft2 : activeColors.canvas,
                  color: selectedType === 'SCENE' ? activeColors.primary : activeColors.ink,
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Layers size={13} /> <span>장면</span>
              </button>
            </div>
          </div>

          {/* 에디터 추출 버튼 */}
          <div style={{ padding: '10px 12px', borderRadius: '8px', backgroundColor: activeColors.canvasSoft, border: `1px solid ${activeColors.hairline}`, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: activeColors.body }}>
                {extractedData ? '에셋 데이터 추출 완료' : '현재 작업 중인 엔트리 에디터에서 에셋을 가져옵니다.'}
              </span>
              <button
                type="button"
                disabled={extracting}
                onClick={handleExtract}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: activeColors.primary,
                  color: activeColors.onPrimary,
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: extracting ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                {extracting ? <Loader2 size={12} className="animate-spin" /> : null}
                <span>{extractedData ? '다시 추출' : '에디터에서 추출'}</span>
              </button>
            </div>

            {/* 블록이 2개 이상일 때 하나만 선택하게 라디오 UI 제공 */}
            {selectedType === 'CODE' && parsedBlocks.length > 1 && (
              <div style={{ marginTop: '6px', borderTop: `1px solid ${activeColors.hairline}`, paddingTop: '8px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: activeColors.ink, marginBottom: '6px' }}>
                  저장할 블록 코드 선택 (총 {parsedBlocks.length}개 발견)
                </div>
                <div style={{ maxHeight: '110px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {parsedBlocks.map((blk: any, idx: number) => {
                    const isChecked = selectedBlockIndex === idx;
                    const blkName = blk.title || blk.type || blk.name || `블록 ${idx + 1}`;
                    return (
                      <label
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 6px',
                          borderRadius: '4px',
                          backgroundColor: isChecked ? activeColors.canvasSoft2 : 'transparent',
                          fontSize: '11px',
                          color: activeColors.ink,
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="radio"
                          name="localCodeBlockSelect"
                          checked={isChecked}
                          onChange={() => {
                            setSelectedBlockIndex(idx);
                            setTitle(`내 로컬 ${blkName}`);
                          }}
                        />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          #{idx + 1}: {blkName}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 저장 대상 폴더 선택 */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: activeColors.ink, marginBottom: '4px' }}>
              저장할 폴더 위치
            </label>
            <select
              value={selectedFolderId ?? ''}
              onChange={(e) => setSelectedFolderId(e.target.value ? e.target.value : null)}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '6px',
                border: `1px solid ${activeColors.hairlineStrong}`,
                backgroundColor: activeColors.canvasSoft2,
                color: activeColors.ink,
                fontSize: '12px',
                outline: 'none',
              }}
            >
              <option value="">로컬 허브 최상위 (루트)</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  📁 {f.name}
                </option>
              ))}
            </select>
          </div>

          {/* 에셋 제목 */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: activeColors.ink, marginBottom: '4px' }}>
              에셋 제목
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 점프 애니메이션 오브젝트"
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '6px',
                border: `1px solid ${activeColors.hairlineStrong}`,
                backgroundColor: activeColors.canvas,
                color: activeColors.ink,
                fontSize: '12px',
                outline: 'none',
              }}
            />
          </div>

          {/* 에셋 설명 */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: activeColors.ink, marginBottom: '4px' }}>
              설명 (선택)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="에셋에 대한 메모나 설명을 적어두세요."
              rows={2}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '6px',
                border: `1px solid ${activeColors.hairlineStrong}`,
                backgroundColor: activeColors.canvas,
                color: activeColors.ink,
                fontSize: '12px',
                outline: 'none',
                resize: 'none',
              }}
            />
          </div>

          {/* 푸터 버튼 */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '7px 14px',
                borderRadius: '6px',
                border: `1px solid ${activeColors.hairlineStrong}`,
                backgroundColor: activeColors.canvas,
                color: activeColors.ink,
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              취소
            </button>
            <button
              type="submit"
              disabled={!extractedData}
              style={{
                padding: '7px 16px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: extractedData ? activeColors.primary : activeColors.canvasSoft2,
                color: extractedData ? activeColors.onPrimary : activeColors.mute,
                fontSize: '12px',
                fontWeight: 600,
                cursor: extractedData ? 'pointer' : 'not-allowed',
              }}
            >
              {isEditMode ? '수정 완료' : '로컬에 저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

