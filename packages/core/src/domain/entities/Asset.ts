import { AssetType } from '../value-objects/AssetType.js';

export interface AssetProps {
  id: string;
  title: string;
  description?: string;
  type: AssetType;
  authorId: string;
  authorName: string;
  categoryId?: string;
  isOfficialBadge: boolean;
  isAdminPick: boolean;
  likeCount: number;
  bookmarkCount: number;
  previewImageUrl?: string;
  tags?: string[];
  data: Record<string, unknown>; // JSON payload for Entry AST / object / scene
  createdAt: Date;
  updatedAt: Date;
}

export class Asset {
  private props: AssetProps;

  constructor(props: AssetProps) {
    this.validate(props);
    this.props = props;
  }

  private validate(props: AssetProps): void {
    if (!props.id || props.id.trim() === '') {
      throw new Error('Asset ID must not be empty');
    }
    if (!props.title || props.title.trim().length < 2) {
      throw new Error('Asset title must be at least 2 characters long');
    }
    if (!props.authorId) {
      throw new Error('Asset authorId is required');
    }
    if (!props.data || Object.keys(props.data).length === 0) {
      throw new Error('Asset data payload cannot be empty');
    }
  }

  get id(): string { return this.props.id; }
  get title(): string { return this.props.title; }
  get description(): string | undefined { return this.props.description; }
  get type(): AssetType { return this.props.type; }
  get authorId(): string { return this.props.authorId; }
  get authorName(): string { return this.props.authorName; }
  get categoryId(): string | undefined { return this.props.categoryId; }
  get isOfficialBadge(): boolean { return this.props.isOfficialBadge; }
  get isAdminPick(): boolean { return this.props.isAdminPick; }
  get likeCount(): number { return this.props.likeCount; }
  get bookmarkCount(): number { return this.props.bookmarkCount; }
  get previewImageUrl(): string | undefined { return this.props.previewImageUrl; }
  get tags(): string[] { return this.props.tags || []; }
  get data(): Record<string, unknown> { return this.props.data; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  public toJSON(): AssetProps {
    return { ...this.props };
  }
}
