import React, { useState } from 'react';
import { X, Settings, Check } from 'lucide-react';
import { colors, ThemeColors } from '@entry-hub/shared';
import { StartupTabSetting, getStartupTabSetting, setStartupTabSetting } from '../App';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeColors: ThemeColors;
  onSaved?: () => void;
}

export function SettingsModal({ isOpen, onClose, activeColors, onSaved }: SettingsModalProps) {
  const [selectedSetting, setSelectedSetting] = useState<StartupTabSetting>(() => getStartupTabSetting());

  if (!isOpen) return null;

  const handleSave = () => {
    setStartupTabSetting(selectedSetting);
    if (onSaved) onSaved();
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        backdropFilter: 'blur(3px)',
        zIndex: 9999,
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
          maxWidth: '380px',
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
            <Settings size={16} color={activeColors.primary} />
            <span>확장 프로그램 설정</span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: activeColors.mute,
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* 본문 설정 내용 */}
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 600,
                color: activeColors.ink,
                marginBottom: '6px',
              }}
            >
              사이드 패널 오픈 시 시작 탭
            </label>
            <p style={{ margin: '0 0 10px', fontSize: '11px', color: activeColors.mute, lineHeight: 1.4 }}>
              엔트리 에디터에서 엔트리 허브 사이드 패널을 열었을 때 가장 먼저 표시할 화면을 선택합니다.
            </p>
            <select
              value={selectedSetting}
              onChange={(e) => setSelectedSetting(e.target.value as StartupTabSetting)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: `1px solid ${activeColors.hairlineStrong}`,
                backgroundColor: activeColors.canvasSoft2,
                color: activeColors.ink,
                fontSize: '13px',
                fontWeight: 500,
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="MAIN">1. 홈 탭</option>
              <option value="EXPLORE">2. 탐색 탭</option>
              <option value="CATEGORY">3. 카테고리 탭</option>
              <option value="MYPICK">4. 마이픽 탭</option>
              <option value="LOCAL_HUB">5. 로컬 허브 탭</option>
              <option value="LAST_ACTIVE">6. 마지막에 있었다가 닫았던 탭</option>
            </select>
          </div>
        </div>

        {/* 푸터 버튼 */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '8px',
            padding: '12px 16px',
            borderTop: `1px solid ${activeColors.hairline}`,
            backgroundColor: activeColors.canvasSoft,
          }}
        >
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
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSave}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 16px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: activeColors.primary,
              color: activeColors.onPrimary,
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Check size={14} />
            <span>설정 저장</span>
          </button>
        </div>
      </div>
    </div>
  );
}

