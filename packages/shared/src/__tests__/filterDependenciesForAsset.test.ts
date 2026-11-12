import { describe, it, expect } from 'vitest';
import { filterDependenciesForAsset } from '../utils/blockModel';

describe('filterDependenciesForAsset (종속성 정밀 필터링 검증)', () => {
  const dummyVariables = [
    { id: 'var_score', name: '점수' },
    { id: 'var_speed', name: '속도' },
    { id: 'var_hp', name: '체력' },
    { id: 'var_unused', name: '안쓰는변수' },
    { id: 'var_local', name: '오브젝트변수', object: 'target_obj_1' },
    { id: 'var_other_local', name: '남의오브젝트변수', object: 'other_obj' },
  ];

  const dummyLists = [
    { id: 'list_inventory', name: '인벤토리' },
    { id: 'list_unused', name: '안쓰는리스트' },
  ];

  const dummyMessages = [
    { id: 'msg_start', name: '게임시작' },
    { id: 'msg_gameover', name: '게임오버' },
    { id: 'msg_unused', name: '안쓰는신호' },
  ];

  it('변수, 리스트, 신호를 전혀 쓰지 않는 블록 코드인 경우 모두 빈 배열을 반환해야 한다', () => {
    const cleanBlock = {
      type: 'when_run_button_click',
      statements: [
        [
          {
            type: 'move_direction',
            params: [10],
          },
        ],
      ],
    };

    const result = filterDependenciesForAsset(cleanBlock, {
      variables: dummyVariables,
      lists: dummyLists,
      messages: dummyMessages,
    });

    expect(result.variables).toEqual([]);
    expect(result.lists).toEqual([]);
    expect(result.messages).toEqual([]);
  });

  it('블록에서 실제로 사용하는 변수와 신호만 정확히 선별하고 미사용 항목은 제외해야 한다', () => {
    const scriptWithScoreAndStart = {
      type: 'when_message_cast',
      params: ['msg_start'],
      statements: [
        [
          {
            type: 'change_variable',
            params: ['var_score', 1],
          },
          {
            type: 'value_of_index_from_list',
            params: ['list_inventory', 1],
          },
        ],
      ],
    };

    const result = filterDependenciesForAsset(scriptWithScoreAndStart, {
      variables: dummyVariables,
      lists: dummyLists,
      messages: dummyMessages,
    });

    expect(result.variables.map((v) => v.id)).toEqual(['var_score']);
    expect(result.lists.map((l) => l.id)).toEqual(['list_inventory']);
    expect(result.messages.map((m) => m.id)).toEqual(['msg_start']);
  });

  it('호출하는 함수 내부에서 참조하는 변수/신호도 함께 선별되어야 한다', () => {
    const dummyFunctions = [
      {
        id: 'func_attack',
        name: '공격하기',
        content: JSON.stringify([
          [
            {
              type: 'set_variable',
              params: ['var_hp', 50],
            },
            {
              type: 'message_cast',
              params: ['msg_gameover'],
            },
          ],
        ]),
      },
      {
        id: 'func_unused',
        name: '미사용함수',
        content: JSON.stringify([
          [
            {
              type: 'set_variable',
              params: ['var_unused', 999],
            },
          ],
        ]),
      },
    ];

    const blockCallingFunction = {
      type: 'when_run_button_click',
      statements: [
        [
          {
            type: 'func_func_attack',
          },
        ],
      ],
    };

    const result = filterDependenciesForAsset(blockCallingFunction, {
      variables: dummyVariables,
      lists: dummyLists,
      messages: dummyMessages,
      functions: dummyFunctions,
    });

    // func_attack이 호출되었으므로 func_attack 및 내부에서 쓰인 var_hp, msg_gameover가 포함되어야 함
    expect(result.functions.map((f) => f.id)).toEqual(['func_attack']);
    expect(result.variables.map((v) => v.id)).toEqual(['var_hp']);
    expect(result.messages.map((m) => m.id)).toEqual(['msg_gameover']);
    // 미사용 변수와 함수는 절대 포함되지 않아야 함
    expect(result.variables.some((v) => v.id === 'var_unused')).toBe(false);
  });

  it('오브젝트 에셋의 경우 해당 오브젝트의 로컬 변수는 자동으로 포함되어야 한다', () => {
    const emptyObjectScript: any[] = [];

    const result = filterDependenciesForAsset(
      emptyObjectScript,
      {
        variables: dummyVariables,
        lists: dummyLists,
        messages: dummyMessages,
      },
      {
        targetObjectIds: ['target_obj_1'],
      }
    );

    expect(result.variables.map((v) => v.id)).toEqual(['var_local']);
    expect(result.variables.some((v) => v.id === 'var_other_local')).toBe(false);
  });
});

