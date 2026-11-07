import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Send,
  Loader2,
  Check,
  AlertCircle,
  Play,
  Settings,
  RefreshCw,
  Code2,
  Columns,
  Cpu,
  ArrowRight,
  HelpCircle,
} from 'lucide-react';
import { ThemeColors } from '@entry-hub/shared';
import {
  getHuberSettings,
  getActiveApiKey,
  HUBER_MODELS,
  HuberSettings,
  HuberModelId,
} from '../../content/storage/huberStorage';
import {
  generateHuberScript,
  HuberScript,
  HuberContext,
} from '../../content/services/huberClient';
import { VisualScriptViewer } from '../components/EntryAssetViewer';

interface HuberMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  script?: HuberScript;
  applied?: boolean;
  createdAt: number;
}

interface HuberTabProps {
  activeColors: ThemeColors;
  onNavigateSettings: () => void;
  onApplyScript: (script: HuberScript, title?: string) => Promise<void>;
  bridgeAdapter?: any;
}

const PRESET_PROMPTS = [
  '화살표 키로 상하좌우 부드럽게 이동하기',
  '스페이스 키를 누르면 점프하고 중력 적용하기',
  '마우스를 클릭하면 소리를 내며 크기가 커졌다 줄어들기',
  '현재 블록 코드의 문제점을 찾아서 버그 수정해줘',
];

export function HuberTab({
  activeColors,
  onNavigateSettings,
  onApplyScript,
  bridgeAdapter,
}: HuberTabProps) {
  const [settings, setSettings] = useState<HuberSettings>(() => getHuberSettings());
  const [messages, setMessages] = useState<HuberMessage[]>([]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 현재 엔트리 에디터에서 선택된 오브젝트 컨텍스트
  const [currentContext, setCurrentContext] = useState<HuberContext | null>(null);
  const [isContextLoading, setIsContextLoading] = useState(false);

  // Diff 뷰어 토글 상태 (메시지 ID별)
  const [diffViewMap, setDiffViewMap] = useState<Record<string, boolean>>({});
  // 적용 진행 중 상태 (메시지 ID별)
  const [applyingId, setApplyingId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeKeyInfo = getActiveApiKey(settings);
  const selectedModelInfo =
    HUBER_MODELS.find((m) => m.id === settings.selectedModel) || HUBER_MODELS[0];

  // 설정 실시간 감지 및 마운트 시 최신화
  useEffect(() => {
    setSettings(getHuberSettings());

    const handleSettingsMsg = (e: MessageEvent) => {
      if (e.data?.type === 'ENTRY_HUB_HUBER_SETTINGS_CHANGED' && e.data.settings) {
        setSettings(e.data.settings);
      }
    };
    window.addEventListener('message', handleSettingsMsg);
    return () => window.removeEventListener('message', handleSettingsMsg);
  }, []);

  // 현재 엔트리 오브젝트 정보 로드
  const fetchCurrentObjectContext = async () => {
    if (!bridgeAdapter) return;
    setIsContextLoading(true);
    try {
      const res =
        typeof (bridgeAdapter as any).extractCurrentAsset === 'function'
          ? await (bridgeAdapter as any).extractCurrentAsset('OBJECT')
          : typeof (bridgeAdapter as any).extractAsset === 'function'
          ? await (bridgeAdapter as any).extractAsset('OBJECT')
          : null;
      if (res && res.data) {
        const raw = res.data;
        const scriptData =
          typeof raw.script === 'string'
            ? JSON.parse(raw.script)
            : raw.script || [];

        setCurrentContext({
          objectName: raw.name || '선택된 오브젝트',
          pictures: (raw.sprite?.pictures || raw.pictures || []).map((p: any) => ({
            id: p.id || p.id_,
            name: p.name || p.name_,
          })),
          sounds: (raw.sprite?.sounds || raw.sounds || []).map((s: any) => ({
            id: s.id || s.id_,
            name: s.name || s.name_,
          })),
          variables: (raw.variables || []).map((v: any) => ({
            id: v.id || v.id_,
            name: v.name || v.name_,
          })),
          messages: (raw.messages || []).map((m: any) => ({
            id: m.id || m.id_,
            name: m.name || m.name_,
          })),
          currentScript: Array.isArray(scriptData) ? scriptData : [],
        });
      }
    } catch (err: any) {
      console.warn('[Huber] 현재 오브젝트 컨텍스트 로드 실패:', err);
    } finally {
      setIsContextLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentObjectContext();
  }, []);

  // 메시지 스크롤 아래로
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSendPrompt = async (textToSend?: string) => {
    const prompt = (textToSend || inputPrompt).trim();
    if (!prompt || isLoading) return;

    // 전송 시점에 최신 로컬 설정 직접 로드
    const currentSettings = getHuberSettings();
    setSettings(currentSettings);

    const currentKeyInfo = getActiveApiKey(currentSettings);
    const currentModelInfo =
      HUBER_MODELS.find((m) => m.id === currentSettings.selectedModel) || HUBER_MODELS[0];

    if (!currentKeyInfo) {
      setErrorMessage(
        `${currentModelInfo.providerName} API 키가 설정되지 않았습니다. [설정] 탭에서 API 키를 등록해 주세요.`
      );
      return;
    }

    setErrorMessage(null);
    setInputPrompt('');

    const userMsg: HuberMessage = {
      id: `msg_user_${Date.now()}`,
      role: 'user',
      content: prompt,
      createdAt: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const result = await generateHuberScript(
        currentSettings.selectedModel,
        currentKeyInfo.key,
        prompt,
        currentContext || undefined
      );

      const assistantMsg: HuberMessage = {
        id: `msg_asst_${Date.now()}`,
        role: 'assistant',
        content: result.explanation,
        script: result.script,
        createdAt: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error('[Huber] 생성 실패:', err);
      setErrorMessage(err.message || '코드 생성 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = async (msgId: string, script: HuberScript) => {
    setApplyingId(msgId);
    try {
      await onApplyScript(script, `${currentContext?.objectName || '오브젝트'} 코드`);
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, applied: true } : m))
      );
      // 적용 후 최신 오브젝트 상태 갱신
      setTimeout(fetchCurrentObjectContext, 500);
    } catch (err: any) {
      setErrorMessage(err.message || '에디터에 적용하는 중 오류가 발생했습니다.');
    } finally {
      setApplyingId(null);
    }
  };

  const toggleDiffView = (msgId: string) => {
    setDiffViewMap((prev) => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '12px' }}>
      {/* 1. 상단 바: 타이틀 & 모델 정보 & 현재 오브젝트 칩 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: '10px',
          borderBottom: `1px solid ${activeColors.hairline}`,
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '6px',
              background: activeColors.gradientDevelop,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
            }}
          >
            <Sparkles size={14} />
          </div>
          <span style={{ fontSize: '14px', fontWeight: 700, color: activeColors.ink }}>
            허버 (Huber)
          </span>
          <span
            style={{
              padding: '2px 6px',
              borderRadius: '4px',
              backgroundColor: `${activeColors.primary}18`,
              color: activeColors.primary,
              fontSize: '10px',
              fontWeight: 700,
            }}
          >
            Beta
          </span>
        </div>

        {/* 현재 모델명 & 오브젝트 배지 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            type="button"
            onClick={fetchCurrentObjectContext}
            disabled={isContextLoading}
            style={{
              background: activeColors.canvasSoft2,
              border: `1px solid ${activeColors.hairline}`,
              borderRadius: '6px',
              padding: '4px 8px',
              fontSize: '11px',
              fontWeight: 600,
              color: activeColors.ink,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
            title="현재 엔트리 오브젝트 정보 새로고침"
          >
            <RefreshCw size={11} className={isContextLoading ? 'animate-spin' : ''} />
            <span>{currentContext ? currentContext.objectName : '오브젝트 미선택'}</span>
          </button>

          <button
            type="button"
            onClick={onNavigateSettings}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: activeColors.mute,
              padding: '4px',
              display: 'flex',
            }}
            title="모델 및 API 키 설정"
          >
            <Settings size={15} />
          </button>
        </div>
      </div>

      {/* 2. API 키 미설정 경고 배너 */}
      {!activeKeyInfo && (
        <div
          style={{
            padding: '12px 14px',
            borderRadius: '10px',
            backgroundColor: `${activeColors.warning}15`,
            border: `1px solid ${activeColors.warning}40`,
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
          }}
        >
          <AlertCircle size={16} color={activeColors.warning} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: activeColors.ink }}>
              {selectedModelInfo.providerName} API 키가 등록되지 않았습니다
            </span>
            <span style={{ fontSize: '11px', color: activeColors.body, lineHeight: '1.4' }}>
              허버는 사용자의 개인 API 키로 작동하며, 키는 브라우저 로컬에만 안전하게 보관됩니다.
            </span>
            <button
              type="button"
              onClick={onNavigateSettings}
              style={{
                alignSelf: 'flex-start',
                marginTop: '4px',
                padding: '4px 10px',
                borderRadius: '6px',
                backgroundColor: activeColors.warning,
                color: '#fff',
                border: 'none',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              설정에서 API 키 입력하기
            </button>
          </div>
        </div>
      )}

      {/* 3. 에러 메시지 알림 바 */}
      {errorMessage && (
        <div
          style={{
            padding: '10px 12px',
            borderRadius: '8px',
            backgroundColor: `${activeColors.error}15`,
            border: `1px solid ${activeColors.error}40`,
            color: activeColors.error,
            fontSize: '11px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            style={{ background: 'none', border: 'none', color: activeColors.error, cursor: 'pointer', fontWeight: 700 }}
          >
            닫기
          </button>
        </div>
      )}

      {/* 4. 대화 및 시뮬레이션 렌더링 영역 */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          paddingRight: '4px',
        }}
      >
        {messages.length === 0 ? (
          <div
            style={{
              padding: '24px 12px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '14px',
              marginTop: 'auto',
              marginBottom: 'auto',
            }}
          >
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: activeColors.gradientDevelop,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                boxShadow: '0 8px 16px rgba(0, 112, 243, 0.2)',
              }}
            >
              <Cpu size={22} />
            </div>
            <div>
              <h4 style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: 700, color: activeColors.ink }}>
                무엇을 만들어 볼까요?
              </h4>
              <p style={{ margin: 0, fontSize: '12px', color: activeColors.mute, lineHeight: '1.5' }}>
                원하는 블록 코드를 한국어로 말씀해 주시면, 허버가 엔트리 블록으로 생성해 드립니다.
              </p>
            </div>

            {/* 퀵 프리셋 칩 버튼 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%', maxWidth: '360px' }}>
              {PRESET_PROMPTS.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendPrompt(preset)}
                  disabled={isLoading || !activeKeyInfo}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: `1px solid ${activeColors.hairline}`,
                    backgroundColor: activeColors.canvasSoft2,
                    color: activeColors.ink,
                    fontSize: '11px',
                    fontWeight: 600,
                    textAlign: 'left',
                    cursor: activeKeyInfo ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span>{preset}</span>
                  <ArrowRight size={12} color={activeColors.mute} />
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                gap: '6px',
              }}
            >
              {/* 말풍선 */}
              <div
                style={{
                  maxWidth: '88%',
                  padding: '10px 14px',
                  borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                  backgroundColor: msg.role === 'user' ? activeColors.primary : activeColors.canvasSoft2,
                  color: msg.role === 'user' ? '#fff' : activeColors.ink,
                  fontSize: '12px',
                  lineHeight: '1.5',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {msg.content}
              </div>

              {/* AI가 생성한 엔트리 블록 시각화 카드 */}
              {msg.role === 'assistant' && msg.script && (
                <div
                  style={{
                    width: '100%',
                    backgroundColor: activeColors.canvas,
                    border: `1.5px solid ${activeColors.hairlineStrong}`,
                    borderRadius: '12px',
                    overflow: 'hidden',
                    marginTop: '4px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                  }}
                >
                  {/* 카드 헤더: 블록 시각화 타이틀 및 컨트롤 */}
                  <div
                    style={{
                      padding: '8px 12px',
                      backgroundColor: activeColors.canvasSoft,
                      borderBottom: `1px solid ${activeColors.hairline}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Code2 size={13} color={activeColors.primary} />
                      <span style={{ fontSize: '11px', fontWeight: 700, color: activeColors.ink }}>
                        생성된 블록 코드 프리뷰
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {/* Diff 토글 버튼 */}
                      {currentContext?.currentScript && currentContext.currentScript.length > 0 && (
                        <button
                          type="button"
                          onClick={() => toggleDiffView(msg.id)}
                          style={{
                            padding: '3px 7px',
                            borderRadius: '5px',
                            border: `1px solid ${activeColors.hairline}`,
                            backgroundColor: diffViewMap[msg.id] ? activeColors.primary : activeColors.canvas,
                            color: diffViewMap[msg.id] ? '#fff' : activeColors.ink,
                            fontSize: '10px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px',
                          }}
                        >
                          <Columns size={11} />
                          <span>{diffViewMap[msg.id] ? '단일 보기' : '기존 코드와 비교'}</span>
                        </button>
                      )}

                      {/* 에디터에 적용하기 버튼 */}
                      <button
                        type="button"
                        onClick={() => handleApply(msg.id, msg.script!)}
                        disabled={applyingId === msg.id || msg.applied}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '6px',
                          backgroundColor: msg.applied ? '#10b981' : activeColors.primary,
                          color: '#fff',
                          border: 'none',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: msg.applied ? 'default' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        {applyingId === msg.id ? (
                          <>
                            <Loader2 size={11} className="animate-spin" />
                            <span>적용 중...</span>
                          </>
                        ) : msg.applied ? (
                          <>
                            <Check size={11} />
                            <span>적용 완료!</span>
                          </>
                        ) : (
                          <>
                            <Play size={11} fill="#fff" />
                            <span>에디터에 적용하기</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* 블록 렌더링 뷰어 (단일 또는 Diff) */}
                  <div style={{ padding: '8px', maxHeight: '340px', overflowY: 'auto' }}>
                    {diffViewMap[msg.id] && currentContext?.currentScript ? (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div>
                          <div style={{ fontSize: '10px', fontWeight: 700, color: activeColors.mute, marginBottom: '4px' }}>
                            현재 적용된 코드 (Before)
                          </div>
                          <VisualScriptViewer
                            scripts={currentContext.currentScript}
                            pictures={currentContext.pictures}
                            sounds={currentContext.sounds}
                          />
                        </div>
                        <div>
                          <div style={{ fontSize: '10px', fontWeight: 700, color: activeColors.primary, marginBottom: '4px' }}>
                            허버 제안 코드 (After)
                          </div>
                          <VisualScriptViewer
                            scripts={msg.script}
                            pictures={currentContext.pictures}
                            sounds={currentContext.sounds}
                          />
                        </div>
                      </div>
                    ) : (
                      <VisualScriptViewer
                        scripts={msg.script}
                        pictures={currentContext?.pictures}
                        sounds={currentContext?.sounds}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}

        {isLoading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 14px' }}>
            <Loader2 size={16} className="animate-spin" color={activeColors.primary} />
            <span style={{ fontSize: '12px', color: activeColors.mute }}>
              허버가 엔트리 블록을 코딩하고 있습니다...
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 5. 하단 프롬프트 입력 바 */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendPrompt();
        }}
        style={{
          display: 'flex',
          gap: '8px',
          alignItems: 'flex-end',
          paddingTop: '8px',
          borderTop: `1px solid ${activeColors.hairline}`,
        }}
      >
        <textarea
          value={inputPrompt}
          onChange={(e) => setInputPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSendPrompt();
            }
          }}
          placeholder={
            activeKeyInfo
              ? '원하는 블록 코드를 설명해 주세요 (Enter: 전송)'
              : '설정에서 API 키를 먼저 입력해 주세요'
          }
          disabled={isLoading || !activeKeyInfo}
          rows={2}
          style={{
            flex: 1,
            boxSizing: 'border-box',
            padding: '8px 12px',
            borderRadius: '8px',
            border: `1.5px solid ${activeColors.hairlineStrong}`,
            backgroundColor: activeColors.canvas,
            color: activeColors.ink,
            fontSize: '12px',
            outline: 'none',
            resize: 'none',
            fontFamily: 'inherit',
          }}
        />

        <button
          type="submit"
          disabled={isLoading || !inputPrompt.trim() || !activeKeyInfo}
          style={{
            padding: '10px 14px',
            borderRadius: '8px',
            backgroundColor: activeColors.primary,
            color: '#fff',
            border: 'none',
            cursor: isLoading || !inputPrompt.trim() || !activeKeyInfo ? 'not-allowed' : 'pointer',
            opacity: isLoading || !inputPrompt.trim() || !activeKeyInfo ? 0.5 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '42px',
          }}
          title="전송"
        >
          {isLoading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
        </button>
      </form>
    </div>
  );
}

