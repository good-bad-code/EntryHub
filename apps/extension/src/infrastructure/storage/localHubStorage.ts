import { AssetType } from '@entry-hub/core';

export interface LocalAssetItem {
  id: string;
  folderId: string | null; // null이면 루트 폴더
  title: string;
  description?: string;
  type: AssetType;
  data: any;
  createdAt: number;
  updatedAt: number;
}

export interface LocalFolderItem {
  id: string;
  parentId: string | null; // null이면 루트 폴더
  name: string;
  createdAt: number;
  order?: number;
}

export interface LocalHubStore {
  folders: LocalFolderItem[];
  assets: LocalAssetItem[];
}

const STORAGE_KEY = 'eh_local_hub_v1';

export function getLocalHubData(): LocalHubStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { folders: [], assets: [] };
    }
    const parsed = JSON.parse(raw);
    return {
      folders: Array.isArray(parsed.folders) ? parsed.folders : [],
      assets: Array.isArray(parsed.assets) ? parsed.assets : [],
    };
  } catch (e) {
    console.error('Failed to load local hub data:', e);
    return { folders: [], assets: [] };
  }
}

export function saveLocalHubData(data: LocalHubStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save local hub data:', e);
  }
}

export function createLocalFolder(name: string, parentId: string | null = null): LocalFolderItem {
  const data = getLocalHubData();
  const newFolder: LocalFolderItem = {
    id: 'folder_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    parentId,
    name: name.trim() || '새 폴더',
    createdAt: Date.now(),
  };
  data.folders.push(newFolder);
  saveLocalHubData(data);
  return newFolder;
}

export function renameLocalFolder(folderId: string, newName: string): void {
  const data = getLocalHubData();
  const folder = data.folders.find((f) => f.id === folderId);
  if (folder) {
    folder.name = newName.trim() || folder.name;
    saveLocalHubData(data);
  }
}

export function deleteLocalFolderRecursive(folderId: string): void {
  const data = getLocalHubData();

  // 대상 폴더 및 하위 모든 자식 폴더 ID 수집
  const folderIdsToDelete = new Set<string>([folderId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const f of data.folders) {
      if (f.parentId && folderIdsToDelete.has(f.parentId) && !folderIdsToDelete.has(f.id)) {
        folderIdsToDelete.add(f.id);
        changed = true;
      }
    }
  }

  // 폴더 삭제 및 해당 폴더들에 속한 에셋 삭제
  data.folders = data.folders.filter((f) => !folderIdsToDelete.has(f.id));
  data.assets = data.assets.filter((a) => !a.folderId || !folderIdsToDelete.has(a.folderId));

  saveLocalHubData(data);
}

export function createLocalAsset(
  title: string,
  type: AssetType,
  dataPayload: any,
  folderId: string | null = null,
  description?: string
): LocalAssetItem {
  const data = getLocalHubData();
  const newAsset: LocalAssetItem = {
    id: 'local_asset_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    folderId,
    title: title.trim() || '이름 없는 에셋',
    description: description || '',
    type,
    data: dataPayload || {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  data.assets.push(newAsset);
  saveLocalHubData(data);
  return newAsset;
}

export function updateLocalAsset(
  assetId: string,
  updates: Partial<Omit<LocalAssetItem, 'id' | 'createdAt'>>
): void {
  const data = getLocalHubData();
  const asset = data.assets.find((a) => a.id === assetId);
  if (asset) {
    Object.assign(asset, updates, { updatedAt: Date.now() });
    saveLocalHubData(data);
  }
}

export function deleteLocalAsset(assetId: string): void {
  const data = getLocalHubData();
  data.assets = data.assets.filter((a) => a.id !== assetId);
  saveLocalHubData(data);
}

export function moveLocalAsset(assetId: string, targetFolderId: string | null): void {
  const data = getLocalHubData();
  const asset = data.assets.find((a) => a.id === assetId);
  if (asset) {
    asset.folderId = targetFolderId;
    asset.updatedAt = Date.now();
    saveLocalHubData(data);
  }
}

/**
 * 백업 JSON 데이터를 로컬 허브에 불러옵니다.
 * overwrite=true 이면 기존 데이터를 완전히 지우고 덮어씁니다.
 * overwrite=false 이면 기존 데이터에 병합하며, ID가 중복되는 항목은 건너뜁니다.
 */
export function importLocalHubData(
  payload: { folders: LocalFolderItem[]; assets: LocalAssetItem[] },
  overwrite: boolean
): { addedFolders: number; addedAssets: number } {
  const store = overwrite ? { folders: [], assets: [] } : getLocalHubData();
  const existingFolderIds = new Set(store.folders.map((f) => f.id));
  const existingAssetIds = new Set(store.assets.map((a) => a.id));

  let addedFolders = 0;
  let addedAssets = 0;

  for (const f of payload.folders) {
    if (!existingFolderIds.has(f.id)) {
      store.folders.push(f);
      addedFolders++;
    }
  }
  for (const a of payload.assets) {
    if (!existingAssetIds.has(a.id)) {
      store.assets.push(a);
      addedAssets++;
    }
  }

  saveLocalHubData(store as LocalHubStore);
  return { addedFolders, addedAssets };
}

export function moveLocalFolder(folderId: string, targetParentId: string | null): void {
  if (folderId === targetParentId) return;
  const data = getLocalHubData();
  const folder = data.folders.find((f) => f.id === folderId);
  if (folder) {
    // 순환 참조 방지 (자신의 하위 폴더로 이동 불가)
    const descendants = new Set<string>([folderId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const f of data.folders) {
        if (f.parentId && descendants.has(f.parentId) && !descendants.has(f.id)) {
          descendants.add(f.id);
          changed = true;
        }
      }
    }
    if (targetParentId && descendants.has(targetParentId)) {
      throw new Error('자신의 하위 폴더로는 이동할 수 없습니다.');
    }
    folder.parentId = targetParentId;
    saveLocalHubData(data);
  }
}

