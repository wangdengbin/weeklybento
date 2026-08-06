<template>
  <div class="slot-machine-container">
    <!-- 场景餐池 Tab 切换器 -->
    <div class="meal-categories-selector glass-card">
      <button 
        v-for="cat in visibleMealCategories" 
        :key="cat.key" 
        class="cat-tab-btn" 
        :class="{ active: selectedCategory === cat.key }"
        @click="handleSelectCategory(cat.key)"
      >
        <span class="cat-emoji">{{ cat.emoji }}</span>
        <span class="cat-name">{{ cat.name }}</span>
      </button>
    </div>

    <transition name="fade-switch" mode="out-in">
      <!-- 团队模式：今日已有团队选定结果卡片 -->
      <div v-if="hasTodayTeamResult && !forceShowMachine" key="team-result" class="team-result-card glass-card">
        <div class="team-card-header">
          <span class="team-badge">👥 午餐搭子模式</span>
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
            ⏰ 抽取时间：{{ todayTeamResult?.rolledAt }} · {{ todayTeamResult?.rolledBy || '搭子成员' }} 已锁定今日菜单
          </div>
        </div>

        <div class="team-card-actions">
          <button class="btn-primary" @click="handleRecordTeamResult">
            <Check :size="18" />
            <span>记录为我的今日日志</span>
          </button>
          <button class="btn-secondary" @click="handleRerollTeamResult">
            <RotateCcw :size="18" />
            <span>重新选定 (重抽并同步搭子圈)</span>
          </button>
        </div>
      </div>

      <div v-else key="machine-main" class="machine-main-wrapper">
        <!-- 池子进度提示卡 -->
        <div class="pool-status-card">
          <div class="status-info">
            <span class="status-dot" :class="{ 'is-empty': isPoolEmpty }"></span>
            <span class="status-text">
              <template v-if="settings.activeMode === 'team'">[👥 搭子待抽池] </template>
              {{ currentCatMeta?.emoji }} {{ currentCatMeta?.name }}待抽池：<strong>{{ availablePool.length }}</strong> / {{ locations.length }} 个地点
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
            <span>{{ settings.activeMode === 'team' ? 'BUDDY RANDOM ROLL' : 'BENTO RANDOM ROLL' }}</span>
            <Sparkles class="sparkle-icon" :size="18" />
          </div>

          <!-- 栏目标题 Row -->
          <div class="reels-header-row">
            <div class="column-title">类型/口味</div>
            <div class="column-title main-title">{{ currentCatMeta?.emoji }} 今日{{ currentCatMeta?.name.replace('池','') }}</div>
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
                  {{ isRolling ? '抽取中...' : (isPoolEmpty ? '池子已空 请重置' : (settings.activeMode === 'team' ? '帮搭子选午餐！(ROLL)' : `帮我选${currentCatMeta?.name || ''}！(ROLL)`)) }}
                </span>
              </div>
            </button>

            <!-- 弱化手选入口，优先级低 -->
            <div class="secondary-actions" v-if="!isRolling">
              <button 
                type="button" 
                class="btn-text-link"
                @click="openManualSelect"
              >
                👋 不想Roll？手动选择一个
              </button>
            </div>

            <p class="anti-repeat-tip">
              ✨ {{ settings.activeMode === 'team' ? '午餐搭子协同：任何人完成 Roll 后搭子圈全员自动同步' : '不重复机制生效中：抽中地点自动移出本轮待抽池' }}
            </p>
          </div>

          <!-- 📅 今日便当打卡清单 (5槽位) -->
          <div v-if="settings.activeMode === 'personal'" class="daily-bento-checklist glass-card">
            <div class="checklist-header">
              <CalendarCheck :size="18" class="text-orange" />
              <span>📅 今日便当打卡清单</span>
            </div>
            <div class="checklist-items">
              <div v-for="cat in visibleMealCategories" :key="cat.key" class="check-item-row" :class="{ 'is-active': selectedCategory === cat.key }">
                <div class="cat-label">
                  <span class="cat-icon">{{ cat.emoji }}</span>
                  <span class="cat-title">{{ cat.name.replace('池','') }}</span>
                </div>

                <div class="cat-content">
                  <template v-if="getTodayRecordsByCat(cat.key).length > 0">
                    <div class="records-sub-list">
                      <div v-for="rec in getTodayRecordsByCat(cat.key)" :key="rec.id" class="single-rec-item">
                        <span class="food-emoji">{{ rec.emoji }}</span>
                        <span class="food-name">{{ rec.locationName }}</span>
                        
                        <span v-if="rec.status === 'planned'" class="badge-status planned">📌 预选</span>
                        <span v-else class="badge-status confirmed">
                          ✅ {{ rec.cost ? `￥${rec.cost}` : '已打卡' }}
                        </span>

                        <!-- 若为预选记录，提供内联确认按钮 -->
                        <button v-if="rec.status === 'planned'" class="mini-btn action-confirm inline-confirm" @click="handleQuickConfirm(rec.id)" title="确认吃了">
                          ✅ 吃了
                        </button>
                      </div>
                    </div>
                  </template>
                  <template v-else>
                    <span class="empty-text">尚无安排</span>
                  </template>
                </div>

                <div class="cat-actions">
                  <button 
                    v-if="getTodayRecordsByCat(cat.key).length === 0" 
                    class="mini-btn action-roll"
                    @click="handleSelectCategory(cat.key)"
                  >
                    🎲 去摇号
                  </button>
                  <template v-else>
                    <button 
                      v-if="getTodayRecordsByCat(cat.key).some(r => r.status === 'planned')" 
                      class="mini-btn action-reroll" 
                      @click="handleSelectCategory(cat.key)" 
                      title="切到此餐池重新摇号"
                    >
                      🔄 重Roll
                    </button>
                    <span v-else class="done-check">✓</span>

                    <!-- 微型隐蔽再记一笔按钮 (小概率事件：一天两杯奶茶/两顿晚餐等) -->
                    <button 
                      class="mini-add-extra-btn" 
                      @click="openAddExtraModal(cat.key)" 
                      title="再记一笔 (小概率多条打卡，如第2杯奶茶)"
                    >
                      <Plus :size="11" />
                    </button>
                  </template>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <!-- 手动选择地点弹窗 -->
    <div v-if="showManualSelectModal" class="manual-select-modal-overlay" @click.self="closeManualSelect">
      <div class="manual-select-modal glass-card">
        <div class="modal-header">
          <h3>选择今日{{ currentCatMeta?.name || '地点' }}</h3>
          <button class="close-btn" @click="closeManualSelect">×</button>
        </div>
        
        <!-- 搜索框 -->
        <div class="search-box">
          <div class="search-input-wrapper">
            <Search :size="16" class="search-icon" />
            <input 
              type="text" 
              v-model="searchQuery" 
              placeholder="搜索店名、标签..." 
              class="search-input"
            />
          </div>
        </div>

        <!-- 候选列表 -->
        <div class="location-list">
          <div 
            v-for="loc in filteredLocations" 
            :key="loc.id" 
            class="location-item"
            :class="{ 'is-disabled': isSubmittingManual }"
            @click="selectLocationManually(loc)"
          >
            <span class="loc-emoji">{{ loc.emoji || '🍱' }}</span>
            <div class="loc-details">
              <span class="loc-name">{{ loc.name }}</span>
              <div class="loc-tags">
                <span v-for="tag in loc.tags" :key="tag" class="loc-tag">#{{ tag }}</span>
                <span class="loc-price" v-if="loc.priceRange">{{ loc.priceRange }}</span>
              </div>
            </div>
            <button class="btn-select-confirm" :disabled="isSubmittingManual">
              {{ isSubmittingManual ? '提交中...' : '选择' }}
            </button>
          </div>
          <div v-if="filteredLocations.length === 0" class="empty-list-tip">
            没有找到匹配的地点~
          </div>
        </div>
      </div>
    </div>

    <!-- 极简加记打卡/多条打卡 Modal -->
    <div v-if="showAddExtraModal" class="manual-select-modal-overlay" @click.self="showAddExtraModal = false">
      <div class="manual-select-modal glass-card extra-record-modal">
        <div class="modal-header">
          <h3>再记一笔【{{ extraCatMeta?.name || '打卡' }}】</h3>
          <button class="close-btn" @click="showAddExtraModal = false">×</button>
        </div>
        
        <p class="sub-tip">适用于一日喝多杯奶茶、吃多顿主食等小概率事件，默认直接完成打卡。</p>
        
        <form @submit.prevent="submitExtraRecord" class="extra-form">
          <div class="form-item">
            <label>餐品 / 店名：</label>
            <input 
              type="text" 
              v-model="extraForm.locationName" 
              placeholder="例如：霸王茶姬 (或第二顿晚餐)" 
              required 
              class="input-field" 
            />
          </div>

          <div class="form-item">
            <label>实付金额 (元，选填)：</label>
            <input 
              type="number" 
              step="0.1" 
              v-model.number="extraForm.cost" 
              placeholder="如 18" 
              class="input-field" 
            />
          </div>

          <div class="form-item">
            <label>打卡状态：</label>
            <div class="status-badge-selected">
              ✅ 已打卡 (默认选中状态)
            </div>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn-secondary" @click="showAddExtraModal = false">取消</button>
            <button type="submit" class="btn-primary">确认加记</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { Sparkles, Dice5, RefreshCw, RotateCcw, Check, CalendarCheck, Search, Plus } from 'lucide-vue-next';
import confetti from 'canvas-confetti';
import { useBentoStore } from '../composables/useBentoStore';
import { useTeamWorkspace } from '../composables/useTeamWorkspace';
import { soundEffects } from '../composables/useAudio';
import { MEAL_CATEGORIES, type BentoLocation, type MealCategory } from '../types';

const emit = defineEmits(['roll-complete']);

const {
  locations: personalLocations,
  availablePool: personalAvailablePool,
  drawnList: personalDrawnList,
  getRandomLocation,
  getTodayDateString,
  resetPool,
  settings,
  addDailyRecord,
  addDirectRecord,
  records,
  selectedCategory,
  setSelectedCategory,
  visibleMealCategories,
  confirmDailyRecord,
} = useBentoStore();
const {
  locations: teamLocations,
  todayResult: teamTodayResult,
  roll: rollTeam,
  canReroll,
  addOrUpdateTeamRecord,
} = useTeamWorkspace();

const currentCatMeta = computed(() => MEAL_CATEGORIES.find(c => c.key === selectedCategory.value));

function handleSelectCategory(catKey: MealCategory) {
  if (settings.value.soundEnabled) soundEffects.playTick(600);
  setSelectedCategory(catKey);
  prepareReels();
}

function getTodayRecordsByCat(catKey: MealCategory) {
  return records.value.filter(r => r.date === todayStr.value && (r.mealCategory || 'lunch') === catKey);
}

const showAddExtraModal = ref(false);
const extraForm = ref({
  mealCategory: 'tea' as MealCategory,
  locationName: '',
  cost: undefined as number | undefined,
  emoji: '🍱',
});
const extraCatMeta = computed(() => MEAL_CATEGORIES.find(c => c.key === extraForm.value.mealCategory));

function openAddExtraModal(catKey: MealCategory) {
  if (settings.value.soundEnabled) soundEffects.playTick(600);
  const catMeta = MEAL_CATEGORIES.find(c => c.key === catKey);
  extraForm.value = {
    mealCategory: catKey,
    locationName: '',
    cost: undefined,
    emoji: catMeta?.emoji || '🍱',
  };
  showAddExtraModal.value = true;
}

function submitExtraRecord() {
  if (!extraForm.value.locationName.trim()) return;
  
  addDirectRecord({
    date: todayStr.value,
    mealCategory: extraForm.value.mealCategory,
    status: 'confirmed',
    locationId: 'custom-' + Date.now(),
    locationName: extraForm.value.locationName.trim(),
    emoji: extraForm.value.emoji,
    cost: extraForm.value.cost,
    note: '再记一笔打卡',
    tags: ['多条记录']
  });

  if (settings.value.soundEnabled) soundEffects.playTick(900);
  showAddExtraModal.value = false;
}

function handleQuickConfirm(recordId: string) {
  const costStr = prompt('请输入实付金额（元，非必填）：', '');
  const cost = costStr ? parseFloat(costStr) : undefined;
  confirmDailyRecord(recordId, isNaN(cost!) ? undefined : cost);
  if (settings.value.soundEnabled) soundEffects.playTick(900);
}

function isLocationMatchingCategory(loc: BentoLocation, category: MealCategory): boolean {
  if (!loc.mealCategories || loc.mealCategories.length === 0) return true;
  return loc.mealCategories.includes(category);
}

const locations = computed(() => settings.value.activeMode === 'team' ? teamLocations.value : personalLocations.value);
const availablePool = computed(() => {
  if (settings.value.activeMode === 'team') {
    const visibleTeamLocs = teamLocations.value.filter(loc => loc.visible !== false);
    const categoryPool = visibleTeamLocs.filter(loc => isLocationMatchingCategory(loc, selectedCategory.value));
    return categoryPool.length > 0 ? categoryPool : visibleTeamLocs;
  }
  return personalAvailablePool.value;
});
const drawnList = computed(() => settings.value.activeMode === 'team' ? [] : personalDrawnList.value);
const isPoolEmpty = computed(() => availablePool.value.length === 0);
const todayTeamResult = computed(() => teamTodayResult.value);

const isRolling = ref(false);
const forceShowMachine = ref(false);

const todayStr = computed(() => getTodayDateString());

// 手动选择状态与方法
const showManualSelectModal = ref(false);
const searchQuery = ref('');
const isSubmittingManual = ref(false);

const currentCategoryLocations = computed(() => {
  return locations.value.filter(loc => loc.visible !== false && isLocationMatchingCategory(loc, selectedCategory.value));
});

const filteredLocations = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  if (!query) return currentCategoryLocations.value;
  return currentCategoryLocations.value.filter(loc => 
    loc.name.toLowerCase().includes(query) || 
    (loc.tags && loc.tags.some(tag => tag.toLowerCase().includes(query)))
  );
});

function openManualSelect() {
  searchQuery.value = '';
  showManualSelectModal.value = true;
}

function closeManualSelect() {
  showManualSelectModal.value = false;
}

async function selectLocationManually(loc: BentoLocation) {
  if (isSubmittingManual.value) return;
  if (settings.value.soundEnabled) soundEffects.playTick(800);

  if (settings.value.activeMode === 'team') {
    isSubmittingManual.value = true;
    try {
      await addOrUpdateTeamRecord(loc.id, todayStr.value, '团队手动选定');
      showManualSelectModal.value = false;
      forceShowMachine.value = false;
      // 兜底反馈：若团队结果卡片条件未满足（如日期边界/数据未刷新），至少明确告知已选定
      if (!hasTodayTeamResult.value) {
        alert(`已手动选定：${loc.emoji || '🍱'} ${loc.name}，并同步到搭子圈`);
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : '团队手动选定失败');
    } finally {
      isSubmittingManual.value = false;
    }
  } else {
    showManualSelectModal.value = false;
    emit('roll-complete', {
      location: loc,
      fortune: '手选精选，美味直达！'
    });
  }
}

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
  if (!canReroll.value) {
    alert('团队管理员已限制普通成员重新 Roll / 重新选定！');
    return;
  }
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
  min-height: 480px;
}

.machine-main-wrapper {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
}

.fade-switch-enter-active,
.fade-switch-leave-active {
  transition: opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1), transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.fade-switch-enter-from,
.fade-switch-leave-to {
  opacity: 0;
  transform: translateY(6px);
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
  flex-wrap: wrap;
}

.team-card-actions button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 12px 8px;
  border-radius: var(--radius-md);
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
}

@media (max-width: 520px) {
  .team-card-actions {
    flex-direction: column;
    gap: 8px;
  }
  .team-card-actions button {
    width: 100%;
    min-width: 0;
  }
}

/* 场景餐池 Selector */
.meal-categories-selector {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 6px;
  margin-bottom: 12px;
  background: rgba(255, 255, 255, 0.8);
  border-radius: var(--radius-lg);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
}

.cat-tab-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 8px 4px;
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  color: #64748B;
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
}

.cat-tab-btn:hover {
  background: rgba(255, 107, 53, 0.08);
  color: var(--primary);
}

.cat-tab-btn.active {
  background: #FF6B00;
  color: #FFFFFF;
  box-shadow: 0 3px 10px rgba(255, 107, 0, 0.25);
}

.cat-emoji {
  font-size: 1rem;
}

/* 今日便当清单 (Daily Bento Checklist) */
.daily-bento-checklist {
  margin-top: 16px;
  padding: 14px 16px;
  background: rgba(255, 255, 255, 0.9);
  border-radius: var(--radius-lg);
  border: 1px solid rgba(255, 237, 213, 0.8);
}

.checklist-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
  font-weight: 800;
  color: #334155;
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 1px dashed #E2E8F0;
}

.checklist-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.check-item-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  background: #F8FAFC;
  border: 1px solid #E2E8F0;
  border-radius: 8px;
  transition: all 0.2s ease;
}

.check-item-row.is-active {
  border-color: #FDBA74;
  background: #FFF7ED;
}

.cat-label {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 90px;
}

.cat-icon {
  font-size: 1.1rem;
}

.cat-title {
  font-size: 0.82rem;
  font-weight: 700;
  color: #475569;
}

.cat-content {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
}

.food-emoji {
  font-size: 1.1rem;
}

.food-name {
  font-size: 0.85rem;
  font-weight: 700;
  color: #1E293B;
}

.badge-status {
  font-size: 0.72rem;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 6px;
}

.badge-status.planned {
  background: #FEF3C7;
  color: #D97706;
}

.badge-status.confirmed {
  background: #DCFCE7;
  color: #15803D;
}

.empty-text {
  font-size: 0.78rem;
  color: #94A3B8;
  font-style: italic;
}

.cat-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.mini-btn {
  padding: 3px 8px;
  font-size: 0.75rem;
  font-weight: 700;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-roll {
  background: #FF6B00;
  color: #FFFFFF;
}

.action-reroll {
  background: #FFF7ED;
  color: #EA580C;
  border: 1px solid #FFD8B3;
}

.action-confirm {
  background: #10B981;
  color: #FFFFFF;
}

.done-check {
  font-size: 0.9rem;
  font-weight: 800;
  color: #10B981;
}

/* 手动选择入口样式 */
.secondary-actions {
  display: flex;
  justify-content: center;
  margin-top: -4px;
}

.btn-text-link {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  transition: all 0.2s ease;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.btn-text-link:hover {
  color: var(--primary);
  background: rgba(255, 107, 53, 0.05);
}

/* 手动选择弹窗 */
.manual-select-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(15, 23, 42, 0.4);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
  padding: 16px;
  animation: fadeIn 0.2s ease-out;
}

.manual-select-modal {
  width: 100%;
  max-width: 420px;
  background: linear-gradient(180deg, #FFFFFF 0%, #FFFDFB 100%);
  border: 1px solid rgba(255, 237, 213, 0.8);
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  max-height: 75vh;
  animation: scaleIn 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px dashed #E2E8F0;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 800;
  color: #1E293B;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.4rem;
  color: #94A3B8;
  cursor: pointer;
  transition: color 0.2s;
  line-height: 1;
}

.close-btn:hover {
  color: #64748B;
}

.search-box {
  padding: 10px 18px;
  background: #FAFAFA;
}

.search-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 12px;
  color: #94A3B8;
  pointer-events: none;
}

.search-input {
  width: 100%;
  padding: 8px 12px 8px 36px;
  border: 1.5px solid #E2E8F0;
  border-radius: var(--radius-md);
  font-size: 0.85rem;
  outline: none;
  transition: all 0.2s ease;
  font-weight: 600;
}

.search-input:focus {
  border-color: var(--primary);
  background: #FFFFFF;
  box-shadow: 0 0 0 3px rgba(255, 107, 53, 0.15);
}

.location-list {
  flex: 1;
  overflow-y: auto;
  padding: 10px 18px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.location-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: #F8FAFC;
  border: 1px solid #E2E8F0;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s ease;
}

.location-item:hover {
  background: #FFF7ED;
  border-color: #FDBA74;
  transform: translateY(-1px);
}

.location-item.is-disabled {
  opacity: 0.6;
  pointer-events: none;
}

.loc-emoji {
  font-size: 1.4rem;
}

.loc-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.loc-name {
  font-size: 0.9rem;
  font-weight: 700;
  color: #1E293B;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.loc-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.loc-tag {
  font-size: 0.68rem;
  color: #64748B;
  background: #F1F5F9;
  padding: 1px 5px;
  border-radius: 4px;
}

.loc-price {
  font-size: 0.68rem;
  color: #EA580C;
  background: #FFEDD5;
  padding: 1px 5px;
  border-radius: 4px;
  font-weight: 700;
}

.btn-select-confirm {
  padding: 4px 10px;
  font-size: 0.78rem;
  font-weight: 700;
  background: #FFFFFF;
  color: #475569;
  border: 1px solid #CBD5E1;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.location-item:hover .btn-select-confirm {
  background: var(--primary);
  color: #FFFFFF;
  border-color: var(--primary);
}

.empty-list-tip {
  text-align: center;
  padding: 20px 0;
  font-size: 0.8rem;
  color: #94A3B8;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes scaleIn {
  from { transform: scale(0.96); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

/* 微型隐蔽再记一笔按钮 (多条打卡小概率事件) */
.mini-add-extra-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 1px solid rgba(148, 163, 184, 0.3);
  background: rgba(241, 245, 249, 0.5);
  border-radius: 50%;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.2s ease;
  margin-left: 6px;
  opacity: 0.6;
}

.mini-add-extra-btn:hover {
  opacity: 1;
  background: var(--primary-light);
  border-color: var(--primary);
  color: var(--primary);
  transform: scale(1.15);
}

.records-sub-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
}

.single-rec-item {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.inline-confirm {
  padding: 1px 6px;
  font-size: 0.68rem;
  margin-left: 4px;
}

/* 极简多条打卡弹窗特有样式 */
.extra-record-modal {
  max-width: 380px;
}

.sub-tip {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-bottom: 12px;
  line-height: 1.4;
}

.extra-form .form-item {
  margin-bottom: 12px;
  text-align: left;
}

.extra-form label {
  display: block;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-main);
  margin-bottom: 4px;
}

.status-badge-selected {
  display: inline-block;
  padding: 6px 12px;
  background: #ECFDF5;
  color: #059669;
  border: 1px solid #A7F3D0;
  border-radius: 6px;
  font-size: 0.82rem;
  font-weight: 700;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}
</style>
