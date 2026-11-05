import { IEntryBridgeRepository } from '../../domain/repositories/IEntryBridgeRepository';
import { AssetType } from '../../domain/value-objects/AssetType';

export interface InjectAssetRequest {
  type: AssetType;
  data: Record<string, unknown>;
  userAuthenticated: boolean;
}

export class InjectAssetUseCase {
  constructor(private bridgeRepo: IEntryBridgeRepository) {}

  async execute(request: InjectAssetRequest): Promise<boolean> {
    if (!request.userAuthenticated) {
      throw new Error('Unauthorized: Authentication required to inject assets into workspace');
    }

    const isReady = await this.bridgeRepo.isEditorReady();
    if (!isReady) {
      throw new Error('Entry Editor is not active or ready in the current page');
    }

    const success = await this.bridgeRepo.injectAsset(request.type, request.data);
    if (!success) {
      throw new Error(`Failed to inject ${request.type} into Entry workspace`);
    }

    return true;
  }
}
