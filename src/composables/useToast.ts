import { reactive } from 'vue';

/**
 * 全局 Toast / Confirm 系统
 * - toast：顶部滑入的轻提示（success / error / info），可携带撤销等动作按钮
 * - confirm：替代原生 window.confirm 的自定义确认弹窗（返回 Promise<boolean>）
 * 通过 <ToastHost /> 挂载渲染（App.vue 中 Teleport 到 body）。
 */

export type ToastType = 'success' | 'error' | 'info';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
  action?: ToastAction;
}

export interface ConfirmItem {
  id: number;
  title: string;
  message: string;
  danger: boolean;
  confirmText: string;
  cancelText: string;
  resolve: (v: boolean) => void;
}

export const toastState = reactive<{
  toasts: ToastItem[];
  confirmQueue: ConfirmItem[];
}>({
  toasts: [],
  confirmQueue: [],
});

let toastSeq = 0;
let confirmSeq = 0;

function pushToast(type: ToastType, message: string, action?: ToastAction, duration = 3200) {
  const id = ++toastSeq;
  toastState.toasts.push({ id, type, message, action });
  window.setTimeout(() => dismissToast(id), action ? 6500 : duration);
}

export function dismissToast(id: number) {
  const idx = toastState.toasts.findIndex(t => t.id === id);
  if (idx >= 0) toastState.toasts.splice(idx, 1);
}

export function resolveConfirm(id: number, result: boolean) {
  const idx = toastState.confirmQueue.findIndex(c => c.id === id);
  if (idx >= 0) {
    const item = toastState.confirmQueue[idx];
    toastState.confirmQueue.splice(idx, 1);
    item.resolve(result);
  }
}

export function useToast() {
  function confirm(options: { title: string; message: string; danger?: boolean; confirmText?: string; cancelText?: string }): Promise<boolean> {
    return new Promise<boolean>(resolve => {
      toastState.confirmQueue.push({
        id: ++confirmSeq,
        title: options.title,
        message: options.message,
        danger: options.danger !== false,
        confirmText: options.confirmText || '确定',
        cancelText: options.cancelText || '取消',
        resolve,
      });
    });
  }

  return {
    toastState,
    success: (message: string, action?: ToastAction) => pushToast('success', message, action),
    error: (message: string) => pushToast('error', message, undefined, 4200),
    info: (message: string, action?: ToastAction) => pushToast('info', message, action, 4200),
    confirm,
    dismissToast,
    resolveConfirm,
  };
}
