<template>
  <div v-if="visible" class="modal-overlay" @click.self="closeModal">
    <div class="modal-content admin-modal">
      <div v-if="settings.activeMode === 'team' && !canEditLocation" class="login-box">
        <div class="lock-icon-wrap"><ShieldAlert :size="36" class="lock-icon" /></div>
        <h3 class="login-title">没有管理权限</h3>
        <p class="login-desc">团队管理员已限制普通成员编辑地点池。</p>
        <button type="button" class="btn-secondary" @click="closeModal">关闭</button>
      </div>

      <div v-else-if="!isAdminLoggedIn" class="login-box">
        <div class="lock-icon-wrap">
          <ShieldAlert :size="36" class="lock-icon" />
        </div>
        <h3 class="login-title">管理员身份验证</h3>
        <p class="login-desc">请输入管理员密码以配置地点池与管理记录</p>

        <form @submit.prevent="handleLogin" class="login-form">
          <input 
            type="password" 
            v-model="passwordInput" 
            placeholder="请输入管理员密码" 
            class="input-field"
            required
            ref="pwdInputRef"
          />
          <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>

          <div class="tip-line">
            💡 默认初始密码为: <strong>admin888</strong>
          </div>

          <div class="form-actions">
            <button type="button" class="btn-secondary" @click="closeModal">取消</button>
            <button type="submit" class="btn-primary">解锁控制台</button>
          </div>
        </form>
      </div>

      <!-- 已登录状态，包含核心管理控制台组件 -->
      <div v-else class="panel-box">
        <AdminPanel @close="closeModal" @open-scan-modal="emit('open-scan-modal')" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import { ShieldAlert } from 'lucide-vue-next';
import { useAdmin } from '../composables/useAdmin';
import { useBentoStore } from '../composables/useBentoStore';
import { useTeamWorkspace } from '../composables/useTeamWorkspace';
import { soundEffects } from '../composables/useAudio';
import AdminPanel from './AdminPanel.vue';

const props = defineProps<{ visible: boolean }>();
const emit = defineEmits(['close', 'open-scan-modal']);

const { isAdminLoggedIn, verifyPassword, grantAdminSession } = useAdmin();
const { settings } = useBentoStore();
const { canEditLocation } = useTeamWorkspace();

const passwordInput = ref('');
const errorMsg = ref('');
const pwdInputRef = ref<HTMLInputElement | null>(null);

watch(() => props.visible, (newVal) => {
  if (newVal) {
    // 个人模式或有权限的团队模式直接自动解锁管理控制台，免去密码锁
    if (settings.value.activeMode === 'personal' || (settings.value.activeMode === 'team' && canEditLocation.value)) {
      grantAdminSession();
    }
    passwordInput.value = '';
    errorMsg.value = '';
    nextTick(() => {
      pwdInputRef.value?.focus();
    });
  }
});

function handleLogin() {
  const success = verifyPassword(passwordInput.value);
  if (success) {
    if (settings.value.soundEnabled) soundEffects.playWinSound();
    errorMsg.value = '';
  } else {
    if (settings.value.soundEnabled) soundEffects.playTick(200);
    errorMsg.value = '密码错误，请重新输入';
  }
}

function closeModal() {
  emit('close');
}
</script>

<style scoped>
.admin-modal {
  max-width: 480px;
}

.login-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 10px 0;
}

.lock-icon-wrap {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: #FFF7ED;
  border: 2px solid #FDBA74;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
}

.lock-icon {
  color: #EA580C;
}

.login-title {
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--text-main);
  margin-bottom: 6px;
}

.login-desc {
  font-size: 0.85rem;
  color: var(--text-muted);
  margin-bottom: 20px;
}

.login-form {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.error-msg {
  font-size: 0.8rem;
  color: #EF4444;
  font-weight: 600;
}

.tip-line {
  font-size: 0.78rem;
  color: var(--text-muted);
  background: var(--primary-light);
  padding: 8px;
  border-radius: var(--radius-sm);
}

.form-actions {
  display: flex;
  gap: 12px;
  margin-top: 8px;
}

.form-actions button {
  flex: 1;
}

.panel-box {
  width: 100%;
}
</style>
