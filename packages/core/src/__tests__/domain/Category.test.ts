import { describe, it, expect } from 'vitest';
import { Category } from '../../domain/entities/Category.js';

describe('Category Domain Entity', () => {
  it('should create a valid Category entity', () => {
    const category = new Category({
      id: 'cat-1',
      name: '스피커 에셋',
      description: '사운드 관련 에셋 모음',
      isOfficial: true,
      badgeId: 'badge-speaker',
      createdAt: new Date(),
    });

    expect(category.id).toBe('cat-1');
    expect(category.name).toBe('스피커 에셋');
    expect(category.isOfficial).toBe(true);
    expect(category.badgeId).toBe('badge-speaker');
  });

  it('should throw an error if category name is too short', () => {
    expect(() => {
      new Category({
        id: 'cat-1',
        name: 'A',
        isOfficial: false,
        createdAt: new Date(),
      });
    }).toThrow('Category name must be at least 2 characters');
  });
});
