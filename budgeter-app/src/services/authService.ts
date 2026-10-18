import { supabase } from './supabase';
import type { UserProfile, SystemRole } from '../types/expense';
import type { Session, User } from '@supabase/supabase-js';

export interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  isLoading: boolean;
}

class AuthService {
  /**
   * Fetch the database-managed profile for this authenticated user.
   */
  public async getProfile(user: User): Promise<UserProfile> {
    if (!supabase) {
      throw new Error('Account services are unavailable. Please contact support.');
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching profile from Supabase:', error);
      throw new Error(`Unable to load your account profile: ${error.message}`);
    }

    if (data) {
      return {
        id: data.id,
        name: data.name || (user.user_metadata?.name as string) || user.email?.split('@')[0] || 'User',
        email: data.email || user.email || '',
        systemRole: (data.system_role as SystemRole) || 'member',
        avatarUrl: data.avatar_url || undefined,
      };
    }

    throw new Error(
      'Your account is not fully set up yet. Please ask your workspace owner for help.'
    );
  }

  public async signIn(email: string, password: string):Promise<{ user: User; session: Session }> {
    if (!supabase) {
      throw new Error('Sign-in is temporarily unavailable. Please contact support.');
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) {
      throw error;
    }

    if (!data.user || !data.session) {
      throw new Error('Authentication succeeded but session could not be established.');
    }

    return { user: data.user, session: data.session };
  }

  public async signUp(email: string, password: string, name: string): Promise<{ user: User | null; session: Session | null }> {
    if (!supabase) {
      throw new Error('Account registration is temporarily unavailable. Please contact support.');
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          name: cleanName,
        },
      },
    });

    if (error) {
      throw error;
    }

    return { user: data.user, session: data.session };
  }

  public async signOut(): Promise<void> {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error during sign out:', error);
      throw error;
    }
  }

  public async getSession(): Promise<Session | null> {
    if (!supabase) return null;
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error('Error fetching session:', error);
      return null;
    }
    return data.session;
  }
}

export const authService = new AuthService();
