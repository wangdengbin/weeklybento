<template>
  <div v-if="visible" class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content debate-modal-content">
      <div class="modal-header-row">
        <div class="header-title">
          <Sparkles class="text-orange" :size="20" />
          <span>🤼 AI 救救纠结症 (双店 PK 辩论)</span>
        </div>
        <button class="close-btn" type="button" @click="$emit('close')">✕</button>
      </div>

      <p class="modal-subtitle">在两家餐厅之间犹豫不决？让 AI 美食大脑评委为你在线打嘴仗选出结果！</p>

      <!-- 双店选择器区域 -->
      <div class="vs-selector-card">
        <div class="select-col">
          <label class="col-label">红方 (选项 A)：</label>
          <select v-model="selectedLoc1Id" class="select-field">
            <option v-for="loc in availableLocations" :key="loc.id" :value="loc.id">
              {{ loc.emoji }} {{ loc.name }} ({{ loc.priceRange }})
            </option>
          </select>
        </div>

        <div class="vs-badge">VS</div>

        <div class="select-col">
          <label class="col-label">蓝方 (选项 B)：</label>
          <select v-model="selectedLoc2Id" class="select-field">
            <option v-for="loc in availableLocations" :key="loc.id" :value="loc.id">
              {{ loc.emoji }} {{ loc.name }} ({{ loc.priceRange }})
            </option>
          </select>
        </div>
      </div>

      <div class="action-btn-row">
        <button 
          type="button" 
          class="btn-primary start-debate-btn" 
          :disabled="isAiLoading || !selectedLoc1 || !selectedLoc2 || selectedLoc1.id === selectedLoc2.id"
          @click="startDebate"
        >
          <Sparkles :size="16" />
          <span>{{ isAiLoading ? '评委激烈辩论中...' : '🔥 开始 AI 美食大辩论' }}</span>
        </button>
        <button 
          type="button" 
          class="btn-secondary small-btn sub-random-btn" 
          @click="randomizeSelection"
        >
          🎲 随机换两家二选一
        </button>
      </div>

      <p v-if="aiError" class="error-msg">{{ aiError }}</p>

      <!-- 辩论过程与结果区 -->
      <div v-if="debateResult" class="debate-result-box animate-fade-in">
        <div class="debate-timeline">
          <div 
            v-for="(item, idx) in debateResult.debate" 
            :key="idx" 
            class="speech-bubble-item"
            :class="item.speaker.includes('热量') ? 'bubble-red' : 'bubble-blue'"
          >
            <div class="speaker-avatar">{{ item.avatar }}</div>
            <div class="speech-content-box">
              <span class="speaker-name">{{ item.speaker }}</span>
              <p class="speech-text">{{ item.content }}</p>
            </div>
          </div>
        </div>

        <!-- 裁判最终裁定卡 -->
        <div class="verdict-card">
          <div class="winner-title">
            🏆 食神裁定胜出：<strong class="winner-name">{{ debateResult.winner }}</strong>
          </div>
          <p class="verdict-text">{{ debateResult.verdict }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { Sparkles } from 'lucide-vue-next';
import type { BentoLocation } from '../types';
import { useBentoAI, type FoodDebateResult } from '../composables/useBentoAI';
import { soundEffects } from '../composables/useAudio';

const props = defineProps<{
  visible: boolean;
  locations: BentoLocation[];
}>();

defineEmits(['close']);

const { isLoading: isAiLoading, aiError, generateFoodDebate } = useBentoAI();

const availableLocations = computed(() => props.locations.filter(l => l.visible !== false));

const selectedLoc1Id = ref('');
const selectedLoc2Id = ref('');

const selectedLoc1 = computed(() => availableLocations.value.find(l => l.id === selectedLoc1Id.value));
const selectedLoc2 = computed(() => availableLocations.value.find(l => l.id === selectedLoc2Id.value));

const debateResult = ref<FoodDebateResult | null>(null);

watch(() => props.visible, (val) => {
  if (val) {
    debateResult.value = null;
    randomizeSelection();
  }
});

function randomizeSelection() {
  const locs = availableLocations.value;
  if (locs.length < 2) return;
  const idx1 = Math.floor(Math.random() * locs.length);
  let idx2 = Math.floor(Math.random() * locs.length);
  while (idx2 === idx1 && locs.length > 1) {
    idx2 = Math.floor(Math.random() * locs.length);
  }
  selectedLoc1Id.value = locs[idx1].id;
  selectedLoc2Id.value = locs[idx2].id;
}

async function startDebate() {
  if (!selectedLoc1.value || !selectedLoc2.value) return;
  soundEffects.playTick(600);

  const res = await generateFoodDebate(
    { name: selectedLoc1.value.name, tags: selectedLoc1.value.tags },
    { name: selectedLoc2.value.name, tags: selectedLoc2.value.tags }
  );

  if (res) {
    debateResult.value = res;
    soundEffects.playWinSound();
  }
}
</script>

<style scoped>
.debate-modal-content {
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
  margin-bottom: 6px;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1.15rem;
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

.modal-subtitle {
  font-size: 0.82rem;
  color: #64748B;
  margin-bottom: 16px;
}

.vs-selector-card {
  display: flex;
  align-items: center;
  gap: 10px;
  background: #F8FAFC;
  border: 1px solid #E2E8F0;
  border-radius: 12px;
  padding: 12px;
  margin-bottom: 14px;
}

.select-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.col-label {
  font-size: 0.75rem;
  font-weight: 700;
  color: #475569;
}

.select-field {
  width: 100%;
  padding: 6px 8px;
  font-size: 0.85rem;
  border: 1px solid #CBD5E1;
  border-radius: 8px;
  background: #FFFFFF;
}

.vs-badge {
  font-size: 1rem;
  font-weight: 900;
  font-style: italic;
  color: #FF6600;
  background: #FFEAD6;
  padding: 4px 8px;
  border-radius: 8px;
}

.action-btn-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: stretch;
  margin-bottom: 16px;
}

.start-debate-btn {
  background: linear-gradient(135deg, #FF9933 0%, #FF6600 100%) !important;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 11px;
  font-size: 0.95rem;
  width: 100%;
}

.sub-random-btn {
  width: 100%;
  justify-content: center;
}

.error-msg {
  font-size: 0.8rem;
  color: #EF4444;
  margin-bottom: 10px;
}

.debate-result-box {
  background: #FFFFFF;
  border: 1px solid #FED7AA;
  border-radius: 14px;
  padding: 14px;
  box-shadow: 0 4px 14px rgba(255, 153, 51, 0.08);
}

.debate-timeline {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 14px;
}

.speech-bubble-item {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}

.speaker-avatar {
  font-size: 24px;
  background: #F1F5F9;
  padding: 4px 8px;
  border-radius: 50%;
}

.speech-content-box {
  flex: 1;
  padding: 8px 12px;
  border-radius: 12px;
}

.bubble-red .speech-content-box {
  background: #FFF1F2;
  border: 1px solid #FECDD3;
}

.bubble-red .speaker-name {
  color: #E11D48;
  font-weight: 800;
  font-size: 0.75rem;
}

.bubble-blue .speech-content-box {
  background: #F0F9FF;
  border: 1px solid #BAE6FD;
}

.bubble-blue .speaker-name {
  color: #0284C7;
  font-weight: 800;
  font-size: 0.75rem;
}

.speech-text {
  font-size: 0.85rem;
  color: #334155;
  margin-top: 2px;
  line-height: 1.4;
}

.verdict-card {
  background: linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%);
  border: 1px solid #F59E0B;
  border-radius: 10px;
  padding: 10px 14px;
  text-align: center;
}

.winner-title {
  font-size: 0.9rem;
  color: #78350F;
}

.winner-name {
  font-size: 1.1rem;
  color: #D97706;
}

.verdict-text {
  font-size: 0.82rem;
  color: #92400E;
  margin-top: 4px;
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
