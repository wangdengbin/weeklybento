<template>
  <div v-if="visible" class="modal-overlay" @click.self="handleClose">
    <div class="modal-content result-card">
      <div class="card-top-decoration">
        <div class="bento-stamp">{{ categoryMeta?.name || 'WEEKLY BENTO' }}</div>
      </div>

      <div class="emoji-container">
        <div class="big-emoji">{{ resultData?.location.emoji }}</div>
      </div>

      <div class="food-info">
        <h2 class="food-name">{{ resultData?.location.name }}</h2>
        
        <div class="fortune-badge">
          ✨ {{ resultData?.fortune || '美味之选！' }}
        </div>

        <!-- ✨ AI 食神点评 & 吃货运势卡片 -->
        <div class="ai-review-section">
          <button 
            v-if="!aiReview" 
            type="button" 
            class="ai-review-trigger-btn"
            :disabled="isAiLoading"
            @click="handleFetchAiReview"
          >
            <Sparkles :size="14" class="sparkle-icon" />
            <span>{{ isAiLoading ? '食神思考中...' : '✨ 请 AI 食神为你点评打分' }}</span>
          </button>

          <div v-else class="ai-review-card animate-fade-in">
            <div class="ai-review-header">
              <Sparkles :size="14" class="text-orange" />
              <span>🔮 AI 食神独家点评</span>
            </div>
            <div class="ai-review-body">
              {{ aiReview }}
            </div>
          </div>
          
          <p v-if="aiError" class="ai-error-text">{{ aiError }}</p>
        </div>

        <div class="tags-row">
          <span v-for="tag in resultData?.location.tags" :key="tag" class="tag-pill">
            # {{ tag }}
          </span>
          <span class="price-tag">{{ resultData?.location.priceRange }}</span>
        </div>

        <div class="recommend-box">
          <div class="box-title-row">
            <span class="box-title">💡 推荐菜品 / 建议：</span>
            <button class="recipe-btn-link" type="button" @click="showRecipeModal = true">
              <ChefHat :size="13" />
              <span>🍳 查看 AI 简易菜谱</span>
            </button>
          </div>
          <div class="box-content">{{ resultData?.location.recommendedDish || '好吃的招牌主食' }}</div>
          
          <!-- 仅在配置了地址或导航链接时展示地图导航 -->
          <div v-if="resultData?.location.address || resultData?.location.mapUrl" class="nav-action-row">
            <button class="nav-btn" type="button" @click="openNavigation(resultData.location)">
              <Navigation :size="14" />
              <span>📍 导航去吃 ({{ resultData.location.address || resultData.location.name }})</span>
            </button>
          </div>
        </div>

        <!-- 个人模式可选金额与记账快捷区 -->
        <div v-if="settings.activeMode === 'personal'" class="expense-input-box">
          <label class="expense-label">💰 实付金额（选填，现填或事后记）：</label>
          <div class="expense-input-row">
            <span class="currency-symbol">￥</span>
            <input 
              type="number" 
              step="0.1" 
              v-model.number="inputCost" 
              placeholder="如 25.5" 
              class="cost-input-field" 
            />
          </div>
        </div>
      </div>

      <div class="card-actions">
        <button class="btn-primary confirm-btn" @click="handleSaveAsPlanned">
          <BookmarkPlus :size="18" />
          <span>📌 保存为{{ categoryMeta?.name || '' }}预选计划</span>
        </button>

        <button class="btn-primary-gradient confirm-btn" @click="handleConfirmEaten">
          <Check :size="18" />
          <span>✅ 确认吃了{{ inputCost ? ` (￥${inputCost})` : '' }}</span>
        </button>

        <button v-if="settings.activeMode === 'personal'" class="btn-secondary re-roll-btn" @click="handleReroll">
          <RefreshCw :size="16" />
          <span>不喜欢，再 Roll 一次</span>
        </button>
      </div>
    </div>

    <!-- 🍳 AI 简易快手菜谱 Modal -->
    <RecipeModal 
      :visible="showRecipeModal" 
      :initialDishName="resultData?.location.recommendedDish || resultData?.location.name" 
      @close="showRecipeModal = false" 
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { Check, RefreshCw, BookmarkPlus, Navigation, Sparkles, ChefHat } from 'lucide-vue-next';
import RecipeModal from './RecipeModal.vue';
import type { BentoLocation, MealCategory } from '../types';
import { MEAL_CATEGORIES } from '../types';
import { useBentoStore } from '../composables/useBentoStore';
import { useCloudSync } from '../composables/useCloudSync';
import { useBentoAI } from '../composables/useBentoAI';
import { soundEffects } from '../composables/useAudio';

const showRecipeModal = ref(false);

const props = defineProps<{
  visible: boolean;
  resultData: { location: BentoLocation; fortune: string } | null;
  category?: MealCategory;
}>();

const emit = defineEmits(['close', 'confirm-record', 'reroll']);

const { markLocationAsDrawn, addDailyRecord, settings, selectedCategory } = useBentoStore();
const { pushToCloud } = useCloudSync();
const { isLoading: isAiLoading, aiError, generateFoodReview } = useBentoAI();

const currentCatKey = computed(() => props.category || selectedCategory.value);
const categoryMeta = computed(() => MEAL_CATEGORIES.find(c => c.key === currentCatKey.value));

const inputCost = ref<number | undefined>(undefined);
const aiReview = ref<string>('');

watch(() => props.visible, (val) => {
  if (val) {
    inputCost.value = undefined;
    aiReview.value = '';
  }
});

async function handleFetchAiReview() {
  if (!props.resultData) return;
  if (settings.value.soundEnabled) soundEffects.playTick(700);

  const loc = props.resultData.location;
  const review = await generateFoodReview({
    locationName: loc.name,
    tags: loc.tags,
    recommendedDish: loc.recommendedDish,
    mealCategory: categoryMeta.value?.name,
  });

  if (review) {
    aiReview.value = review;
    if (settings.value.soundEnabled) soundEffects.playWinSound();
  }
}

function openNavigation(loc: BentoLocation) {
  if (loc.mapUrl) {
    window.open(loc.mapUrl, '_blank');
    return;
  }
  const query = encodeURIComponent(loc.name + (loc.address ? ' ' + loc.address : ''));
  window.open(`https://uri.amap.com/search?keyword=${query}`, '_blank');
}

// 保存为预选计划
function handleSaveAsPlanned() {
  if (!props.resultData) return;
  if (settings.value.soundEnabled) soundEffects.playTick(900);

  if (settings.value.activeMode === 'personal') markLocationAsDrawn(props.resultData.location.id);
  addDailyRecord(props.resultData.location, undefined, undefined, currentCatKey.value, 'planned', inputCost.value);
  if (settings.value.activeMode === 'personal') pushToCloud(true);

  emit('confirm-record');
  emit('close');
}

// 确认直接吃了打卡
function handleConfirmEaten() {
  if (!props.resultData) return;
  if (settings.value.soundEnabled) soundEffects.playTick(900);

  if (settings.value.activeMode === 'personal') markLocationAsDrawn(props.resultData.location.id);
  addDailyRecord(props.resultData.location, undefined, undefined, currentCatKey.value, 'confirmed', inputCost.value);
  if (settings.value.activeMode === 'personal') pushToCloud(true);

  emit('confirm-record');
  emit('close');
}

function handleReroll() {
  if (!props.resultData) return;
  if (settings.value.soundEnabled) soundEffects.playTick(400);

  markLocationAsDrawn(props.resultData.location.id);
  pushToCloud(true);

  emit('reroll');
  emit('close');
}

function handleClose() {
  emit('close');
}
</script>

<style scoped>
.result-card {
  text-align: center;
  position: relative;
  overflow: hidden;
  background: linear-gradient(180deg, #FFFFFF 0%, #FFF7F2 100%);
}

.card-top-decoration {
  position: absolute;
  top: 12px;
  right: 16px;
}

.bento-stamp {
  font-size: 0.65rem;
  font-weight: 800;
  color: #FF8E53;
  border: 1.5px solid #FF8E53;
  padding: 2px 6px;
  border-radius: 4px;
  transform: rotate(5deg);
  letter-spacing: 1px;
}

.emoji-container {
  margin: 10px 0 6px 0;
}

.big-emoji {
  font-size: 4.2rem;
  animation: bounce 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes bounce {
  0% { transform: scale(0.2); }
  60% { transform: scale(1.2); }
  100% { transform: scale(1); }
}

.food-name {
  font-size: 1.6rem;
  font-weight: 800;
  color: var(--text-main);
  margin-bottom: 8px;
}

.fortune-badge {
  display: inline-block;
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--primary);
  background: var(--primary-light);
  padding: 6px 14px;
  border-radius: 20px;
  margin-bottom: 16px;
}

.tags-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-bottom: 16px;
}

.price-tag {
  font-size: 0.8rem;
  font-weight: 700;
  color: #059669;
  background: #ECFDF5;
  padding: 4px 10px;
  border-radius: 20px;
}

.recommend-box {
  background: #FFFFFF;
  border: 1px solid #FFE4D6;
  border-radius: var(--radius-md);
  padding: 12px 16px;
  text-align: left;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
}

.box-title {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--text-muted);
  margin-bottom: 4px;
}

.box-content {
  font-size: 0.92rem;
  font-weight: 600;
  color: var(--text-main);
}

.card-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.confirm-btn {
  width: 100%;
  padding: 14px;
}

.re-roll-btn {
  width: 100%;
  padding: 12px;
}

.expense-input-box {
  background: #FFF7ED;
  border: 1.5px dashed #FFD8B3;
  border-radius: var(--radius-md);
  padding: 10px 14px;
  margin-bottom: 16px;
  text-align: left;
}

.expense-label {
  display: block;
  font-size: 0.8rem;
  font-weight: 700;
  color: #C2410C;
  margin-bottom: 6px;
}

.expense-input-row {
  display: flex;
  align-items: center;
  gap: 4px;
  background: #FFFFFF;
  border: 1px solid #FDBA74;
  border-radius: 8px;
  padding: 4px 10px;
}

.currency-symbol {
  font-size: 1rem;
  font-weight: 800;
  color: #EA580C;
}

.cost-input-field {
  width: 100%;
  border: none;
  outline: none;
  font-size: 1.05rem;
  font-weight: 700;
  color: #334155;
}

.btn-primary-gradient {
  background: linear-gradient(135deg, #10B981 0%, #059669 100%);
  color: #FFFFFF;
  border: none;
  border-radius: var(--radius-md);
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.2s ease;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

.btn-primary-gradient:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(16, 185, 129, 0.4);
}

.nav-action-row {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed #FFE4D6;
}

.nav-btn {
  width: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 12px;
  background: #EFF6FF;
  color: #2563EB;
  border: 1px solid #BFDBFE;
  border-radius: 8px;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
}

.nav-btn:hover {
  background: #DBEAFE;
}

/* ✨ AI 食神点评样式 */
.ai-review-section {
  margin: 10px 0 14px 0;
}

.ai-review-trigger-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 100%);
  border: 1px dashed #FF9933;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 700;
  color: #C2410C;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 6px rgba(255, 153, 51, 0.15);
}

.ai-review-trigger-btn:hover:not(:disabled) {
  transform: scale(1.05);
  background: linear-gradient(135deg, #FFEDD5 0%, #FDBA74 100%);
}

.ai-review-trigger-btn:disabled {
  opacity: 0.7;
  cursor: wait;
}

.sparkle-icon {
  color: #FF6600;
}

.ai-review-card {
  background: linear-gradient(135deg, #FFFBEB 0%, #FFF7ED 100%);
  border: 1px solid #FDE68A;
  border-radius: 12px;
  padding: 10px 14px;
  text-align: left;
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.12);
}

.ai-review-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  font-weight: 800;
  color: #D97706;
  margin-bottom: 4px;
}

.ai-review-body {
  font-size: 0.85rem;
  line-height: 1.45;
  color: #78350F;
  font-weight: 600;
}

.ai-error-text {
  font-size: 0.75rem;
  color: #EF4444;
  margin-top: 4px;
}

.animate-fade-in {
  animation: fadeIn 0.3s ease-out;
}

.box-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.recipe-btn-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #FFF7ED;
  border: 1px solid #FFD8A8;
  border-radius: 6px;
  font-size: 0.72rem;
  color: #C2410C;
  padding: 2px 8px;
  cursor: pointer;
  font-weight: 700;
  transition: transform 0.15s ease;
}

.recipe-btn-link:hover {
  transform: scale(1.05);
  background: #FFE8CC;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
