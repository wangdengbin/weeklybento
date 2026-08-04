<template>
  <div v-if="visible" class="modal-overlay" @click.self="handleClose">
    <div class="modal-content auth-modal">
      <div class="modal-header">
        <h3 class="modal-title">
          <User :size="20" class="header-icon" />
          <span>{{ isAnonymous ? '用户账号与同步设置' : '个人账号信息' }}</span>
        </h3>
        <button class="icon-btn close-btn" @click="handleClose">
          <X :size="18" />
        </button>
      </div>

      <!-- 身份状态 Banner -->
      <div class="status-banner" :class="isAnonymous ? 'is-guest' : 'is-logged'">
        <div class="banner-icon">
          <Sparkles v-if="isAnonymous" :size="20" class="text-orange" />
          <UserCheck v-else :size="20" class="text-green" />
        </div>
        <div class="banner-info">
          <div class="banner-title">
            {{ isAnonymous ? '👻 游客免登录模式' : `👤 已登录账号：${userEmail}` }}
          </div>
          <div class="banner-sub">
            {{ isAnonymous ? '绑定邮箱注册后，即可在手机和电脑登录同一账号，实时同步所有团队与菜单数据！' : '您的个人菜单与团队数据已安全关联至此账号，跨设备多端实时同步。' }}
          </div>
        </div>
      </div>

      <!-- 已登录状态展示面板 -->
      <div v-if="!isAnonymous" class="logged-in-panel">
        <div class="account-details-box">
          <div class="detail-row">
            <span class="label">绑定邮箱：</span>
            <span class="val">{{ userEmail }}</span>
          </div>
          <div class="detail-row">
            <span class="label">账户状态：</span>
            <span class="val tag-green">已验证正式账户</span>
          </div>
        </div>

        <button class="btn-danger logout-btn" :disabled="isAuthLoading" @click="handleSignOut">
          <LogOut :size="16" />
          <span>退出当前账号 (重置为游客)</span>
        </button>
      </div>

      <!-- 未登录/游客状态 表单 -->
      <template v-else>
        <!-- 选项卡 Nav -->
        <div class="auth-tabs">
          <button class="tab-btn" :class="{ active: activeTab === 'signin' }" @click="activeTab = 'signin'">
            <span>登录已有账号</span>
          </button>
          <button class="tab-btn" :class="{ active: activeTab === 'signup' }" @click="activeTab = 'signup'">
            <span>绑定/注册新账号</span>
          </button>
        </div>

        <!-- 登录/注册 表单 -->
        <form @submit.prevent="handleSubmit" class="auth-form">
          <div class="form-item">
            <label>电子邮箱：</label>
            <input 
              type="email" 
              v-model="email" 
              placeholder="请输入您的邮箱 (如 name@example.com)" 
              required 
              class="input-field" 
            />
          </div>

          <div class="form-item">
            <label>密码：</label>
            <input 
              type="password" 
              v-model="password" 
              placeholder="请输入密码 (至少 6 位)" 
              required 
              minlength="6"
              class="input-field" 
            />
          </div>

          <div v-if="errorMsg" class="error-log-box">
            {{ errorMsg }}
          </div>

          <div v-if="successMsg" class="success-log-box">
            {{ successMsg }}
          </div>

          <button type="submit" class="btn-primary submit-btn" :disabled="isAuthLoading">
            <LogIn v-if="activeTab === 'signin'" :size="18" />
            <UserPlus v-else :size="18" />
            <span>{{ isAuthLoading ? '提交中...' : (activeTab === 'signin' ? '登录已有账号' : '注册并绑定当前游客数据') }}</span>
          </button>

          <p class="auth-tip">
            {{ activeTab === 'signin' ? '💡 登录电脑端已注册的账号，即可将手机端同步为相同身份！' : '💡 注册后，您当前所有的团队、地点和记录都将完整同步保留。' }}
          </p>
        </form>
      </template>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { User, X, Sparkles, UserCheck, LogIn, UserPlus, LogOut } from 'lucide-vue-next';
import { useAuth } from '../composables/useAuth';
import { soundEffects } from '../composables/useAudio';

const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits(['close']);

const { isAnonymous, userEmail, isAuthLoading, signUpOrUpgrade, signInWithPassword, signOut } = useAuth();

const activeTab = ref<'signin' | 'signup'>('signin');
const email = ref('');
const password = ref('');
const errorMsg = ref('');
const successMsg = ref('');

watch(() => props.visible, (val) => {
  if (val) {
    errorMsg.value = '';
    successMsg.value = '';
    email.value = '';
    password.value = '';
  }
});

async function handleSubmit() {
  errorMsg.value = '';
  successMsg.value = '';

  if (!email.value || !password.value) {
    errorMsg.value = '请正确填写邮箱和密码';
    return;
  }

  soundEffects.playTick(700);

  if (activeTab.value === 'signin') {
    const res = await signInWithPassword(email.value, password.value);
    if (res.success) {
      soundEffects.playWinSound();
      successMsg.value = res.message;
      setTimeout(() => {
        emit('close');
      }, 1200);
    } else {
      errorMsg.value = res.message;
    }
  } else {
    const res = await signUpOrUpgrade(email.value, password.value);
    if (res.success) {
      soundEffects.playWinSound();
      successMsg.value = res.message;
      setTimeout(() => {
        emit('close');
      }, 1500);
    } else {
      errorMsg.value = res.message;
    }
  }
}

async function handleSignOut() {
  if (confirm('确定要退出当前账号吗？退出后系统将自动恢复为游客身份。')) {
    soundEffects.playTick(400);
    await signOut();
    emit('close');
  }
}

function handleClose() {
  emit('close');
}
</script>

<style scoped>
.auth-modal {
  max-width: 440px;
  width: 90%;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.modal-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1.15rem;
  font-weight: 800;
  margin: 0;
}

.header-icon {
  color: var(--primary);
}

.close-btn {
  background: #F1F5F9;
  border: none;
}

/* Status Banner */
.status-banner {
  display: flex;
  gap: 12px;
  padding: 12px;
  border-radius: var(--radius-md);
  border: 1px solid transparent;
}

.status-banner.is-guest {
  background: #FFF7ED;
  border-color: #FDBA74;
}

.status-banner.is-logged {
  background: #F0FDF4;
  border-color: #86EFAC;
}

.banner-title {
  font-size: 0.85rem;
  font-weight: 800;
  color: #0F172A;
  margin-bottom: 2px;
}

.banner-sub {
  font-size: 0.75rem;
  color: #64748B;
  line-height: 1.4;
}

.auth-tabs {
  display: flex;
  background: #F1F5F9;
  padding: 3px;
  border-radius: var(--radius-sm);
  gap: 4px;
}

.tab-btn {
  flex: 1;
  padding: 8px;
  border: none;
  border-radius: 6px;
  background: transparent;
  font-size: 0.85rem;
  font-weight: 700;
  color: #64748B;
  cursor: pointer;
  transition: all 0.2s ease;
}

.tab-btn.active {
  background: #FFFFFF;
  color: #0F172A;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-item label {
  font-size: 0.8rem;
  font-weight: 700;
  color: #334155;
}

.submit-btn {
  width: 100%;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 6px;
}

.auth-tip {
  font-size: 0.73rem;
  color: var(--text-muted);
  text-align: center;
  line-height: 1.4;
  margin: 0;
}

.error-log-box {
  font-size: 0.78rem;
  background: #FEF2F2;
  color: #DC2626;
  border: 1px solid #FCA5A5;
  padding: 8px 10px;
  border-radius: 6px;
}

.success-log-box {
  font-size: 0.78rem;
  background: #F0FDF4;
  color: #166534;
  border: 1px solid #86EFAC;
  padding: 8px 10px;
  border-radius: 6px;
}

.logged-in-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.account-details-box {
  background: #F8FAFC;
  border: 1px solid #E2E8F0;
  border-radius: var(--radius-sm);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.82rem;
}

.detail-row .label {
  color: #64748B;
  font-weight: 600;
}

.detail-row .val {
  font-weight: 700;
  color: #0F172A;
}

.tag-green {
  background: #DCFCE7;
  color: #166534;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 0.72rem;
}

.logout-btn {
  width: 100%;
  padding: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
</style>
