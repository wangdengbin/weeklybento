<template>
  <header class="header-container">
    <div class="brand-area" @click="handleLogoClick">
      <div class="logo-box">
        <span class="logo-emoji">🍱</span>
      </div>
      <div class="title-box">
        <div class="app-title">
          <span class="shine-text">周周便当</span>
          <span class="version-badge">v1.0</span>
        </div>
        <div class="sub-title">吃什么不纠结 · 随机 Roll 午餐</div>
      </div>
    </div>

    <div class="actions-area">
      <!-- 静音/音效切换按钮 -->
      <button class="icon-btn" @click="toggleSound" :title="settings.soundEnabled ? '关闭音效' : '开启音效'">
        <Volume2 v-if="settings.soundEnabled" :size="20" class="text-orange" />
        <VolumeX v-else :size="20" class="text-gray" />
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
import { Volume2, VolumeX, ShieldCheck, Lock } from 'lucide-vue-next';
import { useBentoStore } from '../composables/useBentoStore';
import { useAdmin } from '../composables/useAdmin';
import { soundEffects } from '../composables/useAudio';

const emit = defineEmits(['open-admin-modal']);

const { settings } = useBentoStore();
const { isAdminLoggedIn } = useAdmin();

const clickCount = ref(0);
let clickTimer: number | null = null;

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
  padding: 16px 20px;
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.8);
  position: sticky;
  top: 0;
  z-index: 40;
}

.brand-area {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
}

.logo-box {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  background: linear-gradient(135deg, #FF6B35 0%, #FF8E53 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(255, 107, 53, 0.25);
  transform: rotate(-3deg);
  transition: transform 0.2s ease;
}

.brand-area:active .logo-box {
  transform: rotate(6deg) scale(0.95);
}

.logo-emoji {
  font-size: 24px;
}

.title-box {
  display: flex;
  flex-direction: column;
}

.app-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 1.25rem;
  font-weight: 800;
  letter-spacing: -0.5px;
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
  font-size: 0.72rem;
  color: var(--text-muted);
  font-weight: 500;
}

.actions-area {
  display: flex;
  align-items: center;
  gap: 8px;
}

.icon-btn {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: 1px solid rgba(0, 0, 0, 0.06);
  background: rgba(255, 255, 255, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--text-main);
  transition: all 0.2s ease;
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

.text-orange {
  color: var(--primary);
}

.text-gray {
  color: var(--text-muted);
}
</style>
