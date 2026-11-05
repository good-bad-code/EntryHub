import { SupabaseClient } from '@supabase/supabase-js';
import { Asset } from '../../domain/entities/Asset';
import { IAssetRepository, AssetFilterOptions } from '../../domain/repositories/IAssetRepository';

export class SupabaseAssetRepository implements IAssetRepository {
  constructor(private supabase: SupabaseClient) {}

  private mapToDomain(row: any): Asset {
    return new Asset({
      id: row.id,
      title: row.title,
      description: row.description || undefined,
      type: row.type,
      authorId: row.author_id,
      authorName: row.author_name,
      categoryId: row.category_id || undefined,
      isOfficialBadge: row.is_official_badge,
      isAdminPick: row.is_admin_pick,
      likeCount: row.like_count || 0,
      bookmarkCount: row.bookmark_count || 0,
      previewImageUrl: row.preview_image_url || undefined,
      data: row.data || {},
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }

  async findById(id: string): Promise<Asset | null> {
    const { data, error } = await this.supabase
      .from('assets')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return this.mapToDomain(data);
  }

  async search(options: AssetFilterOptions): Promise<Asset[]> {
    let query = this.supabase.from('assets').select('*');

    if (options.type) {
      query = query.eq('type', options.type);
    }
    if (options.categoryId) {
      query = query.eq('category_id', options.categoryId);
    }
    if (options.isAdminPickOnly) {
      query = query.eq('is_admin_pick', true);
    }
    if (options.searchQuery) {
      query = query.or(`title.ilike.%${options.searchQuery}%,description.ilike.%${options.searchQuery}%`);
    }

    if (options.sortBy === 'oldest') {
      query = query.order('created_at', { ascending: true });
    } else if (options.sortBy === 'popular') {
      query = query.order('like_count', { ascending: false });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    if (options.limit) {
      const offset = options.offset || 0;
      query = query.range(offset, offset + options.limit - 1);
    }

    const { data, error } = await query;
    if (error || !data) return [];

    return data.map((row) => this.mapToDomain(row));
  }

  async save(asset: Asset): Promise<Asset> {
    const payload = {
      id: asset.id,
      title: asset.title,
      description: asset.description,
      type: asset.type,
      author_id: asset.authorId,
      author_name: asset.authorName,
      category_id: asset.categoryId,
      is_official_badge: asset.isOfficialBadge,
      is_admin_pick: asset.isAdminPick,
      preview_image_url: asset.previewImageUrl,
      data: asset.data,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from('assets')
      .upsert(payload)
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(`Failed to save asset to Supabase: ${error?.message}`);
    }

    return this.mapToDomain(data);
  }

  async delete(id: string): Promise<boolean> {
    const { error } = await this.supabase.from('assets').delete().eq('id', id);
    return !error;
  }

  async toggleLike(assetId: string, userId: string): Promise<boolean> {
    const { data } = await this.supabase
      .from('likes')
      .select('asset_id')
      .eq('asset_id', assetId)
      .eq('user_id', userId)
      .single();

    if (data) {
      const { error } = await this.supabase
        .from('likes')
        .delete()
        .eq('asset_id', assetId)
        .eq('user_id', userId);
      return !error;
    } else {
      const { error } = await this.supabase
        .from('likes')
        .insert({ asset_id: assetId, user_id: userId });
      return !error;
    }
  }

  async toggleBookmark(assetId: string, userId: string): Promise<boolean> {
    const { data } = await this.supabase
      .from('bookmarks')
      .select('asset_id')
      .eq('asset_id', assetId)
      .eq('user_id', userId)
      .single();

    if (data) {
      const { error } = await this.supabase
        .from('bookmarks')
        .delete()
        .eq('asset_id', assetId)
        .eq('user_id', userId);
      return !error;
    } else {
      const { error } = await this.supabase
        .from('bookmarks')
        .insert({ asset_id: assetId, user_id: userId });
      return !error;
    }
  }
}
