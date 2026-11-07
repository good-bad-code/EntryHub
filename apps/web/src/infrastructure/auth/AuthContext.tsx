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

    // RPC로 custom_id → 가상 이메일 조회 (서버에서만 처리, 클라이언트에 이메일 형식 노출 없음)
    try {
      const { data: rpcEmail, error: rpcErr } = await supabase.rpc('get_login_email_by_identifier', {
        p_identifier: rawId,
      });
      if (!rpcErr && rpcEmail) {
        const { error } = await supabase.auth.signInWithPassword({
          email: rpcEmail,
          password: pass,
        });
        if (error) {
          return {
            error: new Error(
              error.message === 'Invalid login credentials'
                ? '아이디 또는 비밀번호가 올바르지 않습니다.'
                : error.message
            ),
          };
        }
        return { error: null };
      }
    } catch {
      // RPC 미배포 또는 예외 시 아래 fallback 진행
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
      const { data, error } = await supabase.rpc('set_user_credentials', {
        p_custom_id: customId || null,
        p_password: password || null,
      });

      if (error) {
        return { error: new Error(error.message) };
      }

      if (!data?.success) {
        return { error: new Error(data?.message || '계정 정보 설정 실패') };
      }

      await refreshProfile();
      return { error: null, customId: data.custom_id };
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
