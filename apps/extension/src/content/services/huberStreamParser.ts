/**
 * Huber AI 실시간 스트리밍(SSE) 청크 파서 유틸리티
 */

export interface ParsedStreamChunk {
  text?: string;
  reasoning?: string;
  isDone?: boolean;
}

/**
 * OpenAI / Groq / DeepSeek 호환 SSE 라인 파서
 */
export function parseOpenAiSseLine(line: string): ParsedStreamChunk | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith(':')) return null; // SSE 핑/주석 무시
  if (!trimmed.startsWith('data:')) return null;

  const dataStr = trimmed.slice(5).trim();
  if (dataStr === '[DONE]') {
    return { isDone: true };
  }

  try {
    const json = JSON.parse(dataStr);
    const delta = json.choices?.[0]?.delta;
    if (!delta) return null;

    const text = delta.content || undefined;
    const reasoning = delta.reasoning_content || undefined;

    if (!text && !reasoning) return null;
    return { text, reasoning };
  } catch {
    return null;
  }
}

/**
 * Anthropic Claude 호환 SSE 라인 파서
 */
export function parseClaudeSseLine(line: string): ParsedStreamChunk | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith(':')) return null;
  if (!trimmed.startsWith('data:')) return null;

  const dataStr = trimmed.slice(5).trim();
  try {
    const json = JSON.parse(dataStr);
    if (json.type === 'message_stop') {
      return { isDone: true };
    }

    if (json.type === 'content_block_delta' && json.delta) {
      if (json.delta.type === 'text_delta' && json.delta.text) {
        return { text: json.delta.text };
      }
      if (json.delta.type === 'thinking_delta' && json.delta.thinking) {
        return { reasoning: json.delta.thinking };
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Google Gemini 호환 SSE 라인 파서
 */
export function parseGeminiSseLine(line: string): ParsedStreamChunk | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith(':')) return null;
  if (!trimmed.startsWith('data:')) return null;

  const dataStr = trimmed.slice(5).trim();
  try {
    const json = JSON.parse(dataStr);
    const candidate = json.candidates?.[0];
    const parts = candidate?.content?.parts;
    if (!parts || !Array.isArray(parts)) return null;

    let textAcc = '';
    let reasoningAcc = '';

    for (const part of parts) {
      if (part.thought) {
        reasoningAcc += part.text || '';
      } else if (part.text) {
        textAcc += part.text;
      }
    }

    if (!textAcc && !reasoningAcc) return null;
    return {
      text: textAcc || undefined,
      reasoning: reasoningAcc || undefined,
    };
  } catch {
    return null;
  }
}

/**
 * 스트림에서 누적된 텍스트 중 마크다운 json 블록(```json ... ```)을 분리하여
 * 설명(explanation)과 JSON 코드 부분을 실시간으로 분리
 */
export function splitStreamTextAndJson(accumulatedText: string): {
  explanationText: string;
  hasJsonBlock: boolean;
  jsonBlockContent: string;
} {
  const jsonStartIdx = accumulatedText.indexOf('```json');
  if (jsonStartIdx === -1) {
    // 아직 json 블록이 시작되지 않은 경우 전체가 설명
    const genericCodeIdx = accumulatedText.indexOf('```');
    if (genericCodeIdx === -1) {
      return {
        explanationText: accumulatedText,
        hasJsonBlock: false,
        jsonBlockContent: '',
      };
    }
    const explanationText = accumulatedText.substring(0, genericCodeIdx).trim();
    const afterCode = accumulatedText.substring(genericCodeIdx + 3);
    const closingIdx = afterCode.indexOf('```');
    return {
      explanationText,
      hasJsonBlock: closingIdx !== -1,
      jsonBlockContent: closingIdx !== -1 ? afterCode.substring(0, closingIdx).trim() : afterCode.trim(),
    };
  }

  const explanationText = accumulatedText.substring(0, jsonStartIdx).trim();
  const afterJson = accumulatedText.substring(jsonStartIdx + 7);
  const closingIdx = afterJson.indexOf('```');

  return {
    explanationText,
    hasJsonBlock: closingIdx !== -1,
    jsonBlockContent: closingIdx !== -1 ? afterJson.substring(0, closingIdx).trim() : afterJson.trim(),
  };
}

