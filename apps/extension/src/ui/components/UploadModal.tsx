import React, { useState, useEffect } from 'react';
import { X, Upload, Code2, Box, Layers, Loader2, CheckCircle2, AlertTriangle, LogIn, Tag, ShieldCheck, Award } from 'lucide-react';
import { colors, filterFunctionsForBlock } from '@entry-hub/shared';
import { WindowPostMessageEntryBridgeAdapter } from '../../adapters/bridge/WindowPostMessageEntryBridgeAdapter';
import { AssetType } from '@entry-hub/core';
import { supabase } from '../../infrastructure/supabase/client';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  bridgeAdapter: WindowPostMessageEntryBridgeAdapter;
  currentUser: any | null;
  onRequireAuth: () => void;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
  editingAsset?: any | null;
  onUpdated?: () => void;
}

export function UploadModal({
  isOpen,
  onClose,
  bridgeAdapter,
  currentUser,
  onRequireAuth,
  onSuccess,
  onError,
  editingAsset,
  onUpdated,
}: UploadModalProps) {
  const isEdit = Boolean(editingAsset);
  const [selectedType, setSelectedType] = useState<AssetType>('CODE');
  const [extracting, setExtracting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [categories, setCategories] = useState<Array<{ id: string; name: string; color?: string }>>([]);
  const [myBadges, setMyBadges] = useState<Array<{ id: string; name: string; color: string; description?: string }>>([]);
  const [attachOfficialBadge, setAttachOfficialBadge] = useState(false);
  const [selectedBadgeId, setSelectedBadgeId] = useState<string>('');
  const [copyrightAgreed, setCopyrightAgreed] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState<string>('');
  const [selectedBlockIndex, setSelectedBlockIndex] = useState<number>(0);

  useEffect(() => {
    if (!isOpen || !currentUser) return;

    // 카테고리 목록 조회
    const loadCategories = async () => {
      const { data } = await supabase.from('categories').select('id, name, color').order('name');
      if (data) setCategories(data);
    };

    // 내 공식 배지 목록 조회
    const loadMyBadges = async () => {
      const { data } = await supabase.from('user_badges').select('id, name, color, description').eq('user_id', currentUser.id);
      if (data) {
        setMyBadges(data);
        if (data.length > 0 && !selectedBadgeId) {
          setSelectedBadgeId(data[0].id);
        }
      }
    };

    loadCategories();
    loadMyBadges();
  }, [isOpen, currentUser]);

  useEffect(() => {
    if (editingAsset) {
      setSelectedType(editingAsset.type);
      setTitle(editingAsset.title || '');
      setDescription(editingAsset.description || '');
      setSelectedCategoryId(editingAsset.category_id || editingAsset.categoryId || '');
      setAttachOfficialBadge(Boolean(editingAsset.is_official_badge || editingAsset.isOfficialBadge));
      if (editingAsset.badge_id || editingAsset.badgeId) {
        setSelectedBadgeId(editingAsset.badge_id || editingAsset.badgeId);
      }
      setTags(Array.isArray(editingAsset.tags) ? editingAsset.tags : []);
      setTagInput('');
      setSelectedBlockIndex(0);
      setCopyrightAgreed(true);
      setExtractedData(null);
    } else {
      setSelectedType('CODE');
      setTitle('');
      setDescription('');
      setSelectedCategoryId('');
      setAttachOfficialBadge(false);
      setTags([]);
      setTagInput('');
      setSelectedBlockIndex(0);
      setCopyrightAgreed(false);
      setExtractedData(null);
    }
  }, [editingAsset, isOpen]);


  if (!isOpen) return null;

  // 비로그인 상태 가드: 로그인하지 않은 경우 로그인 유도 화면 표시
  if (!currentUser) {
    return (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
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
            backgroundColor: colors.canvas,
            borderRadius: '12px',
            width: '100%',
            padding: '24px',
            textAlign: 'center',
            boxShadow: '0 12px 32px rgba(0,0,0,0.2)',
            border: `1px solid ${colors.hairline}`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <AlertTriangle size={36} color={colors.warning} style={{ margin: '0 auto 12px' }} />
          <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 700, color: colors.ink }}>
            로그인이 필요합니다
          </h3>
          <p style={{ margin: '0 0 20px', fontSize: '13px', color: colors.body, lineHeight: '1.5' }}>
            에셋을 추출하여 엔트리-허브에 공유하려면 먼저 계정으로 로그인해 주세요.
          </p>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={onClose}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: '6px',
                border: `1px solid ${colors.hairlineStrong}`,
                backgroundColor: colors.canvas,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              닫기
            </button>
            <button
              onClick={() => {
                onClose();
                onRequireAuth();
              }}
              style={{
                flex: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '10px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: colors.primary,
                color: colors.onPrimary,
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <LogIn size={14} />
              <span>로그인하기</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleExtract = async () => {
    setExtracting(true);
    try {
      const isReady = await bridgeAdapter.isEditorReady();
      if (!isReady) {
        throw new Error('엔트리 에디터가 아직 로드되지 않았습니다.');
      }

      const res = await bridgeAdapter.extractCurrentAsset(selectedType);
      setExtractedData(res);

      // 다중 블록 감지 시 인덱스 초기화
      const availableBlocks = res?.data?.availableBlocks;
      if (Array.isArray(availableBlocks) && availableBlocks.length > 1) {
        const foundIdx = availableBlocks.findIndex((b: any) => b.isSelected);
        const targetIdx = foundIdx >= 0 ? foundIdx : 0;
        setSelectedBlockIndex(targetIdx);
        setTitle(availableBlocks[targetIdx]?.title || res.title || '');
      } else {
        setSelectedBlockIndex(0);
        setTitle(res.title || '');
      }
    } catch (err: any) {
      onError(err?.message || '에셋 추출에 실패했습니다.');
    } finally {
      setExtracting(false);
    }
  };

  const handleSelectBlock = (idx: number) => {
    setSelectedBlockIndex(idx);
    const availableBlocks = extractedData?.data?.availableBlocks;
    if (availableBlocks && availableBlocks[idx]) {
      const chosen = availableBlocks[idx];
      setTitle(chosen.title || chosen.type || '블록 코드');
    }
  };

  const handleAddTag = () => {
    const trimmed = tagInput.trim().replace(/^#/, '');
    if (!trimmed) return;
    if (tags.length >= 5) {
      onError('태그는 최대 5개까지만 등록할 수 있습니다.');
      return;
    }
    if (tags.includes(trimmed)) {
      setTagInput('');
      return;
    }
    setTags([...tags, trimmed]);
    setTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleSaveOrUpload = async () => {
    if (!title || title.trim().length < 2) {
      onError('제목을 2자 이상 입력해주세요.');
      return;
    }

    if (!isEdit && !extractedData) {
      onError('먼저 현재 작업공간에서 에셋을 추출해주세요.');
      return;
    }

    if (!copyrightAgreed) {
      onError('저작권 및 배포 동의 체크박스에 동의해 주세요.');
      return;
    }

    setUploading(true);

    try {
      const authorName =
        currentUser?.user_metadata?.nickname ||
        currentUser?.email?.split('@')[0] ||
        '엔트리유저';

      // 0. 외래키 제약조건 방지: public.users 테이블에 사용자 프로필이 반드시 존재하도록 사전 보장
      try {
        await supabase.from('users').upsert(
          {
            id: currentUser.id,
            nickname: authorName,
            entry_username: currentUser.entry_username || authorName,
            role: (currentUser.entry_user_id === '6a17db19865137773fb9d8c9' || currentUser.entry_username === 'myentrymy' || currentUser.role === 'ADMIN' || currentUser.email === 'entry_6a17db19865137773fb9d8c9@entry-hub.local') ? 'ADMIN' : 'USER',
          },
          { onConflict: 'id' }
        );
      } catch (upsertErr) {
        console.warn('User profile sync warning:', upsertErr);
      }

      const chosenBadge = myBadges.find((b) => b.id === selectedBadgeId);
      const isBadgeAttached = attachOfficialBadge && Boolean(chosenBadge);

      if (isEdit && editingAsset) {
        // 기존 에셋 수정 또는 데이터 덮어쓰기 (갈아엎기)
        const updatePayload: Record<string, any> = {
          title: title.trim(),
          description: description.trim() || null,
          category_id: selectedCategoryId || null,
          is_official_badge: isBadgeAttached,
          badge_name: isBadgeAttached ? chosenBadge?.name : null,
          badge_color: isBadgeAttached ? chosenBadge?.color : null,
          tags: tags,
          updated_at: new Date().toISOString(),
        };

        // 새로 추출된 데이터가 있는 경우 이전 코드/오브젝트/썸네일을 완전히 갈아엎음
        if (extractedData) {
          const finalData = { ...extractedData.data };
          if (
            extractedData.type === 'CODE' &&
            finalData.availableBlocks &&
            finalData.availableBlocks[selectedBlockIndex]
          ) {
            finalData.block = finalData.availableBlocks[selectedBlockIndex].blockJson;
            finalData.functions = filterFunctionsForBlock(
              finalData.block,
              extractedData.data.functions || []
            );
          } else if (extractedData.type === 'CODE') {
            finalData.functions = filterFunctionsForBlock(
              finalData.block,
              extractedData.data.functions || []
            );
          }
          updatePayload.data = finalData;
          updatePayload.type = selectedType;
          if (extractedData.previewImageUrl) {
            updatePayload.preview_image_url = extractedData.previewImageUrl;
          }
        }

        const { error } = await supabase
          .from('assets')
          .update(updatePayload)
          .eq('id', editingAsset.id);

        if (error) throw error;

        onSuccess(
          extractedData
            ? `"${title}" 에셋 데이터가 새로운 내용으로 갈아엎어졌습니다!`
            : `"${title}" 에셋 정보가 수정되었습니다.`
        );
        onUpdated?.();
        onClose();
      } else {
        // 신규 에셋 업로드
        const assetId =
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : undefined;

        const finalData = { ...extractedData.data };
        if (
          extractedData.type === 'CODE' &&
          finalData.availableBlocks &&
          finalData.availableBlocks[selectedBlockIndex]
        ) {
          finalData.block = finalData.availableBlocks[selectedBlockIndex].blockJson;
          finalData.functions = filterFunctionsForBlock(
            finalData.block,
            extractedData.data.functions || []
          );
        } else if (extractedData.type === 'CODE') {
          finalData.functions = filterFunctionsForBlock(
            finalData.block,
            extractedData.data.functions || []
          );
        }

        const payload: Record<string, any> = {
          title: title.trim(),
          description: description.trim() || null,
          type: selectedType,
          author_id: currentUser.id,
          author_name: authorName,
          category_id: selectedCategoryId || null,
          is_official_badge: isBadgeAttached,
          badge_name: isBadgeAttached ? chosenBadge?.name : null,
          badge_color: isBadgeAttached ? chosenBadge?.color : null,
          tags: tags,
          data: finalData,
          preview_image_url: extractedData.previewImageUrl || null,
        };

        if (assetId) {
          payload.id = assetId;
        }

        const { error } = await supabase.from('assets').insert(payload);
        if (error) throw error;

        onSuccess(`"${title}" 에셋이 Supabase 데이터베이스에 등록되었습니다!`);
        onClose();
      }
    } catch (err: any) {
      onError(err?.message || '데이터베이스 저장 중 오류가 발생했습니다.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
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
          backgroundColor: colors.canvas,
          borderRadius: '12px',
          width: '100%',
          maxHeight: '90%',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 12px 32px rgba(0,0,0,0.2)',
          border: `1px solid ${colors.hairline}`,
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '14px 16px',
            borderBottom: `1px solid ${colors.hairline}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Upload size={16} color="#0070f3" />
            <span style={{ fontSize: '14px', fontWeight: 600, color: colors.ink }}>
              {isEdit ? '에셋 수정 및 덮어쓰기' : '내 에셋 추출 및 공유'}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: colors.mute }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body Form */}
        <div style={{ padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Edit Mode Notice Banner */}
          {isEdit && (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: '8px',
                backgroundColor: extractedData ? '#f0fff4' : '#eff6ff',
                border: `1px solid ${extractedData ? '#9ae6b4' : '#bfdbfe'}`,
                fontSize: '12px',
                color: colors.ink,
                lineHeight: 1.4,
              }}
            >
              <strong>에셋 수정 모드</strong>: &quot;{editingAsset.title}&quot;<br />
              {extractedData ? (
                <span style={{ color: '#2f855a', fontWeight: 600 }}>
                  ✨ 현재 에디터에서 새 데이터를 추출했습니다! 저장 시 기존 에셋의 코드/오브젝트가 완전히 갈아엎어집니다.
                </span>
              ) : (
                <span style={{ color: colors.mute }}>
                  제목/설명만 변경하거나, 아래 추출 버튼을 눌러 현재 엔트리 에디터의 데이터를 추출해 이전 꺼를 갈아엎을 수 있습니다.
                </span>
              )}
            </div>
          )}

          {/* Step 1: Type Selection */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: colors.ink, marginBottom: '6px' }}>
              1. {isEdit ? '에셋 타입 (새로 추출할 대상)' : '추출할 에셋 타입 선택'}
            </label>
            <div style={{ display: 'flex', gap: '6px' }}>
              {(['CODE', 'OBJECT', 'SCENE'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    setSelectedType(type);
                    setExtractedData(null);
                  }}
                  style={{
                    flex: 1,
                    padding: '8px 4px',
                    borderRadius: '6px',
                    border: `1px solid ${selectedType === type ? colors.primary : colors.hairline}`,
                    backgroundColor: selectedType === type ? colors.canvasSoft2 : colors.canvas,
                    fontSize: '12px',
                    fontWeight: selectedType === type ? 600 : 400,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                  }}
                >
                  {type === 'CODE' && <Code2 size={12} />}
                  {type === 'OBJECT' && <Box size={12} />}
                  {type === 'SCENE' && <Layers size={12} />}
                  <span>{type === 'CODE' ? '코드' : type === 'OBJECT' ? '오브젝트' : '장면'}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Step 2: Extraction Trigger */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: colors.ink }}>
                2. 현재 엔트리 에디터에서 추출 {isEdit && '(데이터 갈아엎기)'}
              </label>
              {extractedData && (
                <span style={{ fontSize: '11px', color: '#38a169', display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <CheckCircle2 size={12} /> {isEdit ? '새 데이터 추출 완료' : '추출 완료'}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleExtract}
              disabled={extracting}
              style={{
                width: '100%',
                padding: '9px',
                borderRadius: '6px',
                border: `1px dashed ${extractedData ? '#38a169' : colors.hairlineStrong}`,
                backgroundColor: colors.canvasSoft2,
                cursor: extracting ? 'not-allowed' : 'pointer',
                fontSize: '12px',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              {extracting ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>엔트리 엔진에서 추출 중...</span>
                </>
              ) : extractedData ? (
                <span>새 데이터 재추출하기 (갈아엎기 대기 중)</span>
              ) : isEdit ? (
                <span>현재 엔트리 작업공간에서 새로 추출하여 갈아엎기</span>
              ) : (
                <span>작업공간에서 {selectedType === 'CODE' ? '블록 코드' : selectedType === 'OBJECT' ? '오브젝트' : '장면'} 추출하기</span>
              )}
            </button>

            {/* 다중 블록 선택 UI (블록이 2개 이상일 때 하나만 선택 가능) */}
            {selectedType === 'CODE' &&
              extractedData?.data?.availableBlocks &&
              extractedData.data.availableBlocks.length > 1 && (
                <div
                  style={{
                    marginTop: '8px',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    backgroundColor: '#eff6ff',
                    border: '1.5px solid #bfdbfe',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#1e40af' }}>
                      블록 묶음 {extractedData.data.availableBlocks.length}개 발견
                    </span>
                    <span style={{ fontSize: '11px', color: '#2563eb', fontWeight: 600 }}>
                      공유할 블록 1개 선택
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {extractedData.data.availableBlocks.map((blk: any, idx: number) => {
                      const isChosen = selectedBlockIndex === idx;
                      return (
                        <div
                          key={blk.id || idx}
                          onClick={() => handleSelectBlock(idx)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 10px',
                            borderRadius: '6px',
                            border: `1.5px solid ${isChosen ? '#2563eb' : '#dbeafe'}`,
                            backgroundColor: isChosen ? '#ffffff' : '#f8fafc',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input
                              type="radio"
                              name="selectedBlockThread"
                              checked={isChosen}
                              onChange={() => handleSelectBlock(idx)}
                              style={{ cursor: 'pointer' }}
                            />
                            <div>
                              <div style={{ fontSize: '12px', fontWeight: isChosen ? 700 : 500, color: colors.ink }}>
                                {blk.title || blk.type}
                              </div>
                              <div style={{ fontSize: '10px', color: colors.mute }}>
                                블록 {blk.blockCount}개 연결됨
                              </div>
                            </div>
                          </div>
                          {isChosen && (
                            <span style={{ fontSize: '11px', fontWeight: 700, color: '#2563eb' }}>
                              선택됨
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
          </div>

          {/* Step 3: Meta Info */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: colors.ink, marginBottom: '4px' }}>
              에셋 제목
            </label>
            <input
              type="text"
              placeholder="예: 스무스 카메라 컨트롤러"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '8px 10px',
                borderRadius: '6px',
                border: `1px solid ${colors.hairline}`,
                fontSize: '12px',
                outline: 'none',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: colors.ink, marginBottom: '4px' }}>
              설명 (선택)
            </label>
            <textarea
              placeholder="에셋의 사용 방법이나 특징을 설명해주세요."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '8px 10px',
                borderRadius: '6px',
                border: `1px solid ${colors.hairline}`,
                fontSize: '12px',
                outline: 'none',
                resize: 'none',
                fontFamily: 'inherit',
              }}
            />
          </div>

          {/* Category Selection (Optional) */}
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600, color: colors.ink, marginBottom: '4px' }}>
              <Tag size={12} color="#0070f3" />
              <span>카테고리 선택 (선택 사항)</span>
            </label>
            <select
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '8px 10px',
                borderRadius: '6px',
                border: `1px solid ${colors.hairline}`,
                fontSize: '12px',
                backgroundColor: colors.canvas,
                color: colors.ink,
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="">카테고리 선택 안 함 (기본)</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Tag Selection (Up to 5 tags) */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600, color: colors.ink }}>
                <Tag size={12} color="#7928ca" />
                <span>관련 태그 (최대 5개)</span>
              </label>
              <span style={{ fontSize: '11px', color: tags.length >= 5 ? colors.error : colors.mute, fontWeight: 500 }}>
                {tags.length} / 5
              </span>
            </div>

            <div style={{ display: 'flex', gap: '6px', marginBottom: tags.length > 0 ? '8px' : '0' }}>
              <input
                type="text"
                placeholder={tags.length >= 5 ? '최대 5개까지 등록 완료됨' : '태그 입력 후 Enter (예: 물리엔진, 점프)'}
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                disabled={tags.length >= 5}
                style={{
                  flex: 1,
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: `1px solid ${colors.hairline}`,
                  fontSize: '12px',
                  outline: 'none',
                  backgroundColor: tags.length >= 5 ? colors.canvasSoft2 : colors.canvas,
                  color: colors.ink,
                }}
              />
              <button
                type="button"
                onClick={handleAddTag}
                disabled={tags.length >= 5 || !tagInput.trim()}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: `1px solid ${colors.hairlineStrong}`,
                  backgroundColor: colors.canvasSoft2,
                  color: colors.ink,
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: tags.length >= 5 || !tagInput.trim() ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                추가
              </button>
            </div>

            {tags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {tags.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '3px 8px',
                      borderRadius: '12px',
                      backgroundColor: colors.canvasSoft2,
                      border: `1px solid ${colors.hairline}`,
                      fontSize: '11px',
                      color: colors.ink,
                      fontWeight: 500,
                    }}
                  >
                    <span>#{tag}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                        color: colors.mute,
                      }}
                      title="태그 삭제"
                    >
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Official Badge Attachment Section */}
          <div
            style={{
              border: `1px solid ${attachOfficialBadge ? '#0070f3' : colors.hairline}`,
              borderRadius: '8px',
              padding: '10px 12px',
              backgroundColor: attachOfficialBadge ? colors.canvasSoft2 : colors.canvas,
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ShieldCheck size={14} color={attachOfficialBadge ? '#0070f3' : colors.mute} />
                <span style={{ fontSize: '12px', fontWeight: 600, color: colors.ink }}>
                  공식 배지 부착 설정
                </span>
              </div>
              {myBadges.length > 0 ? (
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px', color: colors.body }}>
                  <input
                    type="checkbox"
                    checked={attachOfficialBadge}
                    onChange={(e) => setAttachOfficialBadge(e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                  <span>이 에셋에 공식 배지 부착</span>
                </label>
              ) : (
                <span style={{ fontSize: '11px', color: colors.mute }}>
                  보유 중인 공식 배지 없음
                </span>
              )}
            </div>

            {attachOfficialBadge && myBadges.length > 0 && (
              <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: colors.body }}>
                  부착할 공식 배지 선택:
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {myBadges.map((badge) => {
                    const isSelected = selectedBadgeId === badge.id;
                    return (
                      <div
                        key={badge.id}
                        onClick={() => setSelectedBadgeId(badge.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          border: `1px solid ${isSelected ? badge.color : colors.hairline}`,
                          backgroundColor: isSelected ? `${badge.color}15` : colors.canvas,
                          cursor: 'pointer',
                          fontSize: '12px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input
                            type="radio"
                            name="officialBadgeSelection"
                            checked={isSelected}
                            onChange={() => setSelectedBadgeId(badge.id)}
                            style={{ cursor: 'pointer' }}
                          />
                          <span
                            style={{
                              padding: '2px 6px',
                              borderRadius: '4px',
                              backgroundColor: badge.color,
                              color: '#fff',
                              fontSize: '11px',
                              fontWeight: 700,
                            }}
                          >
                            {badge.name}
                          </span>
                          {badge.description && (
                            <span style={{ fontSize: '11px', color: colors.mute }}>
                              {badge.description}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>


          {/* Copyright Agreement Checkbox (Mandatory) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              padding: '10px 12px',
              backgroundColor: copyrightAgreed ? '#f0fff4' : colors.canvasSoft2,
              borderRadius: '8px',
              border: `1px solid ${copyrightAgreed ? '#9ae6b4' : colors.hairlineStrong}`,
              transition: 'all 0.15s ease',
            }}
          >
            <input
              type="checkbox"
              id="copyrightAgreement"
              checked={copyrightAgreed}
              onChange={(e) => setCopyrightAgreed(e.target.checked)}
              style={{ marginTop: '2px', cursor: 'pointer' }}
            />
            <label htmlFor="copyrightAgreement" style={{ fontSize: '11px', color: colors.body, cursor: 'pointer', lineHeight: 1.5 }}>
              <strong style={{ color: colors.ink }}>저작권 및 배포 동의 (필수)</strong><br />
              본인이 직접 창작하였거나 정당한 배포 권한을 보유한 에셋이며, 타인의 저작권을 침해하지 않음에 동의합니다.
            </label>
          </div>
        </div>

        {/* Footer Buttons */}
        <div
          style={{
            padding: '12px 16px',
            borderTop: `1px solid ${colors.hairline}`,
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '8px',
            backgroundColor: colors.canvasSoft,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 14px',
              borderRadius: '6px',
              border: `1px solid ${colors.hairlineStrong}`,
              backgroundColor: colors.canvas,
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSaveOrUpload}
            disabled={
              isEdit
                ? !title.trim() || !copyrightAgreed || uploading
                : !extractedData || !copyrightAgreed || uploading
            }
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor:
                (isEdit ? title.trim() : extractedData) && copyrightAgreed ? colors.primary : colors.mute,
              color: colors.onPrimary,
              fontSize: '12px',
              fontWeight: 600,
              cursor:
                (isEdit ? title.trim() : extractedData) && copyrightAgreed && !uploading
                  ? 'pointer'
                  : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {uploading ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                <span>DB 저장 중...</span>
              </>
            ) : isEdit ? (
              <span>{extractedData ? '갈아엎기 & 수정 완료' : '수정 완료'}</span>
            ) : (
              <span>공유 및 업로드</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
