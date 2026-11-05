import React, { useState } from 'react';
import { Settings, Check, ArrowLeft } from 'lucide-react';
import { ThemeColors } from '@entry-hub/shared';
import { StartupTabSetting, getStartupTabSetting, setStartupTabSetting, TabType } from '../App';

interface SettingsTabProps {
  activeColors: ThemeColors;
  onBack?: () => void;
  onSaved?: () => void;
}

export function SettingsTab({ activeColors, onBack, onSaved }: SettingsTabProps) {
  const [selectedSetting, setSelectedSetting] = useState<StartupTabSetting>(() => getStartupTabSetting());
  const [isSavedFeedback, setIsSavedFeedback] = useState(false);

  const options: Array<{ value: StartupTabSetting; label: string; desc: string }> = [
    { value: 'MAIN', label: '1. 홈 탭', desc: '확장 프로그램을 열 때 항상 메인 홈 탭이 열립니다.' },
    { value: 'EXPLORE', label: '2. 탐색 탭', desc: '모든 에셋을 둘러볼 수 있는 탐색 탭이 열립니다.' },
    { value: 'CATEGORY', label: '3. 카테고리 탭', desc: '카테고리별로 정돈된 탐색 탭이 열립니다.' },
    { value: 'MYPICK', label: '4. 마이픽 탭', desc: '내가 북마크한 에셋 목록이 바로 열립니다.' },
    { value: 'LOCAL_HUB', label: '5. 로컬 허브 탭', desc: '내 컴퓨터에 보관된 로컬 에셋 폴더가 열립니다.' },
    { value: 'LAST_ACTIVE', label: '6. 마지막에 있었다가 닫았던 탭', desc: '마지막으로 작업하다 닫았던 탭이 기억되어 복원됩니다.' },
  ];

  const handleSelect = (val: StartupTabSetting) => {
    setSelectedSetting(val);
    setStartupTabSetting(val);
    setIsSavedFeedback(true);
    if (onSaved) onSaved();
    setTimeout(() => {
      setIsSavedFeedback(false);
    }, 1800);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* 헤더 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: '12px',
          borderBottom: `1px solid ${activeColors.hairline}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                color: activeColors.mute,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="이전 탭으로 돌아가기"
            >
              <ArrowLeft size={16} />
            </button>
          )}
          <Settings size={18} color={activeColors.primary} />
          <span style={{ fontSize: '15px', fontWeight: 700, color: activeColors.ink }}>
            사이드 패널 설정
          </span>
        </div>

        {isSavedFeedback && (
          <span
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: activeColors.link,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Check size={13} /> 저장됨
          </span>
        )}
      </div>

      {/* 설정 항목 섹션 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <label style={{ fontSize: '12px', fontWeight: 700, color: activeColors.ink }}>
          사이드 패널 시작 탭 선택
        </label>
        <p style={{ margin: 0, fontSize: '12px', color: activeColors.body, lineHeight: '1.5' }}>
          확장 프로그램 사이드 패널을 열었을 때 가장 먼저 표시할 기본 탭을 설정합니다.
        </p>

        {/* 드롭다운 셀렉트 */}
        <select
          value={selectedSetting}
          onChange={(e) => handleSelect(e.target.value as StartupTabSetting)}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: '8px',
            border: `1.5px solid ${activeColors.hairlineStrong}`,
            backgroundColor: activeColors.canvas,
            color: activeColors.ink,
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            outline: 'none',
            marginTop: '4px',
          }}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* 선택된 옵션 목록 상세 리스트 뷰 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: activeColors.mute, textTransform: 'uppercase' }}>
          설정 가능한 옵션 안내
        </div>
        {options.map((opt) => {
          const isSelected = selectedSetting === opt.value;
          return (
            <div
              key={opt.value}
              onClick={() => handleSelect(opt.value)}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                padding: '10px 12px',
                borderRadius: '8px',
                border: `1px solid ${isSelected ? activeColors.primary : activeColors.hairline}`,
                backgroundColor: isSelected ? activeColors.canvasSoft2 : activeColors.canvas,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: isSelected ? 700 : 600,
                    color: isSelected ? activeColors.primary : activeColors.ink,
                  }}
                >
                  {opt.label}
                </span>
                <span style={{ fontSize: '11px', color: activeColors.body, lineHeight: '1.4' }}>
                  {opt.desc}
                </span>
              </div>
              {isSelected && (
                <div
                  style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    backgroundColor: activeColors.primary,
                    color: activeColors.onPrimary,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: '2px',
                  }}
                >
                  <Check size={11} strokeWidth={3} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

