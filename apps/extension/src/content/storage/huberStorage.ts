/**
 * 허버(Huber) AI 어시스턴트 로컬 설정 저장소
 * 모든 설정과 API 키는 브라우저 로컬(localStorage)에만 보관되며, 서버로 절대 전송되지 않습니다.
 */

export type HuberModelId =
  | 'gemini-1.5-flash'
  | 'gemini-1.5-pro'
  | 'gpt-4o-mini'
  | 'gpt-4o'
  | 'claude-3-5-sonnet'
  | 'deepseek-chat'
  | 'groq-llama-3.3';

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
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash (권장)',
    provider: 'gemini',
    providerName: 'Google Gemini',
    description: '빠르고 경제적이며 엔트리 블록 생성에 최적화',
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    provider: 'gemini',
    providerName: 'Google Gemini',
    description: '복잡한 알고리즘과 수학 연산에 강력한 추론력',
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    providerName: 'OpenAI',
    description: '가볍고 안정적인 JSON AST 블록 코드 생성',
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    providerName: 'OpenAI',
    description: '최고 수준의 종합 코딩 및 버그 분석 성능',
  },
  {
    id: 'claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'anthropic',
    providerName: 'Anthropic',
    description: '블록 트리 구조화 및 자연어 이해 최상급',
  },
  {
    id: 'deepseek-chat',
    name: 'DeepSeek V3',
    provider: 'deepseek',
    providerName: 'DeepSeek',
    description: '뛰어난 가성비와 논리/수학적 코딩 추론',
  },
  {
    id: 'groq-llama-3.3',
    name: 'Llama 3.3 70B (Groq)',
    provider: 'groq',
    providerName: 'Groq',
    description: '초고속 실시간 응답 블록 생성기',
  },
];

export interface HuberSettings {
  enabled: boolean;
  selectedModel: HuberModelId;
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
    selectedModel: 'gemini-1.5-flash',
    apiKeys: {},
  };

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : true,
        selectedModel: parsed.selectedModel || 'gemini-1.5-flash',
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

