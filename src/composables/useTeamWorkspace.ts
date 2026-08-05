import { computed, ref } from 'vue';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type { BentoLocation, DailyRecord, TeamPermissions, TeamRollResult } from '../types';

type TeamRole = 'owner' | 'admin' | 'member' | 'viewer';

interface TeamWorkspace {
  id: string;
  public_id: string;
  name: string;
  role: TeamRole;
}

export interface TeamMember {
  user_id: string;
  role: TeamRole;
  joined_at: string;
  email: string;
  is_me: boolean;
}

const team = ref<TeamWorkspace | null>(null);
const myTeams = ref<TeamWorkspace[]>([]);
const members = ref<TeamMember[]>([]);
const locations = ref<BentoLocation[]>([]);
const todayResult = ref<TeamRollResult | null>(null);
const teamHistory = ref<DailyRecord[]>([]);
const isLoading = ref(false);
const errorMessage = ref('');
const pendingInviteUrl = ref('');
let channel: RealtimeChannel | null = null;

export function getErrorMessage(error: unknown): string {
  if (!error) return '';
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (typeof error === 'object') {
    const errObj = error as Record<string, any>;
    if (errObj.message && typeof errObj.message === 'string') return errObj.message;
    if (errObj.error_description && typeof errObj.error_description === 'string') return errObj.error_description;
    if (errObj.details && typeof errObj.details === 'string') return errObj.details;
    if (errObj.hint && typeof errObj.hint === 'string') return errObj.hint;
    try {
      return JSON.stringify(error);
    } catch (e) {
      return String(error);
    }
  }
  return String(error);
}

function today() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date());
}

const defaultPermissions: TeamPermissions = {
  allowMemberReroll: true,
  allowMemberEditLocation: true,
  enabledMealCategories: ['breakfast', 'lunch', 'tea', 'dinner', 'night'],
};

const teamPermissions = ref<TeamPermissions>({ ...defaultPermissions });

function loadTeamPermissions(teamId?: string) {
  if (!teamId) {
    teamPermissions.value = { ...defaultPermissions };
    return;
  }
  try {
    const key = `weekly_bento_team_perms_${teamId}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      teamPermissions.value = { ...defaultPermissions, ...JSON.parse(raw) };
      return;
    }
  } catch (e) {}
  teamPermissions.value = { ...defaultPermissions };
}

function updateTeamPermissions(newPerms: Partial<TeamPermissions>) {
  if (!team.value) return;
  teamPermissions.value = { ...teamPermissions.value, ...newPerms };
  try {
    const key = `weekly_bento_team_perms_${team.value.id}`;
    localStorage.setItem(key, JSON.stringify(teamPermissions.value));
  } catch (e) {}
}

function prepareTags(tags: string[] = [], visible?: boolean): string[] {
  const clean = tags.filter(t => t !== '__hidden__');
  if (visible === false) {
    clean.push('__hidden__');
  }
  return clean;
}

function mapLocation(row: any): BentoLocation {
  const rawTags: string[] = row.tags || [];
  const isHidden = rawTags.includes('__hidden__') || row.visible === false;
  const cleanTags = rawTags.filter(t => t !== '__hidden__');
  return {
    id: row.id,
    name: row.name,
    emoji: row.emoji,
    tags: cleanTags,
    priceRange: row.price_range || '',
    recommendedDish: row.recommended_dish || undefined,
    weight: row.weight || 1,
    isDrawn: false,
    createdAt: new Date(row.created_at).getTime(),
    mealCategories: row.meal_categories || row.mealCategories || undefined,
    visible: !isHidden,
  };
}

async function ensureAnonymousSession() {
  if (!supabase) throw new Error('尚未配置 Supabase');
  const { data } = await supabase.auth.getSession();
  if (data.session) return;
  const { error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
}

async function checkNotAnonymous() {
  if (!supabase) throw new Error('尚未配置 Supabase');
  const { data } = await supabase.auth.getSession();
  const u = data.session?.user;
  if (!u || u.is_anonymous || u.app_metadata?.provider === 'anonymous') {
    throw new Error('匿名账户无法使用搭子圈功能，请先点击右上角【登录/注册】绑定正式账号！');
  }
}

async function fetchTeamMembers(targetTeamId?: string): Promise<TeamMember[]> {
  const teamId = targetTeamId || team.value?.id;
  if (!supabase || !teamId) {
    members.value = [];
    return [];
  }

  try {
    const { data, error } = await supabase.rpc('get_team_members', { p_team_id: teamId });
    if (!error && Array.isArray(data)) {
      members.value = data as TeamMember[];
      return members.value;
    }
  } catch (e) {
    console.warn('fetchTeamMembers rpc failed, trying fallback select:', e);
  }

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const currentUserId = sessionData.session?.user?.id;

    const { data, error } = await supabase
      .from('team_members')
      .select('user_id, role, joined_at')
      .eq('team_id', teamId)
      .order('joined_at', { ascending: true });

    if (error) throw error;
    members.value = (data || []).map((row: any) => ({
      user_id: row.user_id,
      role: row.role,
      joined_at: new Date(row.joined_at).toLocaleDateString('zh-CN'),
      email: row.user_id === currentUserId ? '我' : `搭子成员 (${row.user_id.slice(0, 6)})`,
      is_me: row.user_id === currentUserId,
    }));
    return members.value;
  } catch (e) {
    console.error('Fallback fetchTeamMembers error:', e);
    return [];
  }
}

async function fetchMyTeams(): Promise<TeamWorkspace[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase.rpc('get_my_teams');
    if (!error && Array.isArray(data)) {
      myTeams.value = data as TeamWorkspace[];
      return myTeams.value;
    }
  } catch (e) {
    console.warn('fetchMyTeams rpc failed, trying fallback select:', e);
  }

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;
    if (!userId) return [];

    const { data, error } = await supabase
      .from('team_members')
      .select('role, joined_at, teams!inner(id, public_id, name)')
      .eq('user_id', userId)
      .order('joined_at', { ascending: true });

    if (error) throw error;
    myTeams.value = (data || []).map((row: any) => ({
      id: row.teams.id,
      public_id: row.teams.public_id,
      name: row.teams.name,
      role: row.role,
    }));
    return myTeams.value;
  } catch (e) {
    console.error('Fallback fetchMyTeams error:', e);
    return [];
  }
}

async function loadWorkspace() {
  if (!supabase || !team.value) return;
  const { data: sessionData } = await supabase.auth.getSession();
  const currentUserId = sessionData.session?.user?.id;

  const [{ data: locationRows, error: locationError }, { data: drawRows, error: drawError }] = await Promise.all([
    supabase.from('team_locations').select('*').eq('team_id', team.value.id).order('created_at'),
    supabase.from('team_draws').select('*, team_locations(*)').eq('team_id', team.value.id).order('business_date', { ascending: false }),
  ]);
  if (locationError) throw locationError;
  if (drawError) throw drawError;

  locations.value = (locationRows || []).map(mapLocation);

  teamHistory.value = (drawRows || []).map((draw: any) => {
    const locRow = draw.team_locations;
    const loc = locRow ? mapLocation(locRow) : locations.value.find(item => item.id === draw.location_id);
    const isMe = draw.drawn_by === currentUserId;
    return {
      id: draw.id,
      date: draw.business_date,
      locationId: draw.location_id,
      locationName: loc?.name || '团队用餐',
      emoji: loc?.emoji || '🍱',
      tags: loc?.tags || [],
      priceRange: loc?.priceRange || '',
      recommendedDish: loc?.recommendedDish || '',
      note: draw.note || (isMe ? '午餐搭子 Roll (由我选定)' : '午餐搭子 Roll (搭子成员选定)'),
      drawnAt: new Date(draw.drawn_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    };
  });

  const todayStr = today();
  const todayDraw = (drawRows || []).find((d: any) => d.business_date === todayStr);
  if (todayDraw) {
    const locRow = todayDraw.team_locations;
    const location = locRow ? mapLocation(locRow) : locations.value.find(item => item.id === todayDraw.location_id);
    const isMe = todayDraw.drawn_by === currentUserId;
    todayResult.value = location ? {
      date: todayDraw.business_date,
      locationId: location.id,
      locationName: location.name,
      emoji: location.emoji,
      tags: location.tags,
      priceRange: location.priceRange,
      recommendedDish: location.recommendedDish,
      rolledAt: new Date(todayDraw.drawn_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      rolledBy: isMe ? '我' : '团队成员',
    } : null;
  } else {
    todayResult.value = null;
  }

  await fetchTeamMembers();
  loadTeamPermissions(team.value.id);
}

function startRealtime() {
  if (!supabase || !team.value) return;
  if (channel) supabase.removeChannel(channel);
  const teamId = team.value.id;
  channel = supabase.channel(`weekly-bento-${teamId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'team_locations', filter: `team_id=eq.${teamId}` }, () => loadWorkspace())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'team_draws', filter: `team_id=eq.${teamId}` }, () => loadWorkspace())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'team_members', filter: `team_id=eq.${teamId}` }, () => loadWorkspace())
    .subscribe();
}

function setTeamUrl(publicId: string) {
  const url = new URL(window.location.href);
  url.searchParams.set('team', publicId);
  url.searchParams.delete('invite');
  window.history.replaceState({}, '', url);
  localStorage.setItem('weekly_bento_active_team', publicId);
}

async function openTeam(publicId: string, inviteToken?: string) {
  if (!supabase) throw new Error('尚未配置 Supabase');
  await ensureAnonymousSession();
  if (inviteToken) {
    await checkNotAnonymous();
  }
  const rpcName = inviteToken ? 'join_team' : 'open_team';
  const params = inviteToken
    ? { p_public_id: publicId, p_invite_token: inviteToken }
    : { p_public_id: publicId };
  const { data, error } = await supabase.rpc(rpcName, params);
  if (error) throw error;
  team.value = data as TeamWorkspace;
  setTeamUrl(team.value.public_id);
  await loadWorkspace();
  startRealtime();
}

async function switchActiveTeam(publicId: string) {
  if (!publicId) return;
  isLoading.value = true;
  errorMessage.value = '';
  try {
    await openTeam(publicId);
    await fetchMyTeams();
  } catch (error) {
    errorMessage.value = getErrorMessage(error);
  } finally {
    isLoading.value = false;
  }
}

async function initialize() {
  if (!isSupabaseConfigured) return;
  isLoading.value = true;
  errorMessage.value = '';
  try {
    await ensureAnonymousSession();
    await fetchMyTeams();

    const url = new URL(window.location.href);
    const publicId = url.searchParams.get('team') || localStorage.getItem('weekly_bento_active_team');
    const invite = url.searchParams.get('invite') || undefined;
    if (invite && publicId) {
      await openTeam(publicId, invite);
      await fetchMyTeams();
    } else if (publicId) {
      await openTeam(publicId);
    } else if (myTeams.value.length > 0) {
      await openTeam(myTeams.value[0].public_id);
    }
  } catch (error) {
    errorMessage.value = getErrorMessage(error);
  } finally {
    isLoading.value = false;
  }
}

async function createTeam(name: string, seedLocations: BentoLocation[]) {
  if (!supabase) throw new Error('尚未配置 Supabase');
  await checkNotAnonymous();
  isLoading.value = true;
  errorMessage.value = '';
  try {
    await ensureAnonymousSession();
    const { data, error } = await supabase.rpc('create_team', {
      p_name: name.trim(),
      p_locations: seedLocations,
    });
    if (error) throw error;
    const created = data as TeamWorkspace & { invite_token: string };
    team.value = created;
    setTeamUrl(created.public_id);
    pendingInviteUrl.value = buildInviteUrl(created.public_id, created.invite_token);
    await fetchMyTeams();
    await loadWorkspace();
    startRealtime();
    return created;
  } catch (error) {
    errorMessage.value = getErrorMessage(error);
    throw error;
  } finally {
    isLoading.value = false;
  }
}

function buildInviteUrl(publicId: string, token?: string) {
  const url = new URL(window.location.href);
  url.search = '';
  url.searchParams.set('team', publicId);
  if (token) {
    url.searchParams.set('invite', token);
  }
  return url.toString();
}

async function createInviteUrl(forceRotate = false) {
  if (!supabase || !team.value) throw new Error('请先创建或加入团队');
  
  if (!forceRotate && pendingInviteUrl.value) {
    try {
      const parsed = new URL(pendingInviteUrl.value);
      if (parsed.searchParams.get('team') === team.value.public_id && parsed.searchParams.get('invite')) {
        return pendingInviteUrl.value;
      }
    } catch (e) {}
  }

  const { data, error } = await supabase.rpc('rotate_team_invite', { p_team_id: team.value.id });
  if (error) throw error;
  pendingInviteUrl.value = buildInviteUrl(team.value.public_id, data as string);
  return pendingInviteUrl.value;
}

async function roll(force = false) {
  if (!supabase || !team.value) throw new Error('请先创建或加入团队');
  const { data, error } = await supabase.rpc('roll_team', { p_team_id: team.value.id, p_force: force });
  if (error) throw error;
  todayResult.value = data as TeamRollResult;
  return todayResult.value;
}

async function addLocation(value: Omit<BentoLocation, 'id' | 'isDrawn' | 'createdAt'>) {
  if (!supabase || !team.value) throw new Error('请先创建或加入团队');
  const tagsToSave = prepareTags(value.tags, value.visible);
  const { error } = await supabase.from('team_locations').insert({
    team_id: team.value.id, name: value.name, emoji: value.emoji, tags: tagsToSave,
    price_range: value.priceRange, recommended_dish: value.recommendedDish || null, weight: value.weight,
    meal_categories: value.mealCategories || null,
  });
  if (error) throw error;
  await loadWorkspace();
}

async function updateLocation(value: BentoLocation) {
  if (!supabase || !team.value) throw new Error('请先创建或加入团队');
  const tagsToSave = prepareTags(value.tags, value.visible);
  const { error } = await supabase.from('team_locations').update({
    name: value.name, emoji: value.emoji, tags: tagsToSave, price_range: value.priceRange,
    recommended_dish: value.recommendedDish || null, weight: value.weight,
    meal_categories: value.mealCategories || null,
  }).eq('id', value.id).eq('team_id', team.value.id);
  if (error) throw error;
  await loadWorkspace();
}

async function deleteLocation(id: string) {
  if (!supabase || !team.value) throw new Error('请先创建或加入团队');
  const { error } = await supabase.from('team_locations').delete().eq('id', id).eq('team_id', team.value.id);
  if (error) throw error;
  await loadWorkspace();
}

async function batchDeleteLocations(ids: string[]) {
  if (!supabase || !team.value) throw new Error('请先创建或加入团队');
  if (ids.length === 0) return;
  const { error } = await supabase.from('team_locations').delete().in('id', ids).eq('team_id', team.value.id);
  if (error) throw error;
  await loadWorkspace();
}

async function batchAddLocations(values: Omit<BentoLocation, 'id' | 'isDrawn' | 'createdAt'>[], isOverwrite = false) {
  if (!supabase || !team.value) throw new Error('请先创建或加入团队');
  if (values.length === 0) return;

  if (isOverwrite) {
    const { error: delError } = await supabase.from('team_locations').delete().eq('team_id', team.value.id);
    if (delError) throw delError;
  }

  const rows = values.map(value => ({
    team_id: team.value!.id,
    name: value.name,
    emoji: value.emoji || '🍱',
    tags: prepareTags(value.tags, value.visible),
    price_range: value.priceRange || '',
    recommended_dish: value.recommendedDish || null,
    weight: value.weight || 1,
    meal_categories: value.mealCategories || null,
  }));

  const { error: insError } = await supabase.from('team_locations').insert(rows);
  if (insError) throw insError;
  await loadWorkspace();
}

function clearActiveTeamState() {
  team.value = null;
  locations.value = [];
  todayResult.value = null;
  if (channel) {
    supabase?.removeChannel(channel);
    channel = null;
  }
  localStorage.removeItem('weekly_bento_active_team');
  const url = new URL(window.location.href);
  url.searchParams.delete('team');
  window.history.replaceState({}, '', url);
}

async function leaveTeam(targetTeamId?: string) {
  if (!supabase) return;
  const teamId = targetTeamId || team.value?.id;
  if (!teamId) return;

  isLoading.value = true;
  errorMessage.value = '';
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;
    if (!userId) throw new Error('身份校验失败');

    const { error } = await supabase.from('team_members').delete().eq('team_id', teamId).eq('user_id', userId);
    if (error) throw error;

    if (team.value?.id === teamId) {
      clearActiveTeamState();
    }
    await fetchMyTeams();
    if (!team.value && myTeams.value.length > 0) {
      await switchActiveTeam(myTeams.value[0].public_id);
    }
  } catch (e: any) {
    errorMessage.value = getErrorMessage(e);
    throw e;
  } finally {
    isLoading.value = false;
  }
}

async function deleteTeam(targetTeamId?: string) {
  if (!supabase) return;
  const teamId = targetTeamId || team.value?.id;
  if (!teamId) return;

  isLoading.value = true;
  errorMessage.value = '';
  try {
    const { error } = await supabase.from('teams').delete().eq('id', teamId);
    if (error) throw error;

    if (team.value?.id === teamId) {
      clearActiveTeamState();
    }
    await fetchMyTeams();
    if (!team.value && myTeams.value.length > 0) {
      await switchActiveTeam(myTeams.value[0].public_id);
    }
  } catch (e: any) {
    errorMessage.value = getErrorMessage(e);
    throw e;
  } finally {
    isLoading.value = false;
  }
}

async function addOrUpdateTeamRecord(locationId: string, date: string, note?: string) {
  if (!supabase || !team.value) throw new Error('请先创建或加入团队');
  const { data: sessionData } = await supabase.auth.getSession();
  const currentUserId = sessionData.session?.user?.id;
  if (!currentUserId) throw new Error('身份校验失败');

  const payload: Record<string, any> = {
    team_id: team.value.id,
    location_id: locationId,
    business_date: date,
    drawn_by: currentUserId,
  };
  if (note && note.trim()) {
    payload.note = note.trim();
  }

  let { error } = await supabase.from('team_draws').upsert(payload, { onConflict: 'team_id,business_date' });

  // 如果 Supabase 后台数据库尚未增加 note 列导致 schema cache 报错，自动降级移除 note 重试
  if (error && (error.message.includes("Could not find the 'note' column") || error.message.includes("schema cache"))) {
    delete payload.note;
    const retry = await supabase.from('team_draws').upsert(payload, { onConflict: 'team_id,business_date' });
    error = retry.error;
  }

  if (error) throw error;
  await loadWorkspace();
}

async function deleteTeamRecord(id: string) {
  if (!supabase || !team.value) throw new Error('请先创建或加入团队');
  const { error } = await supabase.from('team_draws').delete().eq('id', id).eq('team_id', team.value.id);
  if (error) throw error;
  await loadWorkspace();
}

const canManage = computed(() => team.value?.role === 'owner' || team.value?.role === 'admin');
const isOwner = computed(() => team.value?.role === 'owner');

const canReroll = computed(() => {
  if (canManage.value) return true;
  return teamPermissions.value.allowMemberReroll !== false;
});

const canEditLocation = computed(() => {
  if (canManage.value) return true;
  return teamPermissions.value.allowMemberEditLocation !== false;
});

export function useTeamWorkspace() {
  return {
    isConfigured: isSupabaseConfigured,
    team,
    myTeams,
    members,
    locations,
    todayResult,
    history: teamHistory,
    isLoading,
    errorMessage,
    pendingInviteUrl,
    canManage,
    isOwner,
    canReroll,
    canEditLocation,
    teamPermissions,
    updateTeamPermissions,
    initialize,
    fetchMyTeams,
    fetchTeamMembers,
    switchActiveTeam,
    openTeam,
    createTeam,
    createInviteUrl,
    buildInviteUrl,
    roll,
    addLocation,
    batchAddLocations,
    updateLocation,
    deleteLocation,
    batchDeleteLocations,
    addOrUpdateTeamRecord,
    deleteTeamRecord,
    leaveTeam,
    deleteTeam,
    refresh: loadWorkspace,
  };
}


