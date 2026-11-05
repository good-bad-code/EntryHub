import { SupabaseClient } from '@supabase/supabase-js';
import { User } from '../../domain/entities/User';
import { IUserRepository, UpdateUserProfileDTO } from '../../domain/repositories/IUserRepository';

export class SupabaseUserRepository implements IUserRepository {
  constructor(private supabase: SupabaseClient) {}

  private mapToDomain(row: any): User {
    return new User({
      id: row.id,
      email: row.email,
      nickname: row.nickname,
      role: row.role,
      profileImageUrl: row.profile_image_url || undefined,
      entryProfileUrl: row.entry_profile_url || undefined,
      officialBadges: row.official_badges || [],
      isBanned: row.is_banned || false,
      createdAt: new Date(row.created_at),
    });
  }

  async findById(id: string): Promise<User | null> {
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return this.mapToDomain(data);
  }

  async findByEmail(email: string): Promise<User | null> {
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !data) return null;
    return this.mapToDomain(data);
  }

  async save(user: User): Promise<User> {
    const payload = {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      role: user.role,
      profile_image_url: user.profileImageUrl,
      entry_profile_url: user.entryProfileUrl,
      official_badges: user.officialBadges,
      is_banned: user.isBanned,
    };

    const { data, error } = await this.supabase
      .from('users')
      .upsert(payload)
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(`Failed to save user profile: ${error?.message}`);
    }

    return this.mapToDomain(data);
  }

  async updateProfile(id: string, updates: UpdateUserProfileDTO): Promise<User> {
    const payload: any = {};
    if (updates.nickname) payload.nickname = updates.nickname;
    if (updates.profileImageUrl) payload.profile_image_url = updates.profileImageUrl;
    if (updates.entryProfileUrl) payload.entry_profile_url = updates.entryProfileUrl;

    const { data, error } = await this.supabase
      .from('users')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(`Failed to update user profile: ${error?.message}`);
    }

    return this.mapToDomain(data);
  }

  async grantBadge(userId: string, badgeId: string): Promise<boolean> {
    const user = await this.findById(userId);
    if (!user) return false;

    const badges = Array.from(new Set([...user.officialBadges, badgeId]));
    const { error } = await this.supabase
      .from('users')
      .update({ official_badges: badges })
      .eq('id', userId);

    return !error;
  }

  async revokeBadge(userId: string, badgeId: string): Promise<boolean> {
    const user = await this.findById(userId);
    if (!user) return false;

    const badges = user.officialBadges.filter((b) => b !== badgeId);
    const { error } = await this.supabase
      .from('users')
      .update({ official_badges: badges })
      .eq('id', userId);

    return !error;
  }

  async setBannedStatus(userId: string, isBanned: boolean): Promise<boolean> {
    const { error } = await this.supabase
      .from('users')
      .update({ is_banned: isBanned })
      .eq('id', userId);

    return !error;
  }
}
