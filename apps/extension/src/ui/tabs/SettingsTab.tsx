import React, { useState } from 'react';
import {
  Settings,
  Check,
  ArrowLeft,
  Sparkles,
  KeyRound,
  ShieldCheck,
  Eye,
  EyeOff,
  Cpu,
} from 'lucide-react';
import { ThemeColors } from '@entry-hub/shared';
import { StartupTabSetting, getStartupTabSetting, setStartupTabSetting } from '../App';
import {
  getHuberSettings,
  saveHuberSettings,
  HuberSettings,
  HUBER_MODELS,
  HuberModelId,
} from '../../content/storage/huberStorage';

interface SettingsTabProps {
  activeColors: ThemeColors;
  onBack?: () => void;
  onSaved?: () => void;
}

export function SettingsTab({ activeColors, onBack, onSaved }: SettingsTabProps) {
  // 시작 탭 설정
  const [selectedSetting, setSelectedSetting] = useState<StartupTabSetting>(() => getStartupTabSetting());
  const [isSavedFeedback, setIsSavedFeedback] = useState(false);

  // 허버(Huber) AI 설정
  const [huberSettings, setHuberSettings] = useState<HuberSettings>(() => getHuberSettings());
  const [huberSavedFeedback, setHuberSavedFeedback] = useState(false);
  const [showKeyMap, setShowKeyMap] = useState<Record<string, boolean>>({});

  const tabOptions: Array<{ value: StartupTabSetting; label: string; desc: string }> = [
    { value: 'MAIN', label: '1. 홈 탭', desc: '확장 프로그램을 열 때 항상 메인 홈 탭이 열립니다.' },
    { value: 'EXPLORE', label: '2. 탐색 탭', desc: '모든 에셋을 둘러볼 수 있는 탐색 탭이 열립니다.' },
    { value: 'CATEGORY', label: '3. 카테고리 탭', desc: '카테고리별로 정돈된 탐색 탭이 열립니다.' },
    { value: 'MYPICK', label: '4. 마이픽 탭', desc: '내가 북마크한 에셋 목록이 바로 열립니다.' },
    { value: 'LOCAL_HUB', label: '5. 로컬 허브 탭', desc: '내 컴퓨터에 보관된 로컬 에셋 폴더가 열립니다.' },
    { value: 'LAST_ACTIVE', label: '6. 마지막에 있었다가 닫았던 탭', desc: '마지막으로 작업하다 닫았던 탭이 기억되어 복원됩니다.' },
  ];

  const handleSelectTab = (val: StartupTabSetting) => {
    setSelectedSetting(val);
    setStartupTabSetting(val);
    triggerSavedFeedback();
  };

  const triggerSavedFeedback = () => {
    setIsSavedFeedback(true);
    if (onSaved) onSaved();
    setTimeout(() => {
      setIsSavedFeedback(false);
    }, 1800);
  };

  const triggerHuberSavedFeedback = () => {
    setHuberSavedFeedback(true);
    if (onSaved) onSaved();
    setTimeout(() => {
      setHuberSavedFeedback(false);
    }, 1800);
  };

  // 허버 토글 변경
  const handleToggleHuber = (enabled: boolean) => {
    const updated = { ...huberSettings, enabled };
    setHuberSettings(updated);
    saveHuberSettings(updated);
    triggerHuberSavedFeedback();
  };

  // 허버 기본 모델 변경
  const handleModelChange = (selectedModel: HuberModelId) => {
    const updated = { ...huberSettings, selectedModel };
    setHuberSettings(updated);
    saveHuberSettings(updated);
    triggerHuberSavedFeedback();
  };

  // API 키 변경
  const handleApiKeyChange = (
    provider: 'gemini' | 'openai' | 'anthropic' | 'deepseek' | 'groq',
    val: string
  ) => {
    const updated = {
      ...huberSettings,
      apiKeys: {
        ...huberSettings.apiKeys,
        [provider]: val,
      },
    };
    setHuberSettings(updated);
    saveHuberSettings(updated);
  };

  const toggleShowKey = (provider: string) => {
    setShowKeyMap((prev) => ({ ...prev, [provider]: !prev[provider] }));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '32px' }}>
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

        {(isSavedFeedback || huberSavedFeedback) && (
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

      {/* ============================================================== */}
      {/* 섹션 1: 허버 (AI 어시스턴트) Beta 설정                          */}
      {/* ============================================================== */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          padding: '16px',
          borderRadius: '12px',
          backgroundColor: activeColors.canvasSoft,
          border: `1px solid ${activeColors.hairline}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
            <div
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '8px',
                background: activeColors.gradientDevelop,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                flexShrink: 0,
              }}
            >
              <Sparkles size={16} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: activeColors.ink }}>
                  허버 (Huber) AI 어시스턴트
                </span>
                <span
                  style={{
                    padding: '2px 5px',
                    borderRadius: '4px',
                    backgroundColor: `${activeColors.primary}20`,
                    color: activeColors.primary,
                    fontSize: '10px',
                    fontWeight: 700,
                  }}
                >
                  Beta
                </span>
              </div>
              <p style={{ margin: '2px 0 0', fontSize: '11px', color: activeColors.mute, lineHeight: 1.4 }}>
                자연어로 엔트리 블록 코드를 생성하고 시뮬레이션 후 에디터에 적용합니다.
              </p>
            </div>
          </div>

          {/* 토글 스위치 (축소 방지 및 정확한 여백 배치) */}
          <label
            style={{
              position: 'relative',
              display: 'inline-block',
              width: '42px',
              height: '24px',
              flexShrink: 0,
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={huberSettings.enabled}
              onChange={(e) => handleToggleHuber(e.target.checked)}
              style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
            />
            <span
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '24px',
                backgroundColor: huberSettings.enabled ? activeColors.primary : activeColors.hairlineStrong,
                transition: 'background-color 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                display: 'block',
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  top: '3px',
                  left: huberSettings.enabled ? '21px' : '3px',
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  backgroundColor: '#ffffff',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.25)',
                  transition: 'left 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                  display: 'block',
                }}
              />
            </span>
          </label>
        </div>

        {huberSettings.enabled ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '6px' }}>
            {/* 기본 모델 선택 드롭다운 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: activeColors.ink, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Cpu size={12} color={activeColors.primary} />
                <span>기본 사용할 AI 모델</span>
              </label>
              <select
                value={huberSettings.selectedModel}
                onChange={(e) => handleModelChange(e.target.value as HuberModelId)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: `1px solid ${activeColors.hairlineStrong}`,
                  backgroundColor: activeColors.canvas,
                  color: activeColors.ink,
                  fontSize: '12px',
                  fontWeight: 600,
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                {HUBER_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.providerName})
                  </option>
                ))}
              </select>
            </div>

            {/* 보안 안내 뱃지 */}
            <div
              style={{
                padding: '8px 10px',
                borderRadius: '6px',
                backgroundColor: `${activeColors.primary}10`,
                border: `1px solid ${activeColors.primary}25`,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <ShieldCheck size={14} color={activeColors.primary} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: '11px', color: activeColors.ink, lineHeight: 1.4 }}>
                <strong>로컬 보안 원칙:</strong> 입력하신 API 키는 브라우저 내부(localStorage)에만 안전하게 저장되며, 어떠한 외부 서버로도 전송되지 않습니다.
              </span>
            </div>

            {/* API 키 등록 리스트 (5개 제공사) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: activeColors.mute, textTransform: 'uppercase' }}>
                제공사별 API 키 관리
              </span>

              {[
                { provider: 'gemini' as const, label: 'Google Gemini API 키', placeholder: 'AIzaSy...' },
                { provider: 'openai' as const, label: 'OpenAI (GPT) API 키', placeholder: 'sk-proj-...' },
                { provider: 'anthropic' as const, label: 'Anthropic (Claude) API 키', placeholder: 'sk-ant-...' },
                { provider: 'deepseek' as const, label: 'DeepSeek API 키', placeholder: 'sk-...' },
                { provider: 'groq' as const, label: 'Groq API 키', placeholder: 'gsk_...' },
              ].map(({ provider, label, placeholder }) => {
                const currentVal = huberSettings.apiKeys[provider] || '';
                const isShowing = !!showKeyMap[provider];

                return (
                  <div key={provider} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: activeColors.ink }}>
                        {label}
                      </span>
                      {currentVal && (
                        <span style={{ fontSize: '10px', color: '#10b981', fontWeight: 600 }}>
                          등록됨
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '4px' }}>
                      <input
                        type={isShowing ? 'text' : 'password'}
                        value={currentVal}
                        onChange={(e) => handleApiKeyChange(provider, e.target.value)}
                        placeholder={placeholder}
                        style={{
                          flex: 1,
                          padding: '7px 10px',
                          borderRadius: '6px',
                          border: `1px solid ${activeColors.hairlineStrong}`,
                          backgroundColor: activeColors.canvas,
                          color: activeColors.ink,
                          fontSize: '11px',
                          outline: 'none',
                          fontFamily: 'monospace',
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => toggleShowKey(provider)}
                        style={{
                          background: activeColors.canvasSoft2,
                          border: `1px solid ${activeColors.hairline}`,
                          borderRadius: '6px',
                          padding: '0 8px',
                          cursor: 'pointer',
                          color: activeColors.mute,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        title={isShowing ? '숨기기' : '보기'}
                      >
                        {isShowing ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div style={{ fontSize: '11px', color: activeColors.mute }}>
            허버 기능이 비활성화되었습니다. 사이드바 탭 메뉴에서 Beta 탭이 숨겨집니다.
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* 섹션 2: 사이드 패널 시작 탭 선택                              */}
      {/* ============================================================== */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <label style={{ fontSize: '13px', fontWeight: 700, color: activeColors.ink }}>
          사이드 패널 시작 탭 선택
        </label>
        <p style={{ margin: 0, fontSize: '12px', color: activeColors.body, lineHeight: '1.5' }}>
          확장 프로그램 사이드 패널을 열었을 때 가장 먼저 표시할 기본 탭을 설정합니다.
        </p>

        {/* 드롭다운 셀렉트 */}
        <select
          value={selectedSetting}
          onChange={(e) => handleSelectTab(e.target.value as StartupTabSetting)}
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
          {tabOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* 시작 탭 옵션 리스트 뷰 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: activeColors.mute, textTransform: 'uppercase' }}>
          시작 탭 안내
        </div>
        {tabOptions.map((opt) => {
          const isSelected = selectedSetting === opt.value;
          return (
            <div
              key={opt.value}
              onClick={() => handleSelectTab(opt.value)}
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
