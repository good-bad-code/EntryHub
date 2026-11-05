import { Asset } from '../entities/Asset.js';
import { AssetType } from '../value-objects/AssetType.js';

export interface AssetFilterOptions {
  type?: AssetType;
  categoryId?: string;
  sortBy?: 'latest' | 'oldest' | 'popular';
  searchQuery?: string;
  isAdminPickOnly?: boolean;
  limit?: number;
  offset?: number;
}

export interface IAssetRepository {
  findById(id: string): Promise<Asset | null>;
  search(options: AssetFilterOptions): Promise<Asset[]>;
  save(asset: Asset): Promise<Asset>;
  delete(id: string): Promise<boolean>;
  toggleLike(assetId: string, userId: string): Promise<boolean>;
  toggleBookmark(assetId: string, userId: string): Promise<boolean>;
}
