import { AssetType } from '../value-objects/AssetType.js';

export interface ExtractedAssetPayload {
  type: AssetType;
  title: string;
  data: Record<string, unknown>;
  previewImageUrl?: string;
}

export interface IEntryBridgeRepository {
  extractCurrentAsset(type: AssetType): Promise<ExtractedAssetPayload>;
  injectAsset(type: AssetType, data: Record<string, unknown>): Promise<boolean>;
  isEditorReady(): Promise<boolean>;
}
