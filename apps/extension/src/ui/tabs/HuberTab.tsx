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
  ChevronRight,
  ChevronDown,
  Plus,
  Square,
} from 'lucide-react';
import { ThemeColors, HuberActionPlan } from '@entry-hub/shared';
import {
  getHuberSettings,
  getActiveApiKey,
  HUBER_MODELS,
  HuberSettings,
  HuberModelId,
} from '../../content/storage/huberStorage';
import {
  generateHuberScript,
  generateHuberScriptStream,
  HuberScript,
  HuberContext,
} from '../../content/services/huberClient';
import { splitStreamTextAndJson } from '../../content/services/huberStreamParser';
import { VisualScriptViewer } from '../components/EntryAssetViewer';

interface HuberMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  reasoning?: string;
  script?: HuberScript;
  actionPlan?: HuberActionPlan;
  applied?: boolean;
  createdAt: number;
  durationText?: string;
  contextSummary?: string;
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

/**
 * Claude 시그니처 4-점 기하학적 엠블럼 아이콘 (:: 모티브)
 */
function HuberPonderingDots({
  activeColor = '#6366f1',
  animated = false,
}: {
  activeColor?: string;
  animated?: boolean;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 4.5px)',
        gridTemplateRows: 'repeat(2, 4.5px)',
        gap: '2px',
        width: '11px',
        height: '11px',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {[0, 1, 2, 3].map((idx) => (
        <span
          key={idx}
          style={{
            width: '4.5px',
            height: '4.5px',
            borderRadius: '1.2px',
            backgroundColor: activeColor,
            animation: animated
              ? `huber-claude-breathe 1.5s infinite ease-in-out ${idx * 0.18}s`
              : 'none',
            display: 'inline-block',
          }}
        />
      ))}
    </div>
  );
}

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
  const [lastPrompt, setLastPrompt] = useState<string>('');

  // Claude 스타일 실시간 경과 타이머
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // 실시간 스트리밍 버퍼
  const [streamingReasoning, setStreamingReasoning] = useState<string>('');
  const [streamingText, setStreamingText] = useState<string>('');
  const [isStreamingReasoningOpen, setIsStreamingReasoningOpen] = useState<boolean>(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 생각 과정(Thinking) 아코디언 토글 상태 (메시지 ID별)
  const [ponderingOpenMap, setPonderingOpenMap] = useState<Record<string, boolean>>({});

  // 퀵 프롬프트 팝오버 토글 상태
  const [showQuickPresets, setShowQuickPresets] = useState(false);

  // 현재 엔트리 에디터에서 선택된 오브젝트 컨텍스트
  const [currentContext, setCurrentContext] = useState<HuberContext | null>(null);
  const [isContextLoading, setIsContextLoading] = useState(false);

  // Diff 뷰어 토글 상태 (메시지 ID별)
  const [diffViewMap, setDiffViewMap] = useState<Record<string, boolean>>({});
  // 적용 진행 중 상태 (메시지 ID별)
  const [applyingId, setApplyingId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeKeyInfo = getActiveApiKey(settings);
  const selectedModelInfo =
    HUBER_MODELS.find((m) => m.id === settings.selectedModel) || HUBER_MODELS[0];

  // 로딩 시간 실시간 카운트업
  useEffect(() => {
    let timer: any = null;
    if (isLoading) {
      setElapsedSeconds(0);
      timer = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timer) clearInterval(timer);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isLoading]);

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
          functions: Array.isArray(raw.functions)
            ? raw.functions
            : Array.isArray(raw.sprite?.functions)
            ? raw.sprite.functions
            : [],
          currentScript: Array.isArray(scriptData) ? scriptData : [],
        });
      }
    } catch (e) {
      console.warn('[Huber] 오브젝트 컨텍스트 가져오기 실패:', e);
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

  const formatSeconds = (secs: number) => {
    if (secs < 60) return `${secs}s`;
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${s}s`;
  };

  const getPonderingLabel = (secs: number) => {
    if (secs < 2) return '오브젝트 및 컨텍스트 분석 중';
    if (secs < 5) return '엔트리 블록 알고리즘 설계 중';
    return '엔트리 블록 코드 및 액션 플랜 작성 중';
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
  };

  const handleSendPrompt = async (textToSend?: string) => {
    const prompt = (textToSend || inputPrompt).trim();
    if (!prompt || isLoading) return;

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
    setShowQuickPresets(false);
    setLastPrompt(prompt);
    setStreamingReasoning('');
    setStreamingText('');
    setIsStreamingReasoningOpen(true);

    const userMsg: HuberMessage = {
      id: `msg_user_${Date.now()}`,
      role: 'user',
      content: prompt,
      createdAt: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);
    const startTime = Date.now();

    const controller = new AbortController();
    abortControllerRef.current = controller;

    let accumulatedReasoning = '';
    let accumulatedText = '';

    try {
      const result = await generateHuberScriptStream(
        currentSettings.selectedModel,
        currentKeyInfo.key,
        prompt,
        {
          onReasoningChunk: (chunk) => {
            accumulatedReasoning += chunk;
            setStreamingReasoning((prev) => prev + chunk);
          },
          onTextChunk: (chunk) => {
            accumulatedText += chunk;
            setStreamingText((prev) => prev + chunk);
          },
        },
        currentContext || undefined,
        {
          tokenSavingMode: currentSettings.tokenSavingMode,
          signal: controller.signal,
        }
      );

      const elapsedMs = Date.now() - startTime;
      const durationText = formatSeconds(Math.max(1, Math.round(elapsedMs / 1000)));

      const assistantMsg: HuberMessage = {
        id: `msg_asst_${Date.now()}`,
        role: 'assistant',
        content: result.explanation || splitStreamTextAndJson(accumulatedText).explanationText,
        reasoning: accumulatedReasoning.trim() || undefined,
        script: result.script,
        actionPlan: result.actionPlan,
        durationText,
        contextSummary: currentContext?.objectName ? `대상: ${currentContext.objectName}` : undefined,
        createdAt: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      if (err.name === 'AbortError' || controller.signal.aborted) {
        console.log('[Huber] 생성이 사용자에 의해 중단되었습니다.');
        if (accumulatedText.trim() || accumulatedReasoning.trim()) {
          const split = splitStreamTextAndJson(accumulatedText);
          const assistantMsg: HuberMessage = {
            id: `msg_asst_${Date.now()}`,
            role: 'assistant',
            content: (split.explanationText || accumulatedText) + '\n\n*(생성이 중단되었습니다)*',
            reasoning: accumulatedReasoning.trim() || undefined,
            durationText: formatSeconds(Math.max(1, Math.round((Date.now() - startTime) / 1000))),
            createdAt: Date.now(),
          };
          setMessages((prev) => [...prev, assistantMsg]);
        }
      } else {
        console.error('[Huber] 생성 실패:', err);
        setErrorMessage(err.message || '코드 생성 중 오류가 발생했습니다.');
      }
    } finally {
      setIsLoading(false);
      setStreamingReasoning('');
      setStreamingText('');
      abortControllerRef.current = null;
    }
  };

  const handleApply = async (msgId: string, msg: HuberMessage) => {
    setApplyingId(msgId);
    try {
      if (msg.actionPlan && bridgeAdapter && typeof bridgeAdapter.executeActionPlan === 'function') {
        const success = await bridgeAdapter.executeActionPlan(msg.actionPlan);
        if (!success) {
          throw new Error('액션 플랜 실행에 실패했습니다.');
        }
      } else if (msg.script) {
        await onApplyScript(msg.script, `${currentContext?.objectName || '오브젝트'} 코드`);
      } else {
        throw new Error('적용할 스크립트나 액션 플랜이 없습니다.');
      }

      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, applied: true } : m))
      );
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

  const togglePondering = (msgId: string) => {
    setPonderingOpenMap((prev) => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        gap: '10px',
        position: 'relative',
        backgroundColor: activeColors.canvas,
        color: activeColors.ink,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
      }}
    >
      {/* CSS 글로벌 애니메이션 키프레임 */}
      <style>{`
        @keyframes huber-claude-breathe {
          0%, 100% {
            opacity: 0.25;
            transform: scale(0.85);
          }
          50% {
            opacity: 1;
            transform: scale(1.15);
          }
        }
        @keyframes huber-fade-in {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .huber-input-focus:focus-within {
          border-color: ${activeColors.primary} !important;
          box-shadow: 0 0 0 2px ${activeColors.primary}25 !important;
        }
      `}</style>

      {/* 1. Claude 스타일 미니멀 상단 네비게이션 헤더 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 2px 10px',
          borderBottom: `1px solid ${activeColors.hairline}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <HuberPonderingDots activeColor={activeColors.primary} animated={false} />
          <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '-0.2px', color: activeColors.ink }}>
            Huber
          </span>
          <span
            style={{
              fontSize: '10px',
              fontWeight: 600,
              padding: '1px 5px',
              borderRadius: '4px',
              backgroundColor: `${activeColors.primary}15`,
              color: activeColors.primary,
            }}
          >
            2.0
          </span>
        </div>

        {/* 현재 오브젝트 및 모델 설정 컨트롤 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            type="button"
            onClick={fetchCurrentObjectContext}
            disabled={isContextLoading}
            style={{
              background: activeColors.canvasSoft,
              border: `1px solid ${activeColors.hairline}`,
              borderRadius: '12px',
              padding: '3px 9px',
              fontSize: '11px',
              fontWeight: 500,
              color: activeColors.ink,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              transition: 'background-color 0.15s ease',
            }}
            title="현재 엔트리 오브젝트 정보 동기화"
          >
            <RefreshCw size={10} className={isContextLoading ? 'animate-spin' : ''} color={activeColors.mute} />
            <span style={{ maxWidth: '110px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentContext ? currentContext.objectName : '오브젝트 미선택'}
            </span>
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
              borderRadius: '6px',
            }}
            title="모델 및 API 설정"
          >
            <Settings size={14} />
          </button>
        </div>
      </div>

      {/* 2. 경고 알림 바 */}
      {!activeKeyInfo && (
        <div
          style={{
            padding: '10px 12px',
            borderRadius: '8px',
            backgroundColor: `${activeColors.warning}15`,
            border: `1px solid ${activeColors.warning}35`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '11px',
            color: activeColors.ink,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AlertCircle size={14} color={activeColors.warning} />
            <span>{selectedModelInfo.providerName} API 키 설정이 필요합니다.</span>
          </div>
          <button
            type="button"
            onClick={onNavigateSettings}
            style={{
              padding: '3px 8px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: activeColors.warning,
              color: '#fff',
              fontSize: '10px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            설정하기
          </button>
        </div>
      )}

      {errorMessage && (
        <div
          style={{
            padding: '8px 12px',
            borderRadius: '8px',
            backgroundColor: `${activeColors.error}15`,
            border: `1px solid ${activeColors.error}35`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '11px',
            color: activeColors.error,
          }}
        >
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            style={{ background: 'none', border: 'none', color: activeColors.error, cursor: 'pointer', fontWeight: 700 }}
          >
            ×
          </button>
        </div>
      )}

      {/* 3. 대화 본문 영역 (Claude Minimal Clean Style) */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
          padding: '4px 2px',
        }}
      >
        {messages.length === 0 ? (
          <div
            style={{
              padding: '32px 16px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '16px',
              margin: 'auto 0',
            }}
          >
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                backgroundColor: activeColors.canvasSoft,
                border: `1px solid ${activeColors.hairline}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <HuberPonderingDots activeColor={activeColors.primary} animated={false} />
            </div>

            <div>
              <h3 style={{ margin: '0 0 6px', fontSize: '15px', fontWeight: 700, color: activeColors.ink }}>
                어떤 엔트리 작품을 만들까요?
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: activeColors.mute, lineHeight: '1.5', maxWidth: '280px' }}>
                원하는 블록 코딩, 소리, 변수, 오브젝트를 자연어로 말씀하시면 허버가 완벽하게 제작합니다.
              </p>
            </div>

            {/* 미니멀 퀵 프리셋 칩 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%', maxWidth: '340px' }}>
              {PRESET_PROMPTS.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendPrompt(preset)}
                  disabled={isLoading || !activeKeyInfo}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '10px',
                    backgroundColor: activeColors.canvasSoft,
                    border: `1px solid ${activeColors.hairline}`,
                    color: activeColors.ink,
                    fontSize: '11px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span>{preset}</span>
                  <ArrowRight size={11} color={activeColors.mute} />
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
                gap: '4px',
                animation: 'huber-fade-in 0.2s ease-out',
                width: '100%',
              }}
            >
              {/* 사용자 질문 버블 (미니멀 라운드 캡슐) */}
              {msg.role === 'user' && (
                <div
                  style={{
                    maxWidth: '85%',
                    padding: '9px 14px',
                    borderRadius: '18px 18px 4px 18px',
                    backgroundColor: activeColors.primary,
                    color: activeColors.onPrimary,
                    fontSize: '12px',
                    lineHeight: '1.5',
                    wordBreak: 'break-word',
                  }}
                >
                  {msg.content}
                </div>
              )}

              {/* 허버 답변 본문 (Claude 플랫 스타일 + 아코디언) */}
              {msg.role === 'assistant' && (
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {/* Claude 시그니처 Thinking / 작업 내역 아코디언 헤더 */}
                  {msg.durationText && (
                    <button
                      type="button"
                      onClick={() => togglePondering(msg.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: '2px 0',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: activeColors.mute,
                        cursor: 'pointer',
                      }}
                    >
                      <HuberPonderingDots activeColor={activeColors.mute} animated={false} />
                      <span>설계 및 작업 내역 {msg.durationText}</span>
                      {ponderingOpenMap[msg.id] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </button>
                  )}

                  {/* 아코디언 세부 내용 (접었다 펼치기) */}
                  {msg.durationText && ponderingOpenMap[msg.id] && (
                    <div
                      style={{
                        padding: '8px 10px',
                        borderRadius: '6px',
                        backgroundColor: activeColors.canvasSoft2,
                        borderLeft: `2px solid ${activeColors.primary}`,
                        fontSize: '11px',
                        color: activeColors.body,
                        lineHeight: '1.5',
                        marginBottom: '4px',
                      }}
                    >
                      <div>• 소요 시간: {msg.durationText}</div>
                      {msg.contextSummary && <div>• {msg.contextSummary}</div>}
                      {msg.actionPlan?.variables?.length ? (
                        <div>• 추가 변수: {msg.actionPlan.variables.map((v) => v.name).join(', ')}</div>
                      ) : null}
                      {msg.actionPlan?.messages?.length ? (
                        <div>• 추가 신호: {msg.actionPlan.messages.map((m) => m.name).join(', ')}</div>
                      ) : null}
                      {msg.reasoning && (
                        <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: `1px solid ${activeColors.hairline}` }}>
                          <div style={{ fontSize: '10px', fontWeight: 600, color: activeColors.mute, marginBottom: '2px' }}>
                            AI 사고 과정:
                          </div>
                          <div
                            style={{
                              fontSize: '10px',
                              color: activeColors.mute,
                              whiteSpace: 'pre-wrap',
                              maxHeight: '150px',
                              overflowY: 'auto',
                              lineHeight: '1.4',
                            }}
                          >
                            {msg.reasoning}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 텍스트 설명 (자연스러운 플랫 마크다운 뷰) */}
                  {Boolean(msg.content && msg.content.trim()) && (
                    <div
                      style={{
                        fontSize: '12px',
                        lineHeight: '1.6',
                        color: activeColors.ink,
                        whiteSpace: 'pre-wrap',
                        padding: '2px 0',
                      }}
                    >
                      {msg.content}
                    </div>
                  )}

                  {/* Claude Artifacts 스타일의 세련된 블록 프리뷰 카드 */}
                  {(msg.script || msg.actionPlan) && (
                    <div
                      style={{
                        width: '100%',
                        backgroundColor: activeColors.canvas,
                        border: `1px solid ${activeColors.hairlineStrong}`,
                        borderRadius: '10px',
                        overflow: 'hidden',
                        marginTop: '4px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                      }}
                    >
                      {/* 미니멀 카드 헤더 */}
                      <div
                        style={{
                          padding: '7px 12px',
                          backgroundColor: activeColors.canvasSoft,
                          borderBottom: `1px solid ${activeColors.hairline}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '6px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Code2 size={12} color={activeColors.primary} />
                          <span style={{ fontSize: '11px', fontWeight: 700, color: activeColors.ink }}>
                            {msg.actionPlan?.objects?.some((o) => o.target === 'NEW')
                              ? 'Huber 2.0 액션 플랜'
                              : '생성된 블록 코드'}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {/* Diff 토글 */}
                          {currentContext?.currentScript && currentContext.currentScript.length > 0 && msg.script && (
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
                              <Columns size={10} />
                              <span>{diffViewMap[msg.id] ? '단일 보기' : '비교'}</span>
                            </button>
                          )}

                          {/* 에디터에 적용하기 버튼 */}
                          <button
                            type="button"
                            onClick={() => handleApply(msg.id, msg)}
                            disabled={applyingId === msg.id || msg.applied}
                            style={{
                              padding: '4px 10px',
                              borderRadius: '6px',
                              backgroundColor: msg.applied ? '#10b981' : activeColors.primary,
                              color: '#fff',
                              border: 'none',
                              fontSize: '11px',
                              fontWeight: 600,
                              cursor: msg.applied ? 'default' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              transition: 'background-color 0.15s ease',
                            }}
                          >
                            {applyingId === msg.id ? (
                              <>
                                <Loader2 size={11} className="animate-spin" />
                                <span>주입 중...</span>
                              </>
                            ) : msg.applied ? (
                              <>
                                <Check size={11} />
                                <span>주입 완료</span>
                              </>
                            ) : (
                              <>
                                <Play size={10} fill="#fff" />
                                <span>작품에 적용하기</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* 액션 플랜 칩 바 */}
                      {msg.actionPlan && (
                        <div
                          style={{
                            padding: '5px 12px',
                            backgroundColor: activeColors.canvasSoft2,
                            borderBottom: `1px solid ${activeColors.hairline}`,
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '5px',
                            fontSize: '10px',
                          }}
                        >
                          {msg.actionPlan.objects?.filter((o) => o.target === 'NEW').length ? (
                            <span style={{ padding: '1px 5px', borderRadius: '4px', backgroundColor: '#8b5cf618', border: '1px solid #8b5cf640', color: '#8b5cf6', fontWeight: 600 }}>
                              오브젝트 +{msg.actionPlan.objects.filter((o) => o.target === 'NEW').length}
                            </span>
                          ) : null}
                          {msg.actionPlan.variables?.length ? (
                            <span style={{ padding: '1px 5px', borderRadius: '4px', backgroundColor: '#0070f318', border: '1px solid #0070f340', color: '#0070f3', fontWeight: 600 }}>
                              변수 +{msg.actionPlan.variables.length} ({msg.actionPlan.variables.map((v) => v.name).join(', ')})
                            </span>
                          ) : null}
                          {msg.actionPlan.lists?.length ? (
                            <span style={{ padding: '1px 5px', borderRadius: '4px', backgroundColor: '#ec489918', border: '1px solid #ec489940', color: '#ec4899', fontWeight: 600 }}>
                              리스트 +{msg.actionPlan.lists.length}
                            </span>
                          ) : null}
                          {msg.actionPlan.messages?.length ? (
                            <span style={{ padding: '1px 5px', borderRadius: '4px', backgroundColor: '#f59e0b18', border: '1px solid #f59e0b40', color: '#d97706', fontWeight: 600 }}>
                              신호 +{msg.actionPlan.messages.length} ({msg.actionPlan.messages.map((m) => m.name).join(', ')})
                            </span>
                          ) : null}
                          {msg.actionPlan.functions?.length ? (
                            <span style={{ padding: '1px 5px', borderRadius: '4px', backgroundColor: '#10b98118', border: '1px solid #10b98140', color: '#10b981', fontWeight: 600 }}>
                              함수 +{msg.actionPlan.functions.length}
                            </span>
                          ) : null}
                        </div>
                      )}

                      {/* 블록 코드 렌더링 */}
                      <div style={{ padding: '8px', maxHeight: '320px', overflowY: 'auto' }}>
                        {diffViewMap[msg.id] && currentContext?.currentScript ? (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <div>
                              <div style={{ fontSize: '10px', fontWeight: 700, color: activeColors.mute, marginBottom: '4px' }}>
                                이전 코드
                              </div>
                              <VisualScriptViewer
                                scripts={currentContext.currentScript}
                                pictures={currentContext.pictures}
                                sounds={currentContext.sounds}
                                functions={currentContext.functions}
                              />
                            </div>
                            <div>
                              <div style={{ fontSize: '10px', fontWeight: 700, color: activeColors.primary, marginBottom: '4px' }}>
                                허버 제안 코드
                              </div>
                              <VisualScriptViewer
                                scripts={msg.script}
                                pictures={currentContext.pictures}
                                sounds={currentContext.sounds}
                                functions={currentContext.functions}
                              />
                            </div>
                          </div>
                        ) : (
                          <VisualScriptViewer
                            scripts={msg.script}
                            pictures={currentContext?.pictures}
                            sounds={currentContext?.sounds}
                            functions={currentContext?.functions}
                          />
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}

        {/* 4. Claude Pondering 및 실시간 스트리밍 버블 */}
        {isLoading && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              animation: 'huber-fade-in 0.2s ease-out',
              width: '100%',
            }}
          >
            {/* Pondering 아코디언 헤더 */}
            <button
              type="button"
              onClick={() => setIsStreamingReasoningOpen(!isStreamingReasoningOpen)}
              style={{
                background: 'none',
                border: 'none',
                padding: '2px 0',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '11px',
                fontWeight: 600,
                color: activeColors.primary,
                cursor: 'pointer',
                width: 'fit-content',
              }}
            >
              <HuberPonderingDots activeColor={activeColors.primary} animated={true} />
              <span>
                {streamingReasoning
                  ? '생각하는 중...'
                  : streamingText
                  ? '답변 작성 중...'
                  : getPonderingLabel(elapsedSeconds)}
              </span>
              <span style={{ fontSize: '10px', color: activeColors.mute, fontVariantNumeric: 'tabular-nums' }}>
                {formatSeconds(elapsedSeconds)}
              </span>
              {isStreamingReasoningOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>

            {/* 실시간 사고 과정 스트리밍 박스 */}
            {Boolean(streamingReasoning) && isStreamingReasoningOpen && (
              <div
                style={{
                  padding: '8px 10px',
                  borderRadius: '6px',
                  backgroundColor: activeColors.canvasSoft2,
                  borderLeft: `2px solid ${activeColors.primary}`,
                  fontSize: '10.5px',
                  color: activeColors.mute,
                  lineHeight: '1.5',
                  whiteSpace: 'pre-wrap',
                  maxHeight: '140px',
                  overflowY: 'auto',
                }}
              >
                {streamingReasoning}
                <span style={{ animation: 'huber-claude-breathe 1s infinite', display: 'inline-block' }}>▍</span>
              </div>
            )}

            {/* 실시간 본문 텍스트 스트리밍 말풍선 */}
            {Boolean(streamingText) && (
              <div
                style={{
                  fontSize: '12px',
                  lineHeight: '1.6',
                  color: activeColors.ink,
                  whiteSpace: 'pre-wrap',
                  padding: '2px 0',
                }}
              >
                {splitStreamTextAndJson(streamingText).explanationText}
                <span
                  style={{
                    animation: 'huber-claude-breathe 1s infinite',
                    display: 'inline-block',
                    color: activeColors.primary,
                  }}
                >
                  ▍
                </span>
              </div>
            )}

            {/* 실시간 블록 JSON 생성 중 인디케이터 */}
            {splitStreamTextAndJson(streamingText).hasJsonBlock && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  backgroundColor: activeColors.canvasSoft,
                  border: `1px dashed ${activeColors.primary}`,
                  color: activeColors.primary,
                  fontSize: '11px',
                  fontWeight: 600,
                  width: 'fit-content',
                }}
              >
                <Loader2 size={12} className="animate-spin" />
                <span>엔트리 블록 코드 생성 및 구조 검증 중...</span>
              </div>
            )}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 5. 퀵 프롬프트 팝오버 (클로드 '+' 액션 모티브) */}
      {showQuickPresets && (
        <div
          style={{
            position: 'absolute',
            bottom: '75px',
            left: '12px',
            right: '12px',
            backgroundColor: activeColors.canvas,
            border: `1px solid ${activeColors.hairlineStrong}`,
            borderRadius: '12px',
            padding: '8px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            zIndex: 10,
            animation: 'huber-fade-in 0.15s ease-out',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          <div style={{ fontSize: '10px', fontWeight: 700, color: activeColors.mute, padding: '4px 6px' }}>
            추천 프롬프트 바로 입력
          </div>
          {PRESET_PROMPTS.map((preset, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setInputPrompt(preset);
                setShowQuickPresets(false);
                textareaRef.current?.focus();
              }}
              style={{
                padding: '6px 8px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: activeColors.canvasSoft,
                color: activeColors.ink,
                fontSize: '11px',
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              {preset}
            </button>
          ))}
        </div>
      )}

      {/* 6. Claude 스타일 플로팅 캡슐 입력 바 (사진 1, 2 모티브) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendPrompt();
          }}
          className="huber-input-focus"
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: '6px',
            padding: '6px 8px 6px 10px',
            borderRadius: '18px',
            backgroundColor: activeColors.canvasSoft,
            border: `1.5px solid ${activeColors.hairlineStrong}`,
            boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
            transition: 'all 0.15s ease',
          }}
        >
          {/* + 퀵 액션 버튼 */}
          <button
            type="button"
            onClick={() => setShowQuickPresets(!showQuickPresets)}
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              border: 'none',
              backgroundColor: showQuickPresets ? activeColors.primary : activeColors.canvas,
              color: showQuickPresets ? '#fff' : activeColors.mute,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'all 0.15s ease',
            }}
            title="추천 프롬프트 열기"
          >
            <Plus size={15} />
          </button>

          {/* 인풋 텍스트에어리어 (Claude 스타일 미니멀 플랫) */}
          <textarea
            ref={textareaRef}
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
                ? '원하는 블록 코드를 설명해 주세요...'
                : '설정에서 API 키를 먼저 입력해 주세요'
            }
            disabled={!activeKeyInfo || isLoading}
            rows={1}
            style={{
              flex: 1,
              border: 'none',
              backgroundColor: 'transparent',
              color: activeColors.ink,
              fontSize: '12px',
              outline: 'none',
              resize: 'none',
              fontFamily: 'inherit',
              lineHeight: '1.4',
              padding: '5px 4px',
              maxHeight: '100px',
            }}
          />

          {/* 전송 / 정지 원형 버튼 */}
          <button
            type={isLoading ? 'button' : 'submit'}
            onClick={isLoading ? handleStopGeneration : undefined}
            disabled={!isLoading && (!inputPrompt.trim() || !activeKeyInfo)}
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              backgroundColor: isLoading
                ? '#ef4444'
                : inputPrompt.trim() && activeKeyInfo
                ? activeColors.primary
                : activeColors.hairlineStrong,
              color: '#ffffff',
              border: 'none',
              cursor: isLoading || (inputPrompt.trim() && activeKeyInfo) ? 'pointer' : 'default',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'all 0.15s ease',
            }}
            title={isLoading ? '생성 중단' : '전송'}
          >
            {isLoading ? <Square size={12} fill="#fff" /> : <Send size={12} />}
          </button>
        </form>

        {/* Claude 서브텍스트 & 모델 캡션 (사진 1, 2 모티브) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 6px',
            fontSize: '10px',
            color: activeColors.mute,
          }}
        >
          <span>허버는 AI 어시스턴트이며 실수를 할 수 있습니다.</span>
          <span style={{ fontWeight: 600 }}>{selectedModelInfo.name}</span>
        </div>
      </div>
    </div>
  );
}
