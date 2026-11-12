/**
 * 허버 2.0 멀티 액션 플랜(Huber Action Plan) 데이터 전송 객체
 */

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

export interface HuberVariableAction {
  name: string;
  type?: 'variable' | 'slide';
  defaultValue?: number | string;
  minValue?: number;
  maxValue?: number;
  visible?: boolean;
}

export interface HuberListAction {
  name: string;
  defaultValues?: Array<string | number>;
  visible?: boolean;
}

export interface HuberMessageAction {
  name: string;
}

export interface HuberFunctionAction {
  name: string;
  content: any[];
  description?: string;
}

export interface HuberObjectAction {
  target: 'CURRENT' | 'NEW';
  name?: string; // NEW일 때 오브젝트 이름
  shapeType?: 'ENTRYBOT' | 'RECTANGLE' | 'CIRCLE' | 'TEXT';
  shapeText?: string; // shapeType이 TEXT일 때 표시할 글자
  shapeColor?: string; // 도형 색상
  initialPosition?: { x: number; y: number };
  sounds?: Array<{
    name: string;
    builtinKey?: string; // 엔트리 기본 사운드 프리셋 키 (예: 'jump', 'ding', 'pop')
  }>;
  script: HuberScript;
}

export interface HuberActionPlan {
  explanation: string;
  variables?: HuberVariableAction[];
  lists?: HuberListAction[];
  messages?: HuberMessageAction[];
  functions?: HuberFunctionAction[];
  objects: HuberObjectAction[];
}

