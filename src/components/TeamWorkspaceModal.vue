<template>
  <div v-if="visible" class="modal-overlay" @click.self="emit('close')">
    <section class="team-modal">
      <button class="close-modal-btn" type="button" title="关闭" @click="emit('close')">
        <X :size="15" />
        <span>关闭</span>
      </button>

      <template v-if="!isConfigured">
        <Database :size="30" class="title-icon" />
        <h2>连接 Supabase</h2>
        <p class="muted">请先配置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY。</p>
      </template>

      <!-- 匿名用户限制拦截 Banner -->
      <template v-else-if="isAnonymous">
        <div class="team-heading">
          <Users :size="26" />
          <div class="heading-title-row">
            <h2>午餐搭子圈</h2>
          </div>
        </div>

        <div class="anon-card">
          <div class="anon-icon-box">
            <Lock :size="28" />
          </div>
          <h3>🔒 需绑定正式账号</h3>
          <p class="anon-desc">
            午餐搭子圈支持团队成员多人实时选餐打卡与菜单共享。<br />
            <strong>匿名游客身份无法使用团队功能</strong>，请先登录或绑定正式邮箱账号！
          </p>
          <button class="primary-action anon-btn" type="button" @click="handleOpenAuth">
            <LogIn :size="18" />
            立即登录 / 绑定账号
          </button>
        </div>
      </template>

      <template v-else>
        <!-- 头部栏 -->
        <div class="team-heading">
          <Users :size="26" />
          <div class="heading-title-row">
            <h2>午餐搭子圈</h2>
            <span class="quota-badge">{{ myTeams.length }}/3</span>
          </div>
        </div>

        <!-- 已经加入的团队列表 (最多3个) -->
        <div v-if="myTeams.length > 0" class="my-teams-section">
          <div class="section-label">我的搭子圈列表</div>
          <div class="teams-list">
            <div
              v-for="t in myTeams"
              :key="t.id"
              class="team-card"
              :class="{ 'is-active': team?.public_id === t.public_id }"
            >
              <div class="team-card-header">
                <div class="team-card-info">
                  <div class="team-card-title">
                    <span class="team-emoji">🍱</span>
                    <span class="team-name">{{ t.name }}</span>
                    <span v-if="team?.public_id === t.public_id" class="active-tag">当前选中</span>
                  </div>
                  <div class="team-card-sub">
                    搭子圈号: <strong>{{ t.public_id }}</strong> · {{ getRoleLabel(t.role) }}
                  </div>
                </div>

                <!-- 切换按钮 -->
                <button
                  v-if="team?.public_id !== t.public_id"
                  class="switch-btn"
                  type="button"
                  :disabled="isLoading"
                  @click="handleSwitch(t.public_id)"
                >
                  <CheckCircle2 :size="15" />
                  切换
                </button>
              </div>

              <!-- 如果是当前选中的团队，展开成员列表与邀请/解散操作 -->
              <div v-if="team?.public_id === t.public_id" class="active-team-details">
                <!-- 团队成员列表展示 -->
                <div class="members-box">
                  <div class="members-header">
                    <Users :size="13" />
                    <span>搭子圈成员 ({{ members.length }} 人)</span>
                  </div>
                  <div class="members-list">
                    <div v-for="m in members" :key="m.user_id" class="member-item">
                      <div class="member-left">
                        <span class="member-dot"></span>
                        <span class="member-email" :title="m.email">{{ m.email }}</span>
                        <span v-if="m.is_me" class="me-badge">我</span>
                      </div>
                      <span class="member-role-badge" :class="m.role">{{ getRoleLabel(m.role) }}</span>
                    </div>
                  </div>
                </div>

                <!-- 专属文本复制区 (仅管理人员可见) -->
                <div v-if="canManage" class="share-box">
                  <div class="share-header-row">
                    <label class="share-label">
                      <span>🔗 专属邀请链接 (全选后可直接 Ctrl+C 或长按复制)</span>
                    </label>
                    <button
                      class="refresh-invite-btn"
                      type="button"
                      title="重置并生成新的邀请链接"
                      :disabled="isGeneratingInvite"
                      @click="generateInviteText(true)"
                    >
                      <RefreshCw :size="12" :class="{ 'spin-icon': isGeneratingInvite }" />
                      刷新链接
                    </button>
                  </div>
                  <textarea
                    ref="inviteTextArea"
                    v-model="inviteText"
                    readonly
                    rows="2"
                    class="invite-textarea"
                    :placeholder="isGeneratingInvite ? '正在生成邀请链接...' : '暂无邀请链接'"
                    @click="selectInviteText"
                  ></textarea>

                  <div class="share-btn-row">
                    <button class="primary-action share-main-btn" type="button" :disabled="isLoading || isGeneratingInvite || !inviteText" @click="shareTeam">
                      <Share2 :size="16" />
                      {{ copied ? '已成功复制！' : '复制邀请文本' }}
                    </button>
                  </div>
                </div>

                <!-- 🛡️ 团队权限控制配置 (仅管理人员可见) -->
                <div v-if="canManage" class="perms-box">
                  <div class="perms-header">
                    <Shield :size="13" />
                    <span>🛡️ 团队成员权限控制设置</span>
                  </div>
                  <div class="perms-list">
                    <label class="perm-item-label">
                      <input 
                        type="checkbox" 
                        :checked="teamPermissions.allowMemberReroll !== false" 
                        @change="handleToggleRerollPerm" 
                      />
                      <span>允许成员重新 Roll / 重新选定</span>
                    </label>

                    <label class="perm-item-label">
                      <input 
                        type="checkbox" 
                        :checked="teamPermissions.allowMemberEditLocation !== false" 
                        @change="handleToggleEditLocationPerm" 
                      />
                      <span>允许成员编辑 / 配置地点池</span>
                    </label>
                  </div>
                </div>

                <div class="team-card-actions">
                  <button v-if="t.role === 'owner'" class="danger-mini-action" type="button" :disabled="isLoading" @click="handleDeleteTeam(t)">
                    <Trash2 :size="14" />
                    解散搭子圈
                  </button>
                  <button v-else class="secondary-mini-action" type="button" :disabled="isLoading" @click="handleLeaveTeam(t)">
                    <X :size="14" />
                    关闭并退出搭子圈
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 创建/加入团队面板 -->
        <div class="create-join-section">
          <!-- 配额受限提示 -->
          <div v-if="myTeams.length >= 3" class="quota-full-banner">
            <ShieldAlert :size="18" class="quota-icon" />
            <span>已达到单账户 <strong>3 个团队上限</strong>。若需加入新团队，请先退出或解散已有团队。</span>
          </div>

          <template v-else>
            <!-- Tab 切换创建或加入 -->
            <div class="sub-tab-row">
              <button
                class="sub-tab-btn"
                :class="{ active: actionMode === 'create' }"
                type="button"
                @click="actionMode = 'create'"
              >
                <Plus :size="15" />
                创建新搭子圈
              </button>
              <button
                class="sub-tab-btn"
                :class="{ active: actionMode === 'join' }"
                type="button"
                @click="actionMode = 'join'"
              >
                <UserPlus :size="15" />
                加入已有搭子圈
              </button>
            </div>

            <!-- 创建团队表单 -->
            <form v-if="actionMode === 'create'" class="action-form" @submit.prevent="handleCreate">
              <input v-model="teamName" maxlength="40" placeholder="搭子圈名称，例如：产品部干饭组" required />
              <label class="seed-option">
                <input v-model="usePersonalMenu" type="checkbox" />
                同步我当前的个人地点作为初始菜单
              </label>
              <button class="primary-action" type="submit" :disabled="isLoading || !teamName.trim()">
                <Plus :size="16" />
                {{ isLoading ? '创建中...' : '创建午餐搭子圈' }}
              </button>
            </form>

            <!-- 加入团队表单 -->
            <form v-else class="action-form" @submit.prevent="handleJoin">
              <input v-model="joinPublicId" placeholder="输入搭子圈号 (public_id) 或粘贴邀请链接" required />
              <button class="primary-action" type="submit" :disabled="isLoading || !joinPublicId.trim()">
                <UserPlus :size="16" />
                {{ isLoading ? '加入中...' : '加入搭子圈' }}
              </button>
            </form>
          </template>
        </div>
      </template>

      <p v-if="errorMessage" class="error-text">{{ errorMessage }}</p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { Database, Plus, Share2, Users, X, Trash2, CheckCircle2, UserPlus, ShieldAlert, Lock, LogIn, RefreshCw, Shield } from 'lucide-vue-next';
import { useBentoStore } from '../composables/useBentoStore';
import { useTeamWorkspace } from '../composables/useTeamWorkspace';
import { getErrorMessage } from '../utils/error';
import { useAuth } from '../composables/useAuth';
import { soundEffects } from '../composables/useAudio';

const props = defineProps<{ visible: boolean }>();
const emit = defineEmits(['close', 'open-auth-modal']);
const { locations: personalLocations, switchMode } = useBentoStore();
const { isAnonymous } = useAuth();
const { team, myTeams, members, isConfigured, isLoading, errorMessage, canManage, createTeam, createInviteUrl, buildInviteUrl, openTeam, deleteTeam, leaveTeam, switchActiveTeam, teamPermissions, updateTeamPermissions } = useTeamWorkspace();

function handleToggleRerollPerm(e: Event) {
  const target = e.target as HTMLInputElement;
  updateTeamPermissions({ allowMemberReroll: target.checked });
  if (soundEffects) soundEffects.playTick(600);
}

function handleToggleEditLocationPerm(e: Event) {
  const target = e.target as HTMLInputElement;
  updateTeamPermissions({ allowMemberEditLocation: target.checked });
  if (soundEffects) soundEffects.playTick(600);
}

const actionMode = ref<'create' | 'join'>('create');
const teamName = ref('');
const joinPublicId = ref('');
const usePersonalMenu = ref(true);
const copied = ref(false);
const inviteText = ref('');
const isGeneratingInvite = ref(false);
const inviteTextArea = ref<HTMLTextAreaElement | null>(null);

function getRoleLabel(role: string) {
  return { owner: '所有者', admin: '管理员', member: '成员', viewer: '只读成员' }[role] || '成员';
}

function handleOpenAuth() {
  emit('close');
  emit('open-auth-modal');
}

async function generateInviteText(forceRefresh = false) {
  if (!team.value) return;
  isGeneratingInvite.value = true;
  try {
    const url = await createInviteUrl(forceRefresh);
    const title = team.value.name || '午餐搭子圈';
    inviteText.value = `🍱 邀请你加入【${title}】！点击链接一起在线选餐、实时同步菜单与打卡记录：\n${url}`;
  } catch (e) {
    console.error('Generate invite url error:', e);
    if (team.value) {
      const fallbackUrl = buildInviteUrl(team.value.public_id);
      const title = team.value.name || '午餐搭子圈';
      inviteText.value = `🍱 邀请你加入【${title}】(搭子圈号: ${team.value.public_id})！点击链接一起在线选餐、实时同步菜单与打卡记录：\n${fallbackUrl}`;
    }
  } finally {
    isGeneratingInvite.value = false;
  }
}

watch(
  [() => props.visible, () => team.value?.public_id, () => canManage.value, () => isAnonymous.value],
  async ([visible, publicId, canMgr, anon]) => {
    if (visible && publicId && canMgr && !anon) {
      await generateInviteText();
    } else if (!visible) {
      inviteText.value = '';
    }
  },
  { immediate: true }
);

watch([joinPublicId, teamName, actionMode], () => {
  errorMessage.value = '';
});

function selectInviteText() {
  if (inviteTextArea.value) {
    inviteTextArea.value.focus();
    inviteTextArea.value.select();
    if (soundEffects) soundEffects.playTick(600);
  }
}

async function handleSwitch(publicId: string) {
  soundEffects.playTick(700);
  await switchActiveTeam(publicId);
  switchMode('team');
}

async function handleCreate() {
  errorMessage.value = '';
  try {
    await createTeam(teamName.value, usePersonalMenu.value ? personalLocations.value : []);
    teamName.value = '';
    switchMode('team');
  } catch (err) {
    errorMessage.value = getErrorMessage(err);
  }
}

async function handleJoin() {
  let targetId = joinPublicId.value.trim();
  let inviteToken: string | undefined;
  errorMessage.value = '';

  try {
    if (targetId.startsWith('http')) {
      const parsedUrl = new URL(targetId);
      const teamParam = parsedUrl.searchParams.get('team');
      const inviteParam = parsedUrl.searchParams.get('invite');
      if (teamParam) targetId = teamParam;
      if (inviteParam) inviteToken = inviteParam;
    }

    await openTeam(targetId, inviteToken);
    joinPublicId.value = '';
    switchMode('team');
  } catch (err) {
    errorMessage.value = getErrorMessage(err);
  }
}

async function shareTeam() {
  if (!inviteText.value) {
    await generateInviteText();
  }
  selectInviteText();
  let success = false;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(inviteText.value);
      success = true;
    }
  } catch (e) {
    try {
      success = document.execCommand('copy');
    } catch (e2) {}
  }

  if (success) {
    copied.value = true;
    window.setTimeout(() => { copied.value = false; }, 2500);
  } else {
    alert('文本已自动选中！请按 Ctrl+C / Cmd+C 直接复制。');
  }
}

async function handleDeleteTeam(t: { id: string; name: string }) {
  if (confirm(`⚠️ 危险操作：确定要解散搭子圈“${t.name}”吗？此操作不可恢复！`)) {
    soundEffects.playTick(300);
    errorMessage.value = '';
    try {
      await deleteTeam(t.id);
      if (myTeams.value.length === 0) {
        switchMode('personal');
      }
    } catch (err) {
      errorMessage.value = getErrorMessage(err);
    }
  }
}

async function handleLeaveTeam(t: { id: string; name: string }) {
  if (confirm(`确定要退出搭子圈“${t.name}”吗？`)) {
    soundEffects.playTick(400);
    errorMessage.value = '';
    try {
      await leaveTeam(t.id);
      if (myTeams.value.length === 0) {
        switchMode('personal');
      }
    } catch (err) {
      errorMessage.value = getErrorMessage(err);
    }
  }
}
</script>

<style scoped>
.modal-overlay { position: fixed; inset: 0; z-index: 100; display: grid; place-items: center; padding: 20px; background: rgba(15, 23, 42, 0.5); }
.team-modal { position: relative; width: min(440px, 100%); max-height: 90vh; overflow-y: auto; box-sizing: border-box; padding: 24px; border-radius: 16px; background: #fff; color: #1f2937; text-align: left; box-shadow: 0 24px 60px rgba(15, 23, 42, 0.22); }
.close-modal-btn { position: absolute; top: 16px; right: 16px; display: inline-flex; align-items: center; gap: 4px; background: #F1F5F9; color: #64748B; border: 1px solid #E2E8F0; padding: 4px 10px; border-radius: 16px; font-size: 0.8rem; font-weight: 600; cursor: pointer; transition: all 0.2s ease; }
.close-modal-btn:hover { background: #FFE4E6; color: #E11D48; border-color: #FECDD3; }

.team-heading { display: flex; align-items: center; gap: 10px; margin-bottom: 18px; color: #ea580c; }
.heading-title-row { display: flex; align-items: center; gap: 8px; }
.heading-title-row h2 { margin: 0; color: #111827; font-size: 20px; font-weight: 800; }
.quota-badge { font-size: 12px; font-weight: 700; background: #FFF7ED; color: #EA580C; border: 1px solid #FFEDD5; padding: 2px 8px; border-radius: 12px; }

.muted { margin-top: 4px; color: #64748b; font-size: 14px; line-height: 1.5; }
.title-icon { color: #ea580c; margin-bottom: 12px; }

/* 匿名限制卡片 */
.anon-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 24px 16px;
  background: #FFF7ED;
  border: 1px dashed #FDBA74;
  border-radius: 12px;
  margin-top: 10px;
}
.anon-icon-box {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: #FFEDD5;
  color: #EA580C;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
}
.anon-card h3 { margin: 0 0 8px 0; color: #0F172A; font-size: 17px; font-weight: 800; }
.anon-desc { margin: 0 0 16px 0; color: #475569; font-size: 13px; line-height: 1.5; }
.anon-btn { min-height: 40px; font-size: 14px; }

.section-label { font-size: 13px; font-weight: 700; color: #475569; margin-bottom: 8px; }

.my-teams-section { margin-bottom: 20px; }
.teams-list { display: flex; flex-direction: column; gap: 10px; }

.team-card {
  border: 1px solid #E2E8F0;
  border-radius: 12px;
  padding: 12px 14px;
  background: #F8FAFC;
  transition: all 0.2s ease;
}
.team-card.is-active {
  border-color: #FDBA74;
  background: #FFF7ED;
  box-shadow: 0 4px 12px rgba(234, 88, 12, 0.08);
}

.team-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.team-card-info { flex: 1; min-width: 0; }
.team-card-title { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.team-emoji { font-size: 16px; }
.team-name { font-weight: 700; font-size: 15px; color: #0F172A; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px; }
.active-tag { font-size: 11px; font-weight: 700; background: #EA580C; color: #FFFFFF; padding: 1px 6px; border-radius: 4px; }
.team-card-sub { font-size: 12px; color: #64748B; margin-top: 3px; }

.switch-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  border-radius: 8px;
  background: #FFFFFF;
  border: 1px solid #CBD5E1;
  color: #0F172A;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s ease;
}
.switch-btn:hover { background: #EA580C; border-color: #EA580C; color: #FFFFFF; }

.active-team-details { margin-top: 10px; border-top: 1px dashed #FDBA74; padding-top: 10px; display: flex; flex-direction: column; gap: 10px; }

/* 成员列表 */
.members-box {
  background: #FFFFFF;
  border: 1px solid #FFEDD5;
  border-radius: 8px;
  padding: 10px;
}
.members-header {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 700;
  color: #C2410C;
  margin-bottom: 8px;
}
.members-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.member-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 6px;
  background: #FAFAFA;
  border-radius: 6px;
  font-size: 12px;
}
.member-left {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.member-dot { width: 6px; height: 6px; border-radius: 50%; background: #22C55E; flex-shrink: 0; }
.member-email { font-weight: 600; color: #1E293B; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 260px; }
.me-badge { font-size: 10px; font-weight: 800; background: #DC2626; color: #FFFFFF; padding: 0 4px; border-radius: 3px; }
.member-role-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  background: #F1F5F9;
  color: #475569;
}
.member-role-badge.owner { background: #FEF3C7; color: #D97706; }
.member-role-badge.admin { background: #E0E7FF; color: #4338CA; }

.share-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.refresh-invite-btn {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  background: transparent;
  border: none;
  color: #C2410C;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 4px;
  transition: background 0.15s ease;
}
.refresh-invite-btn:hover:not(:disabled) {
  background: #FFEDD5;
}
.refresh-invite-btn:disabled {
  opacity: 0.5;
  cursor: wait;
}
.spin-icon {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
.share-label { font-size: 11px; font-weight: 700; color: #C2410C; }
.invite-textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 6px 8px;
  border: 1px solid #FDBA74;
  border-radius: 6px;
  background: #FAFAFA;
  color: #1E293B;
  font-size: 12px;
  line-height: 1.4;
  resize: none;
  font-family: inherit;
}
.share-btn-row { display: flex; width: 100%; }
.share-main-btn { width: 100%; font-size: 12px; min-height: 32px; }

.perms-box {
  background: #FFFFFF;
  border: 1px solid #E2E8F0;
  border-radius: 8px;
  padding: 10px;
}
.perms-header {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 700;
  color: #0F172A;
  margin-bottom: 8px;
}
.perms-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.perm-item-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #334155;
  cursor: pointer;
  user-select: none;
}

.team-card-actions { display: flex; justify-content: flex-end; gap: 8px; }
.danger-mini-action {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border: 1px solid #FCA5A5;
  border-radius: 6px;
  background: #FEF2F2;
  color: #DC2626;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}
.secondary-mini-action {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border: 1px solid #E2E8F0;
  border-radius: 6px;
  background: #FFFFFF;
  color: #475569;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}

.create-join-section {
  border-top: 1px solid #F1F5F9;
  padding-top: 16px;
}

.quota-full-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #FEF2F2;
  border: 1px solid #FECACA;
  color: #991B1B;
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 13px;
  line-height: 1.4;
}
.quota-icon { flex-shrink: 0; }

.sub-tab-row {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  background: #F1F5F9;
  padding: 3px;
  border-radius: 10px;
}
.sub-tab-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 7px 10px;
  border: 0;
  background: transparent;
  color: #64748B;
  font-size: 13px;
  font-weight: 700;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}
.sub-tab-btn.active {
  background: #FFFFFF;
  color: #0F172A;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.08);
}

.action-form { display: grid; gap: 10px; }
input[type="text"], input:not([type]) { width: 100%; box-sizing: border-box; padding: 10px 12px; border: 1px solid #CBD5E1; border-radius: 8px; background: #fff; color: #111827; font: inherit; font-size: 13px; }
input:focus { outline: 2px solid #EA580C; border-color: transparent; }
.seed-option { display: flex; align-items: center; gap: 8px; font-weight: 500; font-size: 13px; color: #475569; }
.primary-action { width: 100%; min-height: 38px; display: flex; align-items: center; justify-content: center; gap: 6px; border: 0; border-radius: 8px; background: #ea580c; color: #fff; font-weight: 700; cursor: pointer; font-size: 13px; }
.primary-action:disabled { opacity: 0.55; cursor: wait; }
.error-text { margin-top: 14px; color: #b91c1c; font-size: 13px; text-align: center; }
</style>
