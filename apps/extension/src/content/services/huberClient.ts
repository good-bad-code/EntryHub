/**
 * 허버(Huber) LLM API 클라이언트
 * 브라우저에서 제공사 공식 엔드포인트로 직접 요청을 보냅니다 (서버 전송 없음).
 */

import { generateEntryHash } from '../utils/entryUtils';
import { HuberModelId, HuberProvider, HUBER_MODELS } from '../storage/huberStorage';
import {
  parseOpenAiSseLine,
  parseClaudeSseLine,
  parseGeminiSseLine,
  splitStreamTextAndJson,
  ParsedStreamChunk,
} from './huberStreamParser';
import {
  HuberBlockNode,
  HuberScript,
  HuberActionPlan,
  HuberObjectAction,
  HuberVariableAction,
  HuberListAction,
  HuberMessageAction,
  HuberFunctionAction,
} from '@entry-hub/shared';

export type {
  HuberBlockNode,
  HuberScript,
  HuberActionPlan,
  HuberObjectAction,
  HuberVariableAction,
  HuberListAction,
  HuberMessageAction,
  HuberFunctionAction,
};

export interface HuberStreamCallbacks {
  onReasoningChunk?: (chunk: string) => void;
  onTextChunk?: (chunk: string) => void;
  onDone?: (result: HuberGenerateResult) => void;
}

export interface HuberContext {
  objectName: string;
  pictures: Array<{ id: string; name: string }>;
  sounds: Array<{ id: string; name: string }>;
  variables: Array<{ id: string; name: string }>;
  messages: Array<{ id: string; name: string }>;
  functions?: any[];
  currentScript: HuberScript;
}

export interface HuberGenerateResult {
  actionPlan: HuberActionPlan;
  script: HuberScript; // 1차 대상 오브젝트 스크립트 (하위 호환성 유지)
  explanation: string;
  rawJson: string;
}

const SYSTEM_PROMPT = `당신은 엔트리(playentry.org) 창작 플랫폼의 풀스택 AI 어시스턴트 '허버(Huber) 2.0'입니다.
사용자의 요구사항을 분석하여 변수, 리스트, 신호, 함수, 오브젝트 생성 및 블록 코드 AST 구조를 자율적으로 설계하십시오.

[허버 2.0 액션 플랜(Huber Action Plan) JSON 스키마]
반드시 다음 JSON 구조로 응답하십시오:
\`\`\`json
{
  "explanation": "사용자에게 작업 내용을 안내하는 친절한 한국어 설명 (2~3줄)",
  "variables": [
    { "name": "변수이름", "defaultValue": 0, "visible": true }
  ],
  "lists": [
    { "name": "리스트이름", "defaultValues": ["항목1"] }
  ],
  "messages": [
    { "name": "신호이름" }
  ],
  "functions": [
    {
      "name": "함수이름",
      "content": [ [ { "id": "f1", "type": "move_x", "params": [10], "statements": [] } ] ]
    }
  ],
  "objects": [
    {
      "target": "CURRENT", // 또는 신규 오브젝트 생성이 필요할 때 "NEW"
      "name": "오브젝트이름", // target이 "NEW"일 때 필수
      "shapeType": "RECTANGLE", // "RECTANGLE" | "CIRCLE" | "ENTRYBOT" | "TEXT"
      "shapeColor": "#0070f3", // 도형 색상
      "initialPosition": { "x": 0, "y": 0 },
      "sounds": [
        { "name": "점프효과음", "builtinKey": "jump" } // "jump" | "pop" | "ding" | "laser"
      ],
      "script": [
        [
          {
            "id": "e4a1",
            "x": 30,
            "y": 30,
            "type": "when_run_button_click",
            "params": [],
            "statements": []
          }
        ]
      ]
    }
  ]
}
\`\`\`

[엔트리 블록 AST 및 타입 규칙]
1. 최상위 script는 2차원 배열 구조입니다: [[ 스레드1블록들... ], [ 스레드2... ]]
   - 각 스레드의 첫 번째 블록은 반드시 시작 카테고리(when_run_button_click, when_some_key_pressed, mouse_clicked, when_object_click, when_message_cast 등)여야 합니다.
2. 각 블록 객체 필수 프로퍼티: "id" (4자리 영숫자), "type" (블록명), "params" (배열), "statements" (2차원 배열)
3. 주요 블록 타입 레퍼런스:
   - 시작: when_run_button_click, when_some_key_pressed (params: ["32" 스페이스, "38" 위, "40" 아래, "37" 좌, "39" 우]), mouse_clicked, when_object_click, when_message_cast (params: ["신호이름/ID"])
   - 움직임: move_direction (params: [거리]), move_x (params: [x거리]), move_y (params: [y거리]), set_x (params: [x위치]), set_y (params: [y위치]), rotate_by_angle (params: [각도]), locate (params: ["mouse" | "random"])
   - 생김새: show, hide, dialog (params: ["내용", "speak"]), dialog_time (params: ["내용", 초, "speak"]), change_to_some_shape (params: ["모양ID"]), change_to_next_shape
   - 소리: sound_something_with_block (params: ["소리이름/ID"])
   - 흐름: wait_second (params: [초]), repeat_basic (params: [횟수], statements: [[...]]), repeat_inf (statements: [[...]]), _if (params: [조건블록], statements: [[...]]), if_else (params: [조건블록], statements: [[참일때], [거짓일때]]), stop_code (params: ["all" | "this"])
   - 판단: reach_something (params: ["mouse" | "edge"]), is_press_some_key (params: ["키코드"]), is_clicked_mouse, boolean_basic_operator (params: [값1, "EQUAL"|"GREATER"|"LESS", 값2]), boolean_and_or (params: [조건1, "AND"|"OR", 조건2]), boolean_not (params: [조건])
   - 계산: calc_basic (params: [값1, "PLUS"|"MINUS"|"MULTI"|"DIVIDE", 값2]), calc_rand (params: [최소, 최대]), coordinate_mouse (params: ["x"|"y"]), length_of_string (params: ["문자열"])
   - 변수: get_variable (params: ["변수이름/ID"]), set_variable (params: ["변수이름/ID", 값]), change_variable (params: ["변수이름/ID", 증감값])
   - 리스트: value_of_index_from_list (params: ["리스트이름/ID", 순번]), add_value_to_list (params: [값, "리스트이름/ID"]), length_of_list (params: ["리스트이름/ID"])
   - 신호: message_cast (params: ["신호이름/ID"]), message_cast_wait (params: ["신호이름/ID"])
4. 새로 필요한 변수/신호가 있다면 variables/messages에 정의하고, 코드의 params에는 정의한 이름을 넣으십시오.
5. 단순 코드 요구 시에는 variables/messages/functions를 생략하고 objects에 target: "CURRENT"로 작성해도 됩니다.

[응답 포맷]
1. 먼저 작업 요약 설명 (2~4줄)
2. \`\`\`json ... \`\`\` 마크다운 코드블록 안에 상기 JSON 스키마를 넣으십시오.`;

export async function generateHuberScript(
  modelId: HuberModelId,
  apiKey: string,
  userPrompt: string,
  context?: Partial<HuberContext>,
  options?: { tokenSavingMode?: boolean }
): Promise<HuberGenerateResult> {
  const modelInfo = HUBER_MODELS.find((m) => m.id === modelId) || HUBER_MODELS[0];
  const provider = modelInfo.provider;

  // 토큰 절감 모드 여부에 따른 시스템 프롬프트 결정
  let activeSystemPrompt = SYSTEM_PROMPT;
  if (options?.tokenSavingMode) {
    activeSystemPrompt = `당신은 교육용 블록 코딩 플랫폼 "엔트리(Entry)"의 전문 AI 코드 생성기입니다.
[토큰 절감 모드 활성화됨]
인사말, 코드 설명, 도입부, 마무리 멘트 등 한국어 텍스트는 0글자여야 합니다. 절대 출력하지 마십시오.
오직 유효한 엔트리 블록 코드 JSON이 담긴 마크다운 json 블록(\`\`\`json ... \`\`\`) 하나만 출력하십시오.
JSON 스키마:
- 2차원 배열 형태 [[block1, block2], ...]
- 각 블록: { id, type, x, y, params, statements }`;
  }

  // 컨텍스트 프롬프트 구성
  let contextDescription = '';
  if (context) {
    contextDescription = `\n\n[현재 선택된 엔트리 오브젝트 정보]
- 오브젝트 이름: ${context.objectName || '오브젝트'}
- 등록된 모양 목록: ${JSON.stringify(context.pictures || [])}
- 등록된 소리 목록: ${JSON.stringify(context.sounds || [])}
- 등록된 변수 목록: ${JSON.stringify(context.variables || [])}
- 등록된 함수 목록: ${JSON.stringify((context.functions || []).map((f: any) => ({ id: f.id, name: f.name })))}
- 현재 적용된 기존 스크립트:
${JSON.stringify(context.currentScript || [], null, 2)}`;
  }

  const fullPrompt = `${userPrompt}${contextDescription}`;

  let rawResponseText = '';

  if (provider === 'gemini') {
    rawResponseText = await callGemini(modelId, apiKey, fullPrompt, activeSystemPrompt);
  } else if (provider === 'openai') {
    rawResponseText = await callOpenAI(modelId, apiKey, fullPrompt, activeSystemPrompt);
  } else if (provider === 'anthropic') {
    rawResponseText = await callAnthropic(modelId, apiKey, fullPrompt, activeSystemPrompt);
  } else if (provider === 'deepseek') {
    rawResponseText = await callDeepSeek(modelId, apiKey, fullPrompt, activeSystemPrompt);
  } else if (provider === 'groq') {
    rawResponseText = await callGroq(modelId, apiKey, fullPrompt, activeSystemPrompt);
  } else {
    throw new Error(`지원하지 않는 제공사: ${provider}`);
  }

  // 응답 파싱
  const parsed = parseHuberResponse(rawResponseText);
  if (options?.tokenSavingMode) {
    parsed.explanation = '';
  }
  return parsed;
}

/**
 * 브라우저 표준 ReadableStream 기반 SSE 스트림 파서 헬퍼
 */
async function readSseStream(
  response: Response,
  parseLine: (line: string) => ParsedStreamChunk | null,
  callbacks?: HuberStreamCallbacks,
  signal?: AbortSignal
): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('스트리밍 응답 바디를 읽을 수 없습니다.');

  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let accumulatedText = '';
  let accumulatedReasoning = '';

  while (true) {
    if (signal?.aborted) {
      await reader.cancel();
      break;
    }

    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || ''; // 마지막 불완전한 라인은 버퍼에 유지

    for (const line of lines) {
      const parsed = parseLine(line);
      if (!parsed) continue;

      if (parsed.isDone) {
        break;
      }

      if (parsed.reasoning) {
        accumulatedReasoning += parsed.reasoning;
        callbacks?.onReasoningChunk?.(parsed.reasoning);
      }

      if (parsed.text) {
        accumulatedText += parsed.text;
        callbacks?.onTextChunk?.(parsed.text);
      }
    }
  }

  return accumulatedText;
}

/**
 * 실시간 스트리밍(SSE) 기반 허버 코드 및 사고 과정 생성기
 */
export async function generateHuberScriptStream(
  modelId: HuberModelId,
  apiKey: string,
  userPrompt: string,
  callbacks?: HuberStreamCallbacks,
  context?: HuberContext,
  options?: { tokenSavingMode?: boolean; signal?: AbortSignal }
): Promise<HuberGenerateResult> {
  const modelInfo = HUBER_MODELS.find((m) => m.id === modelId) || HUBER_MODELS[0];
  const provider = modelInfo.provider;

  let activeSystemPrompt = SYSTEM_PROMPT;
  if (options?.tokenSavingMode) {
    activeSystemPrompt = `당신은 교육용 블록 코딩 플랫폼 "엔트리(Entry)"의 전문 AI 코드 생성기입니다.
[토큰 절감 모드 활성화됨]
인사말, 코드 설명, 도입부, 마무리 멘트 등 한국어 텍스트는 0글자여야 합니다. 절대 출력하지 마십시오.
오직 유효한 엔트리 블록 코드 JSON이 담긴 마크다운 json 블록(\`\`\`json ... \`\`\`) 하나만 출력하십시오.`;
  }

  let contextDescription = '';
  if (context) {
    contextDescription = `\n\n[현재 선택된 엔트리 오브젝트 정보]
- 오브젝트 이름: ${context.objectName || '오브젝트'}
- 등록된 모양 목록: ${JSON.stringify(context.pictures || [])}
- 등록된 소리 목록: ${JSON.stringify(context.sounds || [])}
- 등록된 변수 목록: ${JSON.stringify(context.variables || [])}
- 등록된 함수 목록: ${JSON.stringify((context.functions || []).map((f: any) => ({ id: f.id, name: f.name })))}
- 현재 적용된 기존 스크립트:
${JSON.stringify(context.currentScript || [], null, 2)}`;
  }

  const fullPrompt = `${userPrompt}${contextDescription}`;
  let rawResponseText = '';

  if (provider === 'gemini') {
    rawResponseText = await callGeminiStream(modelId, apiKey, fullPrompt, activeSystemPrompt, callbacks, options?.signal);
  } else if (provider === 'openai') {
    rawResponseText = await callOpenAiStream(modelId, apiKey, fullPrompt, activeSystemPrompt, callbacks, options?.signal);
  } else if (provider === 'anthropic') {
    rawResponseText = await callAnthropicStream(modelId, apiKey, fullPrompt, activeSystemPrompt, callbacks, options?.signal);
  } else if (provider === 'deepseek') {
    rawResponseText = await callDeepSeekStream(modelId, apiKey, fullPrompt, activeSystemPrompt, callbacks, options?.signal);
  } else if (provider === 'groq') {
    rawResponseText = await callGroqStream(modelId, apiKey, fullPrompt, activeSystemPrompt, callbacks, options?.signal);
  } else {
    throw new Error(`지원하지 않는 제공사: ${provider}`);
  }

  const parsed = parseHuberResponse(rawResponseText);
  if (options?.tokenSavingMode) {
    parsed.explanation = '';
  }
  callbacks?.onDone?.(parsed);
  return parsed;
}

// 1. Google Gemini 호출 (동적 모델 발견 및 최신 모델 자동 전환 탑재)
async function callGemini(modelId: HuberModelId, apiKey: string, prompt: string, systemPromptText = SYSTEM_PROMPT): Promise<string> {
  const isPro = modelId === 'gemini-2.5-pro' || modelId === 'gemini-1.5-pro';
  const isLite = modelId === 'gemini-2.0-flash-lite';

  const sendPayload = (url: string) =>
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: `${systemPromptText}\n\n[사용자 요청]\n${prompt}` }] }],
        generationConfig: {
          temperature: 0.2,
          topP: 0.9,
        },
      }),
    });

  // 1단계: 최신 정식 모델 우선 엔드포인트 목록 (Gemini 2.5 / 2.0 우선)
  let candidateUrls: string[] = [];

  if (isPro) {
    candidateUrls = [
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`,
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`,
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent?key=${apiKey}`,
    ];
  } else if (isLite) {
    candidateUrls = [
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`,
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    ];
  } else {
    // Flash 계열 (구글 최신 정식 gemini-2.5-flash 및 2.0 최우선 호출)
    candidateUrls = [
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`,
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`,
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    ];
  }

  let lastErrorMsg = '';

  for (const url of candidateUrls) {
    try {
      const res = await sendPayload(url);

      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return text;
      }

      const err = await res.json().catch(() => ({}));
      lastErrorMsg = err.error?.message || `상태 코드 ${res.status}`;

      // 치명적 인증 에러는 fallback 없이 즉시 throw
      if (res.status === 400 && lastErrorMsg.includes('API_KEY_INVALID')) {
        throw new Error('Google Gemini API 키가 올바르지 않습니다. 키를 다시 확인해 주세요.');
      }
      if (res.status === 403) {
        throw new Error(`Gemini API 권한 오류 (403): ${lastErrorMsg}`);
      }
      if (res.status === 429) {
        throw new Error('Gemini API 호출 한도(Quota)를 초과했습니다. 잠시 후 다시 시도해 주세요.');
      }

      // 구글이 특정 모델을 직접 권장한 경우 즉시 해당 모델로 호출
      const recMatch = lastErrorMsg.match(/models\/([a-zA-Z0-9_\-\.]+)/g);
      if (recMatch && recMatch.length > 0) {
        for (const matchedName of recMatch) {
          const recUrl = `https://generativelanguage.googleapis.com/v1beta/${matchedName}:generateContent?key=${apiKey}`;
          try {
            const recRes = await sendPayload(recUrl);
            if (recRes.ok) {
              const recData = await recRes.json();
              const text = recData.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) return text;
            }
          } catch {}
        }
      }
    } catch (e: any) {
      if (e.message && (e.message.includes('API 키') || e.message.includes('한도') || e.message.includes('권한'))) {
        throw e;
      }
      lastErrorMsg = e.message || lastErrorMsg;
    }
  }

  // 2단계: 후보 URL이 모두 실패한 경우, Google ListModels API로 계정 지원 모델 동적 탐색
  try {
    const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (!listRes.ok) {
      const listErr = await listRes.json().catch(() => ({}));
      console.warn('[Huber] Gemini ListModels failed:', listRes.status, listErr);
      if (listErr.error?.message) {
        throw new Error(`Google API 오류 (${listRes.status}): ${listErr.error.message}`);
      }
    } else {
      const listData = await listRes.json();
      const models: Array<{ name: string; supportedGenerationMethods?: string[] }> = listData.models || [];
      const usable = models.filter((m) => m.supportedGenerationMethods?.includes('generateContent'));

      if (usable.length > 0) {
        const matched =
          usable.find((m) => m.name.includes('2.5-flash')) ||
          usable.find((m) => m.name.includes('2.0-flash')) ||
          (isPro ? usable.find((m) => m.name.includes('pro')) : null) ||
          usable.find((m) => m.name.includes('flash')) ||
          usable[0];

        if (matched) {
          const cleanModelPath = matched.name.startsWith('models/') ? matched.name : `models/${matched.name}`;
          const dynamicUrl = `https://generativelanguage.googleapis.com/v1beta/${cleanModelPath}:generateContent?key=${apiKey}`;
          const dynRes = await sendPayload(dynamicUrl);
          if (dynRes.ok) {
            const dynData = await dynRes.json();
            const text = dynData.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) return text;
          } else {
            const dynErr = await dynRes.json().catch(() => ({}));
            lastErrorMsg = dynErr.error?.message || lastErrorMsg;
          }
        }
      } else {
        throw new Error('해당 Google API 키에서 사용 가능한 텍스트 생성 모델이 없습니다. Google AI Studio 콘솔에서 키 권한을 확인해 주세요.');
      }
    }
  } catch (discoveryErr: any) {
    if (discoveryErr.message && (discoveryErr.message.startsWith('Google API 오류') || discoveryErr.message.includes('사용 가능한'))) {
      throw discoveryErr;
    }
    console.warn('[Huber] Gemini dynamic model discovery error:', discoveryErr);
  }

  throw new Error(`Gemini API 호출 실패: ${lastErrorMsg}`);
}

// 2. OpenAI 호출 (o3-mini, gpt-4o, gpt-4o-mini 지원)
async function callOpenAI(modelId: HuberModelId, apiKey: string, prompt: string, systemPromptText = SYSTEM_PROMPT): Promise<string> {
  const url = 'https://api.openai.com/v1/chat/completions';

  const isReasoning = modelId === 'o3-mini';
  let targetModel = 'gpt-4o-mini';
  if (modelId === 'gpt-4o') targetModel = 'gpt-4o';
  else if (modelId === 'o3-mini') targetModel = 'o3-mini';

  const candidateModels = isReasoning
    ? ['o3-mini', 'gpt-4o', 'gpt-4o-mini']
    : [targetModel, 'gpt-4o-mini', 'gpt-4o'];

  let lastErrorMsg = '';

  for (const m of candidateModels) {
    try {
      const isOseries = m.startsWith('o');
      const bodyPayload: any = {
        model: m,
        messages: isOseries
          ? [
              { role: 'developer', content: systemPromptText },
              { role: 'user', content: prompt },
            ]
          : [
              { role: 'system', content: systemPromptText },
              { role: 'user', content: prompt },
            ],
      };

      if (!isOseries) {
        bodyPayload.temperature = 0.2;
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(bodyPayload),
      });

      if (res.ok) {
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content;
        if (text) return text;
      }

      const err = await res.json().catch(() => ({}));
      lastErrorMsg = err.error?.message || `상태 코드 ${res.status}`;
      if (res.status === 401 || lastErrorMsg.includes('Incorrect API key')) {
        throw new Error('OpenAI API 키가 올바르지 않습니다.');
      }
    } catch (e: any) {
      if (e.message && e.message.includes('API 키')) throw e;
      lastErrorMsg = e.message || lastErrorMsg;
    }
  }

  throw new Error(`OpenAI API 호출 실패: ${lastErrorMsg}`);
}

// 3. Anthropic Claude 호출 (Claude 5.5 Sonnet, 3.7 Sonnet, 3.5 Sonnet 최신 지원)
async function callAnthropic(modelId: HuberModelId, apiKey: string, prompt: string, systemPromptText = SYSTEM_PROMPT): Promise<string> {
  const url = 'https://api.anthropic.com/v1/messages';

  let candidateModels: string[] = [];
  if (modelId === 'claude-5-5-sonnet') {
    candidateModels = [
      'claude-5-5-sonnet-latest',
      'claude-5-5-sonnet-20260219',
      'claude-3-7-sonnet-latest',
      'claude-3-5-sonnet-latest',
    ];
  } else if (modelId === 'claude-3-7-sonnet') {
    candidateModels = [
      'claude-3-7-sonnet-latest',
      'claude-3-7-sonnet-20250219',
      'claude-5-5-sonnet-latest',
      'claude-3-5-sonnet-latest',
    ];
  } else {
    candidateModels = [
      'claude-5-5-sonnet-latest',
      'claude-3-7-sonnet-latest',
      'claude-3-5-sonnet-latest',
      'claude-3-5-sonnet-20241022',
    ];
  }

  let lastErrorMsg = '';

  for (const m of candidateModels) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'dangerously-allow-browser': 'true',
        },
        body: JSON.stringify({
          model: m,
          system: systemPromptText,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 4096,
          temperature: 0.2,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const text = data.content?.[0]?.text;
        if (text) return text;
      }

      const err = await res.json().catch(() => ({}));
      lastErrorMsg = err.error?.message || `상태 코드 ${res.status}`;
      if (res.status === 401 || lastErrorMsg.includes('invalid x-api-key')) {
        throw new Error('Anthropic API 키가 올바르지 않습니다.');
      }
    } catch (e: any) {
      if (e.message && e.message.includes('API 키')) throw e;
      lastErrorMsg = e.message || lastErrorMsg;
    }
  }

  throw new Error(`Claude API 호출 실패: ${lastErrorMsg}`);
}

// 4. DeepSeek 호출 (V3 deepseek-chat, R1 deepseek-reasoner 지원)
async function callDeepSeek(modelId: HuberModelId, apiKey: string, prompt: string, systemPromptText = SYSTEM_PROMPT): Promise<string> {
  const url = 'https://api.deepseek.com/chat/completions';
  const targetModel = modelId === 'deepseek-reasoner' ? 'deepseek-reasoner' : 'deepseek-chat';
  const candidateModels = [targetModel, 'deepseek-chat'];

  let lastErrorMsg = '';

  for (const m of candidateModels) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: m,
          messages: [
            { role: 'system', content: systemPromptText },
            { role: 'user', content: prompt },
          ],
          temperature: m === 'deepseek-reasoner' ? undefined : 0.2,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content;
        if (text) return text;
      }

      const err = await res.json().catch(() => ({}));
      lastErrorMsg = err.error?.message || `상태 코드 ${res.status}`;
      if (res.status === 401) {
        throw new Error('DeepSeek API 키가 올바르지 않습니다.');
      }
    } catch (e: any) {
      if (e.message && e.message.includes('API 키')) throw e;
      lastErrorMsg = e.message || lastErrorMsg;
    }
  }

  throw new Error(`DeepSeek API 호출 실패: ${lastErrorMsg}`);
}

// 5. Groq 호출 (llama-3.3-70b-versatile, llama-3.1-8b-instant 자동 폴백)
async function callGroq(modelId: HuberModelId, apiKey: string, prompt: string, systemPromptText = SYSTEM_PROMPT): Promise<string> {
  const url = 'https://api.groq.com/openai/v1/chat/completions';

  // 모델 우선순위: 70B 요청 시 접근 불가 시 즉시 8B Instant로 자동 폴백하여 오류 원천 차단
  const candidateModels =
    modelId === 'groq-llama-3.1'
      ? ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile', 'llama3-8b-8192']
      : ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'llama3-70b-8192', 'llama3-8b-8192'];

  let lastErrorMsg = '';

  for (const m of candidateModels) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: m,
          messages: [
            { role: 'system', content: systemPromptText },
            { role: 'user', content: prompt },
          ],
          temperature: 0.2,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content;
        if (text) return text;
      }

      const err = await res.json().catch(() => ({}));
      lastErrorMsg = err.error?.message || `상태 코드 ${res.status}`;

      // API 키 인증 오류는 즉시 throw
      if (res.status === 401 || lastErrorMsg.includes('Invalid API Key')) {
        throw new Error('Groq API 키가 올바르지 않습니다. 키를 다시 확인해 주세요.');
      }

      // 모델 부재/접근 권한 오류인 경우 다음 candidate 모델로 자동 fallback
      console.warn(`[Huber] Groq model ${m} failed (${res.status}: ${lastErrorMsg}), trying next fallback model...`);
    } catch (e: any) {
      if (e.message && e.message.includes('API 키')) throw e;
      lastErrorMsg = e.message || lastErrorMsg;
    }
  }

  throw new Error(`Groq API 호출 실패: ${lastErrorMsg}`);
}

// =========================================================
// 실시간 스트리밍(SSE) 전용 호출 엔진 (Gemini / OpenAI / Claude / DeepSeek / Groq)
// =========================================================

async function callGeminiStream(
  modelId: HuberModelId,
  apiKey: string,
  prompt: string,
  systemPromptText = SYSTEM_PROMPT,
  callbacks?: HuberStreamCallbacks,
  signal?: AbortSignal
): Promise<string> {
  const isPro = modelId === 'gemini-2.5-pro' || modelId === 'gemini-1.5-pro';
  const isLite = modelId === 'gemini-2.0-flash-lite';

  let candidateModels = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-2.5-pro',
    'gemini-2.0-flash-lite',
    'gemini-1.5-flash',
  ];
  if (isPro) candidateModels = ['gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-1.5-pro'];
  else if (isLite) candidateModels = ['gemini-2.0-flash-lite', 'gemini-2.5-flash', 'gemini-2.0-flash'];

  let lastErrorMsg = '';

  const sendStream = async (modelName: string) => {
    const cleanName = modelName.startsWith('models/') ? modelName.slice(7) : modelName;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${cleanName}:streamGenerateContent?alt=sse&key=${apiKey}`;
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: `${systemPromptText}\n\n[사용자 요청]\n${prompt}` }] }],
        generationConfig: {
          temperature: 0.2,
          topP: 0.9,
        },
      }),
    });
  };

  // 1단계: 정적 후보 모델 순차 시도
  for (const model of candidateModels) {
    try {
      const res = await sendStream(model);

      if (res.ok) {
        return await readSseStream(res, parseGeminiSseLine, callbacks, signal);
      }

      const err = await res.json().catch(() => ({}));
      lastErrorMsg = err.error?.message || `상태 코드 ${res.status}`;
      if (res.status === 400 && lastErrorMsg.includes('API_KEY_INVALID')) {
        throw new Error('Google Gemini API 키가 올바르지 않습니다.');
      }
      if (res.status === 403) {
        throw new Error(`Gemini API 권한 오류 (403): ${lastErrorMsg}`);
      }
      if (res.status === 429) {
        throw new Error('Gemini API 호출 한도(Quota)를 초과했습니다. 잠시 후 다시 시도해 주세요.');
      }

      // 구글 오류 메시지에 특정 모델이 추천/지정된 경우 즉시 시도
      const recMatch = lastErrorMsg.match(/models\/([a-zA-Z0-9_\-\.]+)/g);
      if (recMatch && recMatch.length > 0) {
        for (const matchedName of recMatch) {
          try {
            const recRes = await sendStream(matchedName);
            if (recRes.ok) {
              return await readSseStream(recRes, parseGeminiSseLine, callbacks, signal);
            }
          } catch {}
        }
      }
    } catch (e: any) {
      if (e.message && (e.message.includes('API 키') || e.message.includes('한도') || e.message.includes('권한'))) {
        throw e;
      }
      lastErrorMsg = e.message || lastErrorMsg;
    }
  }

  // 2단계: 후보 모델 실패 시 Google ListModels API로 계정 지원 모델 동적 탐색 후 스트리밍
  try {
    const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (listRes.ok) {
      const listData = await listRes.json();
      const models: Array<{ name: string; supportedGenerationMethods?: string[] }> = listData.models || [];
      const usable = models.filter((m) => m.supportedGenerationMethods?.includes('generateContent'));

      if (usable.length > 0) {
        const matched =
          usable.find((m) => m.name.includes('2.5-flash')) ||
          usable.find((m) => m.name.includes('2.0-flash')) ||
          (isPro ? usable.find((m) => m.name.includes('pro')) : null) ||
          usable.find((m) => m.name.includes('flash')) ||
          usable[0];

        if (matched) {
          const dynRes = await sendStream(matched.name);
          if (dynRes.ok) {
            return await readSseStream(dynRes, parseGeminiSseLine, callbacks, signal);
          } else {
            const dynErr = await dynRes.json().catch(() => ({}));
            lastErrorMsg = dynErr.error?.message || lastErrorMsg;
          }
        }
      }
    }
  } catch (discoveryErr: any) {
    console.warn('[Huber] Gemini dynamic stream discovery error:', discoveryErr);
  }

  throw new Error(`Gemini 스트리밍 호출 실패: ${lastErrorMsg}`);
}

async function callOpenAiStream(
  modelId: HuberModelId,
  apiKey: string,
  prompt: string,
  systemPromptText = SYSTEM_PROMPT,
  callbacks?: HuberStreamCallbacks,
  signal?: AbortSignal
): Promise<string> {
  const url = 'https://api.openai.com/v1/chat/completions';
  const isReasoning = modelId === 'o3-mini';
  const targetModel = modelId === 'gpt-4o' ? 'gpt-4o' : modelId === 'o3-mini' ? 'o3-mini' : 'gpt-4o-mini';
  const candidateModels = isReasoning
    ? ['o3-mini', 'gpt-4o', 'gpt-4o-mini']
    : [targetModel, 'gpt-4o-mini', 'gpt-4o'];

  let lastErrorMsg = '';

  for (const m of candidateModels) {
    try {
      const isOseries = m.startsWith('o');
      const bodyPayload: any = {
        model: m,
        stream: true,
        messages: isOseries
          ? [
              { role: 'developer', content: systemPromptText },
              { role: 'user', content: prompt },
            ]
          : [
              { role: 'system', content: systemPromptText },
              { role: 'user', content: prompt },
            ],
      };
      if (!isOseries) bodyPayload.temperature = 0.2;

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        signal,
        body: JSON.stringify(bodyPayload),
      });

      if (res.ok) {
        return await readSseStream(res, parseOpenAiSseLine, callbacks, signal);
      }

      const err = await res.json().catch(() => ({}));
      lastErrorMsg = err.error?.message || `상태 코드 ${res.status}`;
      if (res.status === 401 || lastErrorMsg.includes('Incorrect API key')) {
        throw new Error('OpenAI API 키가 올바르지 않습니다.');
      }
    } catch (e: any) {
      if (e.message && e.message.includes('API 키')) throw e;
      lastErrorMsg = e.message || lastErrorMsg;
    }
  }

  throw new Error(`OpenAI 스트리밍 호출 실패: ${lastErrorMsg}`);
}

async function callAnthropicStream(
  modelId: HuberModelId,
  apiKey: string,
  prompt: string,
  systemPromptText = SYSTEM_PROMPT,
  callbacks?: HuberStreamCallbacks,
  signal?: AbortSignal
): Promise<string> {
  const url = 'https://api.anthropic.com/v1/messages';
  let candidateModels: string[] = [];
  if (modelId === 'claude-5-5-sonnet') {
    candidateModels = [
      'claude-5-5-sonnet-latest',
      'claude-5-5-sonnet-20260219',
      'claude-3-7-sonnet-latest',
      'claude-3-5-sonnet-latest',
    ];
  } else if (modelId === 'claude-3-7-sonnet') {
    candidateModels = [
      'claude-3-7-sonnet-latest',
      'claude-3-7-sonnet-20250219',
      'claude-5-5-sonnet-latest',
      'claude-3-5-sonnet-latest',
    ];
  } else {
    candidateModels = [
      'claude-5-5-sonnet-latest',
      'claude-3-7-sonnet-latest',
      'claude-3-5-sonnet-latest',
      'claude-3-5-sonnet-20241022',
    ];
  }

  let lastErrorMsg = '';

  for (const m of candidateModels) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'dangerously-allow-browser': 'true',
        },
        signal,
        body: JSON.stringify({
          model: m,
          stream: true,
          system: systemPromptText,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 4096,
          temperature: 0.2,
        }),
      });

      if (res.ok) {
        return await readSseStream(res, parseClaudeSseLine, callbacks, signal);
      }

      const err = await res.json().catch(() => ({}));
      lastErrorMsg = err.error?.message || `상태 코드: ${res.status}`;
      if (res.status === 401 || lastErrorMsg.includes('invalid x-api-key')) {
        throw new Error('Anthropic API 키가 올바르지 않습니다.');
      }
    } catch (e: any) {
      if (e.message && e.message.includes('API 키')) throw e;
      lastErrorMsg = e.message || lastErrorMsg;
    }
  }

  throw new Error(`Claude 스트리밍 호출 실패: ${lastErrorMsg}`);
}

async function callDeepSeekStream(
  modelId: HuberModelId,
  apiKey: string,
  prompt: string,
  systemPromptText = SYSTEM_PROMPT,
  callbacks?: HuberStreamCallbacks,
  signal?: AbortSignal
): Promise<string> {
  const url = 'https://api.deepseek.com/chat/completions';
  const targetModel = modelId === 'deepseek-reasoner' ? 'deepseek-reasoner' : 'deepseek-chat';
  const candidateModels = [targetModel, 'deepseek-chat'];

  let lastErrorMsg = '';

  for (const m of candidateModels) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        signal,
        body: JSON.stringify({
          model: m,
          stream: true,
          messages: [
            { role: 'system', content: systemPromptText },
            { role: 'user', content: prompt },
          ],
          temperature: m === 'deepseek-reasoner' ? undefined : 0.2,
        }),
      });

      if (res.ok) {
        return await readSseStream(res, parseOpenAiSseLine, callbacks, signal);
      }

      const err = await res.json().catch(() => ({}));
      lastErrorMsg = err.error?.message || `상태 코드 ${res.status}`;
      if (res.status === 401) {
        throw new Error('DeepSeek API 키가 올바르지 않습니다.');
      }
    } catch (e: any) {
      if (e.message && e.message.includes('API 키')) throw e;
      lastErrorMsg = e.message || lastErrorMsg;
    }
  }

  throw new Error(`DeepSeek 스트리밍 호출 실패: ${lastErrorMsg}`);
}

async function callGroqStream(
  modelId: HuberModelId,
  apiKey: string,
  prompt: string,
  systemPromptText = SYSTEM_PROMPT,
  callbacks?: HuberStreamCallbacks,
  signal?: AbortSignal
): Promise<string> {
  const url = 'https://api.groq.com/openai/v1/chat/completions';
  const candidateModels =
    modelId === 'groq-llama-3.1'
      ? ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile', 'llama3-8b-8192']
      : ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'llama3-70b-8192'];

  let lastErrorMsg = '';

  for (const m of candidateModels) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        signal,
        body: JSON.stringify({
          model: m,
          stream: true,
          messages: [
            { role: 'system', content: systemPromptText },
            { role: 'user', content: prompt },
          ],
          temperature: 0.2,
        }),
      });

      if (res.ok) {
        return await readSseStream(res, parseOpenAiSseLine, callbacks, signal);
      }

      const err = await res.json().catch(() => ({}));
      lastErrorMsg = err.error?.message || `상태 코드 ${res.status}`;
      if (res.status === 401 || lastErrorMsg.includes('Invalid API Key')) {
        throw new Error('Groq API 키가 올바르지 않습니다.');
      }
      console.warn(`[Huber] Groq stream ${m} failed, trying next fallback:`, lastErrorMsg);
    } catch (e: any) {
      if (e.message && e.message.includes('API 키')) throw e;
      lastErrorMsg = e.message || lastErrorMsg;
    }
  }

  throw new Error(`Groq 스트리밍 호출 실패: ${lastErrorMsg}`);
}

// 응답 파싱 및 AST 정규화 (허버 2.0 액션 플랜 & 구버전 스크립트 동시 지원)
export function parseHuberResponse(rawText: string): HuberGenerateResult {
  // 1. ```json ... ``` 블록 추출
  const jsonMatch = rawText.match(/```json\s*([\s\S]*?)\s*```/) || rawText.match(/```\s*([\s\S]*?)\s*```/);
  let rawJson = '';
  let explanation = rawText;

  if (jsonMatch) {
    rawJson = jsonMatch[1].trim();
    // 설명 부분은 JSON 코드블록 이전 또는 이후의 텍스트
    explanation = rawText.replace(jsonMatch[0], '').trim();
  } else {
    // 코드블록 없이 순수 JSON인 경우 ({ ... } 또는 [ ... ])
    const firstBrace = rawText.indexOf('{');
    const lastBrace = rawText.lastIndexOf('}');
    const firstBracket = rawText.indexOf('[');
    const lastBracket = rawText.lastIndexOf(']');

    if (firstBrace !== -1 && lastBrace > firstBrace && (firstBracket === -1 || firstBrace < firstBracket)) {
      rawJson = rawText.substring(firstBrace, lastBrace + 1);
      explanation = (rawText.substring(0, firstBrace) + '\n' + rawText.substring(lastBrace + 1)).trim();
    } else if (firstBracket !== -1 && lastBracket > firstBracket) {
      rawJson = rawText.substring(firstBracket, lastBracket + 1);
      explanation = (rawText.substring(0, firstBracket) + '\n' + rawText.substring(lastBracket + 1)).trim();
    }
  }

  if (!rawJson) {
    throw new Error('AI 응답에서 유효한 엔트리 블록 JSON을 찾을 수 없습니다.');
  }

  let parsed: any;
  try {
    parsed = JSON.parse(rawJson);
  } catch (err: any) {
    throw new Error(`엔트리 블록 JSON 파싱 실패: ${err.message}`);
  }

  // 액션 플랜 정규화
  let actionPlan: HuberActionPlan;

  if (Array.isArray(parsed)) {
    // CASE 1: 구버전 단일 스크립트 배열 (1차원 또는 2차원)
    let script: HuberScript;
    if (parsed.length > 0 && !Array.isArray(parsed[0])) {
      script = [parsed as HuberBlockNode[]];
    } else {
      script = parsed as HuberScript;
    }
    normalizeScriptTree(script);

    actionPlan = {
      explanation: explanation || '엔트리 블록 코드가 성공적으로 생성되었습니다.',
      objects: [
        {
          target: 'CURRENT',
          script,
        },
      ],
    };
  } else if (parsed && typeof parsed === 'object') {
    // CASE 2: 신규 멀티 액션 플랜 객체
    const objects: HuberObjectAction[] = [];

    if (Array.isArray(parsed.objects) && parsed.objects.length > 0) {
      for (const obj of parsed.objects) {
        let script: HuberScript = [];
        if (Array.isArray(obj.script)) {
          if (obj.script.length > 0 && !Array.isArray(obj.script[0])) {
            script = [obj.script as HuberBlockNode[]];
          } else {
            script = obj.script as HuberScript;
          }
        }
        normalizeScriptTree(script);
        objects.push({
          target: obj.target === 'NEW' ? 'NEW' : 'CURRENT',
          name: obj.name || (obj.target === 'NEW' ? '오브젝트' : undefined),
          shapeType: obj.shapeType || 'RECTANGLE',
          shapeText: obj.shapeText,
          shapeColor: obj.shapeColor || '#0070f3',
          initialPosition: obj.initialPosition || { x: 0, y: 0 },
          sounds: Array.isArray(obj.sounds) ? obj.sounds : undefined,
          script,
        });
      }
    } else if (Array.isArray(parsed.script)) {
      let script: HuberScript = [];
      if (parsed.script.length > 0 && !Array.isArray(parsed.script[0])) {
        script = [parsed.script as HuberBlockNode[]];
      } else {
        script = parsed.script as HuberScript;
      }
      normalizeScriptTree(script);
      objects.push({
        target: 'CURRENT',
        script,
      });
    } else {
      objects.push({
        target: 'CURRENT',
        script: [],
      });
    }

    actionPlan = {
      explanation: parsed.explanation || explanation || '작업 계획이 성공적으로 생성되었습니다.',
      variables: Array.isArray(parsed.variables) ? parsed.variables : undefined,
      lists: Array.isArray(parsed.lists) ? parsed.lists : undefined,
      messages: Array.isArray(parsed.messages) ? parsed.messages : undefined,
      functions: Array.isArray(parsed.functions) ? parsed.functions : undefined,
      objects,
    };
  } else {
    throw new Error('유효한 엔트리 액션 플랜 또는 블록 스크립트 형식이 아닙니다.');
  }

  const primaryScript = actionPlan.objects[0]?.script || [];

  return {
    actionPlan,
    script: primaryScript,
    explanation: actionPlan.explanation,
    rawJson,
  };
}

// 모든 블록 노드에 고유 ID가 없으면 난수 발급, statements 구조 정규화
function normalizeScriptTree(script: HuberScript) {
  let startY = 30;

  script.forEach((thread, threadIdx) => {
    let currentX = 30 + threadIdx * 240;
    thread.forEach((block, blockIdx) => {
      normalizeNode(block);
      if (blockIdx === 0) {
        if (typeof block.x !== 'number') block.x = currentX;
        if (typeof block.y !== 'number') block.y = startY;
      }
    });
  });
}

function normalizeNode(node: any) {
  if (!node || typeof node !== 'object') return;

  if (!node.id) {
    node.id = generateEntryHash();
  }
  if (!Array.isArray(node.params)) {
    node.params = [];
  }
  if (!Array.isArray(node.statements)) {
    node.statements = [];
  }

  // params 내부의 중첩 노드 재귀 정규화
  node.params.forEach((p: any) => {
    if (p && typeof p === 'object' && p.type) {
      normalizeNode(p);
    }
  });

  // statements 내부의 스레드 노드 재귀 정규화
  node.statements.forEach((subThread: any) => {
    if (Array.isArray(subThread)) {
      subThread.forEach((subBlock: any) => normalizeNode(subBlock));
    }
  });
}

