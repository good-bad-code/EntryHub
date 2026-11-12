import { describe, it, expect } from 'vitest';
import { filterFunctionsForBlock } from '../utils/blockModel';

describe('filterFunctionsForBlock (함수 전이적 참조 선별 검증)', () => {
  const dummyFunctions = [
    {
      id: 'func_jump',
      name: '점프',
      content: JSON.stringify([
        [
          {
            type: 'move_y',
            params: [10],
          },
          {
            // func_jump가 func_sound_effect를 내부에서 호출
            type: 'func_func_sound_effect',
          },
        ],
      ]),
    },
    {
      id: 'func_sound_effect',
      name: '효과음재생',
      content: JSON.stringify([
        [
          {
            type: 'sound_something_with_block',
            params: ['snd1'],
          },
        ],
      ]),
    },
    {
      id: 'func_other',
      name: '무관한함수',
      content: JSON.stringify([
        [
          {
            type: 'move_x',
            params: [5],
          },
        ],
      ]),
    },
  ];

  it('A 함수가 B 함수를 내부 호출할 때 두 함수 모두 전이적으로 선별되어야 한다', () => {
    const mainScript = {
      type: 'when_some_key_pressed',
      params: ['32'],
      statements: [
        [
          {
            type: 'func_func_jump',
          },
        ],
      ],
    };

    const result = filterFunctionsForBlock(mainScript, dummyFunctions);
    const resultIds = result.map((f) => f.id);

    expect(resultIds).toContain('func_jump');
    expect(resultIds).toContain('func_sound_effect');
    expect(resultIds).not.toContain('func_other');
  });

  it('함수 호출이 없는 블록은 빈 배열을 반환해야 한다', () => {
    const noFuncBlock = {
      type: 'move_direction',
      params: [10],
    };

    const result = filterFunctionsForBlock(noFuncBlock, dummyFunctions);
    expect(result).toEqual([]);
  });
});

