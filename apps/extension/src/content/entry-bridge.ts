import {
  ENTRY_HUB_MSG_SOURCE,
  BridgeMessage,
  ExtractAssetPayload,
  InjectAssetPayload,
} from '../protocol';

declare global {
  interface Window {
    Entry?: any;
    __entryHubBridgeInstalled?: boolean;
  }
}

if (!window.__entryHubBridgeInstalled) {
  window.__entryHubBridgeInstalled = true;
  initEntryBridge();
}

// Content Script에 브릿지 준비 완료 알림
window.postMessage({ source: 'ENTRY_HUB_EXTENSION', type: 'BRIDGE_READY' }, '*');

function initEntryBridge() {
  console.log('[Entry-Hub Bridge] Initializing Entry Engine Bridge in Page Context...');

  window.addEventListener('message', async (event: MessageEvent) => {
    // source 체크: event.source는 isolated world 경계에서 다를 수 있으므로 data.source만 확인
    if (!event.data || event.data.source !== ENTRY_HUB_MSG_SOURCE) {
      return;
    }
    // 브릿지가 보낸 응답 메시지는 무시 (무한 루프 방지)
    if (event.data.type && event.data.type.endsWith('_RES')) {
      return;
    }

    const message = event.data as BridgeMessage;

    switch (message.type) {
      case 'CHECK_READY_REQ': {
        const isReady = checkEntryReady();
        sendResponse(message.requestId, 'CHECK_READY_RES', { isReady });
        break;
      }
      case 'EXTRACT_ASSET_REQ': {
        try {
          const type = (message.payload as { type: string }).type;
          const result = await extractAsset(type);
          sendResponse(message.requestId, 'EXTRACT_ASSET_RES', result);
        } catch (err: any) {
          sendError(message.requestId, 'EXTRACT_ASSET_RES', err?.message || '추출에 실패했습니다.');
        }
        break;
      }
      case 'INJECT_ASSET_REQ': {
        try {
          const payload = message.payload as InjectAssetPayload;
          await injectAsset(payload);
          sendResponse(message.requestId, 'INJECT_ASSET_RES', { success: true });
        } catch (err: any) {
          sendError(message.requestId, 'INJECT_ASSET_RES', err?.message || '주입에 실패했습니다.');
        }
        break;
      }
      case 'GET_ENTRY_USER_REQ': {
        try {
          const u = window.Entry?.user || null;
          const userPayload = u ? {
            username: u.username || u.id,
            nickname: u.nickname || u.username,
            id: u.id || u.username,
            _id: u._id,
          } : null;
          sendResponse(message.requestId, 'GET_ENTRY_USER_RES', userPayload);
        } catch (err: any) {
          sendError(message.requestId, 'GET_ENTRY_USER_RES', err?.message || '유저 조회 실패');
        }
        break;
      }
    }
  });

  console.log('[Entry-Hub Bridge] Ready to communicate with Content Script.');
}

function sendResponse<T>(requestId: string, type: any, payload: T) {
  const response: BridgeMessage<T> = {
    source: ENTRY_HUB_MSG_SOURCE,
    requestId,
    type,
    payload,
  };
  window.postMessage(response, '*');
}

function sendError(requestId: string, type: any, error: string) {
  const response: BridgeMessage = {
    source: ENTRY_HUB_MSG_SOURCE,
    requestId,
    type,
    error,
  };
  window.postMessage(response, '*');
}

function checkEntryReady(): boolean {
  const E = window.Entry;
  if (typeof E === 'undefined') {
    return false;
  }
  return !!E.scene && !!E.container;
}

// =========================================================
// 공통 헬퍼 함수 (엔트리 인스턴스/JSON 프로퍼티 호환)
// =========================================================

function toSafeArray(target: any): any[] {
  if (!target) return [];
  if (Array.isArray(target)) return target;
  if (typeof target === 'object') return Object.values(target);
  return [];
}

function getEntityName(entity: any): string | null {
  if (!entity) return null;
  return entity.name || entity.name_ || (typeof entity.getName === 'function' ? entity.getName() : null);
}

function getEntityId(entity: any): string | null {
  if (!entity) return null;
  return entity.id || entity.id_ || null;
}

function getOwnerObjectId(entity: any): string | null {
  if (!entity) return null;
  const owner = entity.object_ !== undefined ? entity.object_ : entity.object;
  if (owner && typeof owner === 'object') {
    return owner.id || owner.id_ || null;
  }
  if (owner) return owner;
  if (entity.objectId) return entity.objectId;
  if (entity.spriteId) return entity.spriteId;
  if (entity.targetObject) {
    if (typeof entity.targetObject === 'object') {
      return entity.targetObject.id || entity.targetObject.id_ || null;
    }
    return entity.targetObject;
  }
  if (entity.targetId) return entity.targetId;
  return null;
}

function generateEntryHash(): string {
  const Entry = window.Entry;
  if (typeof Entry?.generateHash === 'function') {
    return Entry.generateHash();
  }
  return Math.random().toString(36).substring(2, 10);
}

// =========================================================
// 에셋 추출 로직 (Code, Object, Scene) - 모양(pictures), 소리(sounds) 완전 보존
// =========================================================

function getAllLiveObjects(): any[] {
  const Entry = window.Entry;
  if (!Entry?.container) return [];

  if (typeof Entry.container.getAllObjects === 'function') {
    const list = Entry.container.getAllObjects();
    if (Array.isArray(list) && list.length > 0) return list;
  }
  if (Array.isArray(Entry.container.objects_)) {
    return Entry.container.objects_;
  }
  if (Array.isArray(Entry.container.objects)) {
    return Entry.container.objects;
  }
  return [];
}

function serializeEntryObject(liveObj: any): any {
  if (!liveObj) return null;

  // 1. toJSON 호출 시도
  let objJson: any = null;
  if (typeof liveObj.toJSON === 'function') {
    try {
      // isClone=false 로 호출해야 pictures/sounds ID가 그대로 보존됨
      // toJSON(true) 사용 시 Entry.generateHash()로 ID가 새로 생성되어
      // script 내부 블록의 모양/소리 ID와 불일치가 발생함
      objJson = liveObj.toJSON(false);
    } catch (e) {
      console.warn('[Entry-Hub] liveObj.toJSON(false) failed:', e);
    }
  }
  if (!objJson || typeof objJson !== 'object') {
    objJson = {};
  }

  // 2. 기본 메타데이터 동기화
  const id = objJson.id || liveObj.id || liveObj.id_ || generateEntryHash();
  const name = objJson.name || getEntityName(liveObj) || '오브젝트';
  const sceneId =
    objJson.scene ||
    (liveObj.scene && typeof liveObj.scene === 'object' ? liveObj.scene.id : liveObj.scene) ||
    window.Entry?.scene?.selectedScene?.id;

  // 3. 모양(pictures) 완벽 추출 및 보강
  const rawPics: any[] =
    (Array.isArray(objJson.pictures) && objJson.pictures.length > 0 ? objJson.pictures : null) ||
    (Array.isArray(liveObj.pictures_) ? liveObj.pictures_ : null) ||
    (Array.isArray(liveObj.pictures) ? liveObj.pictures : null) ||
    (typeof liveObj.getPictures === 'function' ? liveObj.getPictures() : null) ||
    [];

  const pictures = toSafeArray(rawPics).map((p: any, idx: number) => {
    const pJson = typeof p?.toJSON === 'function' ? p.toJSON() : p;
    let fileurl = (pJson.fileurl || p.fileurl || pJson.imageURL || p.imageURL || '').trim();
    const filename = (pJson.filename || p.filename || `pic_${idx}`).trim();
    const pName = pJson.name || p.name || `모양 ${idx + 1}`;
    const imageType = (pJson.imageType || p.imageType || 'png').replace(/^\./, '');

    // fileurl이 없거나 비정상적일 때 filename으로부터 URL 복원
    if (!fileurl && filename) {
      if (filename.length >= 20) {
        const f1 = filename.substring(0, 2);
        const f2 = filename.substring(2, 4);
        fileurl = `https://playentry.org/uploads/${f1}/${f2}/image/${filename}.${imageType}`;
      } else {
        const hasExt = /\.(png|jpe?g|svg|gif|webp)$/i.test(filename);
        fileurl = hasExt
          ? `https://playentry.org/lib/entry-js/images/media/${filename}`
          : `https://playentry.org/lib/entry-js/images/media/${filename}.png`;
      }
    } else if (fileurl && !fileurl.startsWith('http://') && !fileurl.startsWith('https://') && !fileurl.startsWith('data:')) {
      if (fileurl.startsWith('/')) {
        fileurl = `https://playentry.org${fileurl}`;
      } else if (fileurl.length >= 20 && !fileurl.includes('/')) {
        const f1 = fileurl.substring(0, 2);
        const f2 = fileurl.substring(2, 4);
        fileurl = `https://playentry.org/uploads/${f1}/${f2}/image/${fileurl}.${imageType}`;
      } else {
        fileurl = `https://playentry.org/${fileurl}`;
      }
    }

    return {
      id: pJson.id || p.id || generateEntryHash(),
      name: pName,
      filename,
      imageType,
      fileurl: fileurl || null,
      imageURL: fileurl || null,
      dimension: pJson.dimension || p.dimension || { width: 100, height: 100 },
      scaleX: pJson.scaleX ?? p.scaleX ?? 1,
      scaleY: pJson.scaleY ?? p.scaleY ?? 1,
    };
  });

  // 4. 소리(sounds) 완벽 추출 및 보강
  const rawSounds: any[] =
    (Array.isArray(objJson.sounds) && objJson.sounds.length > 0 ? objJson.sounds : null) ||
    (Array.isArray(liveObj.sounds_) ? liveObj.sounds_ : null) ||
    (Array.isArray(liveObj.sounds) ? liveObj.sounds : null) ||
    (typeof liveObj.getSounds === 'function' ? liveObj.getSounds() : null) ||
    [];

  const sounds = toSafeArray(rawSounds).map((s: any, idx: number) => {
    const sJson = typeof s?.toJSON === 'function' ? s.toJSON() : s;
    let fileurl = sJson.fileurl || s.fileurl;
    const filename = sJson.filename || s.filename || `sound_${idx}`;
    const sName = sJson.name || s.name || `소리 ${idx + 1}`;
    const ext = sJson.ext || s.ext || '.mp3';

    if (!fileurl && filename) {
      const cleanExt = ext.startsWith('.') ? ext : `.${ext}`;
      fileurl = `/lib/entry-js/images/media/${filename}${cleanExt}`;
    }
    if (fileurl && !fileurl.startsWith('http://') && !fileurl.startsWith('https://') && !fileurl.startsWith('data:')) {
      if (fileurl.startsWith('/')) {
        fileurl = `https://playentry.org${fileurl}`;
      } else {
        fileurl = `https://playentry.org/${fileurl}`;
      }
    }

    return {
      id: sJson.id || s.id || generateEntryHash(),
      name: sName,
      filename,
      fileurl: fileurl || null,
      duration: sJson.duration ?? s.duration ?? 0,
      ext,
    };
  });

  // 5. 스크립트(scripts) 추출
  let script = objJson.script;
  if (!script && liveObj.script) {
    script = typeof liveObj.script.toJSON === 'function' ? liveObj.script.toJSON(false) : liveObj.script;
  }

  // 6. selectedPicture 보정
  let selectedPicture = objJson.selectedPicture || liveObj.selectedPicture;
  if (!selectedPicture && pictures.length > 0) {
    selectedPicture = pictures[0];
  } else if (selectedPicture) {
    const matched = pictures.find((p) => p.id === (selectedPicture.id || selectedPicture.id_));
    if (matched) selectedPicture = matched;
  }

  return {
    ...objJson,
    id,
    name,
    scene: sceneId,
    pictures,
    sounds,
    script,
    selectedPicture,
    objectType: objJson.objectType || liveObj.objectType || 'sprite',
  };
}

function getEntryBlockTitle(block: any): string {
  if (!block) return '블록 코드';
  const type = block.type || '';
  const typeMap: Record<string, string> = {
    when_run_button_click: '시작하기 버튼을 클릭했을 때',
    when_some_key_pressed: '키를 눌렀을 때',
    when_key_press: '키를 눌렀을 때',
    mouse_clicked: '마우스를 클릭했을 때',
    mouse_click_cancled: '마우스 클릭을 해제했을 때',
    when_object_click: '오브젝트를 클릭했을 때',
    when_object_click_canceled: '오브젝트 클릭을 해제했을 때',
    when_message_cast: '신호를 받았을 때',
    when_scene_start: '장면이 시작되었을 때',
    when_clone_start: '복제본이 처음 생성되었을 때',
    def_functions: '함수 정의',
    repeat_basic: '반복하기',
    repeat_inf: '계속 반복하기',
    repeat_while_true: '참이 될 때까지 반복하기',
    _if: '만약 참이라면',
    if_else: '만약 참이라면 / 아니면',
  };

  if (typeMap[type]) {
    return typeMap[type];
  }

  try {
    const Entry = (window as any).Entry;
    if (Entry?.block?.[type]?.template) {
      const tmpl = Entry.block[type].template;
      const clean = tmpl.replace(/%\d+/g, '').replace(/[\r\n\t]+/g, ' ').trim();
      if (clean) return clean;
    }
  } catch { }

  return type || '블록 코드';
}

async function extractAsset(type: string): Promise<ExtractAssetPayload> {
  if (!checkEntryReady()) {
    throw new Error('엔트리 에디터가 아직 준비되지 않았습니다.');
  }

  const Entry = window.Entry;

  let projectData: any = {};
  try {
    if (typeof Entry.exportProject === 'function') {
      projectData = Entry.exportProject();
    }
  } catch (e) {
    console.warn('[Entry-Hub] exportProject 실패:', e);
  }

  const deps = extractDependencies(projectData);

  if (type === 'CODE') {
    let targetBlock = Entry.playground?.currentBlock;
    if (!targetBlock && Entry.playground?.blockMenu?.lastSelectedBlock) {
      targetBlock = Entry.playground.blockMenu.lastSelectedBlock;
    }

    const threads = Entry.playground?.object?.script?.getThreads?.() || [];

    // 현재 오브젝트에 존재하는 모든 스레드(블록 묶음) 리스트 구성
    const availableBlocks = threads
      .map((t: any, index: number) => {
        const blocks = t.getBlocks?.() || [];
        const rootBlock = blocks[0];
        if (!rootBlock) return null;
        const blockJson = typeof rootBlock.toJSON === 'function' ? rootBlock.toJSON(false) : rootBlock;
        const blockCount = blocks.length;
        const displayName = getEntryBlockTitle(rootBlock);
        const isTarget = targetBlock ? (rootBlock === targetBlock || targetBlock.getThread?.() === t) : false;
        return {
          index,
          id: rootBlock.id || String(index),
          type: rootBlock.type,
          title: displayName,
          blockCount,
          blockJson,
          isSelected: isTarget,
        };
      })
      .filter(Boolean);

    // 타깃 블록이 명시적으로 선택되지 않았으면 첫 번째 스레드 사용
    if (!targetBlock && availableBlocks.length > 0) {
      const firstThread = threads[0];
      const blocks = firstThread.getBlocks?.() || [];
      if (blocks.length > 0) targetBlock = blocks[0];
      if (availableBlocks[0]) availableBlocks[0].isSelected = true;
    }

    if (!targetBlock) {
      throw new Error('선택된 코드 블록이 없습니다. 에디터에 블록을 추가해 주세요.');
    }

    const blockJson = typeof targetBlock.toJSON === 'function' ? targetBlock.toJSON(false) : targetBlock;
    const initialTitle = getEntryBlockTitle(targetBlock);

    // 현재 선택된 오브젝트의 모양(pictures) 및 소리(sounds) 정보도 함께 추출하여
    // 모양 바꾸기(change_to_some_shape 등)나 소리 재생 블록 주입 시 모양/소리 누락 방지
    const currentLiveObj = Entry.playground?.object || Entry.container?.selectedObject;
    let objPictures: any[] = [];
    let objSounds: any[] = [];
    // CODE 추출 시 모양/소리 메타데이터:
    // projectData.objects에서 ID가 일치하는 오브젝트를 우선 사용하여
    // script 내 ID와 완전히 일치하는 상태로 보존
    if (currentLiveObj) {
      try {
        // projectData.objects에서 ID 일치 항목을 우선 사용 (장면 보관함 방식)
        // exportProject()가 toJSON(false)로 직렬화하므로 script ID와 완전히 일치
        const liveId = currentLiveObj.id || currentLiveObj.id_;
        const exportedObj = liveId
          ? (Array.isArray(projectData.objects) ? projectData.objects.find((o: any) => o.id === liveId) : null)
          : null;
        if (exportedObj) {
          const sp = exportedObj.sprite || exportedObj;
          objPictures = Array.isArray(sp.pictures) ? sp.pictures : (Array.isArray(exportedObj.pictures) ? exportedObj.pictures : []);
          objSounds = Array.isArray(sp.sounds) ? sp.sounds : (Array.isArray(exportedObj.sounds) ? exportedObj.sounds : []);
        } else {
          // fallback: live 인스턴스에서 직접 추출 (toJSON(false) 사용)
          const serialized = serializeEntryObject(currentLiveObj);
          objPictures = serialized.pictures || [];
          objSounds = serialized.sounds || [];
        }
      } catch (e) {
        console.warn('[Entry-Hub] CODE 에셋 추출 중 오브젝트 리소스 추출 예외:', e);
      }
    }

    return {
      type: 'CODE',
      title: initialTitle,
      data: {
        block: blockJson,
        availableBlocks: availableBlocks.length > 1 ? availableBlocks : undefined,
        variables: deps.variables,
        lists: deps.lists,
        messages: deps.messages,
        functions: deps.functions,
        pictures: objPictures,
        sounds: objSounds,
      },
    };
  }

  if (type === 'OBJECT') {
    const liveTargetObject = Entry.playground?.object || Entry.container?.selectedObject;
    if (!liveTargetObject) {
      throw new Error('선택된 오브젝트가 없습니다.');
    }

    // projectData.objects에서 ID 일치 항목을 우선 사용 (장면 보관함과 동일한 방식)
    // exportProject() -> toJSON(false) 경로이므로 pictures/sounds ID가 script와 100% 일치
    const liveId = liveTargetObject.id || liveTargetObject.id_;
    const exportedObj = liveId
      ? (Array.isArray(projectData.objects) ? projectData.objects.find((o: any) => o.id === liveId) : null)
      : null;
    const serialized = exportedObj
      ? (() => {
          // exportedObj는 toJSON(false) 결과이므로 그대로 사용
          const sp = exportedObj.sprite || exportedObj;
          const pics = Array.isArray(sp.pictures) ? sp.pictures : (Array.isArray(exportedObj.pictures) ? exportedObj.pictures : []);
          const snds = Array.isArray(sp.sounds) ? sp.sounds : (Array.isArray(exportedObj.sounds) ? exportedObj.sounds : []);
          const firstPic = pics[0] || null;
          return {
            ...exportedObj,
            pictures: pics,
            sounds: snds,
            selectedPicture: firstPic,
          };
        })()
      : serializeEntryObject(liveTargetObject);

    // 미리보기 이미지: 선택된 모양 또는 첫 번째 모양의 fileurl
    let previewUrl = serialized.selectedPicture?.fileurl || serialized.pictures?.[0]?.fileurl;
    if (!previewUrl) {
      previewUrl = 'https://playentry.org/lib/entry-js/images/media/entrybot_walk1.png';
    }

    return {
      type: 'OBJECT',
      title: serialized.name || '오브젝트',
      data: {
        ...serialized,
        variables: deps.variables,
        lists: deps.lists,
        messages: deps.messages,
        functions: deps.functions,
      },
      previewImageUrl: previewUrl,
    };
  }

  if (type === 'SCENE') {
    const currentScene = Entry.scene?.selectedScene;
    if (!currentScene) {
      throw new Error('현재 선택된 장면이 없습니다.');
    }

    // 장면 보관함과 완전히 동일한 방식:
    // projectData.objects에서 현재 장면 오브젝트를 필터링하여 그대로 사용
    // exportProject() -> toJSON(false)이므로 pictures/sounds/script ID가 100% 일치
    const exportedSceneObjects = Array.isArray(projectData.objects)
      ? projectData.objects.filter((obj: any) => {
          const sId = (obj.scene && typeof obj.scene === 'object' ? obj.scene.id : obj.scene);
          return sId === currentScene.id;
        })
      : [];

    // exportedSceneObjects가 비어있으면 live 오브젝트에서 fallback
    let targetObjects: any[];
    if (exportedSceneObjects.length > 0) {
      targetObjects = exportedSceneObjects;
    } else {
      const allLive = getAllLiveObjects();
      const sceneObjects = allLive.filter((obj: any) => {
        const sId =
          (obj.scene && typeof obj.scene === 'object' ? obj.scene.id : obj.scene) ||
          (typeof obj.getScene === 'function' ? obj.getScene()?.id : null);
        return !sId || sId === currentScene.id;
      });
      targetObjects = sceneObjects.map((liveObj: any) => serializeEntryObject(liveObj));
    }

    // 장면 대표 미리보기 이미지: 첫 번째 오브젝트의 그림 또는 스테이지 캔버스
    let previewUrl: string | null = null;
    if (targetObjects.length > 0) {
      previewUrl = targetObjects[0].selectedPicture?.fileurl || targetObjects[0].pictures?.[0]?.fileurl || null;
    }
    if (!previewUrl) {
      try {
        const canvas = Entry.stage?.canvas;
        if (canvas && typeof canvas.toDataURL === 'function') {
          previewUrl = canvas.toDataURL('image/png');
        }
      } catch (e) {
        console.warn('[Entry-Hub] canvas toDataURL failed:', e);
      }
    }
    if (!previewUrl) {
      previewUrl = 'https://playentry.org/lib/entry-js/images/media/entrybot_walk1.png';
    }

    const sceneData = {
      sceneName: currentScene.name || '장면',
      sceneId: currentScene.id,
      objects: targetObjects,
      variables: deps.variables,
      lists: deps.lists,
      messages: deps.messages,
      functions: deps.functions,
    };

    return {
      type: 'SCENE',
      title: currentScene.name || '장면 에셋',
      data: sceneData,
      previewImageUrl: previewUrl,
    };
  }

  throw new Error(`지원하지 않는 에셋 타입입니다: ${type}`);
}


// ========================================================
// 엔트리 종속성 완전 추출 (변수, 지역변수, 리스트, 신호, 함수)
// ========================================================
function extractDependencies(projectData: any) {
  const Entry = window.Entry;
  const vc = Entry.variableContainer;

  const exportVars = projectData.variables || [];

  function toVarJSON(v: any) {
    return typeof v?.toJSON === 'function' ? v.toJSON() : v;
  }

  function mergeById(exportArr: any[], liveArr: any[]) {
    const merged = exportArr.slice();
    const seenIds = new Set(merged.map((v) => getEntityId(v)).filter(Boolean));

    liveArr.forEach((v) => {
      const id = getEntityId(v);
      if (!id || !seenIds.has(id)) {
        merged.push(v);
        if (id) seenIds.add(id);
      }
    });

    return merged;
  }

  const isVariableOrSlide = (v: any) =>
    !v.isSystem &&
    (!v.variableType ||
      v.variableType === 'variable' ||
      v.variableType === 'slide' ||
      v.type === 'variable' ||
      v.type === 'slide');

  const customVars = mergeById(
    exportVars.filter(isVariableOrSlide),
    vc ? toSafeArray(vc.variables_).map(toVarJSON).filter(isVariableOrSlide) : []
  );

  const customLists = mergeById(
    exportVars.filter((v: any) => v.variableType === 'list'),
    vc ? toSafeArray(vc.lists_).map(toVarJSON) : []
  );

  const customMsgs = mergeById(
    projectData.messages || exportVars.filter((v: any) => v.variableType === 'message'),
    vc ? toSafeArray(vc.messages_).map(toVarJSON) : []
  );

  // Entry의 함수 목록 추출:
  // vc.getFunctionJSON()이 있으면 우선 사용하고,
  // 없을 경우 vc.functions_ 내부의 Entry.Func 인스턴스에서 content.stringify() 또는 content.toJSON()을 추출
  let liveFuncList: any[] = [];
  if (vc && typeof vc.getFunctionJSON === 'function') {
    try {
      liveFuncList = vc.getFunctionJSON() || [];
    } catch (e) {
      console.warn('[Entry-Hub] vc.getFunctionJSON 호출 실패:', e);
    }
  }

  if (liveFuncList.length === 0 && vc?.functions_) {
    const rawFuncs = toSafeArray(vc.functions_);
    liveFuncList = rawFuncs.map((f: any) => {
      if (!f) return null;
      let content = f.content;
      if (content && typeof content.stringify === 'function') {
        try {
          content = content.stringify();
        } catch {
          content = typeof content.toJSON === 'function' ? JSON.stringify(content.toJSON()) : content;
        }
      } else if (content && typeof content.toJSON === 'function') {
        try {
          content = JSON.stringify(content.toJSON());
        } catch { }
      }

      return {
        id: f.id || getEntityId(f),
        name: f.name || getEntityName(f),
        type: f.type || 'normal',
        localVariables: f.localVariables || [],
        useLocalVariables: !!f.useLocalVariables,
        content: typeof content === 'string' ? content : JSON.stringify(content || []),
      };
    }).filter(Boolean);
  }

  const customFuncs = mergeById(
    projectData.functions || [],
    liveFuncList
  );

  return {
    variables: JSON.parse(JSON.stringify(customVars)),
    lists: JSON.parse(JSON.stringify(customLists)),
    messages: JSON.parse(JSON.stringify(customMsgs)),
    functions: JSON.parse(JSON.stringify(customFuncs)),
  };
}

// =========================================================
// 엔트리 에디터 뷰 일괄 동기화 (블록 메뉴, 워크스페이스 보드 등)
// =========================================================
function refreshEntryEditorViews() {
  const Entry = window.Entry;
  const vc = Entry.variableContainer;

  if (Entry.container && typeof Entry.container.updateObjects === 'function') {
    Entry.container.updateObjects();
  }

  if (vc && typeof vc.updateViews === 'function') {
    vc.updateViews();
  }

  if (vc && typeof vc.updateCategory === 'function') {
    vc.updateCategory();
  }

  if (vc && typeof vc.updateList === 'function') {
    vc.updateList();
  }

  if (Entry.container && Entry.container.selectedObject) {
    Entry.container.selectObject(Entry.container.selectedObject.id);
  }

  if (Entry.playground && Entry.playground.blockMenu && typeof Entry.playground.blockMenu.update === 'function') {
    Entry.playground.blockMenu.update();
  }

  if (Entry.playground && Entry.playground.mainWorkspace && Entry.playground.mainWorkspace.board) {
    if (typeof Entry.playground.mainWorkspace.board.reRender === 'function') {
      Entry.playground.mainWorkspace.board.reRender();
    }
  }
}

// =========================================================
// 고아 개인 변수 복구 (오브젝트가 없어진 개인 변수 정리)
// =========================================================
function repairOrphanVariables() {
  const Entry = window.Entry;
  const vc = Entry.variableContainer;
  if (!vc) return;

  let objs = [];
  if (Entry.container && typeof Entry.container.getAllObjects === 'function') {
    objs = Entry.container.getAllObjects();
  } else if (Entry.container && Entry.container.objects) {
    objs = Entry.container.objects;
  }

  const liveObjectIds = new Set();
  toSafeArray(objs).forEach((o) => {
    const id = getEntityId(o);
    if (id) liveObjectIds.add(id);
  });

  const repairList = (list: any[]) => {
    toSafeArray(list).forEach((cur) => {
      const ownerId = getOwnerObjectId(cur);
      if (ownerId && !liveObjectIds.has(ownerId)) {
        if (cur.object_ !== undefined) cur.object_ = null;
        else cur.object = null;
      }
    });
  };

  if (vc.variables_) repairList(vc.variables_);
  if (vc.lists_) repairList(vc.lists_);
}

// =========================================================
// 에셋 주입 로직 (Code, Object, Scene)
// =========================================================
async function injectAsset(payload: InjectAssetPayload): Promise<void> {
  if (!checkEntryReady()) {
    throw new Error('엔트리 에디터가 아직 준비되지 않았습니다.');
  }

  const { type, data } = payload;
  const unparsedData = typeof data === 'string' ? JSON.parse(data) : data;

  if (type === 'SCENE') {
    loadSceneToEntry(unparsedData);
    return;
  }

  if (type === 'OBJECT') {
    loadObjectToEntry(unparsedData);
    return;
  }

  if (type === 'CODE') {
    loadCodeToEntry(unparsedData);
    return;
  }

  throw new Error(`지원하지 않는 에셋 타입입니다: ${type}`);
}

// =========================================================
// 장면(SCENE) 주입 (장면 보관함 완전 호환 구현)
// =========================================================
function loadSceneToEntry(sceneData: any) {
  const Entry = window.Entry;
  const vc = Entry.variableContainer;

  // 1. 오브젝트 ID 매핑 사전 생성
  const idMap: Record<string, string> = {};
  if (sceneData.objects && Array.isArray(sceneData.objects)) {
    sceneData.objects.forEach((objRaw: any) => {
      const rawId = getEntityId(objRaw);
      if (rawId) {
        idMap[rawId] = generateEntryHash();
      }
    });
  }

  // 2. 새 장면 생성
  const newScene = Entry.scene.addScene();
  const targetName = sceneData.sceneName || sceneData.name || '불러온 장면';
  newScene.name = targetName;

  if (typeof Entry.scene.updateView === 'function') {
    Entry.scene.updateView();
  }
  Entry.scene.selectScene(newScene);

  // 3. 장면 ID 매핑
  const sceneIdMap: Record<string, string> = {};
  const oldSceneId = sceneData.sceneId || sceneData.id;
  if (oldSceneId) {
    sceneIdMap[oldSceneId] = newScene.id;
  }

  // 4. 변수/리스트 ID 매핑 테이블
  const variableIdMap: Record<string, string> = {};
  const listIdMap: Record<string, string> = {};

  const remapValue = (value: any): any => {
    if (typeof value === 'string') {
      if (variableIdMap[value]) return variableIdMap[value];
      if (listIdMap[value]) return listIdMap[value];
      if (idMap[value]) return idMap[value];
      if (sceneIdMap[value]) return sceneIdMap[value];

      const trimmed = value.trim();
      const looksLikeJson =
        (trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'));

      if (looksLikeJson) {
        try {
          const parsed = JSON.parse(value);
          const remapped = remapValue(parsed);
          return JSON.stringify(remapped);
        } catch {
          return value;
        }
      }
      return value;
    }

    if (Array.isArray(value)) {
      return value.map(remapValue);
    }

    if (value && typeof value === 'object') {
      Object.keys(value).forEach((key) => {
        value[key] = remapValue(value[key]);
      });
    }

    return value;
  };

  // 5. 변수 동기화
  if (vc && Array.isArray(sceneData.variables)) {
    let currentVars = toSafeArray(vc.variables_);

    [...sceneData.variables].reverse().forEach((savedVar: any) => {
      if (!savedVar) return;
      const oldVarId = getEntityId(savedVar);
      const oldVarName = getEntityName(savedVar);
      const savedOwnerId = getOwnerObjectId(savedVar);
      const newOwnerId = savedOwnerId ? idMap[savedOwnerId] || savedOwnerId : null;
      const savedVarType = savedVar.variableType || savedVar.type || 'variable';

      let currentVar = currentVars.find((cur: any) => {
        const curOwner = getOwnerObjectId(cur);
        const sameName = oldVarName && getEntityName(cur) === oldVarName;
        if (!sameName) return false;
        const curType = cur.variableType || cur.type || 'variable';
        if (curType !== savedVarType) return false;
        return newOwnerId ? curOwner === newOwnerId : !curOwner;
      });

      if (!currentVar && typeof vc.addVariable === 'function') {
        const newVarData = JSON.parse(JSON.stringify(savedVar));
        newVarData.type = savedVarType;
        newVarData.variableType = savedVarType;
        newVarData.object = newOwnerId || null;
        delete newVarData.id;

        try {
          vc.addVariable(newVarData);
        } catch (varErr) {
          console.warn('[Entry-Hub] 변수 생성 실패:', oldVarName, varErr);
        }

        currentVars = toSafeArray(vc.variables_);
        currentVar = currentVars.find((cur: any) => {
          const curOwner = getOwnerObjectId(cur);
          const sameName = oldVarName && getEntityName(cur) === oldVarName;
          if (!sameName) return false;
          const curType = cur.variableType || cur.type || 'variable';
          if (curType !== savedVarType) return false;
          return newOwnerId ? curOwner === newOwnerId : !curOwner;
        });
      }

      if (oldVarId && currentVar) {
        const curId = getEntityId(currentVar);
        if (curId) variableIdMap[oldVarId] = curId;
      }
    });
  }

  // 6. 리스트 동기화
  if (vc && Array.isArray(sceneData.lists)) {
    let currentLists = toSafeArray(vc.lists_);

    [...sceneData.lists].reverse().forEach((savedList: any) => {
      if (!savedList) return;
      const oldListId = getEntityId(savedList);
      const oldListName = getEntityName(savedList);
      const savedOwnerId = getOwnerObjectId(savedList);
      const newOwnerId = savedOwnerId ? idMap[savedOwnerId] || savedOwnerId : null;

      let currentList = currentLists.find((cur: any) => {
        const curOwner = getOwnerObjectId(cur);
        const sameName = oldListName && getEntityName(cur) === oldListName;
        if (!sameName) return false;
        return newOwnerId ? curOwner === newOwnerId : !curOwner;
      });

      if (!currentList && typeof vc.addList === 'function') {
        const newListData = JSON.parse(JSON.stringify(savedList));
        newListData.type = 'list';
        newListData.variableType = 'list';
        newListData.object = newOwnerId || null;
        delete newListData.id;

        try {
          vc.addList(newListData);
        } catch (listErr) {
          console.warn('[Entry-Hub] 리스트 생성 실패:', oldListName, listErr);
        }

        currentLists = toSafeArray(vc.lists_);
        currentList = currentLists.find((cur: any) => {
          const curOwner = getOwnerObjectId(cur);
          const sameName = oldListName && getEntityName(cur) === oldListName;
          if (!sameName) return false;
          return newOwnerId ? curOwner === newOwnerId : !curOwner;
        });
      }

      if (oldListId && currentList) {
        const curId = getEntityId(currentList);
        if (curId) listIdMap[oldListId] = curId;
      }
    });
  }

  // 7. 신호 (메시지) 동기화
  if (vc && Array.isArray(sceneData.messages)) {
    const currentMsgs = toSafeArray(vc.messages_);

    [...sceneData.messages].reverse().forEach((m: any) => {
      if (!currentMsgs.some((cur: any) => getEntityId(cur) === m.id || getEntityName(cur) === m.name)) {
        if (typeof vc.addMessage === 'function') {
          try {
            vc.addMessage(m);
          } catch (msgErr) {
            console.warn('[Entry-Hub] 신호 생성 실패:', m.name, msgErr);
          }
        }
      }
    });
  }

  // 8. 함수 동기화 (내부 스크립트의 변수/리스트 ID 매핑 치환 및 makeBlock, unbanBlockView 트리거)
  if (vc && Array.isArray(sceneData.functions)) {
    const currentFuncs = toSafeArray(vc.functions_);

    [...sceneData.functions].reverse().forEach((f: any) => {
      const fId = getEntityId(f);
      const fName = getEntityName(f);
      if (!currentFuncs.some((cur: any) => (fId && getEntityId(cur) === fId) || (fName && getEntityName(cur) === fName))) {
        try {
          const clonedFunc = JSON.parse(JSON.stringify(f));
          const savedFuncId = clonedFunc.id;
          const savedFuncName = clonedFunc.name;

          // content 내부 스크립트 블록들에 포함된 변수/리스트 ID를 새 ID로 치환
          if (typeof clonedFunc.content === 'string') {
            try {
              const parsed = JSON.parse(clonedFunc.content);
              clonedFunc.content = JSON.stringify(remapValue(parsed));
            } catch {
              clonedFunc.content = remapValue(clonedFunc.content);
            }
          } else if (clonedFunc.content) {
            clonedFunc.content = remapValue(clonedFunc.content);
          }

          delete clonedFunc.id;
          delete clonedFunc.name;

          Object.assign(clonedFunc, remapValue(clonedFunc));
          clonedFunc.id = savedFuncId;
          clonedFunc.name = savedFuncName;

          const newFunc = typeof Entry.Func === 'function' ? new Entry.Func(clonedFunc) : clonedFunc;
          if (Array.isArray(vc.functions_)) {
            vc.functions_.push(newFunc);
          } else if (typeof vc.functions_ === 'object') {
            vc.functions_[newFunc.id] = newFunc;
          }

          if (typeof newFunc?.generateBlock === 'function') {
            newFunc.generateBlock();
          }
          Entry.Func?.updateMenu?.();
          Entry.playground?.blockMenu?.unbanClass?.('functionInit', true);
        } catch (e) {
          console.warn('[Entry-Hub] 함수 추가 오류:', e);
        }
      }
    });
  }

  // 9. 오브젝트 데이터 재매핑 및 엔트리 주입
  if (sceneData.objects && Array.isArray(sceneData.objects)) {
    const updatedObjects = sceneData.objects.map((objRaw: any) => {
      const raw = JSON.parse(JSON.stringify(objRaw));
      const oldId = raw.id;
      if (oldId && idMap[oldId]) {
        raw.id = idMap[oldId];
      }
      raw.scene = newScene.id;

      if (typeof raw.script === 'string') {
        try {
          const parsedScript = JSON.parse(raw.script);
          const remappedScript = remapValue(parsedScript);
          raw.script = JSON.stringify(remappedScript);
        } catch (e) {
          console.warn('[Entry-Hub] script JSON 변환 실패:', e);
        }
      } else if (raw.script) {
        raw.script = remapValue(raw.script);
      }

      const savedScript = raw.script;
      delete raw.script;
      remapValue(raw);
      raw.script = savedScript;

      return raw;
    });

    updatedObjects.reverse().forEach((raw: any) => {
      try {
        if (Entry.container && typeof Entry.container.addObject === 'function') {
          Entry.container.addObject(raw);
        } else if (Entry.container?.addObjectFunc) {
          Entry.container.addObjectFunc(raw);
        }
      } catch (e) {
        console.error('[Entry-Hub] 오브젝트 추가 오류:', e);
      }
    });
  }

  // 10. 고아 변수 복구 및 화면 뷰 일괄 동기화
  repairOrphanVariables();
  refreshEntryEditorViews();
}

// =========================================================
// 단일 오브젝트(OBJECT) 주입
// =========================================================
function loadObjectToEntry(objData: any) {
  const Entry = window.Entry;
  // objData가 { type: 'OBJECT', data: { ... } } 형태로 래핑되어 있는 경우 unwrap
  let rawObj = objData?.data !== undefined ? JSON.parse(JSON.stringify(objData.data)) : JSON.parse(JSON.stringify(objData));

  // 만약 rawObj 내부에도 data 속성이 또 있다면 언래핑
  if (rawObj?.data && (rawObj.data.pictures || rawObj.data.sprite || rawObj.data.name)) {
    rawObj = rawObj.data;
  }

  // Entry.container.addObject(objectModel)은 objectModel.sprite 객체를 필수로 요구함
  // ('name' in objectModel.sprite 접근 에러 방지)
  // 장면 보관함 방식: sprite.pictures / sprite.sounds ID를 절대 변경하지 않고 그대로 보존
  if (!rawObj.sprite || typeof rawObj.sprite !== 'object') {
    rawObj.sprite = {
      name: rawObj.name || '오브젝트',
      pictures: Array.isArray(rawObj.pictures) ? rawObj.pictures : [],
      sounds: Array.isArray(rawObj.sounds) ? rawObj.sounds : [],
      category: rawObj.category || {},
    };
  } else {
    // sprite가 있어도 pictures/sounds가 없으면 최상위에서 복사
    if (!Array.isArray(rawObj.sprite.pictures) || rawObj.sprite.pictures.length === 0) {
      if (Array.isArray(rawObj.pictures) && rawObj.pictures.length > 0) {
        rawObj.sprite.pictures = rawObj.pictures;
      }
    }
    if (!Array.isArray(rawObj.sprite.sounds) || rawObj.sprite.sounds.length === 0) {
      if (Array.isArray(rawObj.sounds) && rawObj.sounds.length > 0) {
        rawObj.sprite.sounds = rawObj.sounds;
      }
    }
    if (!('name' in rawObj.sprite)) {
      rawObj.sprite.name = rawObj.name || '오브젝트';
    }
  }

  // entity 필드 보정 (오브젝트 위치/회전/크기 기본값)
  if (!rawObj.entity || typeof rawObj.entity !== 'object') {
    rawObj.entity = {
      x: rawObj.x ?? 0,
      y: rawObj.y ?? 0,
      rotation: rawObj.rotation ?? 0,
      direction: rawObj.direction ?? 90,
      scaleX: rawObj.scaleX ?? 1,
      scaleY: rawObj.scaleY ?? 1,
      visible: rawObj.visible ?? true,
    };
  }

  const oldId = rawObj.id;
  const newId = generateEntryHash();
  const idMap: Record<string, string> = {};
  if (oldId) idMap[oldId] = newId;

  // 장면 데이터 구조로 감싸서 변수/리스트/함수/신호 일괄 동기화 수행
  const sceneMock = {
    objects: [rawObj],
    variables: rawObj.variables || [],
    lists: rawObj.lists || [],
    messages: rawObj.messages || [],
    functions: rawObj.functions || [],
  };

  // 기존 선택된 장면이 있으면 그 장면 유지
  const currentSceneId = Entry.scene?.selectedScene?.id || null;

  // 동기화 실행
  const vc = Entry.variableContainer;
  const variableIdMap: Record<string, string> = {};
  const listIdMap: Record<string, string> = {};

  const remapValue = (value: any): any => {
    if (typeof value === 'string') {
      if (variableIdMap[value]) return variableIdMap[value];
      if (listIdMap[value]) return listIdMap[value];
      if (idMap[value]) return idMap[value];

      const trimmed = value.trim();
      const looksLikeJson =
        (trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'));
      if (looksLikeJson) {
        try {
          return JSON.stringify(remapValue(JSON.parse(value)));
        } catch {
          return value;
        }
      }
      return value;
    }
    if (Array.isArray(value)) return value.map(remapValue);
    if (value && typeof value === 'object') {
      Object.keys(value).forEach((key) => {
        value[key] = remapValue(value[key]);
      });
    }
    return value;
  };

  // 변수
  if (vc && Array.isArray(sceneMock.variables)) {
    let currentVars = toSafeArray(vc.variables_);
    [...sceneMock.variables].reverse().forEach((savedVar: any) => {
      if (!savedVar) return;
      const oldVarId = getEntityId(savedVar);
      const oldVarName = getEntityName(savedVar);
      const savedOwnerId = getOwnerObjectId(savedVar);
      const newOwnerId = savedOwnerId ? idMap[savedOwnerId] || savedOwnerId : null;
      const savedVarType = savedVar.variableType || savedVar.type || 'variable';

      let currentVar = currentVars.find((cur: any) => {
        const curOwner = getOwnerObjectId(cur);
        const sameName = oldVarName && getEntityName(cur) === oldVarName;
        if (!sameName) return false;
        return newOwnerId ? curOwner === newOwnerId : !curOwner;
      });

      if (!currentVar && typeof vc.addVariable === 'function') {
        const newVarData = JSON.parse(JSON.stringify(savedVar));
        newVarData.type = savedVarType;
        newVarData.variableType = savedVarType;
        newVarData.object = newOwnerId || null;
        delete newVarData.id;
        try {
          vc.addVariable(newVarData);
        } catch (e) { }
        currentVars = toSafeArray(vc.variables_);
        currentVar = currentVars.find((cur: any) => oldVarName && getEntityName(cur) === oldVarName);
      }
      if (oldVarId && currentVar) {
        const curId = getEntityId(currentVar);
        if (curId) variableIdMap[oldVarId] = curId;
      }
    });
  }

  // 리스트
  if (vc && Array.isArray(sceneMock.lists)) {
    let currentLists = toSafeArray(vc.lists_);
    [...sceneMock.lists].reverse().forEach((savedList: any) => {
      if (!savedList) return;
      const oldListId = getEntityId(savedList);
      const oldListName = getEntityName(savedList);
      let currentList = currentLists.find((cur: any) => oldListName && getEntityName(cur) === oldListName);
      if (!currentList && typeof vc.addList === 'function') {
        const newListData = JSON.parse(JSON.stringify(savedList));
        newListData.type = 'list';
        delete newListData.id;
        try {
          vc.addList(newListData);
        } catch (e) { }
        currentLists = toSafeArray(vc.lists_);
        currentList = currentLists.find((cur: any) => oldListName && getEntityName(cur) === oldListName);
      }
      if (oldListId && currentList) {
        const curId = getEntityId(currentList);
        if (curId) listIdMap[oldListId] = curId;
      }
    });
  }

  // 신호
  if (vc && Array.isArray(sceneMock.messages)) {
    const currentMsgs = toSafeArray(vc.messages_);
    [...sceneMock.messages].reverse().forEach((m: any) => {
      if (!currentMsgs.some((cur: any) => getEntityId(cur) === m.id || getEntityName(cur) === m.name)) {
        if (typeof vc.addMessage === 'function') {
          try {
            vc.addMessage(m);
          } catch (e) { }
        }
      }
    });
  }

  // 함수 (내부 content 스크립트 블록들의 변수/리스트 ID 치환 적용)
  if (vc && Array.isArray(sceneMock.functions)) {
    const currentFuncs = toSafeArray(vc.functions_);
    [...sceneMock.functions].reverse().forEach((f: any) => {
      const fId = getEntityId(f);
      const fName = getEntityName(f);
      if (!currentFuncs.some((cur: any) => (fId && getEntityId(cur) === fId) || (fName && getEntityName(cur) === fName))) {
        try {
          const clonedFunc = JSON.parse(JSON.stringify(f));
          const savedFuncId = clonedFunc.id;
          const savedFuncName = clonedFunc.name;

          // content 내부 스크립트 블록들에 포함된 변수/리스트 ID를 새 ID로 치환
          if (typeof clonedFunc.content === 'string') {
            try {
              const parsed = JSON.parse(clonedFunc.content);
              clonedFunc.content = JSON.stringify(remapValue(parsed));
            } catch {
              clonedFunc.content = remapValue(clonedFunc.content);
            }
          } else if (clonedFunc.content) {
            clonedFunc.content = remapValue(clonedFunc.content);
          }

          delete clonedFunc.id;
          delete clonedFunc.name;
          Object.assign(clonedFunc, remapValue(clonedFunc));
          clonedFunc.id = savedFuncId;
          clonedFunc.name = savedFuncName;
          const newFunc = typeof Entry.Func === 'function' ? new Entry.Func(clonedFunc) : clonedFunc;
          if (Array.isArray(vc.functions_)) vc.functions_.push(newFunc);
          else if (typeof vc.functions_ === 'object') vc.functions_[newFunc.id] = newFunc;
          if (typeof newFunc?.generateBlock === 'function') {
            newFunc.generateBlock();
          }
          Entry.Func?.updateMenu?.();
          Entry.playground?.blockMenu?.unbanClass?.('functionInit', true);
        } catch (e) {
          console.warn('[Entry-Hub] 함수 추가 오류:', e);
        }
      }
    });
  }

  rawObj.id = newId;
  if (currentSceneId) rawObj.scene = currentSceneId;

  if (typeof rawObj.script === 'string') {
    try {
      rawObj.script = JSON.stringify(remapValue(JSON.parse(rawObj.script)));
    } catch (e) { }
  } else if (rawObj.script) {
    rawObj.script = remapValue(rawObj.script);
  }

  delete rawObj.variables;
  delete rawObj.lists;
  delete rawObj.messages;
  delete rawObj.functions;

  const savedScript = rawObj.script;
  delete rawObj.script;

  // remapValue는 변수/리스트/오브젝트 ID를 치환하는데,
  // sprite.pictures / sprite.sounds의 ID는 script와 반드시 일치해야 하므로 보호
  // 장면 보관함과 동일: sprite 전체를 별도 보존 후 복원
  const savedSpritePictures = rawObj.sprite?.pictures
    ? JSON.parse(JSON.stringify(rawObj.sprite.pictures))
    : null;
  const savedSpriteSounds = rawObj.sprite?.sounds
    ? JSON.parse(JSON.stringify(rawObj.sprite.sounds))
    : null;

  remapValue(rawObj);

  // remapValue 후 sprite.pictures / sprite.sounds 원본 복원
  if (rawObj.sprite) {
    if (savedSpritePictures !== null) rawObj.sprite.pictures = savedSpritePictures;
    if (savedSpriteSounds !== null) rawObj.sprite.sounds = savedSpriteSounds;
  }

  rawObj.script = savedScript;

  if (Entry.container && typeof Entry.container.addObject === 'function') {
    Entry.container.addObject(rawObj);
  } else if (Entry.container?.addObjectFunc) {
    Entry.container.addObjectFunc(rawObj);
  }

  repairOrphanVariables();
  refreshEntryEditorViews();
}

// =========================================================
// 단일 블록 코드(CODE) 주입
// =========================================================
function loadCodeToEntry(codeData: any) {
  const Entry = window.Entry;
  if (!Entry) return;
  const vc = Entry.variableContainer;

  const variableIdMap: Record<string, string> = {};
  const listIdMap: Record<string, string> = {};

  const remapValue = (value: any): any => {
    if (typeof value === 'string') {
      if (variableIdMap[value]) return variableIdMap[value];
      if (listIdMap[value]) return listIdMap[value];

      const trimmed = value.trim();
      const looksLikeJson =
        (trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'));
      if (looksLikeJson) {
        try {
          return JSON.stringify(remapValue(JSON.parse(value)));
        } catch {
          return value;
        }
      }
      return value;
    }
    if (Array.isArray(value)) return value.map(remapValue);
    if (value && typeof value === 'object') {
      Object.keys(value).forEach((key) => {
        value[key] = remapValue(value[key]);
      });
    }
    return value;
  };

  // 1. 변수 (일반 변수, 슬라이드) 동기화
  if (vc && Array.isArray(codeData.variables)) {
    let currentVars = toSafeArray(vc.variables_);
    codeData.variables.forEach((v: any) => {
      if (!v) return;
      const vId = getEntityId(v);
      const vName = getEntityName(v);
      let currentVar = currentVars.find((cur: any) => (vId && getEntityId(cur) === vId) || (vName && getEntityName(cur) === vName));
      if (!currentVar && typeof vc.addVariable === 'function') {
        try {
          const newVar = JSON.parse(JSON.stringify(v));
          delete newVar.id;
          vc.addVariable(newVar);
        } catch (e) {
          console.warn('[Entry-Hub] 변수 주입 오류:', e);
        }
        currentVars = toSafeArray(vc.variables_);
        currentVar = currentVars.find((cur: any) => vName && getEntityName(cur) === vName);
      }
      if (vId && currentVar) {
        const curId = getEntityId(currentVar);
        if (curId) variableIdMap[vId] = curId;
      }
    });
  }

  // 2. 리스트 동기화
  if (vc && Array.isArray(codeData.lists)) {
    let currentLists = toSafeArray(vc.lists_);
    codeData.lists.forEach((l: any) => {
      if (!l) return;
      const lId = getEntityId(l);
      const lName = getEntityName(l);
      let currentList = currentLists.find((cur: any) => (lId && getEntityId(cur) === lId) || (lName && getEntityName(cur) === lName));
      if (!currentList && typeof vc.addList === 'function') {
        try {
          const newList = JSON.parse(JSON.stringify(l));
          newList.type = 'list';
          delete newList.id;
          vc.addList(newList);
        } catch (e) {
          console.warn('[Entry-Hub] 리스트 주입 오류:', e);
        }
        currentLists = toSafeArray(vc.lists_);
        currentList = currentLists.find((cur: any) => lName && getEntityName(cur) === lName);
      }
      if (lId && currentList) {
        const curId = getEntityId(currentList);
        if (curId) listIdMap[lId] = curId;
      }
    });
  }

  // 3. 신호(메시지) 동기화
  if (vc && Array.isArray(codeData.messages)) {
    const currentMsgs = toSafeArray(vc.messages_);
    codeData.messages.forEach((m: any) => {
      if (!m) return;
      const mId = getEntityId(m);
      const mName = getEntityName(m);
      const exists = currentMsgs.some((cur: any) => (mId && getEntityId(cur) === mId) || (mName && getEntityName(cur) === mName));
      if (!exists && typeof vc.addMessage === 'function') {
        try {
          vc.addMessage(m);
        } catch (e) {
          console.warn('[Entry-Hub] 신호 주입 오류:', e);
        }
      }
    });
  }

  // 4. 함수(functions) 동기화
  if (vc && Array.isArray(codeData.functions)) {
    const currentFuncs = toSafeArray(vc.functions_);
    codeData.functions.forEach((f: any) => {
      if (!f) return;
      const fId = getEntityId(f);
      const fName = getEntityName(f);
      const exists = currentFuncs.some((cur: any) => (fId && getEntityId(cur) === fId) || (fName && getEntityName(cur) === fName));
      if (!exists) {
        try {
          const clonedFunc = JSON.parse(JSON.stringify(f));
          const savedFuncId = clonedFunc.id;
          const savedFuncName = clonedFunc.name;

          if (typeof clonedFunc.content === 'string') {
            try {
              const parsed = JSON.parse(clonedFunc.content);
              clonedFunc.content = JSON.stringify(remapValue(parsed));
            } catch {
              clonedFunc.content = remapValue(clonedFunc.content);
            }
          } else if (clonedFunc.content) {
            clonedFunc.content = remapValue(clonedFunc.content);
          }

          delete clonedFunc.id;
          delete clonedFunc.name;
          Object.assign(clonedFunc, remapValue(clonedFunc));
          clonedFunc.id = savedFuncId;
          clonedFunc.name = savedFuncName;

          const newFunc = typeof Entry.Func === 'function' ? new Entry.Func(clonedFunc) : clonedFunc;
          if (Array.isArray(vc.functions_)) {
            vc.functions_.push(newFunc);
          } else if (typeof vc.functions_ === 'object') {
            vc.functions_[newFunc.id] = newFunc;
          }
          if (typeof newFunc?.generateBlock === 'function') {
            newFunc.generateBlock();
          }
          Entry.Func?.updateMenu?.();
          Entry.playground?.blockMenu?.unbanClass?.('functionInit', true);
        } catch (e) {
          console.warn('[Entry-Hub] 함수 주입 오류:', e);
        }
      }
    });
  }

  // 5. 현재 대상 오브젝트(Target Object)의 모양(Picture) 및 소리(Sound) 매핑 사전 구축
  // 다른 프로젝트/오브젝트에서 가져온 '모양으로 바꾸기' 등의 블록이 '대상없음'으로 풀리는 현상 방지
  const pictureIdMap: Record<string, string> = {};
  const soundIdMap: Record<string, string> = {};

  const currentObj = Entry.playground?.object || Entry.container?.selectedObject;
  if (currentObj) {
    const targetPics: any[] = toSafeArray(
      (Array.isArray(currentObj.pictures_) ? currentObj.pictures_ : null) ||
      (Array.isArray(currentObj.pictures) ? currentObj.pictures : null) ||
      (typeof currentObj.getPictures === 'function' ? currentObj.getPictures() : null) ||
      []
    );
    const targetSounds: any[] = toSafeArray(
      (Array.isArray(currentObj.sounds_) ? currentObj.sounds_ : null) ||
      (Array.isArray(currentObj.sounds) ? currentObj.sounds : null) ||
      (typeof currentObj.getSounds === 'function' ? currentObj.getSounds() : null) ||
      []
    );

    // 저장된 pictures 정보가 있을 경우 매핑
    const savedPics: any[] = Array.isArray(codeData.pictures) ? codeData.pictures : [];
    savedPics.forEach((sp: any) => {
      const sId = sp?.id || sp?.id_;
      const sName = sp?.name || sp?.name_;
      if (!sId) return;

      // 1) 대상 오브젝트에 이미 동일한 ID의 모양이 있으면 그대로 유지
      const hasExactId = targetPics.some((tp) => (tp.id || tp.id_) === sId);
      if (hasExactId) {
        pictureIdMap[sId] = sId;
        return;
      }

      // 2) 동일한 이름의 모양이 있다면 해당 모양의 ID로 매핑
      const matchedByName = targetPics.find((tp) => (tp.name || tp.name_) === sName);
      if (matchedByName) {
        pictureIdMap[sId] = matchedByName.id || matchedByName.id_;
        return;
      }

      // 3) 대상 오브젝트에 모양을 새로 추가할 수 있으면 추가
      if (sp.fileurl || sp.filename) {
        try {
          const newPicData = {
            id: generateEntryHash(),
            name: sName || '불러온 모양',
            filename: sp.filename || sp.name,
            fileurl: sp.fileurl,
            imageType: sp.imageType || 'png',
            dimension: sp.dimension || { width: 100, height: 100 },
            scaleX: sp.scaleX ?? 1,
            scaleY: sp.scaleY ?? 1,
          };
          if (typeof Entry.do === 'function' && Entry.STATIC?.COMMAND_TYPES?.objectAddPicture) {
            Entry.do('objectAddPicture', currentObj.id, newPicData, false);
          } else if (typeof Entry.playground?.addPicture === 'function') {
            Entry.playground.addPicture(newPicData, false, false);
          } else if (typeof currentObj.addPicture === 'function') {
            currentObj.addPicture(newPicData);
          } else if (Array.isArray(currentObj.pictures_)) {
            currentObj.pictures_.push(newPicData);
          } else if (Array.isArray(currentObj.pictures)) {
            currentObj.pictures.push(newPicData);
          }
          pictureIdMap[sId] = newPicData.id;
          return;
        } catch (e) {
          console.warn('[Entry-Hub] 모양 자동 추가 실패:', e);
        }
      }

      // 4) 최후의 수단: 대상 오브젝트의 첫 번째 모양으로 대체하여 '대상없음' 방지
      if (targetPics.length > 0) {
        pictureIdMap[sId] = targetPics[0].id || targetPics[0].id_;
      }
    });

    // 저장된 sounds 정보가 있을 경우 매핑
    const savedSounds: any[] = Array.isArray(codeData.sounds) ? codeData.sounds : [];
    savedSounds.forEach((ss: any) => {
      const sId = ss?.id || ss?.id_;
      const sName = ss?.name || ss?.name_;
      if (!sId) return;

      const hasExactId = targetSounds.some((ts) => (ts.id || ts.id_) === sId);
      if (hasExactId) {
        soundIdMap[sId] = sId;
        return;
      }

      const matchedByName = targetSounds.find((ts) => (ts.name || ts.name_) === sName);
      if (matchedByName) {
        soundIdMap[sId] = matchedByName.id || matchedByName.id_;
        return;
      }

      // 3) 대상 오브젝트에 소리를 새로 추가할 수 있으면 추가
      if (ss.fileurl || ss.filename) {
        try {
          const newSoundData = {
            id: generateEntryHash(),
            name: sName || '불러온 소리',
            filename: ss.filename || ss.name,
            fileurl: ss.fileurl,
            duration: ss.duration ?? 0,
            ext: ss.ext || '.mp3',
          };
          if (typeof Entry.do === 'function' && Entry.STATIC?.COMMAND_TYPES?.objectAddSound) {
            Entry.do('objectAddSound', currentObj.id, newSoundData, false);
          } else if (typeof Entry.playground?.addSound === 'function') {
            Entry.playground.addSound(newSoundData, false, false, false);
          } else if (typeof currentObj.addSound === 'function') {
            currentObj.addSound(newSoundData);
          } else if (Array.isArray(currentObj.sounds_)) {
            currentObj.sounds_.push(newSoundData);
          } else if (Array.isArray(currentObj.sounds)) {
            currentObj.sounds.push(newSoundData);
          }
          soundIdMap[sId] = newSoundData.id;
          return;
        } catch (e) {
          console.warn('[Entry-Hub] 소리 자동 추가 실패:', e);
        }
      }

      if (targetSounds.length > 0) {
        soundIdMap[sId] = targetSounds[0].id || targetSounds[0].id_;
      }
    });

    // 만약 codeData에 pictures나 sounds 메타데이터가 없는 레거시 블록이거나 매핑되지 않은 리소스가 있다면,
    // 현재 대상 오브젝트의 첫 번째 모양/소리를 기본 대체값으로 설정
    if (targetPics.length > 0 && !pictureIdMap['__DEFAULT__']) {
      pictureIdMap['__DEFAULT__'] = targetPics[0].id || targetPics[0].id_;
    }
    if (targetSounds.length > 0 && !soundIdMap['__DEFAULT__']) {
      soundIdMap['__DEFAULT__'] = targetSounds[0].id || targetSounds[0].id_;
    }
  }

  // 6. 블록 데이터 정규화 및 스레드 생성 (단독 필드/표현식 및 다중 블록 안전 주입)
  let rawBlock = codeData.script || codeData.block || codeData.data || codeData;
  if (typeof rawBlock === 'string') {
    try {
      rawBlock = JSON.parse(rawBlock);
    } catch { }
  }
  if (rawBlock?.block) {
    rawBlock = rawBlock.block;
  }

  // 블록 내부의 변수/리스트 ID 매핑 치환
  rawBlock = remapValue(rawBlock);

  // 블록 내부의 모양(picture) 및 소리(sound) ID 치환 (재귀 탐색)
  const remapBlockResources = (blockObj: any): any => {
    if (!blockObj) return blockObj;
    if (Array.isArray(blockObj)) {
      return blockObj.map(remapBlockResources);
    }
    if (typeof blockObj === 'object') {
      const clone = { ...blockObj };

      // params 필드 처리
      if (Array.isArray(clone.params)) {
        clone.params = clone.params.map((param: any) => {
          if (typeof param === 'string') {
            if (pictureIdMap[param]) return pictureIdMap[param];
            if (soundIdMap[param]) return soundIdMap[param];
          }
          if (param && typeof param === 'object') {
            return remapBlockResources(param);
          }
          return param;
        });
      }

      // statements 필드 처리 (흐름 블록 내부의 서브 스크립트)
      if (Array.isArray(clone.statements)) {
        clone.statements = clone.statements.map(remapBlockResources);
      }

      // next 필드 처리 (연결된 다음 블록)
      if (clone.next && typeof clone.next === 'object') {
        clone.next = remapBlockResources(clone.next);
      }

      // 만약 대상 오브젝트에 모양이 있는데 get_pictures 블록의 파라미터가 비었거나 대상이 없으면 모양 보정
      if (clone.type === 'get_pictures' && Array.isArray(clone.params)) {
        const val = clone.params[0];
        if (currentObj) {
          const targetPics = toSafeArray(currentObj.pictures_ || currentObj.pictures || []);
          if (targetPics.length > 0) {
            const hasMatch = targetPics.some((p: any) => (p.id || p.id_) === val || (p.name || p.name_) === val);
            if (!hasMatch) {
              clone.params[0] = (val && pictureIdMap[val]) || pictureIdMap['__DEFAULT__'] || targetPics[0].id || targetPics[0].id_;
            }
          }
        }
      }

      // 만약 대상 오브젝트에 소리가 있는데 get_sounds 블록의 파라미터가 비었거나 대상이 없으면 소리 보정
      if (clone.type === 'get_sounds' && Array.isArray(clone.params)) {
        const val = clone.params[0];
        if (currentObj) {
          const targetSounds = toSafeArray(currentObj.sounds_ || currentObj.sounds || []);
          if (targetSounds.length > 0) {
            const hasMatch = targetSounds.some((s: any) => (s.id || s.id_) === val || (s.name || s.name_) === val);
            if (!hasMatch) {
              clone.params[0] = (val && soundIdMap[val]) || soundIdMap['__DEFAULT__'] || targetSounds[0].id || targetSounds[0].id_;
            }
          }
        }
      }

      // 만약 대상 오브젝트에 모양이 있는데 change_to_some_shape 블록의 파라미터가 비었거나 대상이 없으면 첫번째 모양으로 보정
      if (clone.type === 'change_to_some_shape' && Array.isArray(clone.params)) {
        const val = clone.params[0];
        if (currentObj) {
          const targetPics = toSafeArray(currentObj.pictures_ || currentObj.pictures || []);
          if (targetPics.length > 0) {
            if (val && typeof val === 'object' && val.type === 'get_pictures' && Array.isArray(val.params)) {
              const subVal = val.params[0];
              const hasMatch = targetPics.some((p: any) => (p.id || p.id_) === subVal || (p.name || p.name_) === subVal);
              if (!hasMatch) {
                val.params[0] = (subVal && pictureIdMap[subVal]) || pictureIdMap['__DEFAULT__'] || targetPics[0].id || targetPics[0].id_;
              }
            } else if (typeof val === 'string') {
              const hasMatch = targetPics.some((p: any) => (p.id || p.id_) === val || (p.name || p.name_) === val);
              if (!hasMatch && (!val || !targetPics.some((p: any) => (p.id || p.id_) === pictureIdMap[val]))) {
                clone.params[0] = pictureIdMap[val] || pictureIdMap['__DEFAULT__'] || targetPics[0].id || targetPics[0].id_;
              }
            }
          }
        }
      }

      // 만약 대상 오브젝트에 소리가 있는데 sound_something 블록들의 파라미터가 비었거나 대상이 없으면 첫번째 소리로 보정
      if (typeof clone.type === 'string' && clone.type.startsWith('sound_something') && Array.isArray(clone.params)) {
        const val = clone.params[0];
        if (currentObj) {
          const targetSounds = toSafeArray(currentObj.sounds_ || currentObj.sounds || []);
          if (targetSounds.length > 0) {
            if (val && typeof val === 'object' && val.type === 'get_sounds' && Array.isArray(val.params)) {
              const subVal = val.params[0];
              const hasMatch = targetSounds.some((s: any) => (s.id || s.id_) === subVal || (s.name || s.name_) === subVal);
              if (!hasMatch) {
                val.params[0] = (subVal && soundIdMap[subVal]) || soundIdMap['__DEFAULT__'] || targetSounds[0].id || targetSounds[0].id_;
              }
            } else if (typeof val === 'string') {
              const hasMatch = targetSounds.some((s: any) => (s.id || s.id_) === val || (s.name || s.name_) === val);
              if (!hasMatch && (!val || !targetSounds.some((s: any) => (s.id || s.id_) === soundIdMap[val]))) {
                clone.params[0] = soundIdMap[val] || soundIdMap['__DEFAULT__'] || targetSounds[0].id || targetSounds[0].id_;
              }
            }
          }
        }
      }

      return clone;
    }
    return blockObj;
  };

  rawBlock = remapBlockResources(rawBlock);

  // 배열이 아닌 단일 객체인 경우 배열 형태로 래핑
  const blockArray = Array.isArray(rawBlock) ? rawBlock : [rawBlock];

  // 각 블록의 ID 갱신 및 위치 보정 (기존 캔버스 상단 좌측 적절한 위치로 오프셋)
  const preparedBlocks = blockArray.map((b: any, idx: number) => {
    const clone = JSON.parse(JSON.stringify(b));
    clone.id = generateEntryHash();
    if (idx === 0) {
      clone.x = (clone.x !== undefined && clone.x !== null) ? Number(clone.x) : 60;
      clone.y = (clone.y !== undefined && clone.y !== null) ? Number(clone.y) : 60;
    }
    return clone;
  });

  // Entry.do('addThread', preparedBlocks) 호출로 안전한 Undo/Redo 기록 및 스레드 생성
  try {
    if (Entry.do && Entry.STATIC?.COMMAND_TYPES?.addThread) {
      Entry.do('addThread', preparedBlocks);
    } else if (Entry.playground?.mainWorkspace?.board?.code?.createThread) {
      Entry.playground.mainWorkspace.board.code.createThread(preparedBlocks);
    } else if (typeof Entry.dispatchEvent === 'function') {
      Entry.dispatchEvent('addBackPackToEntry', 'block', preparedBlocks[0] || rawBlock);
    }
  } catch (err) {
    console.warn('[Entry-Hub] Entry.do(addThread) fallback:', err);
    try {
      if (Entry.playground?.mainWorkspace?.board?.code?.createThread) {
        Entry.playground.mainWorkspace.board.code.createThread(preparedBlocks);
      }
    } catch (e) {
      console.error('[Entry-Hub] 블록 코드 주입 최종 실패:', e);
    }
  }

  repairOrphanVariables();
  refreshEntryEditorViews();
}
