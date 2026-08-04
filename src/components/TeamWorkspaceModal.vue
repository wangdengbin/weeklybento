<template>
  <div v-if="visible" class="modal-overlay" @click.self="emit('close')">
    <section class="team-modal">
      <button class="close-button" type="button" title="关闭" @click="emit('close')">
        <X :size="20" />
      </button>

      <template v-if="!isConfigured">
        <Database :size="30" class="title-icon" />
        <h2>连接 Supabase</h2>
        <p class="muted">请先配置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY。</p>
      </template>

      <template v-else-if="team">
        <div class="team-heading">
          <Users :size="26" />
          <div>
            <h2>{{ team.name }}</h2>
            <p class="muted">团队号 {{ team.public_id }} · {{ roleLabel }}</p>
          </div>
        </div>

        <div class="team-actions-group">
          <button v-if="canManage" class="primary-action" type="button" :disabled="isLoading" @click="shareTeam">
            <Share2 :size="18" />
            {{ copied ? '邀请链接已复制' : '复制新的邀请链接' }}
          </button>

          <button v-if="isOwner" class="danger-action" type="button" :disabled="isLoading" @click="handleDeleteTeam">
            <Trash2 :size="16" />
            解散团队
          </button>
          <button v-else class="secondary-action" type="button" :disabled="isLoading" @click="handleLeaveTeam">
            <LogOut :size="16" />
            退出团队
          </button>
        </div>
      </template>

      <template v-else>
        <div class="team-heading">
          <Users :size="26" />
          <div>
            <h2>创建团队菜单</h2>
            <p class="muted">创建后会获得可分享的团队邀请链接。</p>
          </div>
        </div>
        <form @submit.prevent="handleCreate">
          <label for="team-name">团队名称</label>
          <input id="team-name" v-model="teamName" maxlength="40" placeholder="例如：产品部干饭组" required />
          <label class="seed-option">
            <input v-model="usePersonalMenu" type="checkbox" />
            使用当前个人菜单作为团队初始菜单
          </label>
          <button class="primary-action" type="submit" :disabled="isLoading || !teamName.trim()">
            <Plus :size="18" />
            {{ isLoading ? '创建中...' : '创建团队' }}
          </button>
        </form>
      </template>

      <p v-if="errorMessage" class="error-text">{{ errorMessage }}</p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { Database, Plus, Share2, Users, X, Trash2, LogOut } from 'lucide-vue-next';
import { useBentoStore } from '../composables/useBentoStore';
import { useTeamWorkspace } from '../composables/useTeamWorkspace';
import { soundEffects } from '../composables/useAudio';

defineProps<{ visible: boolean }>();
const emit = defineEmits(['close']);
const { locations: personalLocations, switchMode } = useBentoStore();
const { team, isConfigured, isLoading, errorMessage, canManage, isOwner, createTeam, createInviteUrl, deleteTeam, leaveTeam } = useTeamWorkspace();
const teamName = ref('');
const usePersonalMenu = ref(true);
const copied = ref(false);

const roleLabel = computed(() => ({ owner: '所有者', admin: '管理员', member: '成员', viewer: '只读成员' }[team.value?.role || 'member']));

async function handleCreate() {
  await createTeam(teamName.value, usePersonalMenu.value ? personalLocations.value : []);
  switchMode('team');
}

async function shareTeam() {
  const url = await createInviteUrl();
  if (navigator.share) {
    await navigator.share({ title: team.value?.name || '团队菜单', text: '加入我的周周便当团队', url });
  } else {
    await navigator.clipboard.writeText(url);
    copied.value = true;
    window.setTimeout(() => { copied.value = false; }, 2000);
  }
}

async function handleDeleteTeam() {
  if (!team.value) return;
  if (confirm(`⚠️ 危险操作：确定要解散团队“${team.value.name}”吗？此操作将永久删除团队下所有菜单和抽签记录，不可恢复！`)) {
    soundEffects.playTick(300);
    await deleteTeam();
    switchMode('personal');
    alert('团队已成功解散！已自动返回个人模式。');
    emit('close');
  }
}

async function handleLeaveTeam() {
  if (!team.value) return;
  if (confirm(`确定要退出团队“${team.value.name}”吗？`)) {
    soundEffects.playTick(400);
    await leaveTeam();
    switchMode('personal');
    alert('已成功退出团队！已自动返回个人模式。');
    emit('close');
  }
}
</script>

<style scoped>
.modal-overlay { position: fixed; inset: 0; z-index: 100; display: grid; place-items: center; padding: 20px; background: rgba(15, 23, 42, 0.5); }
.team-modal { position: relative; width: min(420px, 100%); box-sizing: border-box; padding: 28px; border-radius: 8px; background: #fff; color: #1f2937; text-align: left; box-shadow: 0 24px 60px rgba(15, 23, 42, 0.22); }
.close-button { position: absolute; top: 12px; right: 12px; width: 36px; height: 36px; display: grid; place-items: center; border: 0; background: transparent; color: #64748b; cursor: pointer; }
.team-heading { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; color: #ea580c; }
.team-heading h2, .team-modal h2 { margin: 0; color: #111827; font-size: 20px; }
.muted { margin-top: 4px; color: #64748b; font-size: 14px; line-height: 1.5; }
.title-icon { color: #ea580c; margin-bottom: 12px; }
form { display: grid; gap: 12px; }
label { color: #374151; font-size: 14px; font-weight: 700; }
input[type="text"], input:not([type]) { width: 100%; box-sizing: border-box; padding: 11px 12px; border: 1px solid #d1d5db; border-radius: 6px; background: #fff; color: #111827; font: inherit; }
.seed-option { display: flex; align-items: center; gap: 8px; font-weight: 500; }
.primary-action { width: 100%; min-height: 44px; display: flex; align-items: center; justify-content: center; gap: 8px; border: 0; border-radius: 6px; background: #ea580c; color: #fff; font-weight: 700; cursor: pointer; }
.primary-action:disabled { opacity: 0.55; cursor: wait; }
.error-text { margin-top: 14px; color: #b91c1c; font-size: 14px; }
</style>
