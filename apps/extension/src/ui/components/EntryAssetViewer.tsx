import React, { useState, useRef } from 'react';
import {
  Code2,
  Box,
  Layers,
  Volume2,
  Image as ImageIcon,
  ChevronRight,
  Music,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Move,
  X,
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
  ParsedTemplateSegment,
  dropdownMap,
  extractFunctionNameFromDef,
} from '@entry-hub/shared';

export function getBlockColor(type: string): { bg: string; border: string; category: string } {
  const info = getEntryBlockInfo(type);
  return {
    bg: info.color,
    border: info.outerLine,
    category: info.categoryName,
  };
}

export function formatBlockLabel(block: any, functions: any[] = []): string {
  return renderBlockTemplate(block, functions);
}

function InlineParamField({
  param,
  isBooleanSlot,
  depth,
  functions,
  onSelectFunction,
  ctx,
}: {
  param: any;
  isBooleanSlot?: boolean;
  depth: number;
  functions?: any[];
  onSelectFunction?: (funcInfo: { name: string; id?: string; blocks?: any[] }) => void;
  ctx?: { pictures?: any[]; sounds?: any[] };
}) {
  if (param === null || param === undefined || param === '') {
    return null;
  }

  // function_field_boolean / function_param_boolean 또는 _isBooleanParam 플래그
  // -> 판단값 슬롯: 육각형 모양으로 <이름> 표시
  if (
    typeof param === 'object' &&
    (param._isBooleanParam ||
      param.type === 'function_field_boolean' ||
      param.type === 'function_param_boolean')
  ) {
    const name = param.params?.[0] ? String(param.params[0]) : '판단';
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '2px 10px',
          clipPath: 'polygon(6px 0%, calc(100% - 6px) 0%, 100% 50%, calc(100% - 6px) 100%, 6px 100%, 0% 50%)',
          backgroundColor: '#4562f5',
          color: '#ffffff',
          fontSize: '11px',
          fontWeight: 700,
          margin: '0 2px',
          lineHeight: '16px',
        }}
      >
        {name}
      </span>
    );
  }

  // get_pictures / get_sounds 블록: ID -> 이름 텍스트 뱃지로 표시
  if (
    typeof param === 'object' &&
    (param.type === 'get_pictures' || param.type === 'get_sounds')
  ) {
    const isShape = param.type === 'get_pictures';
    const resourceId = param.params?.[0];
    let label = resourceId ? String(resourceId) : (isShape ? '모양' : '소리');
    if (resourceId && ctx) {
      const list = isShape ? ctx.pictures : ctx.sounds;
      if (list) {
        const found = list.find((r: any) => (r.id || r.id_) === resourceId);
        if (found) label = found.name || found.name_ || label;
      }
    }
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
        {label}
      </span>
    );
  }

  // number, text, string, angle 등 값 래퍼 객체인 경우 -> 내부 단일 값 바로 추출
  if (
    typeof param === 'object' &&
    param.type &&
    ['number', 'text', 'string', 'angle'].includes(param.type)
  ) {
    const rawVal = param.params && param.params.length > 0 ? param.params[0] : '';
    const formattedVal = formatParamValue(rawVal, ctx);
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
    return <VisualBlock block={param} isInline depth={depth} functions={functions} onSelectFunction={onSelectFunction} ctx={ctx} />;
  }

  // { type: 'number', params: ['10'] } 등의 래퍼 객체인 경우
  if (typeof param === 'object' && param.params && Array.isArray(param.params)) {
    const val = param.params.map((p: any) => formatParamValue(p, ctx)).join(' ');
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

export function VisualBlock({
  block,
  depth = 0,
  isInline = false,
  functions = [],
  onSelectFunction,
  ctx,
}: {
  block: any;
  depth?: number;
  isInline?: boolean;
  functions?: any[];
  onSelectFunction?: (funcInfo: { name: string; id?: string; blocks?: any[] }) => void;
  ctx?: { pictures?: any[]; sounds?: any[] };
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

  const segments = parseBlockSegments(block, functions, ctx);

  const blockContent = (
    <div
      onClick={handleClick}
      title={isFunction ? '클릭하여 함수 내부 보기' : undefined}
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
            ctx={ctx}
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

      {statements.length > 0 && (
        <div style={{ borderLeft: `2px solid ${info.color}`, marginLeft: '8px', paddingLeft: '6px', marginTop: '2px' }}>
          {statements.map((stmt: any, sIdx: number) => {
            const blocks = Array.isArray(stmt) ? stmt : [stmt];
            return (
              <div key={sIdx}>
                {blocks.map((subB: any, bIdx: number) => (
                  <VisualBlock
                    key={bIdx}
                    block={subB}
                    depth={depth + 1}
                    functions={functions}
                    onSelectFunction={onSelectFunction}
                    ctx={ctx}
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

export function VisualScriptViewer({
  scripts,
  functions = [],
  title = '블록 코드',
  pictures = [],
  sounds = [],
}: {
  scripts: any;
  functions?: any[];
  title?: string;
  pictures?: any[];
  sounds?: any[];
}) {
  const ctx = { pictures, sounds };
  let parsed: any[] = [];
  if (typeof scripts === 'string') {
    try { parsed = JSON.parse(scripts); } catch { parsed = []; }
  } else if (Array.isArray(scripts)) {
    parsed = scripts;
  } else if (scripts && typeof scripts === 'object') {
    parsed = [scripts];
  }

  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const hasMovedRef = useRef(false);

  const [selectedFunc, setSelectedFunc] = useState<{
    name: string;
    id?: string;
    blocks?: any[];
  } | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
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

  const handleFunctionSelect = (funcInfo: { name: string; id?: string; blocks?: any[] }) => {
    if (hasMovedRef.current) return;
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
    setSelectedFunc({ ...funcInfo, blocks: matchingBlocks });
  };

  if (!parsed || parsed.length === 0) {
    return <div style={{ padding: '16px', textAlign: 'center', color: colors.mute, fontSize: '11px' }}>코드 없음</div>;
  }

  const viewerContent = (
    <div style={{ position: 'relative', width: '100%', height: isFullscreen ? '100%' : 'auto' }}>
      {/* 줌/팬 미니 툴바 */}
      <div
        style={{
          position: 'absolute',
          top: '6px',
          right: '6px',
          zIndex: 15,
          display: 'flex',
          alignItems: 'center',
          gap: '2px',
          backgroundColor: 'rgba(20, 20, 20, 0.85)',
          borderRadius: '4px',
          padding: '2px 4px',
        }}
      >
        <button
          type="button"
          onClick={() => setZoom((z) => Math.min(z + 0.15, 2.0))}
          style={{ background: 'none', border: 'none', color: '#eee', cursor: 'pointer', padding: '2px' }}
          title="확대"
        >
          <ZoomIn size={12} />
        </button>
        <span style={{ fontSize: '9px', color: '#eee', minWidth: '28px', textAlign: 'center' }}>
          {Math.round(zoom * 100)}%
        </span>
        <button
          type="button"
          onClick={() => setZoom((z) => Math.max(z - 0.15, 0.5))}
          style={{ background: 'none', border: 'none', color: '#eee', cursor: 'pointer', padding: '2px' }}
          title="축소"
        >
          <ZoomOut size={12} />
        </button>
        <button
          type="button"
          onClick={() => { setPan({ x: 0, y: 0 }); setZoom(1); }}
          style={{ background: 'none', border: 'none', color: '#eee', cursor: 'pointer', padding: '2px' }}
          title="위치 및 줌 초기화"
        >
          <RotateCcw size={11} />
        </button>
        <button
          type="button"
          onClick={() => setIsFullscreen((prev) => !prev)}
          style={{ background: 'none', border: 'none', color: '#eee', cursor: 'pointer', padding: '2px', marginLeft: '2px' }}
          title={isFullscreen ? '창 닫기' : '전체화면으로 크게 보기'}
        >
          {isFullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
        </button>
      </div>

      {/* 함수 팝업 박스 */}
      {selectedFunc && (
        <div
          style={{
            position: 'absolute',
            top: '6px',
            left: '6px',
            width: '240px',
            maxHeight: '90%',
            backgroundColor: '#232326',
            border: '1px solid #8f2d56',
            borderRadius: '6px',
            zIndex: 25,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
          }}
        >
          <div style={{ padding: '6px 8px', backgroundColor: '#8f2d56', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', fontWeight: 700 }}>
            <span style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              함수: {selectedFunc.name}
            </span>
            <button
              type="button"
              onClick={() => setSelectedFunc(null)}
              style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}
            >
              <X size={13} />
            </button>
          </div>
          <div style={{ padding: '8px', overflowY: 'auto', flex: 1, backgroundColor: '#18181b' }}>
            {selectedFunc.blocks && selectedFunc.blocks.length > 0 ? (
              selectedFunc.blocks.map((b: any, idx: number) => {
                const bObj = Array.isArray(b) ? b[0] : b;
                return (
                  <VisualBlock
                    key={idx}
                    block={bObj}
                    functions={functions}
                    onSelectFunction={handleFunctionSelect}
                    ctx={ctx}
                  />
                );
              })
            ) : (
              <div style={{ fontSize: '10px', color: '#888', textAlign: 'center', padding: '10px 0' }}>
                함수 내부 블록 없음
              </div>
            )}
          </div>
        </div>
      )}

      {/* 메인 스크립트 캔버스 */}
      <div
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          height: isFullscreen ? 'calc(100vh - 100px)' : 'auto',
          maxHeight: isFullscreen ? 'none' : '260px',
          minHeight: isFullscreen ? '400px' : '80px',
          overflow: 'hidden',
          backgroundColor: '#1e1e1e',
          borderRadius: '6px',
          cursor: isDragging ? 'grabbing' : 'grab',
          userSelect: 'none',
          position: 'relative',
        }}
      >
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
            transition: isDragging ? 'none' : 'transform 0.08s ease-out',
            padding: '12px',
            display: 'inline-flex',
            flexDirection: 'column',
            gap: '10px',
            minWidth: '100%',
          }}
        >
          {parsed.map((thread: any, tIdx: number) => {
            const blocks = Array.isArray(thread) ? thread : thread?.blocks || [thread];
            return (
              <div key={tIdx} style={{ padding: '8px 10px', backgroundColor: '#282828', borderRadius: '6px', border: '1px solid #383838' }}>
                <div style={{ fontSize: '9px', color: '#888', marginBottom: '6px', fontWeight: 600 }}>스레드 #{tIdx + 1}</div>
                {blocks.map((block: any, bIdx: number) => (
                  <VisualBlock
                    key={bIdx}
                    block={block}
                    functions={functions}
                    onSelectFunction={handleFunctionSelect}
                    ctx={ctx}
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
          zIndex: 9999999,
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
            maxWidth: '1200px',
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
          {/* 모달 상단 헤더 */}
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

          {/* 내부 뷰어 본문 */}
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            {viewerContent}
          </div>
        </div>
      </div>
    );
  }

  return viewerContent;
}

export function ExtensionAssetViewer({ type, data }: { type: 'CODE' | 'OBJECT' | 'SCENE'; data: any }) {
  const [selectedObjIdx, setSelectedObjIdx] = useState(0);

  if (!data) return <div style={{ fontSize: '12px', color: colors.mute }}>에셋 데이터 없음</div>;

  if (type === 'CODE') {
    const scripts = data?.block ? [data.block] : (Array.isArray(data) ? data : [data]);
    const functions = data?.functions || [];
    const pictures = data?.pictures || data?.sprite?.pictures || [];
    const sounds = data?.sounds || data?.sprite?.sounds || [];
    return <VisualScriptViewer scripts={scripts} functions={functions} pictures={pictures} sounds={sounds} />;
  }

  if (type === 'OBJECT') {
    const pictures = data.pictures || data.sprite?.pictures || [];
    const sounds = data.sounds || data.sprite?.sounds || [];
    const scripts = data.script || data.scripts || [];
    const functions = data.functions || data.sprite?.functions || [];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {/* Costumes Gallery */}
        {pictures.length > 0 && (
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: colors.ink, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <ImageIcon size={12} color="#0070f3" /> 모양 ({pictures.length})
            </div>
            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
              {pictures.map((pic: any, idx: number) => {
                const img = formatAssetImageUrl(pic);
                return (
                  <div key={idx} style={{ flexShrink: 0, width: '64px', border: `1px solid ${colors.hairline}`, borderRadius: '6px', padding: '4px', textAlign: 'center', backgroundColor: colors.canvasSoft2 }}>
                    <div style={{ height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      {img ? (
                        <img
                          src={img}
                          alt={pic.name}
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = 'https://playentry.org/lib/entry-js/images/media/entrybot1.svg';
                          }}
                          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                        />
                      ) : (
                        <ImageIcon size={14} color={colors.mute} />
                      )}
                    </div>
                    <div style={{ fontSize: '9px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: colors.ink }}>{pic.name}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Code Visualizer */}
        <div>
          <div style={{ fontSize: '11px', fontWeight: 700, color: colors.ink, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Code2 size={12} color="#0090f0" /> 블록 코드
          </div>
          <VisualScriptViewer scripts={scripts} functions={functions} pictures={pictures} sounds={sounds} />
        </div>
      </div>
    );
  }

  // SCENE 3단 뷰 (오브젝트 목록 | 모양/소리 | 블록 코드)
  const sceneName = data.sceneName || data.name || '장면 1';
  const objects = data.objects || [];
  const selectedObj = objects[selectedObjIdx] || objects[0] || null;

  const currentPics = selectedObj?.pictures || [];
  const currentSounds = selectedObj?.sounds || [];
  const currentScripts = selectedObj?.script || selectedObj?.scripts || [];
  const sceneFunctions = data.functions || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* Scene Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', borderRadius: '4px', backgroundColor: '#ff0080', color: '#fff', fontSize: '11px', fontWeight: 700, width: 'fit-content' }}>
        <Layers size={12} />
        <span>장면: {sceneName}</span>
      </div>

      {/* 3단 분할 그리드 */}
      <div style={{ display: 'grid', gridTemplateColumns: '110px 110px 1fr', gap: '8px', minHeight: '180px' }}>
        {/* 1단: 오브젝트 목록 */}
        <div style={{ backgroundColor: colors.canvasSoft2, borderRadius: '6px', padding: '6px', overflowY: 'auto', maxHeight: '240px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: colors.ink, marginBottom: '2px' }}>오브젝트 ({objects.length})</div>
          {objects.map((obj: any, idx: number) => {
            const isSel = idx === selectedObjIdx;
            const img = formatAssetImageUrl(obj.selectedPicture || obj.pictures?.[0]);
            return (
              <div
                key={idx}
                onClick={() => setSelectedObjIdx(idx)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px',
                  borderRadius: '4px',
                  backgroundColor: isSel ? colors.canvas : 'transparent',
                  border: `1px solid ${isSel ? colors.primary : 'transparent'}`,
                  cursor: 'pointer',
                }}
              >
                <div style={{ width: '20px', height: '20px', borderRadius: '3px', backgroundColor: colors.canvasSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {img ? (
                    <img
                      src={img}
                      alt={obj.name}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = 'https://playentry.org/lib/entry-js/images/media/entrybot1.svg';
                      }}
                      style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                    />
                  ) : (
                    <Box size={10} color={colors.mute} />
                  )}
                </div>
                <span style={{ fontSize: '10px', fontWeight: 600, color: colors.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                  {obj.name}
                </span>
              </div>
            );
          })}
        </div>

        {/* 2단: 선택된 오브젝트의 모양 & 소리 */}
        <div style={{ backgroundColor: colors.canvas, borderRadius: '6px', padding: '6px', border: `1px solid ${colors.hairline}`, overflowY: 'auto', maxHeight: '240px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: colors.ink, marginBottom: '4px' }}>모양 ({currentPics.length})</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px' }}>
              {currentPics.map((p: any, pIdx: number) => {
                const img = formatAssetImageUrl(p);
                return (
                  <div key={pIdx} style={{ border: `1px solid ${colors.hairline}`, borderRadius: '4px', padding: '2px', textAlign: 'center', backgroundColor: colors.canvasSoft2 }}>
                    <div style={{ height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      {img ? (
                        <img
                          src={img}
                          alt={p.name}
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = 'https://playentry.org/lib/entry-js/images/media/entrybot1.svg';
                          }}
                          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                        />
                      ) : (
                        <ImageIcon size={10} color={colors.mute} />
                      )}
                    </div>
                    <div style={{ fontSize: '8px', color: colors.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: colors.ink, marginBottom: '4px' }}>소리 ({currentSounds.length})</div>
            {currentSounds.map((s: any, sIdx: number) => (
              <div key={sIdx} style={{ fontSize: '9px', color: colors.body, display: 'flex', alignItems: 'center', gap: '3px', padding: '2px 0' }}>
                <Music size={9} color={colors.primary} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 3단: 블록 코드 시각화 */}
        <div style={{ backgroundColor: colors.canvas, borderRadius: '6px', padding: '6px', border: `1px solid ${colors.hairline}`, overflowY: 'auto', maxHeight: '240px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: colors.ink, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Code2 size={11} color="#0090f0" /> {selectedObj?.name} 코드
          </div>
          <VisualScriptViewer scripts={currentScripts} functions={sceneFunctions} pictures={currentPics} sounds={currentSounds} />
        </div>
      </div>
    </div>
  );
}
