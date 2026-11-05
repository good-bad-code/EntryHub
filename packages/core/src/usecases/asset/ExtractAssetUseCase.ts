import { IEntryBridgeRepository, ExtractedAssetPayload } from '../../domain/repositories/IEntryBridgeRepository';
import { AssetType } from '../../domain/value-objects/AssetType';

export interface ExtractAssetRequest {
  type: AssetType;
  userAuthenticated: boolean;
}

export class ExtractAssetUseCase {
  constructor(private bridgeRepo: IEntryBridgeRepository) {}

  async execute(request: ExtractAssetRequest): Promise<ExtractedAssetPayload> {
    if (!request.userAuthenticated) {
      throw new Error('Unauthorized: Authentication required to extract assets');
    }

    const isReady = await this.bridgeRepo.isEditorReady();
    if (!isReady) {
      throw new Error('Entry Editor is not active or ready in the current page');
    }

    const extracted = await this.bridgeRepo.extractCurrentAsset(request.type);
    if (!extracted || !extracted.data || Object.keys(extracted.data).length === 0) {
      throw new Error(`Failed to extract ${request.type} from Entry workspace`);
    }

    return extracted;
  }
}
