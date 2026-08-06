<template>
  <div class="history-container">
    <div class="history-header">
      <div class="header-title">
        <Calendar :size="20" class="text-orange" />
        <span>{{ isTeamMode ? `${team?.name || '搭子圈'} 每日抽签记录` : '饮食与记账日志' }}</span>
        <span class="mode-badge" :class="isTeamMode ? 'team-badge' : 'personal-badge'">
          {{ isTeamMode ? '👥 搭子圈全员同步' : '🏠 个人消费与打卡' }}
        </span>
      </div>

      <!-- 补录历史记录按钮 -->
      <button v-if="canAddRecord" class="btn-secondary add-rec-btn" @click="openAddModal">
        <Plus :size="16" />
        <span>📝 补录打卡/记一笔</span>
      </button>
    </div>

    <!-- 跨日未结预选提醒 Banner -->
    <div v-if="!isTeamMode && expiredPlannedRecords.length > 0" class="expired-planned-banner glass-card">
      <div class="banner-left">
        <AlertCircle :size="18" class="text-orange" />
        <span>提示：您有 <strong>{{ expiredPlannedRecords.length }}</strong> 条过往未结算的预选计划</span>
      </div>
      <div class="banner-actions">
        <button class="banner-btn clear-btn" @click="handleClearExpiredPlanned">🧹 一键作废</button>
      </div>
    </div>

    <!-- 🏠 个人模式：消费统计看板 (Expense Dashboard) -->
    <div v-if="!isTeamMode" class="expense-dashboard glass-card">
      <div class="dash-header-row">
        <span class="dash-title">📊 个人饮食与财务看板</span>
        <div class="dash-btn-group">
          <button class="btn-primary small-btn ai-report-btn ai-glow-btn" @click="handleGenerateWeeklyReport" :disabled="isAiLoading">
            <Sparkles :size="12" class="ai-sparkle-icon" />
            <span>{{ isAiLoading ? '生成周报中...' : '✨ AI 饮食周报' }}</span>
          </button>
          <button class="export-csv-btn" @click="exportCSV" title="导出 Excel/CSV 格式记账明细单">
            <FileSpreadsheet :size="12" />
            <span>导出 CSV</span>
          </button>
        </div>
      </div>

      <div class="dash-row main-stats">
        <div class="stat-card total-card">
          <span class="stat-label">💰 本月伙食总支出</span>
          <span class="stat-val">￥{{ stats.monthlyTotal.toFixed(2) }}</span>
        </div>
        <div class="stat-card tea-card">
          <span class="stat-label">🧋 咖啡/奶茶专账</span>
          <span class="stat-val tea-stat-val">
            <span>{{ stats.teaCount }} 杯</span>
            <span>￥{{ stats.teaTotal.toFixed(2) }}</span>
          </span>
        </div>
        <div class="stat-card avg-card">
          <span class="stat-label">📊 日均开销 (近30天)</span>
          <span class="stat-val">￥{{ stats.dailyAvg.toFixed(2) }}</span>
        </div>
      </div>

      <!-- 月度伙食预算消耗进度条 (若设置了预算) -->
      <div v-if="settings.monthlyBudget && settings.monthlyBudget > 0" class="dash-row budget-row">
        <div class="budget-info-row">
          <span class="budget-label">月度预算进度：已用 ￥{{ stats.monthlyTotal.toFixed(0) }} / ￥{{ settings.monthlyBudget }}</span>
          <span class="budget-percent" :class="budgetStatusClass">
            {{ budgetPercent.toFixed(1) }}% {{ budgetStatusText }}
          </span>
        </div>
        <div class="budget-progress-bg">
          <div class="budget-progress-fill" :style="{ width: `${Math.min(budgetPercent, 100)}%` }" :class="budgetStatusClass"></div>
        </div>
      </div>

      <!-- 五餐占比对比进度条 -->
      <div class="dash-row ratio-bar-row">
        <div class="ratio-title">五餐开销占比 (按金额)：</div>
        <div class="ratio-progress-bar">
          <div 
            v-for="cat in MEAL_CATEGORIES" 
            :key="cat.key" 
            class="progress-seg" 
            :style="{ width: `${stats.catRatioMap[cat.key] || 0}%`, background: getCatColor(cat.key) }"
            :title="`${cat.name}: ￥${(stats.catTotalMap[cat.key] || 0).toFixed(2)} (${(stats.catRatioMap[cat.key] || 0).toFixed(1)}%)`"
          ></div>
        </div>
        <div class="ratio-legend">
          <span v-for="cat in MEAL_CATEGORIES" :key="cat.key" class="legend-item">
            <span class="dot" :style="{ background: getCatColor(cat.key) }"></span>
            {{ cat.emoji }} ￥{{ (stats.catTotalMap[cat.key] || 0).toFixed(0) }}
          </span>
        </div>
      </div>
    </div>

    <!-- 列表展示 -->
    <div v-if="records.length === 0" class="empty-state glass-card">
      <UtensilsCrossed :size="48" class="empty-icon" />
      <p class="empty-text">{{ isTeamMode ? '搭子圈暂无选餐记录，大家快去 Roll 一个吧！' : '尚无饮食记录，快去 Roll 一个或补录一笔吧！' }}</p>
    </div>

    <div v-else class="records-list">
      <template v-for="group in groupedRecords" :key="group.key">
        <div class="record-group-header">
          <span class="group-month">📅 {{ group.label }}</span>
          <span class="group-count">{{ group.items.length }} 条</span>
        </div>
        <div v-for="rec in group.items" :key="rec.id" class="record-item glass-card" :class="{ 'is-planned': rec.status === 'planned' }">
        <div class="item-date-col">
          <span class="date-str">{{ formatDate(rec.date) }}</span>
          <span class="date-meta-row">
            <span class="time-str">{{ rec.drawnAt }}</span>
            <span class="meal-cat-badge">
              {{ getCatEmoji(rec.mealCategory) }} {{ getCatName(rec.mealCategory) }}
            </span>
          </span>
        </div>

        <div class="item-main-col">
          <div class="food-line">
            <span class="food-emoji">{{ rec.emoji }}</span>
            <span class="food-name">{{ rec.locationName }}</span>

            <!-- 状态 📌 预选 vs ✅ 已打卡 -->
            <span v-if="rec.status === 'planned'" class="status-tag planned-tag">
              📌 预选计划
            </span>
            <span v-else class="status-tag confirmed-tag">
              ✅ 已打卡
            </span>

            <!-- 个人金额展示 -->
            <span v-if="!isTeamMode && rec.cost !== undefined" class="cost-amount-badge">
              ￥{{ rec.cost.toFixed(2) }}
            </span>
          </div>

          <div v-if="rec.note" class="food-note">
            "{{ rec.note }}"
          </div>

          <div v-if="rec.tags && rec.tags.length" class="tags-wrap">
            <span v-for="t in rec.tags" :key="t" class="tag-mini"># {{ t }}</span>
          </div>
        </div>

        <!-- 快捷转化 / 编辑删除操作 -->
        <div v-if="canManageRecord" class="admin-actions">
          <!-- 预选转打卡按钮 -->
          <button 
            v-if="!isTeamMode && rec.status === 'planned'" 
            class="action-btn-text confirm-btn" 
            @click="handleQuickConfirmRecord(rec.id)"
            title="确认吃了并记账"
          >
            💰 填金额打卡
          </button>

          <button class="action-btn edit-btn" @click="openEditModal(rec)" title="修改记录">
            <Edit3 :size="16" />
          </button>
          <button class="action-btn delete-btn" @click="confirmDelete(rec.id)" title="删除记录">
            <Trash2 :size="16" />
          </button>
        </div>
      </div>
      </template>

      <!-- 加载更多 -->
      <div v-if="records.length > visibleCount" class="load-more-row">
        <button class="btn-secondary load-more-btn" @click="visibleCount += 30">
          加载更多 ({{ records.length - visibleCount }} 条)
        </button>
      </div>
    </div>

    <!-- 编辑/补录弹窗 Modal -->
    <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
      <div class="modal-content">
        <h3 class="modal-title">{{ isEditing ? '修改饮食打卡' : (isTeamMode ? '搭子圈补录记录' : '新增饮食/记账打卡') }}</h3>
        
        <form @submit.prevent="saveRecord" class="edit-form">
          <div class="form-item">
            <label>用餐日期：</label>
            <input type="date" v-model="form.date" required class="input-field" />
          </div>

          <!-- 餐别分类选择器 -->
          <div class="form-item">
            <label>餐别时段：</label>
            <div class="meal-cat-radios">
              <label v-for="cat in visibleMealCategories" :key="cat.key" class="radio-item">
                <input type="radio" v-model="form.mealCategory" :value="cat.key" />
                <span>{{ cat.emoji }} {{ cat.name }}</span>
              </label>
            </div>
          </div>

          <div class="form-item">
            <label>地点 / 餐品名称：</label>
            <select v-if="isTeamMode" v-model="form.locationId" @change="onTeamLocationChange" class="input-field" required>
              <option value="" disabled>请选择团队地点</option>
              <option v-for="loc in locations" :key="loc.id" :value="loc.id">
                {{ loc.emoji }} {{ loc.name }} {{ loc.recommendedDish ? `(${loc.recommendedDish})` : '' }}
              </option>
            </select>
            <input v-else type="text" v-model="form.locationName" list="history-location-suggest" placeholder="例如：萨莉亚 (或从下方列表快速选择)" required class="input-field" />
            <datalist id="history-location-suggest">
              <option v-for="loc in personalLocations" :key="loc.id" :value="loc.name">
                {{ loc.emoji }} {{ loc.recommendedDish || '' }}
              </option>
            </datalist>
          </div>

          <!-- 个人模式：状态与花费金额 -->
          <template v-if="!isTeamMode">
            <div class="form-row-inline">
              <div class="form-item flex-1">
                <label>打卡状态：</label>
                <select v-model="form.status" class="input-field">
                  <option value="confirmed">✅ 已打卡 (确定吃了)</option>
                  <option value="planned">📌 预选计划 (暂未吃)</option>
                </select>
              </div>

              <div class="form-item flex-1">
                <label>实付金额 (元)：</label>
                <input type="number" step="0.1" v-model.number="form.cost" placeholder="如 25.5" class="input-field" />
              </div>
            </div>
          </template>

          <div class="form-item">
            <label>用餐心得 / 备注：</label>
            <input type="text" v-model="form.note" placeholder="例如：加了卤蛋，非常美味！" class="input-field" />
          </div>

          <div class="modal-buttons">
            <button type="button" class="btn-secondary" @click="showModal = false">取消</button>
            <button type="submit" class="btn-primary">保存打卡记录</button>
          </div>
        </form>
      </div>
    </div>

    <!-- ✨ AI 饮食周报 Modal -->
    <div v-if="showWeeklyReportModal" class="modal-overlay" @click.self="showWeeklyReportModal = false">
      <div class="modal-content weekly-report-modal animate-fade-in">
        <div class="report-header">
          <div class="title-with-icon">
            <Sparkles class="text-orange" :size="22" />
            <h3 class="report-title">周周便当 · AI 饮食与财务周报</h3>
          </div>
          <button type="button" class="close-report-btn" @click="showWeeklyReportModal = false">✕</button>
        </div>

        <div v-if="weeklyReport" class="report-card-body">
          <!-- 🏆 吃货称号金牌卡片 -->
          <div class="report-badge-box">
            <span class="badge-label">🏆 独家吃货勋章认定</span>
            <h4 class="report-badge-title">「 {{ weeklyReport.title }} 」</h4>
          </div>

          <!-- 🍔 饮食偏好与频次分析 -->
          <div class="report-item-card card-pink">
            <div class="item-header">
              <span class="item-icon">🍔</span>
              <span class="item-title">饮食偏好与频次分析</span>
            </div>
            <p class="item-text">{{ weeklyReport.habitAnalysis }}</p>
          </div>

          <!-- 🥗 营养与口味均衡建议 -->
          <div class="report-item-card card-green">
            <div class="item-header">
              <span class="item-icon">🥗</span>
              <span class="item-title">营养与口味均衡建议</span>
            </div>
            <p class="item-text">{{ weeklyReport.healthInsight }}</p>
          </div>

          <!-- 💰 伙食开销与预算洞察 -->
          <div class="report-item-card card-amber">
            <div class="item-header">
              <span class="item-icon">💰</span>
              <span class="item-title">伙食开销与预算洞察</span>
            </div>
            <p class="item-text">{{ weeklyReport.budgetInsight }}</p>
          </div>
        </div>

        <div class="report-footer">
          <button type="button" class="btn-secondary small-btn flex-1" @click="copyWeeklyReportText">
            📋 复制周报文本
          </button>
          <button type="button" class="btn-primary small-btn flex-1" @click="showWeeklyReportModal = false">
            收下报告
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { Calendar, Plus, UtensilsCrossed, Edit3, Trash2, FileSpreadsheet, AlertCircle, Sparkles } from 'lucide-vue-next';
import { useBentoStore } from '../composables/useBentoStore';
import { useTeamWorkspace } from '../composables/useTeamWorkspace';
import { useCloudSync } from '../composables/useCloudSync';
import { useBentoAI, type WeeklyReportResult } from '../composables/useBentoAI';
import { soundEffects } from '../composables/useAudio';
import { useToast } from '../composables/useToast';
import { MEAL_CATEGORIES, type DailyRecord, type MealCategory, type RecordStatus } from '../types';

const { success: toastSuccess, error: toastError, info: toastInfo, confirm: toastConfirm } = useToast();

const { records: personalRecords, locations: personalLocations, updateRecord, deleteRecord, restoreRecord, addDirectRecord, settings, visibleMealCategories, getTodayDateString } = useBentoStore();
const { team, history: teamHistory, locations: teamLocations, addOrUpdateTeamRecord, deleteTeamRecord } = useTeamWorkspace();
const { pushToCloud } = useCloudSync();
const { isLoading: isAiLoading, generateWeeklyReport } = useBentoAI();

const showWeeklyReportModal = ref(false);
const weeklyReport = ref<WeeklyReportResult | null>(null);

async function handleGenerateWeeklyReport() {
  if (records.value.length === 0) {
    toastInfo('暂无打卡记录，先去 Roll 一笔再生成周报吧！');
    return;
  }
  soundEffects.playTick(600);

  const summary = records.value.slice(0, 15).map(r => ({
    name: r.locationName,
    cost: r.cost,
    category: r.mealCategory,
    tags: r.tags,
  }));

  const report = await generateWeeklyReport(summary, stats.value.monthlyTotal, settings.value.monthlyBudget);
  if (report) {
    weeklyReport.value = report;
    showWeeklyReportModal.value = true;
    soundEffects.playWinSound();
  }
}

function copyWeeklyReportText() {
  if (!weeklyReport.value) return;
  const text = `✨ 周周便当 · AI 饮食周报\n\n🏆 称号：${weeklyReport.value.title}\n\n🍔 饮食偏好：${weeklyReport.value.habitAnalysis}\n\n🥗 营养建议：${weeklyReport.value.healthInsight}\n\n💰 预算洞察：${weeklyReport.value.budgetInsight}`;
  navigator.clipboard.writeText(text);
  soundEffects.playTick(800);
  toastSuccess('AI 饮食周报文本已复制到剪贴板！');
}

const todayStr = computed(() => getTodayDateString());

// 跨日过往未结预选记录
const expiredPlannedRecords = computed(() => {
  return personalRecords.value.filter(r => r.date < todayStr.value && r.status === 'planned');
});

async function handleClearExpiredPlanned() {
  const ok = await toastConfirm({
    title: '一键作废预选',
    message: `确认作废这 ${expiredPlannedRecords.value.length} 条过往未打卡的预选记录吗？`,
    danger: true,
    confirmText: '作废',
  });
  if (!ok) return;
  const expiredIds = new Set(expiredPlannedRecords.value.map(r => r.id));
  expiredIds.forEach(id => deleteRecord(id));
  pushToCloud(true);
  if (settings.value.soundEnabled) soundEffects.playTick(700);
  toastSuccess(`已作废 ${expiredIds.size} 条过期预选`);
}

const isTeamMode = computed(() => settings.value.activeMode === 'team' && Boolean(team.value));
const records = computed(() => {
  const base = isTeamMode.value ? teamHistory.value : personalRecords.value;
  return [...base].sort((a, b) => {
    // 实际日期降序 (YYYY-MM-DD)
    const dateCompare = b.date.localeCompare(a.date);
    if (dateCompare !== 0) return dateCompare;
    
    // 日期相同时，按时间降序排序 (HH:MM)
    const timeA = a.drawnAt || '';
    const timeB = b.drawnAt || '';
    return timeB.localeCompare(timeA);
  });
});
const locations = computed(() => isTeamMode.value ? teamLocations.value : personalLocations.value);

const canAddRecord = computed(() => true); // 允许人人随时记账补录
const canManageRecord = computed(() => true);

const showModal = ref(false);
const isEditing = ref(false);

// 列表加载更多与按月分组
const visibleCount = ref(30);
const groupedRecords = computed(() => {
  const shown = records.value.slice(0, visibleCount.value);
  const groups: { key: string; label: string; items: DailyRecord[] }[] = [];
  const currentMonth = getTodayDateString().slice(0, 7);
  for (const r of shown) {
    const monthKey = r.date.slice(0, 7);
    let g = groups[groups.length - 1];
    if (!g || g.key !== monthKey) {
      g = { key: monthKey, label: `${Number(monthKey.slice(5))}月` + (monthKey === currentMonth ? ' (本月)' : ''), items: [] };
      groups.push(g);
    }
    g.items.push(r);
  }
  return groups;
});

const form = ref({
  id: '',
  date: getTodayDateString(),
  mealCategory: 'lunch' as MealCategory,
  status: 'confirmed' as RecordStatus,
  locationId: '',
  locationName: '',
  emoji: '🍱',
  note: '',
  cost: undefined as number | undefined,
  tags: [] as string[]
});

// 个人模式月度消费统计
const stats = computed(() => {
  const currentMonthStr = getTodayDateString().slice(0, 7); // YYYY-MM
  const monthRecords = personalRecords.value.filter(r => r.date.startsWith(currentMonthStr));
  
  let monthlyTotal = 0;
  let teaCount = 0;
  let teaTotal = 0;
  
  const catTotalMap: Record<string, number> = { breakfast: 0, lunch: 0, tea: 0, dinner: 0, night: 0 };
  
  monthRecords.forEach(r => {
    const cost = r.cost || 0;
    monthlyTotal += cost;
    const cat = r.mealCategory || 'lunch';
    catTotalMap[cat] = (catTotalMap[cat] || 0) + cost;
    if (cat === 'tea') {
      teaCount += 1;
      teaTotal += cost;
    }
  });

  const catRatioMap: Record<string, number> = {};
  MEAL_CATEGORIES.forEach(c => {
    catRatioMap[c.key] = monthlyTotal > 0 ? (catTotalMap[c.key] / monthlyTotal) * 100 : 0;
  });

  const daysInMonth = new Date().getDate();
  const dailyAvg = daysInMonth > 0 ? monthlyTotal / daysInMonth : 0;

  return { monthlyTotal, teaCount, teaTotal, dailyAvg, catTotalMap, catRatioMap };
});

const budgetPercent = computed(() => {
  if (!settings.value.monthlyBudget || settings.value.monthlyBudget <= 0) return 0;
  return (stats.value.monthlyTotal / settings.value.monthlyBudget) * 100;
});

const budgetStatusClass = computed(() => {
  if (budgetPercent.value >= 100) return 'over-budget';
  if (budgetPercent.value >= 80) return 'warning-budget';
  return 'normal-budget';
});

const budgetStatusText = computed(() => {
  if (budgetPercent.value >= 100) return '⚠️ 伙食费已超支';
  if (budgetPercent.value >= 80) return '⚠️ 预算消耗过快';
  return '健康';
});

function exportCSV() {
  if (records.value.length === 0) {
    toastInfo('暂无饮食记账记录可导出');
    return;
  }

  let csvContent = '\uFEFF日期,餐别,地点/餐品,打卡状态,实付金额(元),备注,标签\n';

  records.value.forEach(r => {
    const catName = getCatName(r.mealCategory);
    const statusText = r.status === 'planned' ? '预选计划' : '已打卡';
    const costText = r.cost !== undefined ? r.cost.toFixed(2) : '0';
    const noteText = (r.note || '').replace(/"/g, '""');
    const tagsText = (r.tags || []).join(';');

    csvContent += `"${r.date}","${catName}","${r.locationName}","${statusText}","${costText}","${noteText}","${tagsText}"\n`;
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `WeeklyBento_记账明细_${getTodayDateString().slice(0, 7)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  if (settings.value.soundEnabled) soundEffects.playTick(800);
}

function getCatColor(catKey: MealCategory) {
  switch (catKey) {
    case 'breakfast': return '#F59E0B';
    case 'lunch': return '#FF6B00';
    case 'tea': return '#EC4899';
    case 'dinner': return '#8B5CF6';
    case 'night': return '#3B82F6';
    default: return '#64748B';
  }
}

function getCatEmoji(catKey?: MealCategory) {
  return MEAL_CATEGORIES.find(c => c.key === (catKey || 'lunch'))?.emoji || '🍱';
}

function getCatName(catKey?: MealCategory) {
  return MEAL_CATEGORIES.find(c => c.key === (catKey || 'lunch'))?.name.replace('池','') || '午餐';
}

function handleQuickConfirmRecord(recordId: string) {
  // 直接打开编辑弹窗，方便填写金额并确认打卡（替代原生 prompt）
  const rec = records.value.find(r => r.id === recordId);
  if (rec) openEditModal(rec);
}

function formatDate(dateStr: string) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  let dateObj: Date;
  if (parts.length === 3) {
    dateObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  } else {
    dateObj = new Date(dateStr);
  }
  
  const todayStr = getTodayDateString();
  const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const week = weekDays[dateObj.getDay()];
  const month = dateObj.getMonth() + 1;
  const day = dateObj.getDate();

  if (dateStr === todayStr) {
    return `今天 (${week})`;
  }
  return `${month}月${day}日 (${week})`;
}

function onTeamLocationChange() {
  const selectedLoc = locations.value.find(l => l.id === form.value.locationId);
  if (selectedLoc) {
    form.value.locationName = selectedLoc.name;
    form.value.emoji = selectedLoc.emoji;
    form.value.tags = selectedLoc.tags || [];
  }
}

function openAddModal() {
  if (settings.value.soundEnabled) soundEffects.playTick(600);
  isEditing.value = false;
  const defaultLoc = locations.value[0];
  form.value = {
    id: '',
    date: getTodayDateString(),
    mealCategory: 'lunch',
    status: 'confirmed',
    locationId: defaultLoc?.id || '',
    locationName: defaultLoc?.name || '',
    emoji: defaultLoc?.emoji || '🍱',
    note: '',
    cost: undefined,
    tags: defaultLoc?.tags || []
  };
  showModal.value = true;
}

function openEditModal(rec: DailyRecord) {
  if (settings.value.soundEnabled) soundEffects.playTick(600);
  isEditing.value = true;
  form.value = {
    id: rec.id,
    date: rec.date,
    mealCategory: rec.mealCategory || 'lunch',
    status: rec.status === 'planned' ? 'confirmed' : (rec.status || 'confirmed'),
    locationId: rec.locationId,
    locationName: rec.locationName,
    emoji: rec.emoji,
    note: rec.note || '',
    cost: rec.cost,
    tags: rec.tags || []
  };
  showModal.value = true;
}

async function saveRecord() {
  if (settings.value.soundEnabled) soundEffects.playTick(800);
  try {
    if (isTeamMode.value) {
      if (!form.value.locationId) {
        toastError('请先选择团队地点');
        return;
      }
      await addOrUpdateTeamRecord(form.value.locationId, form.value.date, form.value.note);
    } else {
      if (isEditing.value) {
        updateRecord({
          id: form.value.id,
          date: form.value.date,
          mealCategory: form.value.mealCategory,
          status: form.value.status,
          locationId: form.value.locationId,
          locationName: form.value.locationName,
          emoji: form.value.emoji,
          note: form.value.note,
          cost: form.value.cost,
          tags: form.value.tags,
          drawnAt: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
        });
      } else {
        addDirectRecord({
          date: form.value.date,
          mealCategory: form.value.mealCategory,
          status: form.value.status,
          locationId: form.value.locationId,
          locationName: form.value.locationName,
          emoji: form.value.emoji,
          note: form.value.note,
          cost: form.value.cost,
          tags: form.value.tags,
        });
      }
      pushToCloud(true);
    }
    showModal.value = false;
    if (settings.value.soundEnabled) soundEffects.playTick(900);
  } catch (e: any) {
    toastError(`保存记录失败: ${e.message || e}`);
  }
}

async function confirmDelete(id: string) {
  const ok = await toastConfirm({
    title: '删除记录',
    message: '确认删除此条记录？删除后可点击“撤销”恢复。',
    danger: true,
    confirmText: '删除',
  });
  if (!ok) return;
  if (settings.value.soundEnabled) soundEffects.playTick(400);
  try {
    if (isTeamMode.value) {
      await deleteTeamRecord(id);
      toastSuccess('已删除团队记录');
    } else {
      const target = personalRecords.value.find(r => r.id === id);
      deleteRecord(id);
      pushToCloud(true);
      toastSuccess('已删除记录', target ? {
        label: '撤销',
        onClick: () => {
          restoreRecord(target);
          pushToCloud(true);
        },
      } : undefined);
    }
  } catch (e: any) {
    toastError(e.message || '删除失败');
  }
}
</script>

<style scoped>
.history-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  padding-bottom: 90px;
}

.history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.header-title {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 1.1rem;
  font-weight: 800;
  min-width: 0;
}

.text-orange {
  color: var(--primary);
}

.mode-badge {
  font-size: 0.68rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 10px;
  white-space: nowrap;
}

.team-badge {
  background: #FFF7ED;
  color: #EA580C;
  border: 1px solid #FFEDD5;
}

.personal-badge {
  background: #F1F5F9;
  color: #475569;
  border: 1px solid #E2E8F0;
}

.add-rec-btn {
  padding: 6px 12px;
  font-size: 0.82rem;
  flex-shrink: 0;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  gap: 12px;
  text-align: center;
}

.empty-icon {
  color: var(--text-muted);
  opacity: 0.5;
}

.empty-text {
  font-size: 0.9rem;
  color: var(--text-muted);
}

.records-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.record-group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 10px 2px 2px;
}

.record-group-header:first-child {
  margin-top: 0;
}

.group-month {
  font-size: 0.82rem;
  font-weight: 800;
  color: var(--primary);
}

.group-count {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--text-muted);
}

.load-more-row {
  display: flex;
  justify-content: center;
  padding: 8px 0 4px;
}

.load-more-btn {
  padding: 8px 20px;
  font-size: 0.82rem;
}


.record-item {
  display: grid;
  grid-template-columns: 82px minmax(0, 1fr) auto;
  grid-template-areas: "date main actions";
  align-items: start;
  padding: 14px 16px;
  gap: 14px;
}

.item-date-col {
  grid-area: date;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 0;
  padding-right: 12px;
  border-right: 1px solid rgba(0, 0, 0, 0.06);
}

.date-meta-row {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  margin-top: 3px;
}

.date-str {
  font-size: 0.85rem;
  font-weight: 800;
  color: var(--primary);
}

.time-str {
  font-size: 0.7rem;
  color: var(--text-muted);
}

.item-main-col {
  grid-area: main;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.food-line {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 10px;
}

.food-emoji {
  font-size: 1.2rem;
  white-space: nowrap;
}

.food-name {
  font-size: 1.05rem;
  font-weight: 800;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.food-note {
  font-size: 0.8rem;
  color: var(--text-muted);
  font-style: italic;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.tags-wrap {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.tag-mini {
  font-size: 0.68rem;
  background: var(--primary-light);
  color: var(--primary);
  padding: 2px 6px;
  border-radius: 10px;
  font-weight: 600;
}

.admin-actions {
  grid-area: actions;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 6px;
  max-width: 112px;
}

.action-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.2s ease;
}

.action-btn:active {
  transform: scale(0.9);
}

.edit-btn {
  background: #EFF6FF;
  color: #2563EB;
}

.delete-btn {
  background: #FEF2F2;
  color: #EF4444;
}

.edit-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 16px;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-item label {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--text-main);
}

.modal-title {
  font-size: 1.1rem;
  font-weight: 800;
}

.modal-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 10px;
}

/* 消费统计看板 */
.expense-dashboard {
  padding: 14px 16px;
  background: linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,247,242,0.9) 100%);
  border-radius: var(--radius-lg);
  border: 1px solid rgba(255, 142, 83, 0.25);
  box-shadow: 0 4px 14px rgba(255, 107, 53, 0.06);
}

.main-stats {
  display: flex;
  gap: 10px;
  margin-bottom: 12px;
}

.stat-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px;
  background: #FFFFFF;
  border-radius: var(--radius-md);
  border: 1px solid #FFE4D6;
}

.stat-label {
  font-size: 0.72rem;
  font-weight: 700;
  color: #64748B;
}

.stat-val {
  font-size: 0.95rem;
  font-weight: 800;
  color: #EA580C;
}

.tea-card .stat-val {
  color: #DB2777;
}

.tea-stat-val {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
}

.ratio-bar-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ratio-title {
  font-size: 0.75rem;
  font-weight: 700;
  color: #475569;
}

.ratio-progress-bar {
  display: flex;
  height: 8px;
  border-radius: 4px;
  overflow: hidden;
  background: #E2E8F0;
}

.progress-seg {
  height: 100%;
  transition: width 0.3s ease;
}

.ratio-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  margin-top: 4px;
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.72rem;
  font-weight: 700;
  color: #475569;
}

.legend-item .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.meal-cat-badge {
  font-size: 0.7rem;
  font-weight: 700;
  color: #475569;
  background: #F1F5F9;
  padding: 2px 6px;
  border-radius: 6px;
  margin-top: 2px;
}

.status-tag {
  font-size: 0.72rem;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 6px;
  white-space: nowrap;
}

.status-tag.planned-tag {
  background: #FEF3C7;
  color: #D97706;
}

.status-tag.confirmed-tag {
  background: #DCFCE7;
  color: #15803D;
}

.cost-amount-badge {
  font-size: 0.85rem;
  font-weight: 800;
  color: #EA580C;
  background: #FFEDD5;
  padding: 2px 8px;
  border-radius: 10px;
  white-space: nowrap;
}

.action-btn-text.confirm-btn {
  background: #10B981;
  color: #FFFFFF;
  border: none;
  font-weight: 700;
  font-size: 0.75rem;
  padding: 6px 10px;
  border-radius: 8px;
  cursor: pointer;
  white-space: nowrap;
}

.meal-cat-radios {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  padding: 8px;
  background: #F8FAFC;
  border: 1px solid #E2E8F0;
  border-radius: var(--radius-sm);
}

.radio-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.82rem;
  font-weight: 600;
  color: #334155;
  cursor: pointer;
}

.radio-item input {
  accent-color: #FF6B00;
}

/* 跨日提醒与看板头部 Flex 布局与导出按钮样式 */
.expired-planned-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: #FFFBEB;
  border: 1px solid #FCD34D;
  border-radius: var(--radius-md);
  margin-bottom: 12px;
}

.banner-left {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.82rem;
  color: #92400E;
}

.text-orange {
  color: #F59E0B;
}

.banner-btn.clear-btn {
  background: #FEE2E2;
  color: #DC2626;
  border: 1px solid #FCA5A5;
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
}

.banner-btn.clear-btn:hover {
  background: #FCA5A5;
  color: #991B1B;
}

.dash-header-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 12px;
  margin-bottom: 12px;
}

.dash-title {
  font-size: 0.95rem;
  font-weight: 800;
  color: #1E293B;
  white-space: nowrap;
  flex-shrink: 0;
}

.export-csv-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  background: #FFFFFF;
  color: #2563EB;
  border: 1px solid #BFDBFE;
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}

.export-csv-btn:hover {
  background: #EFF6FF;
  border-color: #3B82F6;
  transform: translateY(-1px);
}

.budget-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 10px;
  padding: 8px;
  background: #F8FAFC;
  border-radius: 8px;
  border: 1px solid #E2E8F0;
}

.budget-info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.75rem;
  font-weight: 700;
}

.budget-label {
  color: #475569;
}

.budget-percent.normal-budget {
  color: #10B981;
}

.budget-percent.warning-budget {
  color: #F59E0B;
}

.budget-percent.over-budget {
  color: #EF4444;
}

.budget-progress-bg {
  height: 6px;
  background: #E2E8F0;
  border-radius: 3px;
  overflow: hidden;
}

.budget-progress-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s ease;
}

.budget-progress-fill.normal-budget {
  background: #10B981;
}

.budget-progress-fill.warning-budget {
  background: #F59E0B;
}

.budget-progress-fill.over-budget {
  background: #EF4444;
}

@media (max-width: 430px) {
  .history-container {
    gap: 12px;
    padding: 12px;
    padding-bottom: 90px;
  }

  .history-header {
    align-items: stretch;
    flex-direction: column;
  }

  .header-title {
    font-size: 1rem;
  }

  .mode-badge {
    margin-left: 28px;
  }

  .add-rec-btn {
    width: 100%;
  }

  .dash-header-row,
  .expired-planned-banner,
  .budget-info-row {
    align-items: flex-start;
    gap: 8px;
  }

  .expired-planned-banner,
  .budget-info-row {
    flex-direction: column;
  }

  .main-stats {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .stat-card:first-child {
    grid-column: 1 / -1;
  }

  .record-item {
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas:
      "date actions"
      "main main";
    gap: 10px 12px;
    padding: 13px 14px;
  }

  .item-date-col {
    flex-direction: row;
    align-items: center;
    gap: 8px;
    padding: 0;
    border-right: 0;
  }

  .date-meta-row {
    flex-direction: row;
    align-items: center;
    margin-top: 0;
  }

  .admin-actions {
    max-width: none;
  }

  .food-line {
    align-items: flex-start;
  }

  .food-name {
    flex: 1 1 calc(100% - 34px);
  }

  .modal-buttons {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }

  .modal-buttons > button {
    min-width: 0;
    padding-inline: 12px;
  }
}

@media (max-width: 350px) {
  .dash-header-row {
    align-items: stretch;
    flex-direction: column;
  }

  .export-csv-btn {
    justify-content: center;
  }

  .main-stats {
    grid-template-columns: 1fr;
  }

  .stat-card:first-child {
    grid-column: auto;
  }

  .record-item {
    grid-template-columns: 1fr;
    grid-template-areas: "date" "main" "actions";
  }

  .admin-actions {
    justify-content: flex-start;
  }
}

/* ✨ AI 饮食周报 CSS */
.dash-btn-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.ai-report-btn {
  background: linear-gradient(135deg, #FF9933 0%, #FF6600 100%) !important;
  box-shadow: 0 2px 6px rgba(255, 102, 0, 0.2);
  white-space: nowrap;
  padding: 4px 10px !important;
  font-size: 0.76rem !important;
  border-radius: 14px !important;
  gap: 4px !important;
  height: 28px;
}

.export-csv-btn {
  background: #F1F5F9;
  color: #475569;
  border: 1px solid #E2E8F0;
  padding: 4px 10px;
  font-size: 0.76rem;
  font-weight: 600;
  border-radius: 14px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 28px;
  transition: all 0.2s ease;
}

.export-csv-btn:hover {
  background: #E2E8F0;
  color: #1E293B;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(15, 23, 42, 0.65);
  backdrop-filter: blur(8px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.weekly-report-modal {
  max-width: 440px;
  width: 92%;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  background: #FFFDF9;
  border-radius: 20px;
  padding: 18px 20px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.25), 0 0 20px rgba(251, 146, 60, 0.15);
  border: 1px solid rgba(251, 146, 60, 0.2);
}

.report-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px dashed #E2E8F0;
}

.title-with-icon {
  display: flex;
  align-items: center;
  gap: 6px;
}

.report-title {
  font-size: 0.98rem;
  font-weight: 800;
  color: #1E293B;
}

.close-report-btn {
  background: #F1F5F9;
  border: none;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  font-size: 13px;
  color: #64748B;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.close-report-btn:hover {
  background: #E2E8F0;
  color: #0F172A;
}

.report-card-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 14px;
  max-height: 55vh;
  overflow-y: auto;
  padding-right: 4px;
}

.report-badge-box {
  background: linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 100%);
  border: 1px solid #FDBA74;
  border-radius: 12px;
  padding: 10px 12px;
  text-align: center;
  box-shadow: 0 2px 8px rgba(251, 146, 60, 0.12);
}

.badge-label {
  font-size: 0.7rem;
  font-weight: 800;
  color: #C2410C;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.report-badge-title {
  font-size: 1.1rem;
  font-weight: 900;
  color: #9A3412;
  margin-top: 2px;
}

.report-item-card {
  border-radius: 12px;
  padding: 10px 12px;
  transition: transform 0.2s ease;
}

.report-item-card:hover {
  transform: translateY(-1px);
}

/* 分色轻量调性卡片 */
.card-pink {
  background: #FFF1F2;
  border: 1px solid #FECDD3;
}

.card-pink .item-title {
  color: #BE123C;
}

.card-green {
  background: #F0FDF4;
  border: 1px solid #BBF7D0;
}

.card-green .item-title {
  color: #15803D;
}

.card-amber {
  background: #FEFCE8;
  border: 1px solid #FEF08A;
}

.card-amber .item-title {
  color: #A16207;
}

.item-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.item-icon {
  font-size: 1rem;
}

.item-title {
  font-size: 0.85rem;
  font-weight: 800;
}

.item-text {
  font-size: 0.82rem;
  color: #334155;
  line-height: 1.45;
}

.report-footer {
  display: flex;
  align-items: center;
  gap: 10px;
}
</style>
