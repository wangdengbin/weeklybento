<template>
  <Teleport to="body">
    <!-- 自定义确认弹窗（替代 window.confirm） -->
    <div v-if="currentConfirm" class="fb-confirm-overlay" @click.self="cancelCurrent">
      <div class="fb-confirm-dialog" :class="{ 'is-danger': currentConfirm.danger }">
        <h4 class="fb-confirm-title">{{ currentConfirm.title }}</h4>
        <p class="fb-confirm-message">{{ currentConfirm.message }}</p>
        <div class="fb-confirm-actions">
          <button type="button" class="fb-btn-cancel" @click="cancelCurrent">{{ currentConfirm.cancelText }}</button>
          <button type="button" class="fb-btn-confirm" @click="okCurrent">{{ currentConfirm.confirmText }}</button>
        </div>
      </div>
    </div>

    <!-- 轻提示 Toast 堆栈 -->
    <div class="fb-toast-host">
      <transition-group name="fb-toast">
        <div
          v-for="t in toastState.toasts"
          :key="t.id"
          class="fb-toast"
          :class="`is-${t.type}`"
          @click="dismissToast(t.id)"
        >
          <span class="fb-toast-icon">{{ iconFor(t.type) }}</span>
          <span class="fb-toast-msg">{{ t.message }}</span>
          <button v-if="t.action" type="button" class="fb-toast-action" @click.stop="handleAction(t)">
            {{ t.action.label }}
          </button>
        </div>
      </transition-group>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue';
import { useToast, dismissToast, resolveConfirm, type ToastItem } from '../composables/useToast';

const { toastState } = useToast();

const currentConfirm = computed(() => toastState.confirmQueue[0] || null);

function iconFor(type: string): string {
  if (type === 'success') return '✅';
  if (type === 'error') return '⚠️';
  return '💡';
}

function handleAction(t: ToastItem) {
  dismissToast(t.id);
  t.action?.onClick();
}

function okCurrent() {
  if (currentConfirm.value) resolveConfirm(currentConfirm.value.id, true);
}

function cancelCurrent() {
  if (currentConfirm.value) resolveConfirm(currentConfirm.value.id, false);
}

// ESC 键取消确认弹窗（桌面端键盘可达性）
function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && currentConfirm.value) {
    cancelCurrent();
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
});
</script>

<style scoped>
/* 确认弹窗 */
.fb-confirm-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(4px);
  animation: fbFadeIn 0.18s ease-out;
}

.fb-confirm-dialog {
  width: min(360px, 100%);
  background: #fff;
  border-radius: 16px;
  padding: 22px 20px 18px;
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.25);
  animation: fbPopIn 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.fb-confirm-title {
  font-size: 1.02rem;
  font-weight: 800;
  color: #0f172a;
  margin: 0 0 8px 0;
}

.fb-confirm-dialog.is-danger .fb-confirm-title {
  color: #dc2626;
}

.fb-confirm-message {
  font-size: 0.86rem;
  line-height: 1.55;
  color: #475569;
  margin: 0 0 18px 0;
  white-space: pre-wrap;
}

.fb-confirm-actions {
  display: flex;
  gap: 10px;
}

.fb-confirm-actions button {
  flex: 1;
  padding: 10px 0;
  border-radius: 10px;
  font-size: 0.88rem;
  font-weight: 700;
  cursor: pointer;
  border: none;
  transition: all 0.18s ease;
}

.fb-btn-cancel {
  background: #f1f5f9;
  color: #475569;
}

.fb-btn-cancel:active {
  transform: scale(0.96);
}

.fb-btn-confirm {
  background: linear-gradient(135deg, #ff6b35, #ff8e53);
  color: #fff;
  box-shadow: 0 4px 12px rgba(255, 107, 53, 0.3);
}

.fb-btn-confirm:active {
  transform: scale(0.96);
}

/* 轻提示 Toast */
.fb-toast-host {
  position: fixed;
  top: 14px;
  left: 0;
  right: 0;
  z-index: 10000;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  pointer-events: none;
  padding: 0 16px;
}

.fb-toast {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: 420px;
  width: fit-content;
  padding: 10px 16px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.18);
  border: 1px solid rgba(255, 255, 255, 0.8);
  font-size: 0.86rem;
  font-weight: 600;
  color: #1e293b;
  cursor: pointer;
  backdrop-filter: blur(12px);
  animation: fbToastIn 0.28s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.fb-toast.is-success {
  border-left: 4px solid #10b981;
}

.fb-toast.is-error {
  border-left: 4px solid #ef4444;
}

.fb-toast.is-info {
  border-left: 4px solid #ff8e53;
}

.fb-toast-icon {
  flex-shrink: 0;
}

.fb-toast-msg {
  line-height: 1.4;
}

.fb-toast-action {
  flex-shrink: 0;
  border: none;
  background: #fff7ed;
  color: #c2410c;
  font-size: 0.78rem;
  font-weight: 800;
  padding: 4px 10px;
  border-radius: 999px;
  cursor: pointer;
}

.fb-toast-action:active {
  transform: scale(0.94);
}

.fb-toast-enter-active,
.fb-toast-leave-active {
  transition: all 0.25s ease;
}

.fb-toast-enter-from,
.fb-toast-leave-to {
  opacity: 0;
  transform: translateY(-14px) scale(0.95);
}

@keyframes fbFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes fbPopIn {
  from { opacity: 0; transform: scale(0.9) translateY(8px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}

@keyframes fbToastIn {
  from { opacity: 0; transform: translateY(-14px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
