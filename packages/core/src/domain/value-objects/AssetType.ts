export type AssetType = 'CODE' | 'OBJECT' | 'SCENE';

export const AssetTypeEnum = {
  CODE: 'CODE' as AssetType,
  OBJECT: 'OBJECT' as AssetType,
  SCENE: 'SCENE' as AssetType,
};

export function isValidAssetType(type: string): type is AssetType {
  return type === 'CODE' || type === 'OBJECT' || type === 'SCENE';
}
