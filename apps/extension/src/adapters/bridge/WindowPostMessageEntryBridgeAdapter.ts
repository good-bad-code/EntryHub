import {
  IEntryBridgeRepository,
  AssetType,
  ExtractedAssetPayload,
} from '@entry-hub/core';
import {
  ENTRY_HUB_MSG_SOURCE,
  BridgeMessage,
  BridgeMessageType,
} from '../../protocol';

export class WindowPostMessageEntryBridgeAdapter implements IEntryBridgeRepository {
  private timeoutMs: number;

  constructor(timeoutMs = 5000) {
    this.timeoutMs = timeoutMs;
  }

  private sendRequest<TResponse>(type: BridgeMessageType, payload?: unknown): Promise<TResponse> {
    return new Promise((resolve, reject) => {
      const requestId = 'req_' + Math.random().toString(36).slice(2, 11) + '_' + Date.now();

      const timer = setTimeout(() => {
        window.removeEventListener('message', listener);
        reject(new Error(`[Entry-Hub] Bridge request timeout (${this.timeoutMs}ms): ${type}`));
      }, this.timeoutMs);

      const listener = (event: MessageEvent) => {
        // event.source 체크 제거: page context↔content script 간 메시지는
        // isolated world 경계로 인해 event.source가 window와 다를 수 있음
        if (!event.data || event.data.source !== ENTRY_HUB_MSG_SOURCE) {
          return;
        }
        // 자신이 보낸 REQ 메시지는 무시 (requestId 매칭으로 처리)
        if (event.data.type && event.data.type.endsWith('_REQ')) {
          return;
        }

        const msg = event.data as BridgeMessage<TResponse>;
        if (msg.requestId !== requestId) return;

        clearTimeout(timer);
        window.removeEventListener('message', listener);

        if (msg.error) {
          reject(new Error(msg.error));
        } else {
          resolve(msg.payload as TResponse);
        }
      };

      window.addEventListener('message', listener);

      const message: BridgeMessage = {
        source: ENTRY_HUB_MSG_SOURCE,
        requestId,
        type,
        payload,
      };

      window.postMessage(message, '*');
    });
  }

  async isEditorReady(): Promise<boolean> {
    try {
      const res = await this.sendRequest<{ isReady: boolean }>('CHECK_READY_REQ');
      return !!res?.isReady;
    } catch {
      return false;
    }
  }

  async extractCurrentAsset(type: AssetType): Promise<ExtractedAssetPayload> {
    const res = await this.sendRequest<ExtractedAssetPayload>('EXTRACT_ASSET_REQ', { type });
    return res;
  }

  async extractAsset(type: AssetType): Promise<ExtractedAssetPayload> {
    return this.extractCurrentAsset(type);
  }

  async injectAsset(type: AssetType, data: Record<string, unknown>): Promise<boolean> {
    const res = await this.sendRequest<{ success: boolean }>('INJECT_ASSET_REQ', { type, data });
    return !!res?.success;
  }
}
