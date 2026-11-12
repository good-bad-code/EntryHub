import { describe, it, expect } from 'vitest';
import {
  parseOpenAiSseLine,
  parseClaudeSseLine,
  parseGeminiSseLine,
  splitStreamTextAndJson,
} from '../content/services/huberStreamParser';

describe('HuberStreamParser (실시간 스트리밍 SSE 파서 검증)', () => {
  it('OpenAI / Groq / DeepSeek SSE 라인에서 텍스트 및 사고 과정(reasoning) 추출', () => {
    // 1. 일반 텍스트 델타
    const line1 = 'data: {"choices":[{"delta":{"content":"엔트리 점프 코드를"}}]}';
    const res1 = parseOpenAiSseLine(line1);
    expect(res1?.text).toBe('엔트리 점프 코드를');
    expect(res1?.reasoning).toBeUndefined();

    // 2. 추론 모델 사고 과정 (DeepSeek R1 / o-series)
    const line2 = 'data: {"choices":[{"delta":{"reasoning_content":"y좌표를 10만큼 변경하고..."}}]}';
    const res2 = parseOpenAiSseLine(line2);
    expect(res2?.reasoning).toBe('y좌표를 10만큼 변경하고...');
    expect(res2?.text).toBeUndefined();

    // 3. 종료 [DONE]
    const lineDone = 'data: [DONE]';
    const resDone = parseOpenAiSseLine(lineDone);
    expect(resDone?.isDone).toBe(true);
  });

  it('Claude SSE 라인에서 텍스트 및 thinking_delta 추출', () => {
    const textLine =
      'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"스페이스 키를 누를 때"}}';
    const resText = parseClaudeSseLine(textLine);
    expect(resText?.text).toBe('스페이스 키를 누를 때');

    const thinkingLine =
      'data: {"type":"content_block_delta","delta":{"type":"thinking_delta","thinking":"엔트리 중력 가속도 구현"}}';
    const resThinking = parseClaudeSseLine(thinkingLine);
    expect(resThinking?.reasoning).toBe('엔트리 중력 가속도 구현');

    const stopLine = 'data: {"type":"message_stop"}';
    const resStop = parseClaudeSseLine(stopLine);
    expect(resStop?.isDone).toBe(true);
  });

  it('Gemini SSE 라인에서 텍스트 및 thought 파트 추출', () => {
    const geminiLine =
      'data: {"candidates":[{"content":{"parts":[{"text":"블록 코드를 생성했습니다."}]}}]}';
    const res = parseGeminiSseLine(geminiLine);
    expect(res?.text).toBe('블록 코드를 생성했습니다.');

    const thoughtLine =
      'data: {"candidates":[{"content":{"parts":[{"thought":true,"text":"오브젝트의 y좌표 변수 필요"}]}}]}';
    const resThought = parseGeminiSseLine(thoughtLine);
    expect(resThought?.reasoning).toBe('오브젝트의 y좌표 변수 필요');
  });

  it('splitStreamTextAndJson: 누적 스트림에서 텍스트 설명과 완성된 JSON 코드 분리', () => {
    // 1. JSON 시작 전 순수 텍스트
    const stream1 = '안녕하세요! 점프 코드를 작성 중입니다...';
    const split1 = splitStreamTextAndJson(stream1);
    expect(split1.hasJsonBlock).toBe(false);
    expect(split1.explanationText).toBe(stream1);

    // 2. JSON 완성 상태
    const stream2 =
      '설명입니다.\n```json\n{"objects":[{"target":"CURRENT","script":[]}]}\n```\n완료!';
    const split2 = splitStreamTextAndJson(stream2);
    expect(split2.hasJsonBlock).toBe(true);
    expect(split2.explanationText).toBe('설명입니다.');
    expect(split2.jsonBlockContent).toBe('{"objects":[{"target":"CURRENT","script":[]}]}');
  });
});

