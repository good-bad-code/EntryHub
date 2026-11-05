export interface CreateAssetDTO {
  title: string;
  description?: string;
  type: 'CODE' | 'OBJECT' | 'SCENE';
  categoryId?: string;
  isOfficialBadge?: boolean;
  tags?: string[];
  data: Record<string, unknown>;
  previewImageUrl?: string;
}

export interface AssetResponseDTO {
  id: string;
  title: string;
  description?: string;
  type: 'CODE' | 'OBJECT' | 'SCENE';
  authorId: string;
  authorName: string;
  categoryId?: string;
  isOfficialBadge: boolean;
  isAdminPick: boolean;
  tags?: string[];
  likeCount: number;
  bookmarkCount: number;
  previewImageUrl?: string;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
