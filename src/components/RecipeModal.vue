<template>
  <div v-if="visible" class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content recipe-modal-content">
      <div class="modal-header-row">
        <div class="header-title">
          <ChefHat class="text-orange" :size="22" />
          <span>🍳 AI 15分钟快手便当菜谱</span>
        </div>
        <button class="close-btn" type="button" @click="$emit('close')">✕</button>
      </div>

      <!-- 搜索或粘贴截图区域 -->
      <div class="search-upload-box">
        <div class="input-btn-row">
          <input 
            type="text" 
            v-model="inputDishName" 
            placeholder="输入菜名 (如: 蒜香蜗牛加金米饭/酸菜鱼)" 
            class="input-field flex-1"
            @keyup.enter="handleFetchRecipe"
          />
          <button 
            type="button" 
            class="btn-primary fetch-recipe-btn"
            :disabled="isAiLoading || !inputDishName.trim()"
            @click="handleFetchRecipe"
          >
            <Sparkles :size="15" />
            <span>{{ isAiLoading ? '大厨推导中...' : '生成菜谱' }}</span>
          </button>
        </div>

        <!-- 📷 截图上传/粘贴上传区 -->
        <div class="image-drop-area" @paste="handlePaste">
          <label class="upload-label">
            <Upload :size="14" />
            <span>{{ isCompressing ? '压缩图片中...' : '上传/粘贴美食截图/小票 (可 Ctrl+V 粘贴)' }}</span>
            <input type="file" accept="image/*" @change="handleFileSelect" hidden />
          </label>
          <span v-if="compressedSizeText" class="compress-badge">⚡ 已完成极简 Token 压缩 ({{ compressedSizeText }})</span>
        </div>
      </div>

      <p v-if="aiError" class="error-msg">{{ aiError }}</p>

      <!-- 🍳 菜谱卡片展现区 -->
      <div v-if="recipe" class="recipe-card animate-fade-in">
        <div class="recipe-card-header">
          <div class="dish-title-row">
            <h3 class="dish-name">{{ recipe.dishName }}</h3>
            <span class="difficulty-tag">{{ recipe.difficulty }}</span>
          </div>
          <span class="servings-badge">🍱 {{ recipe.servings }}</span>
        </div>

        <!-- 食材清单表 -->
        <div class="ingredients-section">
          <div class="section-title-row">
            <span class="sec-title">🛒 必备食材清单：</span>
            <button type="button" class="copy-ingredients-btn" @click="copyIngredients">
              📋 复制清单
            </button>
          </div>
          <div class="ingredients-grid">
            <div v-for="(item, idx) in recipe.ingredients" :key="idx" class="ing-item">
              <span class="ing-name">{{ item.name }}</span>
              <span class="ing-amount">{{ item.amount }}</span>
            </div>
          </div>
        </div>

        <!-- 烹饪步骤 -->
        <div class="steps-section">
          <div class="sec-title">🍳 15分钟快手步骤：</div>
          <ol class="steps-list">
            <li v-for="(step, idx) in recipe.steps" :key="idx" class="step-item">
              {{ step }}
            </li>
          </ol>
        </div>

        <!-- 秘诀 -->
        <div v-if="recipe.chefTips" class="chef-tips-card">
          {{ recipe.chefTips }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { ChefHat, Sparkles, Upload } from 'lucide-vue-next';
import { useBentoAI, type RecipeResult } from '../composables/useBentoAI';
import { compressImageFile, tryExtractTextFromImage } from '../utils/imageCompressor';
import { soundEffects } from '../composables/useAudio';

const props = defineProps<{
  visible: boolean;
  initialDishName?: string;
}>();

defineEmits(['close']);

const { isLoading: isAiLoading, aiError, generateRecipe, parseLocationText } = useBentoAI();

const inputDishName = ref('');
const recipe = ref<RecipeResult | null>(null);
const isCompressing = ref(false);
const compressedSizeText = ref('');

watch(() => props.visible, (val) => {
  if (val) {
    recipe.value = null;
    compressedSizeText.value = '';
    inputDishName.value = props.initialDishName || '';
    if (props.initialDishName) {
      handleFetchRecipe();
    }
  }
});

async function handleFetchRecipe() {
  if (!inputDishName.value.trim()) return;
  soundEffects.playTick(600);

  const res = await generateRecipe(inputDishName.value);
  if (res) {
    recipe.value = res;
    soundEffects.playWinSound();
  }
}

// 识别上传或粘贴的图片 (二段式极简 Token 策略)
async function processImage(file: File) {
  try {
    isCompressing.value = true;
    compressedSizeText.value = '';

    // 1. 优先尝试纯前端提取图片文字/菜名
    const extractedText = await tryExtractTextFromImage(file);

    if (extractedText) {
      // 成功提取到文本 -> 仅传纯文字 (Token 消耗趋近于 0！)
      compressedSizeText.value = '⚡ 前端纯文字提取 (免图 Token)';
      inputDishName.value = extractedText;
    } else {
      // 未提炼出文本 -> 进行微型 Canvas 图片压缩降级发送
      const compressedBase64 = await compressImageFile(file, 600, 0.65);
      const sizeKB = Math.round(compressedBase64.length / 1024);
      compressedSizeText.value = `图片降级 ${sizeKB} KB`;

      const textRes = await parseLocationText(`图片识图: ${file.name}`);
      if (textRes && textRes.name) {
        inputDishName.value = textRes.name;
      } else {
        inputDishName.value = file.name.replace(/\.[^/.]+$/, "") || '特色便当菜';
      }
    }

    await handleFetchRecipe();
  } catch (err: any) {
    console.error('图片处理识别失败:', err);
  } finally {
    isCompressing.value = false;
  }
}

function handleFileSelect(e: Event) {
  const target = e.target as HTMLInputElement;
  if (target.files && target.files[0]) {
    processImage(target.files[0]);
  }
}

function handlePaste(e: ClipboardEvent) {
  const items = e.clipboardData?.items;
  if (!items) return;

  for (let i = 0; i < items.length; i++) {
    if (items[i].type.indexOf('image') !== -1) {
      const file = items[i].getAsFile();
      if (file) {
        processImage(file);
        break;
      }
    }
  }
}

function copyIngredients() {
  if (!recipe.value) return;
  const list = recipe.value.ingredients.map(i => `${i.name}: ${i.amount}`).join('\n');
  navigator.clipboard.writeText(`🛒 ${recipe.value.dishName} 食材采购清单：\n${list}`);
  soundEffects.playTick(800);
  alert('已成功复制食材清单到剪贴板！');
}
</script>

<style scoped>
.recipe-modal-content {
  max-width: 520px;
  width: 92%;
  max-height: 85vh;
  overflow-y: auto;
  padding: 20px;
  background: #FFFDF9;
  border-radius: 20px;
}

.modal-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1.1rem;
  font-weight: 800;
  color: #1E293B;
}

.close-btn {
  background: none;
  border: none;
  font-size: 18px;
  color: #94A3B8;
  cursor: pointer;
}

.search-upload-box {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 14px;
}

.input-btn-row {
  display: flex;
  gap: 8px;
}

.fetch-recipe-btn {
  background: linear-gradient(135deg, #FF9933 0%, #FF6600 100%) !important;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

.image-drop-area {
  background: #FFF7ED;
  border: 1px dashed #FF9933;
  border-radius: 10px;
  padding: 8px 12px;
  text-align: center;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.upload-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.78rem;
  font-weight: 600;
  color: #C2410C;
  cursor: pointer;
}

.compress-badge {
  font-size: 0.7rem;
  color: #059669;
  background: #ECFDF5;
  padding: 2px 6px;
  border-radius: 6px;
  font-weight: 700;
}

.error-msg {
  font-size: 0.8rem;
  color: #EF4444;
  margin-bottom: 10px;
}

.recipe-card {
  background: #FFFFFF;
  border: 1px solid #FED7AA;
  border-radius: 14px;
  padding: 16px;
  box-shadow: 0 4px 14px rgba(255, 153, 51, 0.08);
}

.recipe-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #F1F5F9;
}

.dish-name {
  font-size: 1.15rem;
  font-weight: 800;
  color: #1E293B;
}

.difficulty-tag {
  font-size: 0.72rem;
  background: #FEF3C7;
  color: #D97706;
  padding: 2px 6px;
  border-radius: 6px;
  font-weight: 700;
  margin-left: 6px;
}

.servings-badge {
  font-size: 0.78rem;
  color: #64748B;
}

.sec-title {
  font-size: 0.85rem;
  font-weight: 800;
  color: #334155;
}

.ingredients-section {
  margin-bottom: 14px;
  background: #FAF5FF;
  border: 1px solid #F3E8FF;
  border-radius: 10px;
  padding: 10px;
}

.section-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.copy-ingredients-btn {
  background: #FFFFFF;
  border: 1px solid #D8B4FE;
  border-radius: 6px;
  font-size: 0.72rem;
  color: #7E22CE;
  padding: 2px 8px;
  cursor: pointer;
  font-weight: 600;
}

.ingredients-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px 12px;
}

.ing-item {
  display: flex;
  justify-content: space-between;
  font-size: 0.8rem;
  background: #FFFFFF;
  padding: 4px 8px;
  border-radius: 6px;
}

.ing-name {
  color: #475569;
  font-weight: 600;
}

.ing-amount {
  color: #9333EA;
  font-weight: 700;
}

.steps-section {
  margin-bottom: 12px;
}

.steps-list {
  margin: 6px 0 0 18px;
  padding: 0;
  font-size: 0.85rem;
  color: #334155;
  line-height: 1.5;
}

.step-item {
  margin-bottom: 6px;
}

.chef-tips-card {
  background: linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%);
  border: 1px solid #F59E0B;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 0.8rem;
  color: #78350F;
  font-weight: 600;
}

.animate-fade-in {
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
