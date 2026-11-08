import blockData from '../data/entryBlockData.json';

export interface BlockRenderInfo {
  category: string;
  categoryName: string;
  skeleton: string;
  color: string;
  outerLine: string;
  isEvent: boolean;
  isLoop: boolean;
  isField: boolean;
  isBoolean: boolean;
  isFunction: boolean;
}

// 15종 공식 카테고리 영문-한글 매핑
export const ENTRY_CATEGORY_NAMES: Record<string, string> = {
  start: '시작',
  flow: '흐름',
  moving: '움직임',
  looks: '생김새',
  brush: '붓',
  text: '글상자',
  sound: '소리',
  judgement: '판단',
  calc: '계산',
  variable: '자료',
  func: '함수',
  analysis: '데이터 분석',
  ai_utilize: '인공지능',
  expansion: '확장',
  arduino: '하드웨어',
};

// 카테고리별 공식 색상 (EntryStatic.colorSet.block 기준)
export const ENTRY_CATEGORY_COLORS: Record<string, { bg: string; border: string }> = {
  start: { bg: '#00b400', border: '#009400' },
  flow: { bg: '#19baea', border: '#1498c0' },
  moving: { bg: '#ad3efb', border: '#8b19db' },
  looks: { bg: '#ff3a61', border: '#c72042' },
  brush: { bg: '#ff9b00', border: '#fc6500' },
  text: { bg: '#e43500', border: '#ad2800' },
  sound: { bg: '#67b100', border: '#508a00' },
  judgement: { bg: '#4562f5', border: '#1b3ad8' },
  calc: { bg: '#f4af18', border: '#ff7f00' },
  variable: { bg: '#dd47d8', border: '#b819b3' },
  func: { bg: '#de5c04', border: '#a14100' },
  analysis: { bg: '#25aeff', border: '#1592ff' },
  ai_utilize: { bg: '#8222ff', border: '#670bdd' },
  expansion: { bg: '#ef6d6d', border: '#c63f3f' },
  arduino: { bg: '#00b6b1', border: '#008380' },
};

export const categoryMap = blockData.categoryMap as Record<string, string>;
export const skeletonMap = blockData.skeletonMap as Record<string, string>;
export const templates = blockData.templates as Record<string, string>;
export const dropdownMap = blockData.dropdownMap as Record<string, string>;

/**
 * 블록의 타입(type)으로부터 정확한 카테고리, 색상, 스켈레톤(외형 모양) 메타데이터를 계산합니다.
 */
export function getEntryBlockInfo(type: string): BlockRenderInfo {
  const t = (type || '').trim();
  const lower = t.toLowerCase();

  // 1. 함수 블록 여부 확인
  const isFunction =
    lower.includes('func') ||
    lower.includes('def_func') ||
    lower.includes('custom') ||
    lower.startsWith('func_') ||
    categoryMap[t] === 'func';

  // 2. 카테고리 결정
  let categoryKey = categoryMap[t];

  if (!categoryKey) {
    if (isFunction) {
      categoryKey = 'func';
    } else if (
      lower.startsWith('calc_') ||
      lower.includes('calc') ||
      lower.includes('random') ||
      lower.includes('coordinate_') ||
      lower.includes('math')
    ) {
      categoryKey = 'calc';
    } else if (
      lower.startsWith('boolean_') ||
      lower.startsWith('is_') ||
      lower.includes('boolean') ||
      lower.includes('reach') ||
      lower.includes('touch') ||
      lower.includes('judgement')
    ) {
      categoryKey = 'judgement';
    } else if (
      lower.includes('draw') ||
      lower.includes('brush') ||
      lower.includes('pen') ||
      lower.includes('stamp') ||
      lower.includes('erase') ||
      lower.includes('thickness')
    ) {
      categoryKey = 'brush';
    } else if (lower.includes('text') || lower.includes('font') || lower.includes('textbox')) {
      categoryKey = 'text';
    } else if (lower.includes('sound') || lower.includes('audio') || lower.includes('volume') || lower.includes('pitch')) {
      categoryKey = 'sound';
    } else if (lower.includes('variable') || lower.includes('list')) {
      categoryKey = 'variable';
    } else if (lower.includes('repeat') || lower.includes('if') || lower.includes('wait') || lower.includes('stop') || lower.includes('flow')) {
      categoryKey = 'flow';
    } else if (lower.includes('move') || lower.includes('rotate') || lower.includes('direction') || lower.includes('locate') || lower.includes('motion')) {
      categoryKey = 'moving';
    } else if (lower.includes('dialog') || lower.includes('show') || lower.includes('hide') || lower.includes('looks') || lower.includes('effect')) {
      categoryKey = 'looks';
    } else if (lower.startsWith('when') || lower.includes('entry_event') || lower === 'start') {
      categoryKey = 'start';
    } else if (lower.includes('ai_') || lower.includes('voice') || lower.includes('knn')) {
      categoryKey = 'ai_utilize';
    } else if (lower.includes('hardware') || lower.includes('arduino')) {
      categoryKey = 'arduino';
    } else {
      categoryKey = 'flow';
    }
  }

  const categoryName = ENTRY_CATEGORY_NAMES[categoryKey] || '블록';
  const colorPair = ENTRY_CATEGORY_COLORS[categoryKey] || { bg: '#444444', border: '#333333' };

  // 3. 스켈레톤(모양) 결정
  let skeleton = skeletonMap[t];
  if (!skeleton) {
    if (lower.startsWith('when_') || lower.includes('clicked') || lower.includes('pressed') || categoryKey === 'start') {
      skeleton = 'basic_event';
    } else if (lower.includes('repeat') || lower.includes('if') || lower.includes('loop')) {
      skeleton = 'basic_loop';
    } else if (categoryKey === 'judgement' || lower.startsWith('boolean_') || lower.startsWith('is_') || lower.includes('boolean')) {
      skeleton = 'basic_boolean_field';
    } else if (categoryKey === 'calc' || lower.startsWith('calc_') || lower.includes('get_') || lower.includes('value')) {
      skeleton = 'basic_string_field';
    } else {
      skeleton = 'basic';
    }
  }

  const isEvent = skeleton === 'basic_event';
  const isLoop = skeleton === 'basic_loop' || skeleton === 'basic_double_loop' || skeleton === 'basic_define';
  const isBoolean = skeleton === 'basic_boolean_field';
  const isField = skeleton === 'basic_string_field' || isBoolean;

  return {
    category: categoryKey,
    categoryName,
    skeleton,
    color: colorPair.bg,
    outerLine: colorPair.border,
    isEvent,
    isLoop,
    isField,
    isBoolean,
    isFunction,
  };
}

export interface ParsedTemplateSegment {
  type: 'text' | 'param';
  text?: string;
  paramIndex?: number;
  param?: any;
}

/**
 * 엔트리 공식 모든 키보드 키 코드 및 키 이름 매핑 테이블
 */
export const ENTRY_KEY_CODE_MAP: Record<string, string> = {
  // 특수/제어 키
  '8': '백스페이스',
  '9': '탭',
  '13': '엔터',
  '16': '쉬프트',
  '17': '컨트롤',
  '18': '알트',
  '20': '캡스락',
  '27': 'ESC',
  '32': '스페이스',
  '33': '페이지업',
  '34': '페이지다운',
  '35': '엔드',
  '36': '홈',
  '37': '왼쪽 화살표',
  '38': '위쪽 화살표',
  '39': '오른쪽 화살표',
  '40': '아래쪽 화살표',
  '45': '인서트',
  '46': '딜리트',
  '91': '윈도우',
  '92': '윈도우',
  '93': '메뉴',
  '144': '넘버락',
  '145': '스크롤락',

  // 숫자 키 0-9
  '48': '0', '49': '1', '50': '2', '51': '3', '52': '4',
  '53': '5', '54': '6', '55': '7', '56': '8', '57': '9',

  // 영문 알파벳 키 a-z
  '65': 'a', '66': 'b', '67': 'c', '68': 'd', '69': 'e',
  '70': 'f', '71': 'g', '72': 'h', '73': 'i', '74': 'j',
  '75': 'k', '76': 'l', '77': 'm', '78': 'n', '79': 'o',
  '80': 'p', '81': 'q', '82': 'r', '83': 's', '84': 't',
  '85': 'u', '86': 'v', '87': 'w', '88': 'x', '89': 'y', '90': 'z',

  // 숫자패드 (Numpad)
  '96': '숫자패드 0', '97': '숫자패드 1', '98': '숫자패드 2', '99': '숫자패드 3', '100': '숫자패드 4',
  '101': '숫자패드 5', '102': '숫자패드 6', '103': '숫자패드 7', '104': '숫자패드 8', '105': '숫자패드 9',
  '106': '숫자패드 *', '107': '숫자패드 +', '109': '숫자패드 -', '110': '숫자패드 .', '111': '숫자패드 /',

  // 기능 키 F1-F12
  '112': 'F1', '113': 'F2', '114': 'F3', '115': 'F4', '116': 'F5', '117': 'F6',
  '118': 'F7', '119': 'F8', '120': 'F9', '121': 'F10', '122': 'F11', '123': 'F12',

  // 기호 및 문장부호 키
  '186': ';', '187': '=', '188': ',', '189': '-', '190': '.', '191': '/',
  '192': '`', '219': '[', '220': '\\', '221': ']', '222': '\'',

  // 영문 키 이름 매핑
  'all': '모든',
  'space': '스페이스',
  'enter': '엔터',
  'up': '위쪽 화살표',
  'down': '아래쪽 화살표',
  'left': '왼쪽 화살표',
  'right': '오른쪽 화살표',
  'shift': '쉬프트',
  'ctrl': '컨트롤',
  'alt': '알트',
  'backspace': '백스페이스',
  'tab': '탭',
  'esc': 'ESC',
  'escape': 'ESC',
  'delete': '딜리트',
  'insert': '인서트',
};

/**
 * 엔트리 함수 블록의 정의로부터 사용자 함수 이름을 추출합니다.
 */
export function extractFunctionNameFromDef(funcDef: any): string {
  if (!funcDef) return '';
  if (typeof funcDef === 'string') return funcDef;

  // 1. content JSON 문자열에서 function_field_label의 params 텍스트 직접 정규식 추출 (최우선)
  const contentStr =
    typeof funcDef.content === 'string'
      ? funcDef.content
      : JSON.stringify(funcDef.content || '');
  if (contentStr) {
    const directRegex = /"type"\s*:\s*"function_field_label"\s*,\s*"params"\s*:\s*\[\s*"([^"\\]*(?:\\.[^"\\]*)*)"/i;
    const match = directRegex.exec(contentStr);
    if (match && match[1]) {
      const clean = match[1].replace(/\\"/g, '"').trim();
      if (clean) return clean;
    }
    const reverseRegex = /"params"\s*:\s*\[\s*"([^"\\]*(?:\\.[^"\\]*)*)"\s*\]\s*,\s*"type"\s*:\s*"function_field_label"/i;
    const match2 = reverseRegex.exec(contentStr);
    if (match2 && match2[1]) {
      const clean = match2[1].replace(/\\"/g, '"').trim();
      if (clean) return clean;
    }
  }

  // 2. template 필드 파싱
  if (funcDef.template) {
    const clean = String(funcDef.template).replace(/%\d+/g, '').replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (clean) return clean;
  }

  // 3. description 필드 파싱
  if (funcDef.description && typeof funcDef.description === 'string' && funcDef.description.trim()) {
    return funcDef.description.trim();
  }

  // 4. name 또는 title 필드 파싱 (기본 명칭이 아닌 실제 이름일 때)
  if (funcDef.name && funcDef.name !== '함수' && funcDef.name !== '함수 정의') return funcDef.name;
  if (funcDef.title && funcDef.title !== '함수' && funcDef.title !== '함수 정의') return funcDef.title;

  function findLabel(node: any): string | null {
    if (!node) return null;
    if (Array.isArray(node)) {
      for (const item of node) {
        const found = findLabel(item);
        if (found) return found;
      }
      return null;
    }
    if (typeof node === 'object') {
      if (node.type === 'function_field_label' && node.params?.[0]) {
        const str = String(node.params[0]).trim();
        if (str) return str;
      }
      if (node.params && Array.isArray(node.params)) {
        const found = findLabel(node.params);
        if (found) return found;
      }
      if (node.statements && Array.isArray(node.statements)) {
        const found = findLabel(node.statements);
        if (found) return found;
      }
    }
    return null;
  }

  let content = funcDef.content;
  if (typeof content === 'string') {
    try { content = JSON.parse(content); } catch { content = null; }
  }
  if (content) {
    const label = findLabel(content);
    if (label) return label;
  }

  if (funcDef.params) {
    const label = findLabel(funcDef.params);
    if (label) return label;
  }

  return funcDef.name || funcDef.title || '';
}

/**
 * 템플릿과 블록 파라미터를 결합하여 구조화된 세그먼트 배열을 파싱합니다.
 * pictures/sounds 이름 해석을 위한 선택적 컨텍스트를 받을 수 있습니다.
 */
export function parseBlockSegments(block: any, functions: any[] = [], ctx?: { pictures?: any[]; sounds?: any[] }): ParsedTemplateSegment[] {
  if (!block || typeof block !== 'object') return [];
  const type = block.type || block.name || '';
  const params: any[] = block.params || [];

  // get_pictures: picture ID -> 이름 텍스트로 변환하여 단일 텍스트 세그먼트 반환
  if (type === 'get_pictures') {
    const picId = params[0];
    let label = picId ? String(picId) : '모양';
    if (picId && ctx?.pictures) {
      const pic = ctx.pictures.find((p: any) => (p.id || p.id_) === picId);
      if (pic) label = pic.name || pic.name_ || label;
    }
    return [{ type: 'text', text: label }];
  }

  // get_sounds: sound ID -> 이름 텍스트로 변환
  if (type === 'get_sounds') {
    const sndId = params[0];
    let label = sndId ? String(sndId) : '소리';
    if (sndId && ctx?.sounds) {
      const snd = ctx.sounds.find((s: any) => (s.id || s.id_) === sndId);
      if (snd) label = snd.name || snd.name_ || label;
    }
    return [{ type: 'text', text: label }];
  }

  // 함수 정의 블록 (def_functions)
  if (type === 'def_functions') {
    // params 구조: [[label, param, ...]] 또는 [label, param, ...]
    const rawParams: any[] = Array.isArray(params[0]) ? params[0] : params;
    const segments: ParsedTemplateSegment[] = [];
    rawParams.forEach((subP: any, idx: number) => {
      if (!subP?.type) return;
      if (subP.type === 'function_field_label') {
        // 라벨 텍스트 그대로 출력
        const label = subP.params?.[0] ? String(subP.params[0]) : '';
        if (label) segments.push({ type: 'text', text: label });
      } else if (subP.type === 'function_field_boolean' || subP.type === 'function_param_boolean') {
        // 판단값 슬롯: _isBooleanParam 플래그
        segments.push({ type: 'param', paramIndex: idx, param: { ...subP, _isBooleanParam: true } });
      } else {
        // 문자/숫자 슬롯
        segments.push({ type: 'param', paramIndex: idx, param: subP });
      }
    });
    // rawParams가 비어있으면 fallback으로 이름만
    if (segments.length === 0) {
      segments.push({ type: 'text', text: extractFunctionNameFromDef(block) || '함수 정의' });
    }
    return segments;
  }

  // 함수 라벨 블록
  if (type === 'function_field_label') {
    const label = params.length > 0 ? String(params[0]) : '함수';
    return [{ type: 'text', text: label }];
  }

  // 함수 매개변수 블록
  if (type === 'function_field_string' || type === 'function_param_string') {
    const label = params.length > 0 ? String(params[0]) : '문자/숫자';
    return [{ type: 'param', paramIndex: 0, param: label }];
  }
  if (type === 'function_field_boolean' || type === 'function_param_boolean') {
    const label = params.length > 0 ? String(params[0]) : '참/거짓';
    return [{ type: 'param', paramIndex: 0, param: label }];
  }

  // 함수 호출 블록 (func_... 또는 type이 함수 id와 일치하는 경우)
  if (type.startsWith('func_') || functions.some((f: any) => (f.id || f._id) === type || `func_${f.id || f._id}` === type)) {
    const funcId = type.startsWith('func_') ? type.slice(5) : type;
    let found = functions.find((f: any) => {
      if (!f) return false;
      const fId = f.id || f._id;
      return fId === funcId || fId === type || `func_${fId}` === type;
    });

    if (!found && functions.length === 1) {
      found = functions[0];
    }

    // 1. 엔트리 공식 템플릿(template) 지원: block.template 또는 found.template 또는 런타임 Entry.block[type].template
    const activeTemplate: string | null =
      block?.template ||
      found?.template ||
      ((typeof window !== 'undefined' && (window as any).Entry?.block?.[type]?.template)
        ? (window as any).Entry.block[type].template
        : null);

    if (activeTemplate) {
      const segments: ParsedTemplateSegment[] = [];
      const regex = /%([0-9]+)/g;
      let lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = regex.exec(activeTemplate)) !== null) {
        if (match.index > lastIndex) {
          const textChunk = activeTemplate.slice(lastIndex, match.index).trim();
          if (textChunk) {
            segments.push({ type: 'text', text: textChunk });
          }
        }
        const pIdx = parseInt(match[1], 10) - 1;
        // 실제 블록의 params 범위 내에 있는 경우만 파라미터 슬롯으로 처리 (끝의 인디케이터 %N 제외)
        if (pIdx >= 0 && pIdx < params.length) {
          segments.push({
            type: 'param',
            paramIndex: pIdx,
            param: params[pIdx],
          });
        }
        lastIndex = regex.lastIndex;
      }

      if (lastIndex < activeTemplate.length) {
        const remaining = activeTemplate.slice(lastIndex).trim();
        if (remaining) {
          segments.push({ type: 'text', text: remaining });
        }
      }

      if (segments.length > 0) {
        return segments;
      }
    }

    // 2. 정의 블록 체인(fieldBlocks)으로부터 복원
    if (found) {
      const fieldBlocks = getFuncDefFieldBlocks(found);
      if (fieldBlocks.length > 0) {
        const segments: ParsedTemplateSegment[] = [];
        let callParamIdx = 0;
        for (const field of fieldBlocks) {
          if (field.type === 'function_field_label') {
            const label = field.params?.[0] ? String(field.params[0]).trim() : '';
            if (label) segments.push({ type: 'text', text: label });
          } else {
            // 파라미터 슬롯: 실제 호출 값으로 채움
            const actualParam = callParamIdx < params.length ? params[callParamIdx] : null;
            const isBoolean = field.type === 'function_field_boolean' || field.type === 'function_param_boolean';
            segments.push({
              type: 'param',
              paramIndex: callParamIdx,
              param: isBoolean && actualParam ? { ...actualParam, _isBooleanParam: true } : actualParam,
            });
            callParamIdx++;
          }
        }
        if (segments.length > 0) {
          return segments;
        }
      }
    }

    // 3. 정의 없는 경우 폴백: 함수명 + 파라미터 나열 (사용자 수정 함수명/라벨 우선)
    const runtimeName =
      typeof window !== 'undefined'
        ? ((window as any).Entry?.variableContainer?.functions_?.find?.((f: any) => (f.id || f._id) === funcId)?.name ||
           (window as any).Entry?.block?.[type]?.template?.replace(/%\d+/g, '')?.trim())
        : null;

    const funcName =
      (found ? extractFunctionNameFromDef(found) || found.name : '') ||
      block?.funcName ||
      block?.name ||
      runtimeName ||
      found?.description ||
      '함수';
    const segments: ParsedTemplateSegment[] = [{ type: 'text', text: funcName }];
    params.forEach((param, idx) => {
      if (param === null || param === undefined) return;
      const pType = param?.type || '';
      // function_field_string/boolean은 정의 descriptor이므로 실제 값 슬롯으로 처리
      if (pType === 'function_field_string' || pType === 'function_param_string') {
        const actualVal = param.params?.[1] ?? null;
        segments.push({ type: 'param', paramIndex: idx, param: actualVal });
        return;
      }
      const isBoolean = pType === 'function_field_boolean' || pType === 'function_param_boolean';
      segments.push({ type: 'param', paramIndex: idx, param: isBoolean ? { ...param, _isBooleanParam: true } : param });
    });
    return segments;
  }

  // number, text, string, angle 등의 기본 값 래퍼 블록
  if (type === 'number' || type === 'text' || type === 'string' || type === 'angle') {
    const val = params.length > 0 ? params[0] : '';
    return [{ type: 'param', paramIndex: 0, param: val }];
  }

  const template = templates[type];

  if (template) {
    const segments: ParsedTemplateSegment[] = [];
    const regex = /%([0-9]+)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(template)) !== null) {
      if (match.index > lastIndex) {
        segments.push({
          type: 'text',
          text: template.slice(lastIndex, match.index),
        });
      }
      const idx = parseInt(match[1], 10) - 1;
      segments.push({
        type: 'param',
        paramIndex: idx,
        param: idx >= 0 && idx < params.length ? params[idx] : null,
      });
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < template.length) {
      segments.push({
        type: 'text',
        text: template.slice(lastIndex),
      });
    }

    return segments;
  }

  // 템플릿이 없는 경우 기본 폴백 세그먼트
  const cleanType = type
    .replace(/^when_/, '')
    .replace(/_basic$/, '')
    .replace(/_/g, ' ');

  const segments: ParsedTemplateSegment[] = [{ type: 'text', text: cleanType }];
  params.forEach((param, idx) => {
    if (param !== null && param !== undefined) {
      segments.push({ type: 'param', paramIndex: idx, param });
    }
  });

  return segments;
}

/**
 * 함수 정의(def_functions) 블록에서 순서가 보존된 필드 블록 배열을 추출합니다.
 * [function_field_label, function_param_string, function_field_label, ...] 형태로 반환합니다.
 */
/**
 * 함수 정의(def_functions / function_create) 블록에서
 * 순서가 보존된 필드 블록 배열을 추출합니다.
 *
 * 엔트리 함수 정의 내부는 링크드 리스트 구조입니다:
 *   function_create
 *     params[0]: function_field_label
 *       params[0]: "라벨 텍스트"
 *       params[1]: function_field_string  <-- 다음 블록
 *         params[0]: stringParam_xxxx
 *         params[1]: function_field_boolean  <-- 다음 블록
 *           ...
 */
export function getFuncDefFieldBlocks(funcDef: any): any[] {
  if (!funcDef) return [];

  const FIELD_TYPES = new Set([
    'function_field_label',
    'function_field_string',
    'function_field_boolean',
    'function_param_string',
    'function_param_boolean',
  ]);

  // 링크드 리스트를 따라 모든 필드 블록을 순서대로 수집
  function traverseChain(startBlock: any): any[] {
    const fields: any[] = [];
    const visited = new Set<string>();
    let current = startBlock;

    while (current && typeof current === 'object' && current.type) {
      if (current.id && visited.has(current.id)) break;
      if (current.id) visited.add(current.id);

      if (!FIELD_TYPES.has(current.type)) break;

      fields.push(current);

      // 다음 블록: params 배열에서 FIELD_TYPES에 속하는 object 탐색
      const p: any[] = current.params || [];
      let next: any = null;
      for (let i = p.length - 1; i >= 0; i--) {
        if (p[i] && typeof p[i] === 'object' && FIELD_TYPES.has(p[i].type)) {
          next = p[i];
          break;
        }
      }
      // params에 없으면 next 연결 블록 확인
      if (!next && current.next && typeof current.next === 'object' && FIELD_TYPES.has(current.next.type)) {
        next = current.next;
      }
      current = next;
    }

    return fields;
  }

  // function_create 블록을 재귀 탐색으로 찾아 params[0]에서 체인 시작
  function findAndTraverse(node: any): any[] | null {
    if (!node) return null;
    if (Array.isArray(node)) {
      for (const item of node) {
        const result = findAndTraverse(item);
        if (result) return result;
      }
      return null;
    }
    if (typeof node === 'object') {
      if ((node.type === 'function_create' || node.type === 'function_create_value') && node.params?.[0]) {
        return traverseChain(node.params[0]);
      }
      // def_functions 직접 타입: params 배열 자체가 field chain 시작점
      if (node.type === 'def_functions' && node.params) {
        const rawParams: any[] = Array.isArray(node.params[0]) ? node.params[0] : node.params;
        const firstField = rawParams.find((p: any) => p?.type && FIELD_TYPES.has(p.type));
        if (firstField) return traverseChain(firstField);
      }
      if (node.params) return findAndTraverse(node.params);
    }
    return null;
  }

  // 0. funcDef에 이미 fields 배열이 명시된 경우
  if (Array.isArray(funcDef.fields) && funcDef.fields.length > 0) {
    return funcDef.fields;
  }

  // 1. funcDef.params 직접 접근 (def_functions 블록 자체인 경우)
  if (funcDef.params) {
    const result = findAndTraverse(funcDef.params);
    if (result && result.length > 0) return result;
    // function_create 없이 직접 field blocks인 경우
    const rawParams: any[] = Array.isArray(funcDef.params[0]) ? funcDef.params[0] : funcDef.params;
    const direct = rawParams.filter((p: any) => p?.type && FIELD_TYPES.has(p.type));
    if (direct.length > 0) return direct;
  }

  // 2. funcDef.content 직렬화된 경우
  if (funcDef.content) {
    let content = funcDef.content;
    if (typeof content === 'string') {
      try { content = JSON.parse(content); } catch { content = null; }
    }
    if (!content) return [];
    const result = findAndTraverse(content);
    if (result && result.length > 0) return result;

    // 3. traverseChain으로 잡히지 않았을 경우: content 내의 모든 FIELD_TYPES 블록을 순서대로 수집 (DFS 폴백)
    const collected: any[] = [];
    const visited = new Set<string>();
    const dfsCollect = (curr: any) => {
      if (!curr) return;
      if (Array.isArray(curr)) {
        curr.forEach(dfsCollect);
        return;
      }
      if (typeof curr === 'object') {
        if (curr.type && FIELD_TYPES.has(curr.type)) {
          const key = curr.id || `${curr.type}_${collected.length}`;
          if (!visited.has(key)) {
            visited.add(key);
            collected.push(curr);
          }
        }
        if (curr.params && Array.isArray(curr.params)) {
          curr.params.forEach(dfsCollect);
        }
      }
    };
    dfsCollect(content);
    if (collected.length > 0) return collected;
  }

  return [];
}

/**
 * 파라미터 값(값, 드롭다운 키, 서브블록)을 사용자 친화적 문자열로 포맷팅합니다.
 * pictures/sounds 이름 해석을 위한 선택적 컨텍스트를 받을 수 있습니다.
 */
export function formatParamValue(param: any, ctx?: { pictures?: any[]; sounds?: any[] }): string {
  if (param === null || param === undefined) return '';

  // 1. 엔트리 모든 키코드 (숫자 또는 문자열) -> 한글 이름 변환
  if (typeof param === 'number' || typeof param === 'string') {
    const rawStr = String(param).trim().toLowerCase();
    if (ENTRY_KEY_CODE_MAP[rawStr]) {
      return ENTRY_KEY_CODE_MAP[rawStr];
    }
  }

  if (typeof param === 'string') {
    return dropdownMap[param] || param;
  }

  if (typeof param === 'number' || typeof param === 'boolean') {
    return String(param);
  }

  if (typeof param === 'object') {
    // get_pictures 블록: 모양 ID -> 모양 이름 변환
    if (param.type === 'get_pictures') {
      const picId = param.params?.[0];
      if (picId && ctx?.pictures) {
        const pic = ctx.pictures.find((p: any) => (p.id || p.id_) === picId);
        if (pic) return pic.name || pic.name_ || String(picId);
      }
      return picId ? String(picId) : '모양';
    }

    // get_sounds 블록: 소리 ID -> 소리 이름 변환
    if (param.type === 'get_sounds') {
      const sndId = param.params?.[0];
      if (sndId && ctx?.sounds) {
        const snd = ctx.sounds.find((s: any) => (s.id || s.id_) === sndId);
        if (snd) return snd.name || snd.name_ || String(sndId);
      }
      return sndId ? String(sndId) : '소리';
    }

    // 함수 파라미터 블록: 이름 표시
    if (param.type === 'function_field_string' || param.type === 'function_param_string') {
      return param.params?.[0] ? String(param.params[0]) : '문자/숫자';
    }
    if (param.type === 'function_field_boolean' || param.type === 'function_param_boolean') {
      return param.params?.[0] ? String(param.params[0]) : '참/거짓';
    }

    // 엔트리 블록 객체인 경우
    if (param.type) {
      return renderBlockTemplate(param, [], ctx);
    }
    // params[0] 등이 { type: 'number', params: ['10'] } 구조인 경우
    if (param.params && Array.isArray(param.params)) {
      return param.params.map((p: any) => formatParamValue(p, ctx)).join(' ');
    }
  }

  return '';
}

/**
 * 엔트리 공식 템플릿(%1, %2 치환)을 적용하여 완성된 블록 텍스트를 생성합니다.
 * pictures/sounds 이름 해석을 위한 선택적 컨텍스트를 받을 수 있습니다.
 */
export function renderBlockTemplate(block: any, functions: any[] = [], ctx?: { pictures?: any[]; sounds?: any[] }): string {
  if (!block || typeof block !== 'object') return '';
  const type = block.type || block.name || '';
  const params: any[] = block.params || [];

  // get_pictures 블록: picture ID -> 이름 변환
  if (type === 'get_pictures') {
    const picId = params[0];
    if (picId && ctx?.pictures) {
      const pic = ctx.pictures.find((p: any) => (p.id || p.id_) === picId);
      if (pic) return pic.name || pic.name_ || String(picId);
    }
    return picId ? String(picId) : '모양';
  }

  // get_sounds 블록: sound ID -> 이름 변환
  if (type === 'get_sounds') {
    const sndId = params[0];
    if (sndId && ctx?.sounds) {
      const snd = ctx.sounds.find((s: any) => (s.id || s.id_) === sndId);
      if (snd) return snd.name || snd.name_ || String(sndId);
    }
    return sndId ? String(sndId) : '소리';
  }

  // 함수 정의 블록
  if (type === 'def_functions') {
    const rawParams: any[] = Array.isArray(params[0]) ? params[0] : params;
    const parts: string[] = [];
    rawParams.forEach((subP: any) => {
      if (!subP?.type) return;
      if (subP.type === 'function_field_label') {
        const label = subP.params?.[0] ? String(subP.params[0]) : '';
        if (label) parts.push(label);
      } else if (subP.type === 'function_field_boolean' || subP.type === 'function_param_boolean') {
        const name = subP.params?.[0] ? String(subP.params[0]) : '판단';
        parts.push(`<${name}>`);
      } else {
        const name = subP.params?.[0] ? String(subP.params[0]) : '값';
        parts.push(`(${name})`);
      }
    });
    return parts.length > 0 ? parts.join(' ') : (extractFunctionNameFromDef(block) || '함수 정의');
  }

  // 함수 파라미터 블록 이름 표시
  if (type === 'function_field_string' || type === 'function_param_string') {
    return params[0] ? String(params[0]) : '문자/숫자';
  }
  if (type === 'function_field_boolean' || type === 'function_param_boolean') {
    return params[0] ? String(params[0]) : '참/거짓';
  }
  if (type === 'function_field_label') {
    return params[0] ? String(params[0]) : '';
  }

  // 함수 호출 블록
  if (type.startsWith('func_') || functions.some((f: any) => (f.id || f._id) === type || `func_${f.id || f._id}` === type)) {
    const funcId = type.startsWith('func_') ? type.slice(5) : type;
    const found = functions.find((f: any) => {
      if (!f) return false;
      const fId = f.id || f._id;
      return fId === funcId || fId === type || `func_${fId}` === type;
    });

    // 1. 엔트리 공식 템플릿 지원
    const activeTemplate: string | null =
      found?.template ||
      ((typeof window !== 'undefined' && (window as any).Entry?.block?.[type]?.template)
        ? (window as any).Entry.block[type].template
        : null);

    if (activeTemplate) {
      let result = activeTemplate.replace(/%([0-9]+)/g, (_match: string, num: string) => {
        const idx = parseInt(num, 10) - 1;
        if (idx >= 0 && idx < params.length) {
          return formatParamValue(params[idx], ctx);
        }
        return '';
      });
      result = result.replace(/\s+/g, ' ').trim();
      if (result) return result;
    }

    // 2. 정의가 있는 경우: 라벨과 파라미터를 순서대로 인터리브
    if (found) {
      const fieldBlocks = getFuncDefFieldBlocks(found);
      if (fieldBlocks.length > 0) {
        const parts: string[] = [];
        let callParamIdx = 0;
        for (const field of fieldBlocks) {
          if (field.type === 'function_field_label') {
            const label = field.params?.[0] ? String(field.params[0]).trim() : '';
            if (label) parts.push(label);
          } else {
            const actualParam = callParamIdx < params.length ? params[callParamIdx] : null;
            const isBoolean = field.type === 'function_field_boolean' || field.type === 'function_param_boolean';
            if (isBoolean) {
              const name = actualParam?.params?.[0] ? String(actualParam.params[0]) : '판단';
              parts.push(`<${name}>`);
            } else {
              parts.push(formatParamValue(actualParam, ctx) || '?');
            }
            callParamIdx++;
          }
        }
        const rendered = parts.join(' ').replace(/\s+/g, ' ').trim();
        if (rendered) return rendered;
      }
    }

    // 3. 정의 없는 경우 폴백: 사용자 정의 이름 우선
    const funcName = found ? extractFunctionNameFromDef(found) || found.name || '함수' : '함수';
    const paramParts = params.map((p: any) => {
      const pType = p?.type || '';
      if (pType === 'function_field_boolean' || pType === 'function_param_boolean') {
        const name = p.params?.[0] ? String(p.params[0]) : '판단';
        return `<${name}>`;
      }
      return formatParamValue(p, ctx) || null;
    }).filter(Boolean);
    return paramParts.length > 0 ? `${funcName} ${paramParts.join(' ')}` : funcName;
  }

  // number, text, string, angle 등 값 래퍼 블록
  if (type === 'number' || type === 'text' || type === 'string' || type === 'angle') {
    return params.length > 0 ? formatParamValue(params[0], ctx) : '';
  }

  const template = templates[type];

  if (template) {
    // %1, %2 등의 템플릿 플레이스홀더 치환
    let result = template.replace(/%([0-9]+)/g, (_match: string, num: string) => {
      const idx = parseInt(num, 10) - 1;
      if (idx >= 0 && idx < params.length) {
        return formatParamValue(params[idx], ctx);
      }
      return '';
    });

    // 불필요한 연속 공백 정리
    result = result.replace(/\s+/g, ' ').trim();
    if (result) return result;
  }

  // 템플릿이 없는 경우 기본 폴백: 영문 타입 읽기 쉽게 정돈 및 파라미터 나열
  const cleanType = type
    .replace(/^when_/, '')
    .replace(/_basic$/, '')
    .replace(/_/g, ' ');

  const paramTexts = params
    .map((p: any) => formatParamValue(p, ctx))
    .filter(Boolean)
    .join(' ');

  return paramTexts ? `${cleanType} (${paramTexts})` : cleanType;
}

/**
 * 블록 또는 스크립트에서 실제로 사용/정의된 함수 및 그 함수가 내부에서 참조하는 함수들을
 * 재귀적(전이적, transitive)으로 탐색하여 연관된 함수 목록만 선별(필터링)합니다.
 *
 * @param rootBlockOrScript 검사할 블록 객체 또는 스크립트 배열 (단일 블록, 1차원 스레드, 2차원 다중 스레드 지원)
 * @param allFunctions 프로젝트에 등록된 전체 함수 목록
 * @returns 실제로 참조되는 함수 객체들의 배열 (무관한 함수는 완전 제외)
 */
export function filterFunctionsForBlock(rootBlockOrScript: any, allFunctions: any[]): any[] {
  if (!allFunctions || !Array.isArray(allFunctions) || allFunctions.length === 0) {
    return [];
  }
  if (!rootBlockOrScript) {
    return [];
  }

  // 빠른 조회를 위한 ID 및 이름 매핑 테이블 구축
  const idToFunc = new Map<string, any>();
  const nameToFunc = new Map<string, any>();

  allFunctions.forEach((f) => {
    if (!f) return;
    const fId = f.id || f._id;
    if (fId) idToFunc.set(fId, f);
    const fName = f.name || extractFunctionNameFromDef(f);
    if (fName) nameToFunc.set(fName, f);
  });

  const initialFuncIds = new Set<string>();

  // 블록 트리 순회 및 함수 호출 / 정의 탐색 함수
  const scanNode = (node: any) => {
    if (!node) return;

    if (typeof node === 'string') {
      const trimmed = node.trim();
      if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
        try {
          scanNode(JSON.parse(node));
        } catch { }
      }
      return;
    }

    if (Array.isArray(node)) {
      for (const item of node) {
        scanNode(item);
      }
      return;
    }

    if (typeof node !== 'object') return;

    const type = node.type || node.name || '';
    if (typeof type === 'string') {
      // 1. func_<id> 형태의 함수 호출 블록
      if (type.startsWith('func_')) {
        const fId = type.slice(5);
        if (fId && idToFunc.has(fId)) {
          initialFuncIds.add(fId);
        } else if (allFunctions.length === 1) {
          // 함수가 단 1개 등록된 상태에서 func_ 블록이 발견되면 무조건 매칭
          const singleId = allFunctions[0].id || allFunctions[0]._id;
          if (singleId) initialFuncIds.add(singleId);
        }
      } else if (idToFunc.has(type)) {
        initialFuncIds.add(type);
      }
    }

    // 2. 함수 정의 블록 (def_functions, function_create, function_create_value)
    if (type === 'def_functions' || type === 'function_create' || type === 'function_create_value') {
      if (node.id && idToFunc.has(node.id)) {
        initialFuncIds.add(node.id);
      }
      const defName = extractFunctionNameFromDef(node);
      if (defName && nameToFunc.has(defName)) {
        const matched = nameToFunc.get(defName);
        if (matched?.id) initialFuncIds.add(matched.id);
        else if (matched?._id) initialFuncIds.add(matched._id);
      } else if (allFunctions.length === 1) {
        const singleId = allFunctions[0].id || allFunctions[0]._id;
        if (singleId) initialFuncIds.add(singleId);
      }
    }

    // 3. 노드 ID가 특정 함수의 content 안에 포함되어 있는지 확인
    if (node.id) {
      for (const f of allFunctions) {
        if (!f) continue;
        const cStr = typeof f.content === 'string' ? f.content : JSON.stringify(f.content || '');
        if (cStr.includes(node.id)) {
          const fId = f.id || f._id;
          if (fId) initialFuncIds.add(fId);
        }
      }
    }

    // 파라미터 재귀 탐색
    if (node.params && Array.isArray(node.params)) {
      for (const p of node.params) {
        scanNode(p);
      }
    }

    // 내부 실행 블록(statements) 재귀 탐색
    if (node.statements && Array.isArray(node.statements)) {
      for (const stmt of node.statements) {
        scanNode(stmt);
      }
    }

    // 연결된 다음 블록(next) 재귀 탐색
    if (node.next) {
      scanNode(node.next);
    }
  };

  scanNode(rootBlockOrScript);

  if (initialFuncIds.size === 0) {
    return [];
  }

  // 4. 전이적(Transitive / 재귀적) 의존성 전파: 함수 내부에서 호출하는 하위 함수 탐색
  const visited = new Set<string>();
  const queue: string[] = [];

  for (const id of initialFuncIds) {
    visited.add(id);
    queue.push(id);
  }

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const f = idToFunc.get(currentId);
    if (!f) continue;

    let content = f.content;
    if (typeof content === 'string') {
      try {
        content = JSON.parse(content);
      } catch {
        content = null;
      }
    }

    if (content) {
      const childFuncIds = new Set<string>();

      const scanChild = (node: any) => {
        if (!node) return;
        if (Array.isArray(node)) {
          for (const item of node) scanChild(item);
          return;
        }
        if (typeof node !== 'object') return;

        const type = node.type || node.name || '';
        if (typeof type === 'string') {
          if (type.startsWith('func_')) {
            const fId = type.slice(5);
            if (fId && idToFunc.has(fId)) childFuncIds.add(fId);
          } else if (idToFunc.has(type)) {
            childFuncIds.add(type);
          }
        }

        if (node.params && Array.isArray(node.params)) {
          for (const p of node.params) scanChild(p);
        }
        if (node.statements && Array.isArray(node.statements)) {
          for (const stmt of node.statements) scanChild(stmt);
        }
        if (node.next) {
          scanChild(node.next);
        }
      };

      scanChild(content);

      for (const childId of childFuncIds) {
        if (!visited.has(childId)) {
          visited.add(childId);
          queue.push(childId);
        }
      }
    }
  }

  // 최종적으로 방문된(직접/간접 참조된) 함수들만 반환
  return allFunctions.filter((f) => {
    if (!f) return false;
    const fId = f.id || f._id;
    return fId && visited.has(fId);
  });
}

