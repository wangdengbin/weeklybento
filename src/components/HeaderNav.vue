<template>
  <header class="header-container">
    <div class="header-main-row">
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
        <!-- 桌面端内嵌 模式切换胶囊 -->
        <div class="mode-toggle-pill desktop-mode-pill">
          <span
            class="mode-item"
            :class="{ active: settings.activeMode === 'personal' }"
            @click="selectPersonalMode"
            title="切换至个人独享模式"
          >
            🏠 个人
          </span>
          <span
            class="mode-item team-mode-item"
            :class="{ active: settings.activeMode === 'team' }"
            @click="selectTeamMode"
            :title="isAnonymous ? '使用搭子圈多人协同功能需要先注册/登录账号' : (settings.activeMode === 'team' ? '点击切换团队或管理邀请' : '切换至午餐搭子模式')"
          >
            👥 {{ displayTeamName }}
            <span v-if="isAnonymous" class="login-tip-badge">🔒 需登录</span>
            <ChevronDown v-else-if="settings.activeMode === 'team'" :size="13" class="team-arrow-icon" />
          </span>
        </div>

        <!-- ⚡ 云端实时同步状态指示 -->
        <span
          v-if="realtimeStatus === 'connecting' || realtimeStatus === 'subscribed' || realtimeStatus === 'error'"
          class="realtime-badge"
          :class="'rt-' + realtimeStatus"
          :title="realtimeStatusText"
        >
          <span class="rt-dot"></span>
          <span class="rt-label">{{ realtimeStatusText }}</span>
        </span>

        <!-- 账号登录/身份 状态按钮 -->
        <button 
          class="icon-btn auth-btn" 
          :class="{ 'is-logged': !isAnonymous }"
          @click="emit('open-auth-modal')"
          :title="isAnonymous ? '当前为游客身份，点击注册/登录绑定账号' : `已登录：${userEmail}`"
        >
          <UserCheck v-if="!isAnonymous" :size="18" class="text-green" />
          <User v-else :size="18" />
        </button>

        <!-- 静音/音效切换按钮 -->
        <button class="icon-btn" @click="toggleSound" :title="settings.soundEnabled ? '关闭音效' : '开启音效'">
          <Volume2 v-if="settings.soundEnabled" :size="20" class="text-orange" />
          <VolumeX v-else :size="20" class="text-gray" />
        </button>

        <!-- 搭子圈切换/管理按钮 -->
        <button
          v-if="settings.activeMode === 'team'"
          class="icon-btn team-manage-btn"
          type="button"
          :title="team ? `当前搭子圈：${team.name} (点击切换/管理)` : '午餐搭子圈与邀请'"
          @click="emit('open-team-modal')"
        >
          <Users :size="18" class="text-orange" />
        </button>

        <!-- 📍 扫描周边美食 & AI 整理入口 -->
        <button 
          class="icon-btn scan-nearby-btn" 
          @click="emit('open-scan-modal')"
          title="扫描周边 500m-2000m 美食，AI 自动整理维护"
        >
          <Compass :size="18" class="text-orange" />
        </button>

        <!-- 管理控制台按钮 -->
        <button 
          class="icon-btn admin-btn is-admin" 
          @click="openAdminModal"
          title="地点池与管理控制台"
        >
          <SlidersHorizontal :size="18" class="admin-active-icon" />
        </button>
      </div>
    </div>

    <!-- 移动端独立第二行：宽体居中模式切换 segmented pill -->
    <div class="mobile-mode-row">
      <div class="mode-toggle-pill mobile-mode-pill">
        <span
          class="mode-item"
          :class="{ active: settings.activeMode === 'personal' }"
          @click="selectPersonalMode"
        >
          🏠 个人独享
        </span>
        <span
          class="mode-item team-mode-item"
          :class="{ active: settings.activeMode === 'team' }"
          @click="selectTeamMode"
        >
          👥 {{ displayTeamName }}
          <ChevronDown v-if="settings.activeMode === 'team'" :size="13" class="team-arrow-icon" />
        </span>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { Volume2, VolumeX, Users, User, UserCheck, ChevronDown, SlidersHorizontal, Compass } from 'lucide-vue-next';
import { useBentoStore } from '../composables/useBentoStore';
import { useTeamWorkspace } from '../composables/useTeamWorkspace';
import { useAuth } from '../composables/useAuth';
import { useCloudSync } from '../composables/useCloudSync';
import { soundEffects } from '../composables/useAudio';

const emit = defineEmits(['open-admin-modal', 'open-team-modal', 'open-auth-modal', 'open-scan-modal']);

const { settings, switchMode } = useBentoStore();
const { team, myTeams } = useTeamWorkspace();
const { isAnonymous, userEmail } = useAuth();
const { realtimeStatus } = useCloudSync();

const realtimeStatusText = computed(() => {
  switch (realtimeStatus.value) {
    case 'connecting': return '同步连接中';
    case 'subscribed': return '实时同步中';
    case 'error': return '同步已离线';
    default: return '';
  }
});

const clickCount = ref(0);
let clickTimer: number | null = null;

const displayTeamName = computed(() => {
  if (team.value?.name) {
    return team.value.name.length > 7 ? team.value.name.slice(0, 6) + '...' : team.value.name;
  }
  return '午餐搭子';
});

function selectPersonalMode() {
  switchMode('personal');
  if (settings.value.soundEnabled) soundEffects.playTick(800);
}

function selectTeamMode() {
  if (isAnonymous.value) {
    emit('open-team-modal');
    if (settings.value.soundEnabled) soundEffects.playTick(600);
    return;
  }
  if (settings.value.activeMode === 'team') {
    emit('open-team-modal');
    if (settings.value.soundEnabled) soundEffects.playTick(600);
    return;
  }
  if (!team.value && myTeams.value.length === 0) {
    emit('open-team-modal');
    return;
  }
  switchMode('team');
  if (settings.value.soundEnabled) soundEffects.playTick(800);
}

function toggleSound() {
  settings.value.soundEnabled = !settings.value.soundEnabled;
  settings.value.updatedAt = Date.now();
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
  flex-direction: column;
  padding: 10px 16px;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(14px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.9);
  position: sticky;
  top: 0;
  z-index: 40;
  gap: 6px;
}

.header-main-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 10px;
}

.brand-area {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  min-width: 0;
  flex-shrink: 0;
}

.logo-box {
  width: 40px;
  height: 40px;
  border-radius: 12px;
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
  font-size: 20px;
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
  flex-shrink: 0;
}

.sub-title {
  font-size: 0.68rem;
  color: var(--text-muted);
  font-weight: 500;
  white-space: nowrap;
}

.actions-area {
  display: flex;
  align-items: center;
  gap: 8px;
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
  gap: 3px;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.team-arrow-icon {
  margin-left: 1px;
  color: #EA580C;
  opacity: 0.8;
}

.mode-item.active {
  color: #0F172A;
  background: #FFFFFF;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.06);
}

.mode-toggle-pill:active {
  transform: scale(0.96);
}

.mobile-mode-row {
  display: none;
  width: 100%;
  justify-content: center;
  padding-top: 2px;
}

/* 响应式断点：当窗口宽度小于等于 580px 时分层显示 */
@media (max-width: 580px) {
  .desktop-mode-pill {
    display: none !important;
  }
  .mobile-mode-row {
    display: flex;
  }
  .mobile-mode-pill {
    width: 100%;
    justify-content: space-between;
  }
  .mobile-mode-pill .mode-item {
    flex: 1;
    text-align: center;
  }
}

.auth-btn.is-logged {
  background: #F0FDF4;
  border-color: #86EFAC;
}

.text-green {
  color: #166534;
}

.text-orange {
  color: var(--primary);
}

.login-tip-badge {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 0.65rem;
  font-weight: 800;
  background: linear-gradient(135deg, #FEF2F2 0%, #FEE2E2 100%);
  color: #DC2626;
  padding: 1px 6px;
  border-radius: 8px;
  border: 1px solid #FCA5A5;
  margin-left: 3px;
  box-shadow: 0 1px 4px rgba(220, 38, 38, 0.15);
  animation: loginTipPulse 2.2s infinite cubic-bezier(0.4, 0, 0.6, 1);
  transform-origin: center;
}

@keyframes loginTipPulse {
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 1px 4px rgba(220, 38, 38, 0.15);
    border-color: #FCA5A5;
  }
  50% {
    transform: scale(1.06);
    box-shadow: 0 3px 10px rgba(220, 38, 38, 0.35);
    border-color: #EF4444;
    background: linear-gradient(135deg, #FEE2E2 0%, #FECDD3 100%);
  }
}

.text-gray {
  color: var(--text-muted);
}

/* ⚡ 云端实时同步状态指示 */
.realtime-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 9px 3px 7px;
  border-radius: 20px;
  font-size: 0.68rem;
  font-weight: 700;
  white-space: nowrap;
  flex-shrink: 0;
  border: 1px solid transparent;
  transition: all 0.25s ease;
}

.rt-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.rt-subscribed {
  background: rgba(240, 253, 244, 0.9);
  border-color: #86EFAC;
  color: #166534;
}

.rt-subscribed .rt-dot {
  background: #22C55E;
  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.18);
  animation: rtPulse 2.4s infinite;
}

.rt-connecting {
  background: rgba(255, 251, 235, 0.9);
  border-color: #FCD34D;
  color: #92400E;
}

.rt-connecting .rt-dot {
  background: #F59E0B;
  animation: rtPulse 1.1s infinite;
}

.rt-error {
  background: rgba(254, 242, 242, 0.9);
  border-color: #FCA5A5;
  color: #991B1B;
}

.rt-error .rt-dot {
  background: #EF4444;
}

@keyframes rtPulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.55; transform: scale(0.8); }
}

/* 小屏只显示圆点，节省空间 */
@media (max-width: 580px) {
  .rt-label {
    display: none;
  }
  .realtime-badge {
    padding: 3px 7px;
  }
}
</style>
