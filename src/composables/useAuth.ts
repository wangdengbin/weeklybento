import { ref, computed, onMounted } from 'vue';
import type { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const session = ref<Session | null>(null);
const user = ref<User | null>(null);
const isAuthLoading = ref(false);
const authError = ref<string>('');

const isAnonymous = computed(() => {
  if (!user.value) return true;
  return user.value.is_anonymous ?? (user.value.app_metadata?.provider === 'anonymous');
});

const userEmail = computed(() => {
  if (isAnonymous.value || !user.value) return '';
  return user.value.email || '';
});

async function initAuth() {
  if (!supabase) return;
  
  try {
    const { data } = await supabase.auth.getSession();
    session.value = data.session;
    user.value = data.session?.user || null;

    if (!data.session) {
      await ensureAnonymousSession();
    }
  } catch (e: any) {
    console.error('Init auth failed:', e);
  }

  // 监听会话状态变化
  supabase.auth.onAuthStateChange((_event, newSession) => {
    session.value = newSession;
    user.value = newSession?.user || null;
  });
}

async function ensureAnonymousSession() {
  if (!supabase) return;
  const { data } = await supabase.auth.getSession();
  if (data.session) {
    session.value = data.session;
    user.value = data.session.user;
    return;
  }

  isAuthLoading.value = true;
  authError.value = '';
  try {
    const { data: anonData, error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
    session.value = anonData.session;
    user.value = anonData.user;
  } catch (e: any) {
    authError.value = e.message || '生成游客身份失败';
  } finally {
    isAuthLoading.value = false;
  }
}

/**
 * 将当前游客账号升级绑定为正式邮箱账号 (或注册新账号)
 */
async function signUpOrUpgrade(email: string, password: string): Promise<{ success: boolean; message: string }> {
  if (!supabase) return { success: false, message: '尚未配置 Supabase' };
  
  isAuthLoading.value = true;
  authError.value = '';
  try {
    const cleanEmail = email.trim();

    // 如果当前已经是匿名用户，使用 updateUser 关联 email 与 password 升级为正式账号
    if (isAnonymous.value && user.value) {
      const { data, error } = await supabase.auth.updateUser({
        email: cleanEmail,
        password: password,
      });

      if (error) {
        // 如果更新关联失败（可能邮箱已存在），回退到普通 signUp
        const { error: signUpErr } = await supabase.auth.signUp({
          email: cleanEmail,
          password: password,
        });
        if (signUpErr) throw signUpErr;
      } else {
        session.value = data.user ? (await supabase.auth.getSession()).data.session : session.value;
        user.value = data.user || user.value;
      }
    } else {
      const { error } = await supabase.auth.signUp({
        email: cleanEmail,
        password: password,
      });
      if (error) throw error;
    }

    return { success: true, message: '账号绑定注册成功！您现在可以在手机和电脑登录同一账号。' };
  } catch (e: any) {
    const msg = e.message || '注册绑定失败';
    authError.value = msg;
    return { success: false, message: msg };
  } finally {
    isAuthLoading.value = false;
  }
}

/**
 * 使用邮箱密码登录已有账号 (跨设备同号登录)
 */
async function signInWithPassword(email: string, password: string): Promise<{ success: boolean; message: string }> {
  if (!supabase) return { success: false, message: '尚未配置 Supabase' };

  isAuthLoading.value = true;
  authError.value = '';
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password,
    });
    if (error) throw error;

    session.value = data.session;
    user.value = data.user;
    return { success: true, message: '登录成功！已载入您的共享数据。' };
  } catch (e: any) {
    const msg = e.message || '登录失败，请检查邮箱与密码';
    authError.value = msg;
    return { success: false, message: msg };
  } finally {
    isAuthLoading.value = false;
  }
}

/**
 * 退出当前登录并重置为新的游客身份
 */
async function signOut(): Promise<void> {
  if (!supabase) return;
  isAuthLoading.value = true;
  try {
    await supabase.auth.signOut();
    session.value = null;
    user.value = null;
    await ensureAnonymousSession();
  } catch (e: any) {
    console.error('Sign out error:', e);
  } finally {
    isAuthLoading.value = false;
  }
}

export function useAuth() {
  onMounted(() => {
    if (!session.value) {
      initAuth();
    }
  });

  return {
    isConfigured: isSupabaseConfigured,
    session,
    user,
    isAnonymous,
    userEmail,
    isAuthLoading,
    authError,
    initAuth,
    ensureAnonymousSession,
    signUpOrUpgrade,
    signInWithPassword,
    signOut,
  };
}
