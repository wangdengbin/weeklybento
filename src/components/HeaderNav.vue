<template>
  <header class="header-container">
    <div class="brand-area" @click="handleLogoClick">
      <div class="logo-box">
        <span class="logo-emoji">🍱</span>
      </div>
      <div class="title-box">
        <div class="app-title">
          <span class="shine-text">周周便当</span>
          <span class="version-badge">v1.1</span>
        </div>
        <div class="sub-title">吃什么不纠结 · 随机 Roll 午餐</div>
      </div>
    </div>

    <div class="actions-area">
      <!-- 个人/团队 模式快速切换 Pill Badge -->
      <div 
        class="mode-toggle-pill" 
        @click="toggleMode" 
        :title="settings.activeMode === 'personal' ? '切换至团队共享模式' : '切换至个人独享模式'"
      >
        <span class="mode-item" :class="{ active: settings.activeMode === 'personal' }">🏠 个人</span>
        <span class="mode-item" :class="{ active: settings.activeMode === 'team' }">👥 团队</span>
      </div>

      <!-- 静音/音效切换按钮 -->
      <button class="icon-btn" @click="toggleSound" :title="settings.soundEnabled ? '关闭音效' : '开启音效'">
        <Volume2 v-if="settings.soundEnabled" :size="20" class="text-orange" />
        <VolumeX v-else :size="20" class="text-gray" />
      </button>

      <button
        v-if="settings.activeMode === 'team' && team"
        class="icon-btn"
        type="button"
        title="团队与邀请"
        @click="emit('open-team-modal')"
      >
        <Share2 :size="18" />
      </button>

      <!-- 管理员暗门 / 状态 -->
      <button 
        class="icon-btn admin-btn" 
        :class="{ 'is-admin': isAdminLoggedIn }"
        @click="openAdminModal"
        title="管理员面板 (长按或点击)"
      >
        <ShieldCheck v-if="isAdminLoggedIn" :size="20" class="admin-active-icon" />
        <Lock v-else :size="18" />
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Volume2, VolumeX, ShieldCheck, Lock, Share2 } from 'lucide-vue-next';
import { useBentoStore } from '../composables/useBentoStore';
import { useAdmin } from '../composables/useAdmin';
import { useTeamWorkspace } from '../composables/useTeamWorkspace';
import { soundEffects } from '../composables/useAudio';

const emit = defineEmits(['open-admin-modal', 'open-team-modal']);

const { settings, switchMode } = useBentoStore();
const { isAdminLoggedIn } = useAdmin();
const { team } = useTeamWorkspace();

const clickCount = ref(0);
let clickTimer: number | null = null;

function toggleMode() {
  const nextMode = settings.value.activeMode === 'personal' ? 'team' : 'personal';
  if (nextMode === 'team' && !team.value) {
    emit('open-team-modal');
    return;
  }
  switchMode(nextMode);
  if (settings.value.soundEnabled) soundEffects.playTick(800);
}

function toggleSound() {
  settings.value.soundEnabled = !settings.value.soundEnabled;
  if (settings.value.soundEnabled) {
    soundEffects.playTick(1000);
  }
}

function handleLogoClick() {
  if (settings.value.soundEnabled) soundEffects.playTick(600);
  clickCount.value++;
  if (clickTimer) clearTimeout(clickTimer);

  if (clickCount.value >= 3) {
    clickCount.value = 0;
    openAdminModal();
  } else {
    clickTimer = window.setTimeout(() => {
      clickCount.value = 0;
    }, 1000);
  }
}

function openAdminModal() {
  emit('open-admin-modal');
}
</script>

<style scoped>
.header-container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  background: rgba(255, 255, 255, 0.75);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.8);
  position: sticky;
  top: 0;
  z-index: 40;
  gap: 12px;
}

.brand-area {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  min-width: 0;
  flex-shrink: 1;
}

.logo-box {
  width: 42px;
  height: 42px;
  border-radius: 13px;
  background: linear-gradient(135deg, #FF6B35 0%, #FF8E53 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(255, 107, 53, 0.25);
  transform: rotate(-3deg);
  transition: transform 0.2s ease;
  flex-shrink: 0;
}

.brand-area:active .logo-box {
  transform: rotate(6deg) scale(0.95);
}

.logo-emoji {
  font-size: 22px;
}

.title-box {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.app-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 1.15rem;
  font-weight: 800;
  letter-spacing: -0.5px;
  white-space: nowrap;
}

.version-badge {
  font-size: 0.65rem;
  padding: 2px 6px;
  background: var(--primary-light);
  color: var(--primary);
  border-radius: 8px;
  font-weight: 700;
}

.sub-title {
  font-size: 0.7rem;
  color: var(--text-muted);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.actions-area {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  white-space: nowrap;
}

.icon-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid rgba(0, 0, 0, 0.06);
  background: rgba(255, 255, 255, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--text-main);
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.icon-btn:active {
  transform: scale(0.9);
}

.admin-btn.is-admin {
  background: #FFF7ED;
  border-color: #FDBA74;
  color: #EA580C;
}

.admin-active-icon {
  color: #EA580C;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.15); }
}

/* 个人/团队模式切换胶囊按钮 */
.mode-toggle-pill {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  background: rgba(15, 23, 42, 0.06);
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 20px;
  padding: 3px;
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
  gap: 2px;
  transition: all 0.2s ease;
}

.mode-item {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
  flex-shrink: 0;
  font-size: 0.76rem;
  font-weight: 700;
  line-height: 1;
  padding: 5px 9px;
  border-radius: 16px;
  color: #64748B;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.mode-item.active {
  color: #0F172A;
  background: #FFFFFF;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.06);
}

.mode-toggle-pill:active {
  transform: scale(0.96);
}

.text-orange {
  color: var(--primary);
}

.text-gray {
  color: var(--text-muted);
}
</style>
