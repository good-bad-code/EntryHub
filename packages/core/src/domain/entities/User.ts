import { UserRole } from '../value-objects/UserRole.js';

export interface UserProps {
  id: string;
  email: string;
  nickname: string;
  role: UserRole;
  profileImageUrl?: string;
  entryProfileUrl?: string;
  officialBadges: string[];
  isBanned: boolean;
  createdAt: Date;
}

export class User {
  private props: UserProps;

  constructor(props: UserProps) {
    this.props = props;
  }

  get id(): string { return this.props.id; }
  get email(): string { return this.props.email; }
  get nickname(): string { return this.props.nickname; }
  get role(): UserRole { return this.props.role; }
  get profileImageUrl(): string | undefined { return this.props.profileImageUrl; }
  get entryProfileUrl(): string | undefined { return this.props.entryProfileUrl; }
  get officialBadges(): string[] { return this.props.officialBadges; }
  get isBanned(): boolean { return this.props.isBanned; }

  public isAdmin(): boolean {
    return this.props.role === 'ADMIN';
  }

  public hasBadge(badgeId: string): boolean {
    return this.props.officialBadges.includes(badgeId);
  }

  public toJSON(): UserProps {
    return { ...this.props };
  }
}
