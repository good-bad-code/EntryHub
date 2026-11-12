/**
 * 허버(Huber) AI 어시스턴트 로컬 설정 저장소
 * 모든 설정과 API 키는 브라우저 로컬(localStorage)에만 보관되며, 서버로 절대 전송되지 않습니다.
 */

export type HuberModelId =
  | 'gemini-2.5-flash'
  | 'gemini-2.5-pro'
  | 'gemini-2.0-flash'
  | 'gemini-2.0-flash-lite'
  | 'gemini-1.5-pro'
  | 'gemini-1.5-flash'
  | 'gpt-4o'
  | 'gpt-4o-mini'
  | 'o3-mini'
  | 'claude-5-5-sonnet'
  | 'claude-3-7-sonnet'
  | 'claude-3-5-sonnet'
  | 'deepseek-chat'
  | 'deepseek-reasoner'
  | 'groq-llama-3.3'
  | 'groq-llama-3.1';

export type HuberProvider = 'gemini' | 'openai' | 'anthropic' | 'deepseek' | 'groq';

export interface HuberModelInfo {
  id: HuberModelId;
  name: string;
  provider: HuberProvider;
  providerName: string;
  description: string;
}

export const HUBER_MODELS: HuberModelInfo[] = [
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash (최신/권장)',
    provider: 'gemini',
    providerName: 'Google Gemini',
    description: '구글 2.5세대 최신 초고속 플래시 모델로 빠르고 정확한 블록 생성',
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'gemini',
    providerName: 'Google Gemini',
    description: '구글 2.5세대 최신 심층 추론 및 복잡한 알고리즘 설계',
  },
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    provider: 'gemini',
    providerName: 'Google Gemini',
    description: '안정적인 2.0 세대 차세대 고속 플래시 모델',
  },
  {
    id: 'gemini-2.0-flash-lite',
    name: 'Gemini 2.0 Flash-Lite',
    provider: 'gemini',
    providerName: 'Google Gemini',
    description: '초경량 초고속 저지연 플래시 모델',
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    provider: 'gemini',
    providerName: 'Google Gemini',
    description: '복잡한 알고리즘과 수학 연산에 강력한 심층 추론',
  },
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    provider: 'gemini',
    providerName: 'Google Gemini',
    description: '엔트리 블록 코드 생성',
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o (최신)',
    provider: 'openai',
    providerName: 'OpenAI',
    description: '최고 수준의 종합 지능 및 블록 버그 분석 성능',
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    providerName: 'OpenAI',
    description: '가볍고 안정적인 고속 블록 코드 생성',
  },
  {
    id: 'o3-mini',
    name: 'o3-mini (추론 특화)',
    provider: 'openai',
    providerName: 'OpenAI',
    description: '수학, 알고리즘, 복잡한 게임 로직 추론 최적화',
  },
  {
    id: 'claude-5-5-sonnet',
    name: 'Claude 5.5 Sonnet (최신/권장)',
    provider: 'anthropic',
    providerName: 'Anthropic',
    description: 'Anthropic 최신 5.5세대 소넷 모델로 최고의 코드 완성도 제공',
  },
  {
    id: 'claude-3-7-sonnet',
    name: 'Claude 3.7 Sonnet',
    provider: 'anthropic',
    providerName: 'Anthropic',
    description: '하이브리드 추론 및 세련된 블록 구조화',
  },
  {
    id: 'claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'anthropic',
    providerName: 'Anthropic',
    description: '정평이 난 섬세한 한국어 이해와 블록 트리 생성',
  },
  {
    id: 'deepseek-chat',
    name: 'DeepSeek V3 (최신)',
    provider: 'deepseek',
    providerName: 'DeepSeek',
    description: '뛰어난 가성비와 강력한 코딩 논리 추론',
  },
  {
    id: 'deepseek-reasoner',
    name: 'DeepSeek R1 (추론 특화)',
    provider: 'deepseek',
    providerName: 'DeepSeek',
    description: '단계별 심층 사고 기반의 복잡한 로직 설계',
  },
  {
    id: 'groq-llama-3.3',
    name: 'Llama 3.3 70B (Groq)',
    provider: 'groq',
    providerName: 'Groq',
    description: '초고속 LPU 실시간 70B 대형 언어 모델',
  },
  {
    id: 'groq-llama-3.1',
    name: 'Llama 3.1 8B Instant (Groq)',
    provider: 'groq',
    providerName: 'Groq',
    description: '무료 티어 호환 및 즉각적인 초고속 응답',
  },
];

export interface HuberSettings {
  enabled: boolean;
  selectedModel: HuberModelId;
  tokenSavingMode?: boolean; // 토큰 절감 모드 (답변 멘트 생략하고 코드만 바로 생성)
  apiKeys: {
    gemini?: string;
    openai?: string;
    anthropic?: string;
    deepseek?: string;
    groq?: string;
  };
}

const STORAGE_KEY = 'eh_huber_settings_v1';

export function getHuberSettings(): HuberSettings {
  const defaults: HuberSettings = {
    enabled: true,
    selectedModel: 'gemini-2.5-flash',
    tokenSavingMode: false,
    apiKeys: {},
  };

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      let selectedModel = parsed.selectedModel;
      if (!HUBER_MODELS.some((m) => m.id === selectedModel)) {
        selectedModel = 'gemini-2.5-flash';
      }

      return {
        enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : true,
        selectedModel,
        tokenSavingMode: typeof parsed.tokenSavingMode === 'boolean' ? parsed.tokenSavingMode : false,
        apiKeys: parsed.apiKeys || {},
      };
    }
  } catch {}

  return defaults;
}

export function saveHuberSettings(settings: HuberSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    window.postMessage({ type: 'ENTRY_HUB_HUBER_SETTINGS_CHANGED', settings }, '*');
  } catch (err) {
    console.warn('[Entry-Hub] Huber settings save error:', err);
  }
}

export function getActiveApiKey(settings: HuberSettings): { provider: HuberProvider; key: string } | null {
  const modelInfo = HUBER_MODELS.find((m) => m.id === settings.selectedModel) || HUBER_MODELS[0];
  const provider = modelInfo.provider;
  const key = settings.apiKeys[provider]?.trim() || '';
  if (!key) return null;
  return { provider, key };
}

