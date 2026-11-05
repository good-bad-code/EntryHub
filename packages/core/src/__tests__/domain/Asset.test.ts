import { describe, it, expect } from 'vitest';
import { Asset } from '../../domain/entities/Asset.js';

describe('Asset Domain Entity', () => {
  it('should create a valid Asset entity when correct props are provided', () => {
    const asset = new Asset({
      id: 'asset-123',
      title: 'Awesome Jumping Player Code',
      description: 'Player move and jump logic',
      type: 'CODE',
      authorId: 'user-001',
      authorName: 'EntryMaster',
      isOfficialBadge: false,
      isAdminPick: true,
      likeCount: 42,
      bookmarkCount: 10,
      data: { blocks: [{ id: 'b1', type: 'move' }] },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    expect(asset.id).toBe('asset-123');
    expect(asset.title).toBe('Awesome Jumping Player Code');
    expect(asset.type).toBe('CODE');
    expect(asset.isAdminPick).toBe(true);
    expect(asset.likeCount).toBe(42);
  });

  it('should throw an error if asset title is less than 2 characters', () => {
    expect(() => {
      new Asset({
        id: 'asset-123',
        title: 'A',
        type: 'CODE',
        authorId: 'user-001',
        authorName: 'EntryMaster',
        isOfficialBadge: false,
        isAdminPick: false,
        likeCount: 0,
        bookmarkCount: 0,
        data: { blocks: [] },
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }).toThrow('Asset title must be at least 2 characters long');
  });

  it('should throw an error if asset data payload is empty', () => {
    expect(() => {
      new Asset({
        id: 'asset-123',
        title: 'Valid Title',
        type: 'CODE',
        authorId: 'user-001',
        authorName: 'EntryMaster',
        isOfficialBadge: false,
        isAdminPick: false,
        likeCount: 0,
        bookmarkCount: 0,
        data: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }).toThrow('Asset data payload cannot be empty');
  });
});
