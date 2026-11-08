'use client';

import React, { useState, useRef } from 'react';
import {
  Code2,
  Box,
  Layers,
  Volume2,
  Image as ImageIcon,
  ChevronRight,
  FileCode,
  Music,
  CheckCircle2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Move,
  X,
  ExternalLink,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import {
  colors,
  formatAssetImageUrl,
  getEntryBlockInfo,
  renderBlockTemplate,
  parseBlockSegments,
  formatParamValue,
  dropdownMap,
  extractFunctionNameFromDef,
} from '@entry-hub/shared';

// 호환성 유지용 getBlockColor 래퍼
export function getBlockColor(type: string): { bg: string; border: string; category: string } {
  const info = getEntryBlockInfo(type);
  return {
    bg: info.color,
    border: info.outerLine,
    category: info.categoryName,
  };
}

// 블록 텍스트 포맷터 (엔트리 387개 공식 한국어 템플릿 적용)
export function formatBlockLabel(block: any, functions: any[] = []): string {
  return renderBlockTemplate(block, functions);
}

function InlineParamField({
  param,
  isBooleanSlot,
  depth,
  functions,
  onSelectFunction,
}: {
  param: any;
  isBooleanSlot?: boolean;
  depth: number;
  functions?: any[];
  onSelectFunction?: (funcInfo: { name: string; id?: string; blocks?: any[] }) => void;
}) {
  if (param === null || param === undefined || param === '') {
    return null;
  }

  // number, text, string, angle 등 값 래퍼 객체인 경우 -> 내부 단일 값 바로 추출
  if (
    typeof param === 'object' &&
    param.type &&
    ['number', 'text', 'string', 'angle'].includes(param.type)
  ) {
    const rawVal = param.params && param.params.length > 0 ? param.params[0] : '';
    const formattedVal = formatParamValue(rawVal);
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '1px 8px',
          borderRadius: '12px',
          backgroundColor: '#ffffff',
          color: '#333333',
          fontSize: '11px',
          fontWeight: 700,
          boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.15)',
          margin: '0 2px',
          lineHeight: '16px',
        }}
      >
        {formattedVal}
      </span>
    );
  }

  // 엔트리 서브블록 객체인 경우 (계산 블록, 판단 블록, 변수 블록 등)
  if (typeof param === 'object' && param.type) {
    return <VisualBlock block={param} isInline depth={depth} functions={functions} onSelectFunction={onSelectFunction} />;
  }

  // { type: 'number', params: ['10'] } 등의 래퍼 객체인 경우
  if (typeof param === 'object' && param.params && Array.isArray(param.params)) {
    const val = param.params.map(formatParamValue).join(' ');
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '1px 8px',
          borderRadius: '12px',
          backgroundColor: '#ffffff',
          color: '#333333',
          fontSize: '11px',
          fontWeight: 700,
          boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.15)',
          margin: '0 2px',
          lineHeight: '16px',
        }}
      >
        {val}
      </span>
    );
  }

  const formatted = formatParamValue(param);

  // 드롭다운 또는 연산자 기호(=, ≠, >, <, +, - 등)
  const isOperatorOrDropdown =
    ['=', '≠', '>', '<', '≥', '≤', '+', '-', '×', '÷', '그리고', '또는'].includes(formatted) ||
    Boolean(typeof param === 'string' && dropdownMap[param]) ||
    Boolean(typeof param === 'string' && param === param.toUpperCase() && param.length > 1);

  if (isOperatorOrDropdown) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '2px',
          padding: '1px 6px',
          borderRadius: '4px',
          backgroundColor: 'rgba(0,0,0,0.28)',
          color: '#ffffff',
          fontSize: '11px',
          fontWeight: 700,
          margin: '0 2px',
          lineHeight: '16px',
        }}
      >
        <span>{formatted}</span>
        <span style={{ fontSize: '8px', opacity: 0.8 }}>▼</span>
      </span>
    );
  }

  // 일반 타원형 값 입력창 (O 모양: 숫자, 텍스트)
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '1px 8px',
        borderRadius: '12px',
        backgroundColor: '#ffffff',
        color: '#333333',
        fontSize: '11px',
        fontWeight: 700,
        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.15)',
        margin: '0 2px',
        lineHeight: '16px',
      }}
    >
      {formatted}
    </span>
  );
}

// 시각적 블록 컴포넌트 (엔트리 스켈레톤 디자인: 시작 이벤트 반원 모자, 루프 C형태, 조건 다이아몬드, 값 타원형)
export function VisualBlock({
  block,
  depth = 0,
  isInline = false,
  functions = [],
  onSelectFunction,
}: {
  block: any;
  depth?: number;
  isInline?: boolean;
  functions?: any[];
  onSelectFunction?: (funcInfo: { name: string; id?: string; blocks?: any[] }) => void;
}) {
  if (!block || typeof block !== 'object') return null;

  const type = block.type || 'block';
  const info = getEntryBlockInfo(type);
  const statements = block.statements || [];
  const isFunction = info.isFunction;

  const handleClick = (e: React.MouseEvent) => {
    if (isFunction && onSelectFunction) {
      e.stopPropagation();
      const innerBlocks = statements.flat();
      const funcId = type.startsWith('func_') ? type.slice(5) : (block.id || type);
      onSelectFunction({
        name: formatBlockLabel(block, functions) || type,
        id: funcId,
        blocks: innerBlocks.length > 0 ? innerBlocks : (block.params?.[0]?.blocks || []),
      });
    }
  };

  // 스켈레톤별 형태 스타일 결정
  const isEvent = info.isEvent;
  const isLoop = info.isLoop || statements.length > 0;
  const isBoolean = info.isBoolean;
  const isStringField = info.skeleton === 'basic_string_field';

  let borderRadius = '5px';
  let clipPath = 'none';
  let padding = isInline ? '2px 8px' : '5px 10px';

  if (isEvent) {
    borderRadius = '14px 14px 5px 5px';
    padding = '7px 12px 5px 12px';
  } else if (isBoolean) {
    clipPath = 'polygon(7px 0%, calc(100% - 7px) 0%, 100% 50%, calc(100% - 7px) 100%, 7px 100%, 0% 50%)';
    padding = '3px 12px';
  } else if (isStringField) {
    borderRadius = '16px';
    padding = '2px 8px';
  }

  const segments = parseBlockSegments(block, functions);

  const blockContent = (
    <div
      onClick={handleClick}
      title={isFunction ? '클릭하여 함수 내부 블록 보기' : undefined}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '4px',
        padding,
        backgroundColor: info.color,
        border: `1px solid ${info.outerLine}`,
        borderRadius,
        clipPath,
        color: '#ffffff',
        fontSize: '11px',
        fontWeight: 600,
        boxShadow: isInline ? 'none' : '0 1px 3px rgba(0,0,0,0.18)',
        whiteSpace: 'nowrap',
        cursor: isFunction ? 'pointer' : 'default',
        outline: isFunction ? '1px dashed rgba(255,255,255,0.5)' : 'none',
        verticalAlign: 'middle',
        margin: isInline ? '0 2px' : undefined,
      }}
    >
      {!isInline && !isFunction && (
        <span
          style={{
            fontSize: '9px',
            opacity: 0.9,
            padding: '1px 4px',
            backgroundColor: 'rgba(0,0,0,0.25)',
            borderRadius: '3px',
            marginRight: '2px',
          }}
        >
          {info.categoryName}
        </span>
      )}

      {segments.map((seg, sIdx) => {
        if (seg.type === 'text') {
          return (
            <span key={sIdx} style={{ textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>
              {seg.text}
            </span>
          );
        }
        return (
          <InlineParamField
            key={sIdx}
            param={seg.param}
            isBooleanSlot={isBoolean}
            depth={depth}
            functions={functions}
            onSelectFunction={onSelectFunction}
          />
        );
      })}

      {isFunction && (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            backgroundColor: 'rgba(0,0,0,0.25)',
            color: '#ffffff',
            fontSize: '11px',
            fontStyle: 'italic',
            fontWeight: 700,
            fontFamily: 'serif',
            marginLeft: '4px',
            lineHeight: 1,
            userSelect: 'none',
          }}
          title="함수 블록"
        >
          f
        </span>
      )}
    </div>
  );

  if (isInline) {
    return blockContent;
  }

  return (
    <div style={{ marginLeft: `${depth * 10}px`, marginBottom: isLoop ? '5px' : '2px' }}>
      {blockContent}

      {/* 내부 중첩 루프/흐름 블록 (statements: C형태 팔 구현) */}
      {statements.length > 0 && (
        <div
          style={{
            borderLeft: `4px solid ${info.color}`,
            marginLeft: '14px',
            paddingLeft: '10px',
            marginTop: '3px',
            marginBottom: '3px',
          }}
        >
          {statements.map((stmt: any, sIdx: number) => {
            const blocks = Array.isArray(stmt) ? stmt : [stmt];
            return (
              <div key={sIdx} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {blocks.map((subB: any, bIdx: number) => (
                  <VisualBlock
                    key={bIdx}
                    block={subB}
                    depth={depth + 1}
                    functions={functions}
                    onSelectFunction={onSelectFunction}
                  />
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ========================================================
// 마우스 Pan 드래그 및 줌 지원 스크립트 뷰어
// ========================================================
export function VisualScriptViewer({
  scripts,
  functions = [],
  title = '블록 코드',
}: {
  scripts: any;
  functions?: any[];
  title?: string;
}) {
  let parsedScripts: any[] = [];

  if (typeof scripts === 'string') {
    try {
      parsedScripts = JSON.parse(scripts);
    } catch {
      parsedScripts = [];
    }
  } else if (Array.isArray(scripts)) {
    parsedScripts = scripts;
  } else if (scripts && typeof scripts === 'object') {
    parsedScripts = [scripts];
  }

  // Pan & Zoom 상태
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const hasMovedRef = useRef(false);

  // 함수 클릭 모달/패널 상태
  const [selectedFunc, setSelectedFunc] = useState<{
    name: string;
    id?: string;
    blocks?: any[];
  } | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    // 마우스 왼쪽 버튼 클릭 시 드래그 시작
    if (e.button !== 0) return;
    setIsDragging(true);
    hasMovedRef.current = false;
    dragStartRef.current = {
      x: e.clientX - pan.x,
      y: e.clientY - pan.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const nextX = e.clientX - dragStartRef.current.x;
    const nextY = e.clientY - dragStartRef.current.y;
    if (Math.abs(nextX - pan.x) > 3 || Math.abs(nextY - pan.y) > 3) {
      hasMovedRef.current = true;
    }
    setPan({ x: nextX, y: nextY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const resetView = () => {
    setPan({ x: 0, y: 0 });
    setZoom(1);
  };

  const handleFunctionSelect = (funcInfo: { name: string; id?: string; blocks?: any[] }) => {
    // 드래그 중 실수로 클릭된 경우 무시
    if (hasMovedRef.current) return;

    // 함수 정의 DB 매칭 시도
    let matchingBlocks = funcInfo.blocks || [];
    if ((!matchingBlocks || matchingBlocks.length === 0) && functions.length > 0) {
      const found = functions.find((f) => {
        if (!f) return false;
        const fName = extractFunctionNameFromDef(f) || f.name || '';
        return (
          f.id === funcInfo.id ||
          `func_${f.id}` === funcInfo.id ||
          fName === funcInfo.name ||
          (funcInfo.name && fName && funcInfo.name.includes(fName)) ||
          (funcInfo.id && f.id && (funcInfo.id.includes(f.id) || f.id.includes(funcInfo.id)))
        );
      });

      if (found) {
        let rawContent: any = found.content;
        if (typeof rawContent === 'string') {
          try {
            rawContent = JSON.parse(rawContent);
          } catch {
            rawContent = [];
          }
        }
        if (Array.isArray(rawContent)) {
          // Entry 함수 정의 구조: [[ { type: 'function_create' | 'function_create_value', statements: [ [...] ] } ]]
          const firstThread = Array.isArray(rawContent[0]) ? rawContent[0] : rawContent;
          const rootBlock = firstThread?.[0];
          if (
            rootBlock &&
            (rootBlock.type === 'function_create' || rootBlock.type === 'function_create_value' || rootBlock.type === 'def_functions') &&
            Array.isArray(rootBlock.statements) &&
            rootBlock.statements.length > 0
          ) {
            matchingBlocks = rootBlock.statements.flat();
          } else {
            matchingBlocks = firstThread;
          }
        }
      }
    }

    setSelectedFunc({
      ...funcInfo,
      blocks: matchingBlocks,
    });
  };

  if (!parsedScripts || parsedScripts.length === 0) {
    return (
      <div
        style={{
          padding: '32px',
          textAlign: 'center',
          color: colors.mute,
          fontSize: '13px',
          backgroundColor: colors.canvasSoft2,
          borderRadius: '8px',
        }}
      >
        이 오브젝트에는 작성된 블록 코드가 없습니다.
      </div>
    );
  }

  const viewerContent = (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: isFullscreen ? '100%' : '360px' }}>
      {/* 조작 툴바 (줌 & Pan 컨트롤) */}
      <div
        style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          zIndex: 20,
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          backgroundColor: 'rgba(20, 20, 20, 0.85)',
          backdropFilter: 'blur(6px)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: '6px',
          padding: '4px 6px',
        }}
      >
        <span
          style={{
            fontSize: '11px',
            color: '#aaa',
            marginRight: '6px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <Move size={12} /> 드래그로 이동
        </span>
        <button
          type="button"
          onClick={() => setZoom((z) => Math.min(z + 0.15, 2.0))}
          title="확대"
          style={{
            background: 'none',
            border: 'none',
            color: '#eee',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <ZoomIn size={14} />
        </button>
        <span style={{ fontSize: '11px', color: '#eee', minWidth: '34px', textAlign: 'center' }}>
          {Math.round(zoom * 100)}%
        </span>
        <button
          type="button"
          onClick={() => setZoom((z) => Math.max(z - 0.15, 0.5))}
          title="축소"
          style={{
            background: 'none',
            border: 'none',
            color: '#eee',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <ZoomOut size={14} />
        </button>
        <button
          type="button"
          onClick={resetView}
          title="원위치로 복귀"
          style={{
            background: 'none',
            border: 'none',
            color: '#eee',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            marginLeft: '2px',
          }}
        >
          <RotateCcw size={13} />
        </button>
        <button
          type="button"
          onClick={() => setIsFullscreen(!isFullscreen)}
          title={isFullscreen ? '전체화면 종료' : '전체화면으로 보기'}
          style={{
            background: 'none',
            border: 'none',
            color: '#eee',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            marginLeft: '2px',
          }}
        >
          {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
        </button>
      </div>

      {/* 함수 블록 클릭 시 옆에 뜨는 네모 팝업/패널 */}
      {selectedFunc && (
        <div
          style={{
            position: 'absolute',
            top: '12px',
            left: '12px',
            width: '320px',
            maxHeight: '85%',
            backgroundColor: '#232326',
            border: '1px solid #8f2d56',
            borderRadius: '8px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            zIndex: 30,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '10px 12px',
              backgroundColor: '#8f2d56',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700 }}>
              <span>함수 정의:</span>
              <span style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selectedFunc.name}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedFunc(null)}
              style={{
                background: 'none',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <X size={15} />
            </button>
          </div>

          <div style={{ padding: '12px', overflowY: 'auto', flex: 1, backgroundColor: '#18181b' }}>
            {selectedFunc.blocks && selectedFunc.blocks.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {selectedFunc.blocks.map((b: any, i: number) => {
                  const bObj = Array.isArray(b) ? b[0] : b;
                  return (
                    <VisualBlock
                      key={i}
                      block={bObj}
                      functions={functions}
                      onSelectFunction={handleFunctionSelect}
                    />
                  );
                })}
              </div>
            ) : (
              <div style={{ fontSize: '12px', color: '#999', textAlign: 'center', padding: '18px 0' }}>
                이 함수의 내부 블록 정보가 포함되어 있지 않습니다.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 마우스 드래그 가능한 메인 캔버스 */}
      <div
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          width: '100%',
          height: isFullscreen ? 'calc(100vh - 120px)' : '460px',
          maxHeight: isFullscreen ? 'none' : '520px',
          overflow: 'hidden',
          backgroundColor: '#1a1a1c',
          borderRadius: '8px',
          cursor: isDragging ? 'grabbing' : 'grab',
          position: 'relative',
          userSelect: 'none',
        }}
      >
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
            transition: isDragging ? 'none' : 'transform 0.08s ease-out',
            padding: '24px',
            display: 'inline-flex',
            flexDirection: 'column',
            gap: '20px',
            minWidth: '100%',
          }}
        >
          {parsedScripts.map((thread: any, tIdx: number) => {
            const blocks = Array.isArray(thread) ? thread : thread?.blocks || [thread];
            return (
              <div
                key={tIdx}
                style={{
                  padding: '14px',
                  backgroundColor: '#262629',
                  borderRadius: '8px',
                  border: '1px solid #38383c',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                  minWidth: '220px',
                }}
              >
                <div style={{ fontSize: '11px', color: '#888', marginBottom: '8px', fontWeight: 600 }}>
                  스레드 #{tIdx + 1}
                </div>
                {blocks.map((block: any, bIdx: number) => (
                  <VisualBlock
                    key={bIdx}
                    block={block}
                    functions={functions}
                    onSelectFunction={handleFunctionSelect}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  if (isFullscreen) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(4px)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
        }}
        onClick={() => setIsFullscreen(false)}
      >
        <div
          style={{
            width: '92vw',
            maxWidth: '1280px',
            height: '88vh',
            backgroundColor: '#18181b',
            borderRadius: '12px',
            border: '1px solid #333',
            boxShadow: '0 20px 50px rgba(0,0,0,0.7)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            style={{
              padding: '12px 18px',
              borderBottom: '1px solid #2a2a2a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#202023',
              color: '#ffffff',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 700 }}>
              <Code2 size={16} color="#0090f0" />
              <span>{title} (전체화면 뷰)</span>
            </div>
            <button
              type="button"
              onClick={() => setIsFullscreen(false)}
              style={{
                background: 'none',
                border: 'none',
                color: '#aaa',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
              }}
              title="닫기"
            >
              <X size={18} />
            </button>
          </div>

          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            {viewerContent}
          </div>
        </div>
      </div>
    );
  }

  return viewerContent;
}

// ========================================================
// 메인 엔트리 에셋 인스펙터 컴포넌트
// ========================================================
export function EntryAssetViewer({
  type,
  data,
  rawJsonMode = false,
}: {
  type: 'CODE' | 'OBJECT' | 'SCENE';
  data: any;
  rawJsonMode?: boolean;
}) {
  const [selectedSceneIndex, setSelectedSceneIndex] = useState(0);
  const [selectedObjectIndex, setSelectedObjectIndex] = useState(0);
  const [objectDetailTab, setObjectDetailTab] = useState<'PICTURES' | 'SOUNDS' | 'SCRIPTS'>('PICTURES');
  const [showRawJson, setShowRawJson] = useState(rawJsonMode);

  if (!data) {
    return <div style={{ color: colors.mute, fontSize: '13px' }}>에셋 데이터가 비어 있습니다.</div>;
  }

  // 1. 단일 블록 코드 에셋
  if (type === 'CODE') {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: colors.ink, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Code2 size={16} color={colors.primary} />
            <span>블록 코드 시각화</span>
          </h4>
          <button
            type="button"
            onClick={() => setShowRawJson(!showRawJson)}
            style={{
              background: 'none',
              border: `1px solid ${colors.hairlineStrong}`,
              borderRadius: '6px',
              padding: '4px 8px',
              fontSize: '11px',
              color: colors.body,
              cursor: 'pointer',
            }}
          >
            {showRawJson ? '시각화 보기' : 'JSON 원본 보기'}
          </button>
        </div>

        {showRawJson ? (
          <pre style={{ backgroundColor: '#111', color: '#eee', padding: '16px', borderRadius: '8px', fontSize: '12px', overflow: 'auto', maxHeight: '420px' }}>
            {JSON.stringify(data, null, 2)}
          </pre>
        ) : (
          <VisualScriptViewer
            scripts={data?.block ? [data.block] : (Array.isArray(data) ? data : [data])}
            functions={data?.functions || []}
          />
        )}
      </div>
    );
  }

  // 2. 단일 오브젝트 에셋 (스프라이트, 모양, 소리, 스크립트)
  if (type === 'OBJECT') {
    const pictures: any[] = data.pictures || data.sprite?.pictures || [];
    const sounds: any[] = data.sounds || data.sprite?.sounds || [];
    const scripts = data.script || data.scripts || [];
    const functions = data.functions || data.sprite?.functions || [];

    return (
      <div>
        {/* 탭 네비게이션 & 원본 토글 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setObjectDetailTab('PICTURES')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: objectDetailTab === 'PICTURES' ? colors.primary : colors.canvasSoft2,
                color: objectDetailTab === 'PICTURES' ? colors.onPrimary : colors.ink,
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <ImageIcon size={14} />
              <span>모양 ({pictures.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setObjectDetailTab('SOUNDS')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: objectDetailTab === 'SOUNDS' ? colors.primary : colors.canvasSoft2,
                color: objectDetailTab === 'SOUNDS' ? colors.onPrimary : colors.ink,
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Volume2 size={14} />
              <span>소리 ({sounds.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setObjectDetailTab('SCRIPTS')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: objectDetailTab === 'SCRIPTS' ? colors.primary : colors.canvasSoft2,
                color: objectDetailTab === 'SCRIPTS' ? colors.onPrimary : colors.ink,
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Code2 size={14} />
              <span>블록 코드</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowRawJson(!showRawJson)}
            style={{
              background: 'none',
              border: `1px solid ${colors.hairlineStrong}`,
              borderRadius: '6px',
              padding: '4px 8px',
              fontSize: '11px',
              color: colors.body,
              cursor: 'pointer',
            }}
          >
            {showRawJson ? '시각화 보기' : 'JSON 원본 보기'}
          </button>
        </div>

        {showRawJson ? (
          <pre style={{ backgroundColor: '#111', color: '#eee', padding: '16px', borderRadius: '8px', fontSize: '12px', overflow: 'auto', maxHeight: '420px' }}>
            {JSON.stringify(data, null, 2)}
          </pre>
        ) : objectDetailTab === 'PICTURES' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '12px' }}>
            {pictures.map((pic: any, idx: number) => {
              // pic 객체 자체를 formatAssetImageUrl에 넘겨 filename 및 fileurl 모두 지원
              const imgUrl = formatAssetImageUrl(pic);
              return (
                <div
                  key={idx}
                  style={{
                    border: `1px solid ${colors.hairline}`,
                    borderRadius: '8px',
                    padding: '10px',
                    backgroundColor: colors.canvas,
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      height: '90px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: colors.canvasSoft2,
                      borderRadius: '6px',
                      marginBottom: '8px',
                      overflow: 'hidden',
                    }}
                  >
                    {imgUrl ? (
                      <img
                        src={imgUrl}
                        alt={pic.name || `모양 ${idx + 1}`}
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          const target = e.currentTarget;
                          if (!target.dataset.triedFallback) {
                            target.dataset.triedFallback = 'true';
                            const fallbackUrl = formatAssetImageUrl(pic, { thumb: true });
                            if (fallbackUrl && fallbackUrl !== target.src) {
                              target.src = fallbackUrl;
                              return;
                            }
                          }
                          target.onerror = null;
                          target.src = 'https://playentry.org/lib/entry-js/images/media/entrybot1.svg';
                        }}
                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                      />
                    ) : (
                      <ImageIcon size={24} color={colors.mute} />
                    )}
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: colors.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {pic.name || `모양 ${idx + 1}`}
                  </div>
                  {pic.dimension && (
                    <div style={{ fontSize: '10px', color: colors.mute, marginTop: '2px' }}>
                      {pic.dimension.width} × {pic.dimension.height}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : objectDetailTab === 'SOUNDS' ? (
          sounds.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: colors.mute, fontSize: '13px' }}>포함된 소리가 없습니다.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {sounds.map((snd: any, sIdx: number) => (
                <div
                  key={sIdx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: `1px solid ${colors.hairline}`,
                    backgroundColor: colors.canvas,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: colors.canvasSoft2, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.primary }}>
                      <Music size={16} />
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: colors.ink }}>{snd.name || `소리 ${sIdx + 1}`}</div>
                      <div style={{ fontSize: '11px', color: colors.mute }}>재생 시간: {snd.duration ? `${Number(snd.duration).toFixed(1)}초` : '길이 미상'}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          <VisualScriptViewer scripts={scripts} functions={functions} />
        )}
      </div>
    );
  }

  // 3. 복합 장면 에셋 (다중 장면 및 다중 오브젝트 포함)
  const sceneList = data.scenes || [data];
  const currentScene = sceneList[selectedSceneIndex] || sceneList[0] || {};
  const objects: any[] = currentScene.objects || data.objects || [];
  const selectedObject = objects[selectedObjectIndex] || objects[0] || {};
  const currentPictures: any[] = selectedObject.pictures || [];
  const currentSounds: any[] = selectedObject.sounds || [];
  const currentScripts = selectedObject.script || selectedObject.scripts || [];
  const sceneFunctions = data.functions || currentScene.functions || [];

  return (
    <div>
      {/* 상단 컨트롤: 장면 선택 (다중 장면일 경우) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Layers size={16} color={colors.primary} />
          <span style={{ fontSize: '13px', fontWeight: 600, color: colors.ink }}>
            장면: {currentScene.name || `장면 ${selectedSceneIndex + 1}`}
          </span>
          {sceneList.length > 1 && (
            <div style={{ display: 'flex', gap: '4px', marginLeft: '8px' }}>
              {sceneList.map((sc: any, idx: number) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setSelectedSceneIndex(idx);
                    setSelectedObjectIndex(0);
                  }}
                  style={{
                    padding: '3px 8px',
                    borderRadius: '4px',
                    border: `1px solid ${idx === selectedSceneIndex ? colors.primary : colors.hairline}`,
                    backgroundColor: idx === selectedSceneIndex ? colors.canvasSoft2 : colors.canvas,
                    fontSize: '11px',
                    color: colors.ink,
                    cursor: 'pointer',
                  }}
                >
                  {sc.name || `장면 ${idx + 1}`}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowRawJson(!showRawJson)}
          style={{
            background: 'none',
            border: `1px solid ${colors.hairlineStrong}`,
            borderRadius: '6px',
            padding: '4px 8px',
            fontSize: '11px',
            color: colors.body,
            cursor: 'pointer',
          }}
        >
          {showRawJson ? '시각화 보기' : 'JSON 원본 보기'}
        </button>
      </div>

      {showRawJson ? (
        <pre style={{ backgroundColor: '#111', color: '#eee', padding: '16px', borderRadius: '8px', fontSize: '12px', overflow: 'auto', maxHeight: '420px' }}>
          {JSON.stringify(data, null, 2)}
        </pre>
      ) : (
        /* 3단 분할 레이아웃: [오브젝트 목록] [모양 & 소리] [블록 코드] */
        <div style={{ display: 'grid', gridTemplateColumns: '220px 240px 1fr', gap: '14px', minHeight: '380px' }}>
          {/* 1열: 장면 내 오브젝트 목록 */}
          <div
            style={{
              backgroundColor: colors.canvasSoft2,
              borderRadius: '8px',
              padding: '10px',
              border: `1px solid ${colors.hairline}`,
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              maxHeight: '480px',
              overflowY: 'auto',
            }}
          >
            <div style={{ fontSize: '12px', fontWeight: 700, color: colors.ink, padding: '4px 6px', marginBottom: '4px' }}>
              오브젝트 목록 ({objects.length})
            </div>
            {objects.map((obj: any, idx: number) => {
              const isSelected = idx === selectedObjectIndex;
              const mainPic = obj.selectedPicture || obj.pictures?.[0];
              const imgUrl = formatAssetImageUrl(mainPic);

              return (
                <div
                  key={idx}
                  onClick={() => setSelectedObjectIndex(idx)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px',
                    borderRadius: '6px',
                    backgroundColor: isSelected ? colors.canvas : 'transparent',
                    border: `1px solid ${isSelected ? colors.primary : 'transparent'}`,
                    cursor: 'pointer',
                    boxShadow: isSelected ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                  }}
                >
                  <div style={{ width: '32px', height: '32px', borderRadius: '4px', backgroundColor: colors.canvasSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {imgUrl ? (
                      <img
                        src={imgUrl}
                        alt={obj.name}
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = 'https://playentry.org/lib/entry-js/images/media/entrybot1.svg';
                        }}
                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                      />
                    ) : (
                      <Box size={16} color={colors.mute} />
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: colors.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {obj.name || `오브젝트 ${idx + 1}`}
                    </div>
                    <div style={{ fontSize: '10px', color: colors.mute }}>
                      모양 {obj.pictures?.length || 0} · 소리 {obj.sounds?.length || 0}
                    </div>
                  </div>
                  {isSelected && <ChevronRight size={14} color={colors.primary} />}
                </div>
              );
            })}
          </div>

          {/* 2열: 선택된 오브젝트의 모양 & 소리 목록 */}
          <div
            style={{
              backgroundColor: colors.canvas,
              borderRadius: '8px',
              padding: '12px',
              border: `1px solid ${colors.hairline}`,
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              maxHeight: '480px',
              overflowY: 'auto',
            }}
          >
            {/* 모양 목록 */}
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: colors.ink, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <ImageIcon size={13} color="#0070f3" />
                <span>모양 ({currentPictures.length})</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                {currentPictures.map((pic: any, pIdx: number) => {
                  const pUrl = formatAssetImageUrl(pic);
                  return (
                    <div key={pIdx} style={{ border: `1px solid ${colors.hairline}`, borderRadius: '6px', padding: '6px', textAlign: 'center', backgroundColor: colors.canvasSoft2 }}>
                      <div style={{ height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '4px', overflow: 'hidden' }}>
                        {pUrl ? (
                          <img
                            src={pUrl}
                            alt={pic.name}
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.src = 'https://playentry.org/lib/entry-js/images/media/entrybot1.svg';
                            }}
                            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                          />
                        ) : (
                          <ImageIcon size={16} color={colors.mute} />
                        )}
                      </div>
                      <div style={{ fontSize: '10px', fontWeight: 600, color: colors.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {pic.name}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 소리 목록 */}
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: colors.ink, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Volume2 size={13} color="#a25b15" />
                <span>소리 ({currentSounds.length})</span>
              </div>
              {currentSounds.length === 0 ? (
                <div style={{ fontSize: '11px', color: colors.mute }}>소리 없음</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {currentSounds.map((snd: any, sIdx: number) => (
                    <div key={sIdx} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px', borderRadius: '4px', backgroundColor: colors.canvasSoft2, fontSize: '11px', color: colors.ink }}>
                      <Music size={12} color={colors.primary} />
                      <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{snd.name}</span>
                      <span style={{ fontSize: '10px', color: colors.mute }}>{snd.duration ? `${Number(snd.duration).toFixed(1)}s` : ''}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 3열: 선택된 오브젝트의 블록 코드 (VisualBlock 뷰어) */}
          <div
            style={{
              backgroundColor: colors.canvas,
              borderRadius: '8px',
              padding: '12px',
              border: `1px solid ${colors.hairline}`,
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '480px',
              overflow: 'hidden',
            }}
          >
            <div style={{ fontSize: '12px', fontWeight: 700, color: colors.ink, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Code2 size={14} color="#0090f0" />
              <span>{selectedObject?.name || '오브젝트'}의 블록 코드</span>
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              <VisualScriptViewer scripts={currentScripts} functions={sceneFunctions} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
