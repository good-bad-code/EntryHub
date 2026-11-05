import { User } from '../entities/User.js';

export interface UpdateUserProfileDTO {
  nickname?: string;
  profileImageUrl?: string;
  entryProfileUrl?: string;
}

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  save(user: User): Promise<User>;
  updateProfile(id: string, updates: UpdateUserProfileDTO): Promise<User>;
  grantBadge(userId: string, badgeId: string): Promise<boolean>;
  revokeBadge(userId: string, badgeId: string): Promise<boolean>;
  setBannedStatus(userId: string, isBanned: boolean): Promise<boolean>;
}
