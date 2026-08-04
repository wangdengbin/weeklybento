import { ref } from 'vue';
import { useBentoStore } from './useBentoStore';

const isAdminLoggedIn = ref(false);

export function useAdmin() {
  const { settings } = useBentoStore();

  function verifyPassword(pwd: string): boolean {
    if (pwd === settings.value.adminPassword) {
      isAdminLoggedIn.value = true;
      return true;
    }
    return false;
  }

  function logout() {
    isAdminLoggedIn.value = false;
  }

  function grantAdminSession() {
    isAdminLoggedIn.value = true;
  }

  function changePassword(oldPwd: string, newPwd: string): { success: boolean; message: string } {
    if (oldPwd !== settings.value.adminPassword) {
      return { success: false, message: '旧密码输入错误' };
    }
    if (!newPwd || newPwd.trim().length < 4) {
      return { success: false, message: '新密码不能小于4位数' };
    }
    settings.value.adminPassword = newPwd.trim();
    return { success: true, message: '管理员密码修改成功！' };
  }

  return {
    isAdminLoggedIn,
    verifyPassword,
    logout,
    grantAdminSession,
    changePassword,
  };
}
