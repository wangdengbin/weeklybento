<template>
  <div v-if="visible" class="modal-overlay" @click.self="handleClose">
    <div class="modal-content result-card">
      <div class="card-top-decoration">
        <div class="bento-stamp">WEEKLY BENTO</div>
      </div>

      <div class="emoji-container">
        <div class="big-emoji">{{ resultData?.location.emoji }}</div>
      </div>

      <div class="food-info">
        <h2 class="food-name">{{ resultData?.location.name }}</h2>
        
        <div class="fortune-badge">
          ✨ {{ resultData?.fortune || '美味之选！' }}
        </div>

        <div class="tags-row">
          <span v-for="tag in resultData?.location.tags" :key="tag" class="tag-pill">
            # {{ tag }}
          </span>
          <span class="price-tag">{{ resultData?.location.priceRange }}</span>
        </div>

        <div class="recommend-box">
          <div class="box-title">💡 推荐菜品 / 建议：</div>
          <div class="box-content">{{ resultData?.location.recommendedDish || '好吃的招牌主食' }}</div>
        </div>
      </div>

      <div class="card-actions">
        <button class="btn-primary confirm-btn" @click="handleConfirm">
          <Check :size="20" />
          <span>打卡并记录为今日午餐</span>
        </button>

        <button v-if="settings.activeMode === 'personal'" class="btn-secondary re-roll-btn" @click="handleReroll">
          <RefreshCw :size="18" />
          <span>不满意，再 Roll 一次</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Check, RefreshCw } from 'lucide-vue-next';
import type { BentoLocation } from '../types';
import { useBentoStore } from '../composables/useBentoStore';
import { useCloudSync } from '../composables/useCloudSync';
import { soundEffects } from '../composables/useAudio';

const props = defineProps<{
  visible: boolean;
  resultData: { location: BentoLocation; fortune: string } | null;
}>();

const emit = defineEmits(['close', 'confirm-record', 'reroll']);

const { markLocationAsDrawn, addDailyRecord, settings } = useBentoStore();
const { pushToCloud } = useCloudSync();

function handleConfirm() {
  if (!props.resultData) return;
  if (settings.value.soundEnabled) soundEffects.playTick(900);

  // 1. 标记本轮已吃
  if (settings.value.activeMode === 'personal') markLocationAsDrawn(props.resultData.location.id);
  // 2. 写入今日记录
  addDailyRecord(props.resultData.location);
  // 3. 即时推送更新至云数据库
  if (settings.value.activeMode === 'personal') pushToCloud(true);

  emit('confirm-record');
  emit('close');
}

function handleReroll() {
  if (!props.resultData) return;
  if (settings.value.soundEnabled) soundEffects.playTick(400);

  // 不喜欢，依旧移出待抽池
  markLocationAsDrawn(props.resultData.location.id);
  // 实时同步状态至云端
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
</style>
