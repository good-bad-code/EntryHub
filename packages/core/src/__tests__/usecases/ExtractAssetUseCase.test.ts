import { describe, it, expect, vi } from 'vitest';
import { ExtractAssetUseCase } from '../../usecases/asset/ExtractAssetUseCase.js';
import { IEntryBridgeRepository } from '../../domain/repositories/IEntryBridgeRepository.js';

describe('ExtractAssetUseCase', () => {
  it('should successfully extract a scene asset when user is authenticated and editor is ready', async () => {
    const mockBridgeRepo: IEntryBridgeRepository = {
      isEditorReady: vi.fn().mockResolvedValue(true),
      extractCurrentAsset: vi.fn().mockResolvedValue({
        type: 'SCENE',
        title: 'Stage 1 Scene',
        data: { sceneId: 'scene-001', objects: ['obj-1', 'obj-2'] },
        previewImageUrl: 'https://example.com/scene1.png',
      }),
      injectAsset: vi.fn(),
    };

    const useCase = new ExtractAssetUseCase(mockBridgeRepo);
    const result = await useCase.execute({
      type: 'SCENE',
      userAuthenticated: true,
    });

    expect(result.type).toBe('SCENE');
    expect(result.title).toBe('Stage 1 Scene');
    expect(mockBridgeRepo.isEditorReady).toHaveBeenCalledOnce();
    expect(mockBridgeRepo.extractCurrentAsset).toHaveBeenCalledWith('SCENE');
  });

  it('should throw an error when user is not authenticated', async () => {
    const mockBridgeRepo: IEntryBridgeRepository = {
      isEditorReady: vi.fn(),
      extractCurrentAsset: vi.fn(),
      injectAsset: vi.fn(),
    };

    const useCase = new ExtractAssetUseCase(mockBridgeRepo);

    await expect(
      useCase.execute({
        type: 'CODE',
        userAuthenticated: false,
      })
    ).rejects.toThrow('Unauthorized: Authentication required to extract assets');
  });

  it('should throw an error when Entry editor is not ready', async () => {
    const mockBridgeRepo: IEntryBridgeRepository = {
      isEditorReady: vi.fn().mockResolvedValue(false),
      extractCurrentAsset: vi.fn(),
      injectAsset: vi.fn(),
    };

    const useCase = new ExtractAssetUseCase(mockBridgeRepo);

    await expect(
      useCase.execute({
        type: 'OBJECT',
        userAuthenticated: true,
      })
    ).rejects.toThrow('Entry Editor is not active or ready in the current page');
  });
});
