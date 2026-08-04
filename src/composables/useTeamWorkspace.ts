import { computed, ref } from 'vue';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type { BentoLocation, TeamRollResult } from '../types';

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
  const [{ data: locationRows, error: locationError }, { data: drawRows, error: drawError }] = await Promise.all([
    supabase.from('team_locations').select('*').eq('team_id', team.value.id).order('created_at'),
    supabase.from('team_draws').select('*').eq('team_id', team.value.id).eq('business_date', today()).limit(1),
  ]);
  if (locationError) throw locationError;
  if (drawError) throw drawError;
  locations.value = (locationRows || []).map(mapLocation);
  const draw = drawRows?.[0];
  const location = draw ? locations.value.find(item => item.id === draw.location_id) : null;
  todayResult.value = draw && location ? {
    date: draw.business_date,
    locationId: location.id,
    locationName: location.name,
    emoji: location.emoji,
    tags: location.tags,
    priceRange: location.priceRange,
    recommendedDish: location.recommendedDish,
    rolledAt: new Date(draw.drawn_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    rolledBy: '团队成员',
  } : null;
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

const canManage = computed(() => team.value?.role === 'owner' || team.value?.role === 'admin');

export function useTeamWorkspace() {
  return {
    isConfigured: isSupabaseConfigured,
    team,
    locations,
    todayResult,
    isLoading,
    errorMessage,
    pendingInviteUrl,
    canManage,
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
    refresh: loadWorkspace,
  };
}

