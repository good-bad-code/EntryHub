import { describe, it, expect, vi } from 'vitest';
import { SupabaseAssetRepository } from '../../adapters/repositories/SupabaseAssetRepository.js';

describe('SupabaseAssetRepository Adapter', () => {
  it('should find asset by ID and map SQL row to Domain Asset entity', async () => {
    const mockSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'asset-999',
        title: 'Cool Physics Simulation',
        description: 'Physics engine object',
        type: 'OBJECT',
        author_id: 'user-007',
        author_name: 'GravityDev',
        category_id: 'cat-physics',
        is_official_badge: true,
        is_admin_pick: false,
        like_count: 15,
        bookmark_count: 3,
        preview_image_url: 'https://example.com/physics.png',
        data: { object: { name: 'Ball' } },
        created_at: '2026-09-30T10:00:00.000Z',
        updated_at: '2026-09-30T10:00:00.000Z',
      },
      error: null,
    });

    const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

    const mockSupabaseClient = { from: mockFrom } as any;

    const repository = new SupabaseAssetRepository(mockSupabaseClient);
    const asset = await repository.findById('asset-999');

    expect(asset).not.toBeNull();
    expect(asset?.id).toBe('asset-999');
    expect(asset?.title).toBe('Cool Physics Simulation');
    expect(asset?.type).toBe('OBJECT');
    expect(asset?.isOfficialBadge).toBe(true);
    expect(asset?.likeCount).toBe(15);
    expect(mockFrom).toHaveBeenCalledWith('assets');
    expect(mockEq).toHaveBeenCalledWith('id', 'asset-999');
  });

  it('should return empty list if search query encounters error', async () => {
    const mockRange = vi.fn().mockResolvedValue({ data: null, error: { message: 'Database offline' } });
    const mockOrder = vi.fn().mockReturnValue({ range: mockRange });
    const mockSelect = vi.fn().mockReturnValue({ order: mockOrder });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

    const mockSupabaseClient = { from: mockFrom } as any;

    const repository = new SupabaseAssetRepository(mockSupabaseClient);
    const results = await repository.search({ limit: 10 });

    expect(results).toEqual([]);
  });
});
