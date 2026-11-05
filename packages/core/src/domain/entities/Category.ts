export interface CategoryProps {
  id: string;
  name: string;
  description?: string;
  isOfficial: boolean;
  badgeId?: string;
  creatorId?: string;
  createdAt: Date;
}

export class Category {
  private props: CategoryProps;

  constructor(props: CategoryProps) {
    this.validate(props);
    this.props = props;
  }

  private validate(props: CategoryProps): void {
    if (!props.id) throw new Error('Category ID is required');
    if (!props.name || props.name.trim().length < 2) {
      throw new Error('Category name must be at least 2 characters');
    }
  }

  get id(): string { return this.props.id; }
  get name(): string { return this.props.name; }
  get description(): string | undefined { return this.props.description; }
  get isOfficial(): boolean { return this.props.isOfficial; }
  get badgeId(): string | undefined { return this.props.badgeId; }
  get creatorId(): string | undefined { return this.props.creatorId; }
  get createdAt(): Date { return this.props.createdAt; }

  public toJSON(): CategoryProps {
    return { ...this.props };
  }
}
