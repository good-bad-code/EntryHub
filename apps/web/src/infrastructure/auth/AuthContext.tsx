'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';

export interface UserProfile {
  id: string;
  email?: string;
  nickname: string;
  entry_username?: string;
  entry_user_id?: string;
  is_social?: boolean;
  custom_id?: string;
  has_password?: boolean;
  avatar_url?: string;
  entry_profile_url?: string;
  role: 'USER' | 'ADMIN';
  is_banned?: boolean;
  theme?: 'light' | 'dark';
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  signIn: (identifier: string, pass: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, pass: string, nickname: string, entryUsername?: string, entryProfileUrl?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<{ error: Error | null }>;
  refreshProfile: () => Promise<void>;
  setCredentials: (customId?: string, password?: string) => Promise<{ error: Error | null; customId?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchProfile = async (userId: string, email?: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.warn('Profile fetch warning:', error.message);
      }

      if (data) {
        const userProf = data as UserProfile;
        const isMaster =
          (userProf.entry_username || '').toLowerCase() === 'myentrymy' ||
          (userProf.nickname || '').toLowerCase() === 'myentrymy' ||
          (email || '').toLowerCase() === 'myentrymy@entry-hub.local';

        // myentrymy 유저라면 ADMIN 권한 자동 부여
        if (isMaster && userProf.role !== 'ADMIN') {
          await supabase.from('users').update({ role: 'ADMIN' }).eq('id', userId);
          userProf.role = 'ADMIN';
        }

        // 이전 데이터에 남아있는 이메일 제거 (보안 및 이메일 미사용 정책)
        if (userProf.email) {
          await supabase.from('users').update({ email: null }).eq('id', userId);
          delete userProf.email;
        }

        setProfile(userProf);
      } else {
        const isMaster = (email || '').toLowerCase().includes('myentrymy');
        const fallbackUsername = email ? email.split('@')[0] : '사용자';

        // 프로필 테이블이 아직 없거나 레코드가 없을 때 기본 프로필 설정
        setProfile({
          id: userId,
          nickname: fallbackUsername,
          entry_username: fallbackUsername,
          role: isMaster ? 'ADMIN' : 'USER',
        });
        if (isMaster) {
          await supabase.from('users').upsert({
            id: userId,
            nickname: fallbackUsername,
            entry_username: fallbackUsername,
            role: 'ADMIN',
          }, { onConflict: 'id' });
        }
      }
    } catch (e) {
      console.warn('Profile fetch exception:', e);
      const isMaster = (email || '').toLowerCase().includes('myentrymy');
      const fallbackUsername = email ? email.split('@')[0] : '사용자';
      setProfile({
        id: userId,
        nickname: fallbackUsername,
        entry_username: fallbackUsername,
        role: isMaster ? 'ADMIN' : 'USER',
      });
    }
  };

  useEffect(() => {
    // 초기 세션 확인
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id, session.user.email);
      }
      setLoading(false);
    });

    // 세션 변경 리스너
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id, session.user.email);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (identifier: string, pass: string) => {
    const rawId = identifier.trim();
    if (!rawId) {
      return { error: new Error('아이디를 입력해 주세요.') };
    }

    // 1. 이메일 형식으로 직접 입력한 경우 즉시 로그인 시도
    if (rawId.includes('@') && rawId.includes('.')) {
      const { error: directErr } = await supabase.auth.signInWithPassword({
        email: rawId,
        password: pass,
      });
      if (!directErr) return { error: null };
    }

    // 2. RPC로 custom_id → 가상 이메일 조회
    try {
      const { data: rpcEmail, error: rpcErr } = await supabase.rpc('get_login_email_by_identifier', {
        p_identifier: rawId,
      });
      if (!rpcErr && rpcEmail) {
        const { error } = await supabase.auth.signInWithPassword({
          email: rpcEmail,
          password: pass,
        });
        if (!error) return { error: null };
      }
    } catch {}

    // 3. Fallback: users 테이블에서 custom_id 대소문자 무시 조회 후 로그인 시도
    try {
      const { data: userRow } = await supabase
        .from('users')
        .select('id, entry_user_id, custom_id')
        .or(`custom_id.ilike.${rawId},custom_id.ilike.${rawId}@entry`)
        .maybeSingle();

      if (userRow?.entry_user_id) {
        const candidateEmail = `entry_${userRow.entry_user_id}@entry-hub.local`;
        const { error: fallbackErr } = await supabase.auth.signInWithPassword({
          email: candidateEmail,
          password: pass,
        });
        if (!fallbackErr) return { error: null };
      }
    } catch {}

    // 4. [신규] 엔트리 로그인으로 인해 auth.users 비밀번호가 임시 autologin 비밀번호로 덮어써졌을 경우 자동 복구
    try {
      const { data: repairRes, error: repairErr } = await supabase.rpc('check_and_repair_login_password', {
        p_identifier: rawId,
        p_password: pass,
      });

      if (!repairErr && repairRes?.success && repairRes?.email) {
        const { error: retryErr } = await supabase.auth.signInWithPassword({
          email: repairRes.email,
          password: pass,
        });
        if (!retryErr) return { error: null };
      }
    } catch (e) {
      console.warn('[AuthContext] check_and_repair_login_password error:', e);
    }

    return { error: new Error('아이디 또는 비밀번호가 올바르지 않습니다.') };
  };

  const signUp = async (
    email: string,
    pass: string,
    nickname: string,
    entryUsername?: string,
    entryProfileUrl?: string
  ) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password: pass,
      options: {
        data: {
          nickname,
          entry_username: entryUsername,
          entry_profile_url: entryProfileUrl,
        },
      },
    });

    if (error) {
      return { error: error as Error | null };
    }

    // 유저 메타데이터 기반으로 users 테이블에도 삽입 시도
    if (data.user) {
      try {
        await supabase.from('users').upsert({
          id: data.user.id,
          email: email,
          nickname: nickname,
          entry_username: entryUsername,
          entry_profile_url: entryProfileUrl,
          role: 'USER',
        });
      } catch (e) {
        console.warn('User table sync exception (will be handled by trigger or lazy profile):', e);
      }
    }

    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  const deleteAccount = async () => {
    try {
      const { error } = await supabase.rpc('delete_own_user');
      if (error) {
        return { error: new Error(error.message) };
      }
      await signOut();
      return { error: null };
    } catch (err: any) {
      return { error: err as Error };
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id, user.email);
    }
  };

  const setCredentials = async (customId?: string, password?: string) => {
    if (!user) {
      return { error: new Error('로그인이 필요합니다.') };
    }
    try {
      const cleanCustomId = customId?.trim() || null;
      const cleanPassword = password?.trim() || null;

      // 1. 비밀번호가 입력된 경우 공식 Supabase GoTrue Auth API 호출
      if (cleanPassword) {
        if (cleanPassword.length < 6) {
          return { error: new Error('비밀번호는 최소 6자 이상이어야 합니다.') };
        }
        const { error: updateAuthErr } = await supabase.auth.updateUser({
          password: cleanPassword,
        });
        if (updateAuthErr) {
          console.warn('[AuthContext] GoTrue updateUser warning:', updateAuthErr.message);
        }
      }

      // 2. set_user_credentials RPC 호출 (custom_id 저장 및 해시 동기화)
      let customIdResult = cleanCustomId;
      const { data, error } = await supabase.rpc('set_user_credentials', {
        p_custom_id: cleanCustomId,
        p_password: cleanPassword,
      });

      if (error) {
        console.warn('[AuthContext] set_user_credentials RPC fallback:', error.message);
        // RPC 실패 시 public.users 직접 업데이트 fallback
        const updatePayload: Record<string, any> = {
          updated_at: new Date().toISOString(),
        };
        if (cleanCustomId) {
          // 중복 검사
          const { data: existing } = await supabase
            .from('users')
            .select('id')
            .ilike('custom_id', cleanCustomId)
            .neq('id', user.id)
            .maybeSingle();

          if (existing) {
            return { error: new Error('이미 사용 중인 아이디입니다.') };
          }
          updatePayload.custom_id = cleanCustomId;
        }
        if (cleanPassword) {
          updatePayload.has_password = true;
        }

        const { error: directUpdateErr } = await supabase
          .from('users')
          .update(updatePayload)
          .eq('id', user.id);

        if (directUpdateErr) {
          return { error: new Error(directUpdateErr.message) };
        }
      } else if (!data?.success) {
        return { error: new Error(data?.message || '계정 정보 설정 실패') };
      } else if (data?.custom_id) {
        customIdResult = data.custom_id;
      }

      await refreshProfile();
      return { error: null, customId: customIdResult || undefined };
    } catch (err: any) {
      return { error: err as Error };
    }
  };

  const isAdmin =
    profile?.role === 'ADMIN' ||
    (profile?.entry_username || '').toLowerCase() === 'myentrymy' ||
    (profile?.nickname || '').toLowerCase() === 'myentrymy' ||
    (user?.email || '').toLowerCase() === 'myentrymy@entry-hub.local';

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        loading,
        isAdmin,
        signIn,
        signUp,
        signOut,
        deleteAccount,
        refreshProfile,
        setCredentials,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
