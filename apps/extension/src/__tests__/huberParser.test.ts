import { describe, it, expect } from 'vitest';
import { parseHuberResponse } from '../content/services/huberClient';

describe('parseHuberResponse (허버 2.0 파서 TDD 검증)', () => {
  it('구버전 2차원 블록 스크립트 배열 응답을 정상적으로 HuberActionPlan으로 호환 정규화해야 한다', () => {
    const legacyResponse = `
다음은 시작 버튼을 누르면 10만큼 움직이는 코드입니다.
\`\`\`json
[
  [
    {
      "id": "b1a1",
      "type": "when_run_button_click",
      "params": [],
      "statements": []
    },
    {
      "id": "b1a2",
      "type": "move_direction",
      "params": [10],
      "statements": []
    }
  ]
]
\`\`\`
즐거운 코딩 되세요!
    `;

    const result = parseHuberResponse(legacyResponse);

    expect(result.actionPlan.objects.length).toBe(1);
    expect(result.actionPlan.objects[0].target).toBe('CURRENT');
    expect(result.actionPlan.objects[0].script[0].length).toBe(2);
    expect(result.actionPlan.objects[0].script[0][0].type).toBe('when_run_button_click');
    expect(result.script[0][0].type).toBe('when_run_button_click');
    expect(result.explanation).toContain('시작 버튼을 누르면 10만큼');
  });

  it('신규 멀티 액션 플랜(변수, 신호, 신규 오브젝트 생성) 응답을 완벽하게 파싱해야 한다', () => {
    const multiActionResponse = `
요청하신 게임 스타트 시스템을 구성했습니다.
\`\`\`json
{
  "explanation": "점수 변수와 게임오버 신호를 생성하고 적 비행기 오브젝트를 추가했습니다.",
  "variables": [
    { "name": "점수", "defaultValue": 0, "visible": true }
  ],
  "messages": [
    { "name": "게임오버" }
  ],
  "objects": [
    {
      "target": "NEW",
      "name": "적 비행기",
      "shapeType": "RECTANGLE",
      "shapeColor": "#ff4d4d",
      "initialPosition": { "x": 100, "y": 50 },
      "sounds": [
        { "name": "폭발음", "builtinKey": "pop" }
      ],
      "script": [
        [
          {
            "type": "when_run_button_click",
            "params": [],
            "statements": [
              [
                {
                  "type": "change_variable",
                  "params": ["점수", 1]
                }
              ]
            ]
          }
        ]
      ]
    }
  ]
}
\`\`\`
    `;

    const result = parseHuberResponse(multiActionResponse);

    expect(result.actionPlan.variables).toHaveLength(1);
    expect(result.actionPlan.variables![0].name).toBe('점수');
    expect(result.actionPlan.messages).toHaveLength(1);
    expect(result.actionPlan.messages![0].name).toBe('게임오버');

    const obj = result.actionPlan.objects[0];
    expect(obj.target).toBe('NEW');
    expect(obj.name).toBe('적 비행기');
    expect(obj.shapeType).toBe('RECTANGLE');
    expect(obj.sounds).toHaveLength(1);
    expect(obj.sounds![0].builtinKey).toBe('pop');
    expect(obj.script[0][0].type).toBe('when_run_button_click');
  });

  it('코드블록 태그가 없는 순수 JSON 텍스트도 자동으로 감지하여 파싱해야 한다', () => {
    const bareJson = JSON.stringify({
      variables: [{ name: "체력", defaultValue: 100 }],
      objects: [
        {
          target: "CURRENT",
          script: [
            [{ type: "when_run_button_click" }]
          ]
        }
      ]
    });

    const result = parseHuberResponse(bareJson);
    expect(result.actionPlan.variables![0].name).toBe('체력');
    expect(result.actionPlan.objects[0].script[0][0].type).toBe('when_run_button_click');
  });
});

