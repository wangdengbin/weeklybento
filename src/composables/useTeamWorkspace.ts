import { computed, ref } from 'vue';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type { BentoLocation, DailyRecord, TeamRollResult } from '../types';

type TeamRole = 'owner' | 'admin' | 'member' | 'viewer';

interface TeamWorkspace {
  id: string;
  public_id: string;
  name: string;
  role: TeamRole;
}

const team = ref<TeamWorkspace | null>(null);
const locations = ref<BentoLocation[]>([]);
const todayResult = ref<TeamRollResult | null>(null);
const teamHistory = ref<DailyRecord[]>([]);
const isLoading = ref(false);
const errorMessage = ref('');
const pendingInviteUrl = ref('');
let channel: RealtimeChannel | null = null;

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function today() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date());
}

function mapLocation(row: any): BentoLocation {
  return {
    id: row.id,
    name: row.name,
    emoji: row.emoji,
    tags: row.tags || [],
    priceRange: row.price_range || '',
    recommendedDish: row.recommended_dish || undefined,
    weight: row.weight || 1,
    isDrawn: false,
    createdAt: new Date(row.created_at).getTime(),
  };
}

async function ensureAnonymousSession() {
  if (!supabase) throw new Error('尚未配置 Supabase');
  const { data } = await supabase.auth.getSession();
  if (data.session) return;
  const { error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
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
      note: draw.note || (isMe ? '团队协同 Roll (由我选定)' : '团队协同 Roll (团队成员选定)'),
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
}

function startRealtime() {
  if (!supabase || !team.value) return;
  if (channel) supabase.removeChannel(channel);
  const teamId = team.value.id;
  channel = supabase.channel(`weekly-bento-${teamId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'team_locations', filter: `team_id=eq.${teamId}` }, () => loadWorkspace())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'team_draws', filter: `team_id=eq.${teamId}` }, () => loadWorkspace())
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

async function initialize() {
  if (!isSupabaseConfigured) return;
  isLoading.value = true;
  errorMessage.value = '';
  try {
    await ensureAnonymousSession();
    const url = new URL(window.location.href);
    const publicId = url.searchParams.get('team') || localStorage.getItem('weekly_bento_active_team');
    const invite = url.searchParams.get('invite') || undefined;
    if (publicId) await openTeam(publicId, invite);
  } catch (error) {
    errorMessage.value = getErrorMessage(error);
  } finally {
    isLoading.value = false;
  }
}

async function createTeam(name: string, seedLocations: BentoLocation[]) {
  if (!supabase) throw new Error('尚未配置 Supabase');
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

function buildInviteUrl(publicId: string, token: string) {
  const url = new URL(window.location.href);
  url.search = '';
  url.searchParams.set('team', publicId);
  url.searchParams.set('invite', token);
  return url.toString();
}

async function createInviteUrl() {
  if (!supabase || !team.value) throw new Error('请先创建或加入团队');
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
  const { error } = await supabase.from('team_locations').insert({
    team_id: team.value.id, name: value.name, emoji: value.emoji, tags: value.tags,
    price_range: value.priceRange, recommended_dish: value.recommendedDish || null, weight: value.weight,
  });
  if (error) throw error;
  await loadWorkspace();
}

async function updateLocation(value: BentoLocation) {
  if (!supabase || !team.value) throw new Error('请先创建或加入团队');
  const { error } = await supabase.from('team_locations').update({
    name: value.name, emoji: value.emoji, tags: value.tags, price_range: value.priceRange,
    recommended_dish: value.recommendedDish || null, weight: value.weight,
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
    tags: value.tags || [],
    price_range: value.priceRange || '',
    recommended_dish: value.recommendedDish || null,
    weight: value.weight || 1,
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

async function leaveTeam() {
  if (!supabase || !team.value) return;
  isLoading.value = true;
  errorMessage.value = '';
  try {
    const teamId = team.value.id;
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;
    if (!userId) throw new Error('身份校验失败');

    const { error } = await supabase.from('team_members').delete().eq('team_id', teamId).eq('user_id', userId);
    if (error) throw error;

    clearActiveTeamState();
  } catch (e: any) {
    errorMessage.value = getErrorMessage(e);
    throw e;
  } finally {
    isLoading.value = false;
  }
}

async function deleteTeam() {
  if (!supabase || !team.value) return;
  isLoading.value = true;
  errorMessage.value = '';
  try {
    const teamId = team.value.id;
    const { error } = await supabase.from('teams').delete().eq('id', teamId);
    if (error) throw error;

    clearActiveTeamState();
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

  const { error } = await supabase.from('team_draws').upsert({
    team_id: team.value.id,
    location_id: locationId,
    business_date: date,
    drawn_by: currentUserId,
    note: note || '团队补录记录',
  }, { onConflict: 'team_id,business_date' });

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

export function useTeamWorkspace() {
  return {
    isConfigured: isSupabaseConfigured,
    team,
    locations,
    todayResult,
    history: teamHistory,
    isLoading,
    errorMessage,
    pendingInviteUrl,
    canManage,
    isOwner,
    initialize,
    openTeam,
    createTeam,
    createInviteUrl,
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


