import { AssetType } from '@entry-hub/core';

export const ENTRY_HUB_MSG_SOURCE = 'ENTRY_HUB_EXTENSION';

export type BridgeMessageType =
  | 'CHECK_READY_REQ'
  | 'CHECK_READY_RES'
  | 'EXTRACT_ASSET_REQ'
  | 'EXTRACT_ASSET_RES'
  | 'INJECT_ASSET_REQ'
  | 'INJECT_ASSET_RES'
  | 'EXECUTE_ACTION_PLAN_REQ'
  | 'EXECUTE_ACTION_PLAN_RES'
  | 'GET_ENTRY_USER_REQ'
  | 'GET_ENTRY_USER_RES';

export interface BridgeMessage<T = unknown> {
  source: typeof ENTRY_HUB_MSG_SOURCE;
  requestId: string;
  type: BridgeMessageType;
  payload?: T;
  error?: string;
}

export interface ExtractAssetPayload {
  type: AssetType;
  title: string;
  data: Record<string, unknown>;
  previewImageUrl?: string;
}

export interface InjectAssetPayload {
  type: AssetType;
  data: Record<string, unknown>;
}
