// 统一解析任意错误对象为可展示的中文消息
export function getErrorMessage(error: unknown): string {
  if (!error) return '';
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (typeof error === 'object') {
    const errObj = error as Record<string, any>;
    if (errObj.message && typeof errObj.message === 'string') return errObj.message;
    if (errObj.error_description && typeof errObj.error_description === 'string') return errObj.error_description;
    if (errObj.details && typeof errObj.details === 'string') return errObj.details;
    if (errObj.hint && typeof errObj.hint === 'string') return errObj.hint;
    try {
      return JSON.stringify(error);
    } catch (e) {
      return String(error);
    }
  }
  return String(error);
}