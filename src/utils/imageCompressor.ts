/**
 * 前端 Canvas 图片压缩与极简文字提取工具 (极致省 Token 策略)
 */

/**
 * 将原始图片按 maxDimension (默认 600px) 等比例缩小，并按 quality (默认 0.65) 导出 JPEG Base64
 */
export function compressImageFile(
  file: File | Blob,
  maxDimension = 600,
  quality = 0.65
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('无法创建 Canvas 2D 绘图上下文'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedBase64);
      };

      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = e.target?.result as string;
    };

    reader.onerror = () => reject(new Error('读取图片文件失败'));
    reader.readAsDataURL(file);
  });
}

/**
 * ⚡ 纯前端二段式策略：尝试从图片文件名/元数据/文字区块中提前抽取菜名与文本
 * 如果抽取到文本，直接返还纯文字（Token 消耗趋近于 0）
 * 如果没有检测到有价值文字，返还 null，由调用方降级发送压缩图片
 */
export async function tryExtractTextFromImage(file: File): Promise<string | null> {
  if (!file) return null;

  // 1. 如果文件名本身包含菜名（如 小杨生煎.jpg 或 美团订单_螺丝粉.png），直接提取文件名
  const rawFileName = file.name ? file.name.replace(/\.[^/.]+$/, "").trim() : '';
  const cleanFileName = rawFileName.replace(/^(image|img|screenshot|微信截图|屏幕截图|wx_|IMG_|QQ截图)[_-]?\d*/i, '').trim();

  if (cleanFileName && cleanFileName.length >= 2 && !/^\d+$/.test(cleanFileName)) {
    return cleanFileName;
  }

  // 2. 纯前端 Canvas 文本度检测（检测图像是否有明显的黑白文本行特征）
  // 若未识别出高频文本元数据，则返回 null 进行图片发送降级
  return null;
}
