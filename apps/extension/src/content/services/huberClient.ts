/**
 * 허버(Huber) LLM API 클라이언트
 * 브라우저에서 제공사 공식 엔드포인트로 직접 요청을 보냅니다 (서버 전송 없음).
 */

import { generateEntryHash } from '../utils/entryUtils';
import { HuberModelId, HuberProvider, HUBER_MODELS } from '../storage/huberStorage';

export interface HuberBlockNode {
  id: string;
  type: string;
  params: any[];
  statements?: any[][];
  movable?: null | boolean;
  deletable?: null | boolean;
  x?: number;
  y?: number;
}

export type HuberScript = HuberBlockNode[][];

export interface HuberContext {
  objectName: string;
  pictures: Array<{ id: string; name: string }>;
  sounds: Array<{ id: string; name: string }>;
  variables: Array<{ id: string; name: string }>;
  messages: Array<{ id: string; name: string }>;
  currentScript: HuberScript;
}

export interface HuberGenerateResult {
  script: HuberScript;
  explanation: string;
  rawJson: string;
}

const SYSTEM_PROMPT = `당신은 엔트리(playentry.org) 블록 코딩 전문가 AI 어시스턴트 '허버(Huber)'입니다.
사용자의 요구사항을 분석하여 오직 유효한 엔트리 블록 AST(Abstract Syntax Tree) 구조와 친절한 한국어 설명을 제공해야 합니다.

[엔트리 블록 AST 구조 규칙]
1. 엔트리의 스크립트는 2차원 배열 구조입니다: [[ { block1 }, { block2 }, ... ], [ 스레드2... ]]
   - 최상위 배열의 각 요소는 독립된 실행 스레드(Thread)입니다.
   - 각 스레드의 첫 번째 블록은 반드시 시작 카테고리 블록(when_run_button_click, when_some_key_pressed, mouse_clicked, when_object_click 등)이어야 합니다.
2. 각 블록 객체 필수 프로퍼티:
   - "id": 4자리 영숫자 고유 식별자 (예: "a1b2")
   - "type": 엔트리 블록 타입 문자열
   - "params": 입력 인자 배열 []
   - "statements": C자형 블록(반복문, 조건문) 내부 블록 스레드 배열 [ [ { 내부블록1 } ] ]
3. 주요 블록 타입 레퍼런스:
   - 시작: when_run_button_click, when_some_key_pressed (params: ["32" 스페이스, "38" 위, "40" 아래, "37" 좌, "39" 우]), mouse_clicked, when_object_click, when_message_cast (params: ["신호ID"])
   - 움직임: move_direction (params: [거리]), move_x (params: [x거리]), move_y (params: [y거리]), set_x (params: [x위치]), set_y (params: [y위치]), rotate_by_angle (params: [각도]), locate (params: ["mouse" | "random"])
   - 생김새: show, hide, dialog (params: ["내용", "speak"]), dialog_time (params: ["내용", 초, "speak"]), change_to_some_shape (params: ["모양ID"]), change_to_next_shape
   - 흐름: wait_second (params: [초]), repeat_basic (params: [횟수], statements: [[...]]), repeat_inf (statements: [[...]]), _if (params: [조건블록], statements: [[...]]), if_else (params: [조건블록], statements: [[참일때], [거짓일때]]), stop_code (params: ["all" | "this"])
   - 판단: reach_something (params: ["mouse" | "edge"]), is_press_some_key (params: ["키코드"]), is_clicked_mouse, boolean_basic_operator (params: [값1, "EQUAL"|"GREATER"|"LESS", 값2]), boolean_and_or (params: [조건1, "AND"|"OR", 조건2]), boolean_not (params: [조건])
   - 계산: calc_basic (params: [값1, "PLUS"|"MINUS"|"MULTI"|"DIVIDE", 값2]), calc_rand (params: [최소, 최대]), coordinate_mouse (params: ["x"|"y"]), length_of_string (params: ["문자열"])
   - 변수: get_variable (params: ["변수ID"]), set_variable (params: ["변수ID", 값]), change_variable (params: ["변수ID", 증감값])
4. 모양(pictures)이나 소리(sounds) 블록을 사용할 때는 컨텍스트에 주어진 실제 등록된 모양 ID/소리 ID를 사용하십시오.

[응답 포맷 규칙]
반드시 다음 구조로 응답하십시오:
1. 먼저 코드에 대한 간단하고 친절한 설명 (2~4줄)
2. 이어서 엔트리 블록 AST JSON을 다음 마크다운 코드블록 안에 넣으십시오:
\`\`\`json
[
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
\`\`\`
JSON 이외에 코드블록 안에 다른 텍스트를 넣지 마십시오.`;

export async function generateHuberScript(
  modelId: HuberModelId,
  apiKey: string,
  userPrompt: string,
  context?: Partial<HuberContext>
): Promise<HuberGenerateResult> {
  const modelInfo = HUBER_MODELS.find((m) => m.id === modelId) || HUBER_MODELS[0];
  const provider = modelInfo.provider;

  // 컨텍스트 프롬프트 구성
  let contextDescription = '';
  if (context) {
    contextDescription = `\n\n[현재 선택된 엔트리 오브젝트 정보]
- 오브젝트 이름: ${context.objectName || '오브젝트'}
- 등록된 모양 목록: ${JSON.stringify(context.pictures || [])}
- 등록된 소리 목록: ${JSON.stringify(context.sounds || [])}
- 등록된 변수 목록: ${JSON.stringify(context.variables || [])}
- 현재 적용된 기존 스크립트:
${JSON.stringify(context.currentScript || [], null, 2)}`;
  }

  const fullPrompt = `${userPrompt}${contextDescription}`;

  let rawResponseText = '';

  if (provider === 'gemini') {
    rawResponseText = await callGemini(modelId, apiKey, fullPrompt);
  } else if (provider === 'openai') {
    rawResponseText = await callOpenAI(modelId, apiKey, fullPrompt);
  } else if (provider === 'anthropic') {
    rawResponseText = await callAnthropic(modelId, apiKey, fullPrompt);
  } else if (provider === 'deepseek') {
    rawResponseText = await callDeepSeek(apiKey, fullPrompt);
  } else if (provider === 'groq') {
    rawResponseText = await callGroq(apiKey, fullPrompt);
  } else {
    throw new Error(`지원하지 않는 제공사: ${provider}`);
  }

  // 응답 파싱
  return parseHuberResponse(rawResponseText);
}

// 1. Google Gemini 호출 (동적 모델 발견 및 최신 모델 자동 전환 탑재)
async function callGemini(modelId: HuberModelId, apiKey: string, prompt: string): Promise<string> {
  const isPro = modelId === 'gemini-1.5-pro';

  const sendPayload = (url: string) =>
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: `${SYSTEM_PROMPT}\n\n[사용자 요청]\n${prompt}` }] }],
        generationConfig: {
          temperature: 0.2,
          topP: 0.9,
        },
      }),
    });

  // 1단계: 최신 정식 모델 우선 엔드포인트 목록
  let candidateUrls: string[] = [];

  if (isPro) {
    candidateUrls = [
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`,
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent?key=${apiKey}`,
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-pro-exp-02-05:generateContent?key=${apiKey}`,
    ];
  } else {
    // Flash 계열 (구글 최신 권장 모델 gemini-3.8-flash 최우선 호출)
    candidateUrls = [
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`,
      `https://generativelanguage.googleapis.com/v1/models/gemini-3.8-flash:generateContent?key=${apiKey}`,
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
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

      // 구글이 특정 모델을 직접 권장(예: use models/gemini-3.8-flash)한 경우 즉시 해당 모델로 호출
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
        // Flash 또는 Pro 계열 우선 매칭
        const matched =
          (isPro ? usable.find((m) => m.name.includes('pro')) : null) ||
          usable.find((m) => m.name.includes('3.8-flash')) ||
          usable.find((m) => m.name.includes('3.')) ||
          usable.find((m) => m.name.includes('2.0-flash')) ||
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

// 2. OpenAI 호출
async function callOpenAI(modelId: HuberModelId, apiKey: string, prompt: string): Promise<string> {
  const openaiModel = modelId === 'gpt-4o' ? 'gpt-4o' : 'gpt-4o-mini';
  const url = 'https://api.openai.com/v1/chat/completions';

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: openaiModel,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `OpenAI API 호출 실패 (상태 코드: ${res.status})`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

// 3. Anthropic Claude 호출
async function callAnthropic(modelId: HuberModelId, apiKey: string, prompt: string): Promise<string> {
  const url = 'https://api.anthropic.com/v1/messages';

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'dangerously-allow-browser': 'true',
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4096,
      temperature: 0.2,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Claude API 호출 실패 (상태 코드: ${res.status})`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text;
  if (!text) throw new Error('Claude 응답에서 텍스트를 찾을 수 없습니다.');
  return text;
}

// 4. DeepSeek 호출
async function callDeepSeek(apiKey: string, prompt: string): Promise<string> {
  const url = 'https://api.deepseek.com/chat/completions';

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `DeepSeek API 호출 실패 (상태 코드: ${res.status})`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

// 5. Groq 호출
async function callGroq(apiKey: string, prompt: string): Promise<string> {
  const url = 'https://api.groq.com/openai/v1/chat/completions';

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Groq API 호출 실패 (상태 코드: ${res.status})`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

// 응답 파싱 및 AST 정규화
function parseHuberResponse(rawText: string): HuberGenerateResult {
  // 1. ```json ... ``` 블록 추출
  const jsonMatch = rawText.match(/```json\s*([\s\S]*?)\s*```/) || rawText.match(/```\s*([\s\S]*?)\s*```/);
  let rawJson = '';
  let explanation = rawText;

  if (jsonMatch) {
    rawJson = jsonMatch[1].trim();
    // 설명 부분은 JSON 코드블록 이전 또는 이후의 텍스트
    explanation = rawText.replace(jsonMatch[0], '').trim();
  } else {
    // 코드블록 없이 순수 JSON인 경우
    const firstBracket = rawText.indexOf('[');
    const lastBracket = rawText.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket > firstBracket) {
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

  // 1차원 배열로 왔다면 2차원 스레드 배열로 감싸기
  let script: HuberScript;
  if (Array.isArray(parsed) && parsed.length > 0 && !Array.isArray(parsed[0])) {
    script = [parsed as HuberBlockNode[]];
  } else if (Array.isArray(parsed)) {
    script = parsed as HuberScript;
  } else {
    throw new Error('엔트리 스크립트는 블록 스레드 배열 구조여야 합니다.');
  }

  // 노드 ID 및 필수 필드 보정 (Schema Normalization)
  normalizeScriptTree(script);

  return {
    script,
    explanation: explanation || '엔트리 블록 코드가 성공적으로 생성되었습니다.',
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

