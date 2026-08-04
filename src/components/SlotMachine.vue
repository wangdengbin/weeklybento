<template>
  <div class="slot-machine-container">
    <!-- 团队模式：今日已有团队选定结果卡片 -->
    <div v-if="hasTodayTeamResult && !forceShowMachine" class="team-result-card glass-card">
      <div class="team-card-header">
        <span class="team-badge">👥 团队协同模式</span>
        <span class="team-status-tag">今日已选定</span>
      </div>

      <div class="team-card-body">
        <div class="big-emoji-wrap">{{ todayTeamResult?.emoji }}</div>
        <h2 class="team-location-title">{{ todayTeamResult?.locationName }}</h2>
        
        <div class="tags-row" v-if="todayTeamResult?.tags?.length">
          <span v-for="tag in todayTeamResult.tags" :key="tag" class="tag-pill"># {{ tag }}</span>
          <span class="price-tag" v-if="todayTeamResult?.priceRange">{{ todayTeamResult.priceRange }}</span>
        </div>

        <div class="recommend-box" v-if="todayTeamResult?.recommendedDish">
          <span class="box-label">💡 推荐菜品：</span>
          <span class="box-text">{{ todayTeamResult.recommendedDish }}</span>
        </div>

        <div class="team-meta-info">
          ⏰ 抽取时间：{{ todayTeamResult?.rolledAt }} · {{ todayTeamResult?.rolledBy || '团队成员' }} 已锁定今日菜单
        </div>
      </div>

      <div class="team-card-actions">
        <button class="btn-primary" @click="handleRecordTeamResult">
          <Check :size="18" />
          <span>记录为我的今日日志</span>
        </button>
        <button class="btn-secondary" @click="handleRerollTeamResult">
          <RotateCcw :size="18" />
          <span>重新选定 (重抽并同步团队)</span>
        </button>
      </div>
    </div>

    <template v-else>
      <!-- 池子进度提示卡 -->
      <div class="pool-status-card">
        <div class="status-info">
          <span class="status-dot" :class="{ 'is-empty': isPoolEmpty }"></span>
          <span class="status-text">
            <template v-if="settings.activeMode === 'team'">[👥 团队待抽池] </template>
            待抽池：<strong>{{ availablePool.length }}</strong> / {{ locations.length }} 个地点
          </span>

          <label class="weekly-toggle-badge" title="开启后本周 (周一至周日) 已抽中过的餐厅不会再次重抽">
            <input type="checkbox" v-model="settings.weeklyNoRepeat" class="weekly-checkbox" />
            <span>📅 按周不重复</span>
          </label>
        </div>
        <button v-if="drawnList.length > 0" class="reset-link" @click="handleResetPool">
          <RotateCcw :size="13" />
          重置池子 (已吃{{ drawnList.length }})
        </button>
      </div>

      <!-- 主老虎机机器 Frame -->
      <div class="machine-frame glass-card">
        <div class="machine-header">
          <Sparkles class="sparkle-icon" :size="18" />
          <span>{{ settings.activeMode === 'team' ? 'TEAM RANDOM ROLL' : 'BENTO RANDOM ROLL' }}</span>
          <Sparkles class="sparkle-icon" :size="18" />
        </div>

        <!-- 栏目标题 Row -->
        <div class="reels-header-row">
          <div class="column-title">类型/口味</div>
          <div class="column-title main-title">今日午餐地</div>
          <div class="column-title">吃货运势</div>
        </div>

        <!-- 老虎机 Display 窗口 (纯 3D 滚轮) -->
        <div class="display-window">
          <!-- 渐变阴影遮罩 (顶部与底部) -->
          <div class="window-overlay"></div>

          <!-- 中奖高亮指示线框 -->
          <div class="target-highlight-bar">
            <span class="pointer-arrow left">▶</span>
            <span class="pointer-arrow right">◀</span>
          </div>

          <!-- 3D 滚动槽 1: 标签/氛围 -->
          <div class="reel-column">
            <div class="reel-viewport">
              <div class="reel-strip" :style="{ transform: `translateY(-${reel1Offset}px)`, transition: reelTransition }">
                <div v-for="(item, idx) in reel1Items" :key="idx" class="reel-item">
                  <span class="reel-tag">{{ item }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 3D 滚动槽 2: 地点与 Emoji (核心) -->
          <div class="reel-column main-reel">
            <div class="reel-viewport">
              <div class="reel-strip" :style="{ transform: `translateY(-${reel2Offset}px)`, transition: reelTransition }">
                <div v-for="(loc, idx) in reel2Items" :key="idx" class="reel-item loc-item">
                  <span class="item-emoji">{{ loc.emoji }}</span>
                  <span class="item-name">{{ loc.name }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 3D 滚动槽 3: 运势判词 -->
          <div class="reel-column">
            <div class="reel-viewport">
              <div class="reel-strip" :style="{ transform: `translateY(-${reel3Offset}px)`, transition: reelTransition }">
                <div v-for="(word, idx) in reel3Items" :key="idx" class="reel-item">
                  <span class="reel-fortune">{{ word }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 摇杆/启动按钮区 -->
        <div class="action-bar">
          <button 
            class="btn-primary roll-btn" 
            :disabled="isRolling || isPoolEmpty" 
            @click="startRoll"
          >
            <div class="btn-inner">
              <Dice5 v-if="!isRolling" :size="24" class="btn-icon" />
              <RefreshCw v-else :size="24" class="btn-icon spin-icon" />
              <span class="btn-text">
                {{ isRolling ? '抽取中...' : (isPoolEmpty ? '池子已空 请重置' : (settings.activeMode === 'team' ? '帮团队选午餐！(ROLL)' : '帮我选午餐！(ROLL)')) }}
              </span>
            </div>
          </button>

          <p class="anti-repeat-tip">
            ✨ {{ settings.activeMode === 'team' ? '团队模式协同：任何人完成 Roll 后全员自动同步' : '不重复机制生效中：抽中地点自动移出本轮待抽池' }}
          </p>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { Sparkles, Dice5, RefreshCw, RotateCcw, Check } from 'lucide-vue-next';
import confetti from 'canvas-confetti';
import { useBentoStore } from '../composables/useBentoStore';
import { useTeamWorkspace } from '../composables/useTeamWorkspace';
import { soundEffects } from '../composables/useAudio';
import type { BentoLocation } from '../types';

const emit = defineEmits(['roll-complete']);

const {
  locations: personalLocations,
  availablePool: personalAvailablePool,
  drawnList: personalDrawnList,
  getRandomLocation,
  resetPool,
  settings,
  addDailyRecord,
} = useBentoStore();
const {
  locations: teamLocations,
  todayResult: teamTodayResult,
  roll: rollTeam,
} = useTeamWorkspace();

const locations = computed(() => settings.value.activeMode === 'team' ? teamLocations.value : personalLocations.value);
const availablePool = computed(() => settings.value.activeMode === 'team' ? teamLocations.value : personalAvailablePool.value);
const drawnList = computed(() => settings.value.activeMode === 'team' ? [] : personalDrawnList.value);
const isPoolEmpty = computed(() => availablePool.value.length === 0);
const todayTeamResult = computed(() => teamTodayResult.value);

const isRolling = ref(false);
const forceShowMachine = ref(false);

const todayStr = computed(() => new Date().toISOString().slice(0, 10));

const hasTodayTeamResult = computed(() => {
  return settings.value.activeMode === 'team' &&
    !!todayTeamResult.value &&
    todayTeamResult.value.date === todayStr.value;
});

function handleRecordTeamResult() {
  if (!todayTeamResult.value) return;
  const targetLoc = locations.value.find(l => l.id === todayTeamResult.value?.locationId);
  if (targetLoc) {
    addDailyRecord(targetLoc);
  } else {
    addDailyRecord({
      id: todayTeamResult.value.locationId,
      name: todayTeamResult.value.locationName,
      emoji: todayTeamResult.value.emoji,
      tags: todayTeamResult.value.tags,
      priceRange: todayTeamResult.value.priceRange || '￥20-30',
      weight: 1,
      isDrawn: true,
      createdAt: Date.now(),
    });
  }
  if (settings.value.soundEnabled) soundEffects.playTick(900);
  alert('已将今日团队选定菜单记录至您的个人日志！');
}

function handleRerollTeamResult() {
  if (settings.value.soundEnabled) soundEffects.playTick(700);
  if (confirm('确定重新抽取并重置团队选定菜单吗？')) {
    forceShowMachine.value = true;
  }
}

const FORTUNE_WORDS = [
  '绝不反悔！', '加个汉堡！', '香到迷糊！', '老板加个蛋！', 
  '今天吃好点！', '热气腾腾！', '爽快干饭！', '胃口大开！',
  '满足满满！', '打卡美味！'
];

// 动态构造滚轮列表
const reel1Items = ref<string[]>(['辣味香浓', '热乎汤面', '减脂清淡', '快乐美食', '经典快餐', '鲜美下饭']);
const reel2Items = ref<BentoLocation[]>(locations.value);
const reel3Items = ref<string[]>(FORTUNE_WORDS);

const reel1Offset = ref(0);
const reel2Offset = ref(0);
const reel3Offset = ref(0);
const reelTransition = ref('transform 0.1s ease-out');

const ITEM_HEIGHT = 64; // 单项精准高度 (px)

function prepareReels() {
  const currentPool = availablePool.value.length > 0 ? availablePool.value : locations.value;
  // 复制多份制造无限滚动的视觉
  const repeatedLocs: BentoLocation[] = [];
  for (let i = 0; i < 6; i++) {
    repeatedLocs.push(...currentPool);
  }
  reel2Items.value = repeatedLocs;

  const tagsList = ['🔥 极其过瘾', '🍜 汤汁浓郁', '🥗 健康清爽', '🍔 碳水快乐', '🍱 经典必吃', '🍲 鲜香味美'];
  const repeatedTags: string[] = [];
  for (let i = 0; i < 10; i++) {
    repeatedTags.push(...tagsList);
  }
  reel1Items.value = repeatedTags;

  const repeatedFortunes: string[] = [];
  for (let i = 0; i < 10; i++) {
    repeatedFortunes.push(...FORTUNE_WORDS);
  }
  reel3Items.value = repeatedFortunes;
}

async function startRoll() {
  if (isRolling.value) return;

  let targetLoc: BentoLocation | null = null;
  if (settings.value.activeMode === 'team') {
    const shouldForce = forceShowMachine.value;
    forceShowMachine.value = true;
    try {
      const result = await rollTeam(shouldForce);
      targetLoc = teamLocations.value.find(item => item.id === result.locationId) || {
        id: result.locationId,
        name: result.locationName,
        emoji: result.emoji,
        tags: result.tags,
        priceRange: result.priceRange || '',
        recommendedDish: result.recommendedDish,
        weight: 1,
        isDrawn: false,
        createdAt: Date.now(),
      };
    } catch (error) {
      forceShowMachine.value = false;
      alert(error instanceof Error ? error.message : '团队抽签失败');
      return;
    }
  } else {
    targetLoc = getRandomLocation();
  }
  if (!targetLoc) return;

  isRolling.value = true;
  if (settings.value.soundEnabled) soundEffects.playTick(500);

  prepareReels();

  let targetIndexInPool = -1;
  for (let i = reel2Items.value.length - 1; i >= 0; i--) {
    if (reel2Items.value[i].id === targetLoc.id) {
      targetIndexInPool = i;
      break;
    }
  }
  const targetReel2Index = (targetIndexInPool >= 1 ? targetIndexInPool : Math.floor(reel2Items.value.length / 2)) - 1;

  const targetReel1Index = Math.floor(Math.random() * (reel1Items.value.length - 10)) + 5;
  const targetReel3Index = Math.floor(Math.random() * (reel3Items.value.length - 10)) + 5;

  // 设置动画
  reelTransition.value = 'transform 2.5s cubic-bezier(0.15, 0.85, 0.35, 1.02)';
  reel1Offset.value = Math.max(0, targetReel1Index) * ITEM_HEIGHT;
  reel2Offset.value = Math.max(0, targetReel2Index) * ITEM_HEIGHT;
  reel3Offset.value = Math.max(0, targetReel3Index) * ITEM_HEIGHT;

  // 播放转动喀哒音效
  let audioTimer: number | undefined;
  if (settings.value.soundEnabled) {
    let interval = 80;
    const playLoop = () => {
      soundEffects.playReelClick();
      interval += 12; // 逐渐变慢
      if (interval < 300 && isRolling.value) {
        audioTimer = window.setTimeout(playLoop, interval);
      }
    };
    playLoop();
  }

  // 动画结束 (2.5s)
  setTimeout(() => {
    isRolling.value = false;
    if (settings.value.activeMode === 'team') forceShowMachine.value = false;
    if (audioTimer) clearTimeout(audioTimer);

    if (settings.value.soundEnabled) {
      soundEffects.playWinSound();
      soundEffects.vibrate([100, 50, 100]);
    }

    // 彩带特效
    confetti({
      particleCount: 70,
      spread: 60,
      origin: { y: 0.65 },
      colors: ['#FF6B35', '#FFC72C', '#FF3366', '#4ADE80']
    });

    // 触发抽中回调
    emit('roll-complete', {
      location: targetLoc,
      fortune: reel3Items.value[targetReel3Index + 1] || '今日美味特供！'
    });
  }, 2600);
}

function handleResetPool() {
  if (settings.value.soundEnabled) soundEffects.playTick(700);
  resetPool();
}
</script>

<style scoped>
.slot-machine-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
}

.pool-status-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.7);
  border-radius: var(--radius-md);
  font-size: 0.85rem;
  box-shadow: var(--shadow-sm);
}

.status-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #22C55E;
}

.status-dot.is-empty {
  background: #EF4444;
}

.weekly-toggle-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.72rem;
  font-weight: 700;
  color: #0F172A;
  background: #F1F5F9;
  border: 1px solid #CBD5E1;
  border-radius: 12px;
  padding: 2px 8px;
  margin-left: 6px;
  cursor: pointer;
  user-select: none;
}

.weekly-checkbox {
  width: 13px;
  height: 13px;
  accent-color: #FF6B00;
  cursor: pointer;
}

.reset-link {
  background: none;
  border: none;
  color: var(--primary);
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
}

.machine-frame {
  padding: 20px 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  background: linear-gradient(180deg, #FFFFFF 0%, #FFF5EE 100%);
  border: 2px solid #FFE4D6;
}

.machine-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 0.85rem;
  font-weight: 800;
  color: var(--primary);
  letter-spacing: 1px;
}

.sparkle-icon {
  color: var(--accent);
}

/* 栏目标题头 Row */
.reels-header-row {
  display: grid;
  grid-template-columns: 1fr 1.6fr 1fr;
  gap: 8px;
  padding: 0 8px;
}

.column-title {
  font-size: 0.72rem;
  color: var(--text-muted);
  font-weight: 700;
  text-align: center;
}

.column-title.main-title {
  color: var(--primary);
}

/* 老虎机 Display 窗口 */
.display-window {
  display: grid;
  grid-template-columns: 1fr 1.6fr 1fr;
  gap: 8px;
  height: 192px; /* 3 * 64px 精确高度 */
  background: #18181B;
  border-radius: var(--radius-md);
  padding: 0 6px;
  position: relative;
  overflow: hidden;
  box-shadow: inset 0 8px 20px rgba(0, 0, 0, 0.7);
  border: 3px solid #FFD8CC;
}

/* 顶部与底部渐变阴影覆盖 */
.window-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(
    180deg, 
    rgba(24, 24, 27, 0.92) 0%, 
    rgba(0, 0, 0, 0) 30%, 
    rgba(0, 0, 0, 0) 70%, 
    rgba(24, 24, 27, 0.92) 100%
  );
  pointer-events: none;
  z-index: 10;
}

/* 精确中间中奖区域高亮框 */
.target-highlight-bar {
  position: absolute;
  top: 64px; /* 精确定位在第2行 (64px - 128px) */
  left: 4px;
  right: 4px;
  height: 64px;
  border-top: 2px dashed #F59E0B;
  border-bottom: 2px dashed #F59E0B;
  background: rgba(245, 158, 11, 0.12);
  pointer-events: none;
  z-index: 9;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4px;
}

.pointer-arrow {
  color: #F59E0B;
  font-size: 0.7rem;
  animation: blink 1s infinite alternate;
}

@keyframes blink {
  from { opacity: 0.5; }
  to { opacity: 1; }
}

.reel-column {
  display: flex;
  flex-direction: column;
  align-items: center;
  overflow: hidden;
  height: 100%;
}

.reel-viewport {
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: relative;
}

.reel-strip {
  display: flex;
  flex-direction: column;
  will-change: transform;
}

.reel-item {
  height: 64px; /* 精确 64px */
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.85rem;
  color: #F4F4F5;
  font-weight: 600;
  text-align: center;
}

.reel-tag {
  font-size: 0.75rem;
  color: #FDE047;
  background: rgba(254, 240, 138, 0.15);
  padding: 4px 8px;
  border-radius: 12px;
  white-space: nowrap;
}

.loc-item {
  display: flex;
  flex-direction: row; /* 横向排列或靠紧居中 */
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 4px;
}

.item-emoji {
  font-size: 1.4rem;
  line-height: 1;
}

.item-name {
  font-size: 0.95rem;
  font-weight: 800;
  color: #FFFFFF;
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.6);
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reel-fortune {
  font-size: 0.78rem;
  color: #FF8E53;
  font-weight: 700;
}

.action-bar {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  margin-top: 4px;
}

.roll-btn {
  width: 100%;
  height: 56px;
}

.btn-inner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
}

.btn-icon {
  flex-shrink: 0;
}

.btn-text {
  font-size: 1.15rem;
  font-weight: 800;
  letter-spacing: 0.5px;
}

.spin-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.anti-repeat-tip {
  font-size: 0.73rem;
  color: var(--text-muted);
  text-align: center;
}

/* 团队选定卡片样式 */
.team-result-card {
  padding: 24px 20px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  background: rgba(255, 255, 255, 0.85);
  border: 2px solid rgba(255, 107, 53, 0.25);
  border-radius: var(--radius-lg);
  box-shadow: 0 8px 24px rgba(255, 107, 53, 0.12);
}

.team-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.team-badge {
  font-size: 0.8rem;
  font-weight: 800;
  color: var(--primary);
  background: var(--primary-light);
  padding: 4px 10px;
  border-radius: 12px;
}

.team-status-tag {
  font-size: 0.75rem;
  font-weight: 700;
  color: #166534;
  background: #DCFCE7;
  padding: 4px 10px;
  border-radius: 12px;
}

.big-emoji-wrap {
  font-size: 64px;
  line-height: 1;
  margin-top: 8px;
  filter: drop-shadow(0 4px 12px rgba(0,0,0,0.1));
}

.team-location-title {
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--text-main);
  margin: 0;
}

.tags-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
}

.tag-pill {
  font-size: 0.75rem;
  color: #64748B;
  background: #F1F5F9;
  padding: 3px 8px;
  border-radius: 8px;
  font-weight: 600;
}

.price-tag {
  font-size: 0.75rem;
  color: #EA580C;
  background: #FFEDD5;
  padding: 3px 8px;
  border-radius: 8px;
  font-weight: 700;
}

.recommend-box {
  background: #FFF7ED;
  border: 1px dashed #FDBA74;
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
  color: #9A3412;
  width: 100%;
}

.team-meta-info {
  font-size: 0.75rem;
  color: #94A3B8;
}

.team-card-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
  margin-top: 8px;
}

.team-card-actions button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 12px;
  border-radius: var(--radius-md);
  font-weight: 700;
  cursor: pointer;
}
</style>
