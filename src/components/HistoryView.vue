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
        <button class="export-csv-btn" @click="exportCSV" title="导出 Excel/CSV 格式记账明细单">
          <FileSpreadsheet :size="14" />
          <span>导出 CSV 账单</span>
        </button>
      </div>

      <div class="dash-row main-stats">
        <div class="stat-card total-card">
          <span class="stat-label">💰 本月伙食总支出</span>
          <span class="stat-val">￥{{ stats.monthlyTotal.toFixed(2) }}</span>
        </div>
        <div class="stat-card tea-card">
          <span class="stat-label">🧋 奶茶专账</span>
          <span class="stat-val">{{ stats.teaCount }} 杯 · ￥{{ stats.teaTotal.toFixed(2) }}</span>
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
      <div v-for="rec in records" :key="rec.id" class="record-item glass-card" :class="{ 'is-planned': rec.status === 'planned' }">
        <div class="item-date-col">
          <span class="date-str">{{ formatDate(rec.date) }}</span>
          <span class="time-str">{{ rec.drawnAt }}</span>
          
          <!-- 餐别 Tag -->
          <span class="meal-cat-badge">
            {{ getCatEmoji(rec.mealCategory) }} {{ getCatName(rec.mealCategory) }}
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
              <label v-for="cat in MEAL_CATEGORIES" :key="cat.key" class="radio-item">
                <input type="radio" v-model="form.mealCategory" :value="cat.key" />
                <span>{{ cat.emoji }} {{ cat.name }}</span>
              </label>
            </div>
          </div>

          <div class="form-item">
            <label>选择/输入地点：</label>
            <select v-model="form.locationId" @change="onLocationSelectChange" required class="input-field">
              <option v-for="loc in locations" :key="loc.id" :value="loc.id">
                {{ loc.emoji }} {{ loc.name }}
              </option>
            </select>
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { Calendar, Plus, UtensilsCrossed, Edit3, Trash2, FileSpreadsheet, AlertCircle } from 'lucide-vue-next';
import { useBentoStore } from '../composables/useBentoStore';
import { useTeamWorkspace } from '../composables/useTeamWorkspace';
import { useCloudSync } from '../composables/useCloudSync';
import { soundEffects } from '../composables/useAudio';
import { MEAL_CATEGORIES, type DailyRecord, type MealCategory, type RecordStatus } from '../types';

const { records: personalRecords, locations: personalLocations, updateRecord, deleteRecord, confirmDailyRecord, addDirectRecord, settings } = useBentoStore();
const { team, history: teamHistory, locations: teamLocations, addOrUpdateTeamRecord, deleteTeamRecord } = useTeamWorkspace();
const { pushToCloud } = useCloudSync();

const todayStr = computed(() => new Date().toISOString().slice(0, 10));

// 跨日过往未结预选记录
const expiredPlannedRecords = computed(() => {
  return personalRecords.value.filter(r => r.date < todayStr.value && r.status === 'planned');
});

function handleClearExpiredPlanned() {
  if (confirm(`确认作废这 ${expiredPlannedRecords.value.length} 条过往未打卡的预选记录吗？`)) {
    const expiredIds = new Set(expiredPlannedRecords.value.map(r => r.id));
    expiredIds.forEach(id => deleteRecord(id));
    pushToCloud(true);
    if (settings.value.soundEnabled) soundEffects.playTick(700);
  }
}

const isTeamMode = computed(() => settings.value.activeMode === 'team' && Boolean(team.value));
const records = computed(() => isTeamMode.value ? teamHistory.value : personalRecords.value);
const locations = computed(() => isTeamMode.value ? teamLocations.value : personalLocations.value);

const canAddRecord = computed(() => true); // 允许人人随时记账补录
const canManageRecord = computed(() => true);

const showModal = ref(false);
const isEditing = ref(false);

const form = ref({
  id: '',
  date: new Date().toISOString().slice(0, 10),
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
  const currentMonthStr = new Date().toISOString().slice(0, 7); // YYYY-MM
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
  if (personalRecords.value.length === 0) {
    alert('暂无饮食记账记录可导出');
    return;
  }

  let csvContent = '\uFEFF日期,餐别,地点/餐品,打卡状态,实付金额(元),备注,标签\n';

  personalRecords.value.forEach(r => {
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
  a.download = `WeeklyBento_记账明细_${new Date().toISOString().slice(0, 7)}.csv`;
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
  const costStr = prompt('请输入实付金额（元）：', '20');
  if (costStr === null) return;
  const cost = parseFloat(costStr);
  confirmDailyRecord(recordId, isNaN(cost) ? undefined : cost);
  pushToCloud(true);
  if (settings.value.soundEnabled) soundEffects.playTick(900);
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
  
  const todayStr = new Date().toISOString().slice(0, 10);
  const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const week = weekDays[dateObj.getDay()];
  const month = dateObj.getMonth() + 1;
  const day = dateObj.getDate();

  if (dateStr === todayStr) {
    return `今天 (${week})`;
  }
  return `${month}月${day}日 (${week})`;
}

function openAddModal() {
  if (settings.value.soundEnabled) soundEffects.playTick(600);
  isEditing.value = false;
  form.value = {
    id: '',
    date: new Date().toISOString().slice(0, 10),
    mealCategory: 'lunch',
    status: 'confirmed',
    locationId: locations.value[0]?.id || '',
    locationName: locations.value[0]?.name || '',
    emoji: locations.value[0]?.emoji || '🍱',
    note: '',
    cost: undefined,
    tags: locations.value[0]?.tags || []
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
    status: rec.status || 'confirmed',
    locationId: rec.locationId,
    locationName: rec.locationName,
    emoji: rec.emoji,
    note: rec.note || '',
    cost: rec.cost,
    tags: rec.tags || []
  };
  showModal.value = true;
}

function onLocationSelectChange() {
  const target = locations.value.find(l => l.id === form.value.locationId);
  if (target) {
    form.value.locationName = target.name;
    form.value.emoji = target.emoji;
    form.value.tags = target.tags || [];
  }
}

async function saveRecord() {
  if (settings.value.soundEnabled) soundEffects.playTick(800);
  try {
    if (isTeamMode.value) {
      if (!form.value.locationId) {
        alert('请选择地点');
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
  } catch (e: any) {
    alert(`保存记录失败: ${e.message || e}`);
  }
}

async function confirmDelete(id: string) {
  if (confirm('确认删除此条记录？')) {
    if (settings.value.soundEnabled) soundEffects.playTick(400);
    try {
      if (isTeamMode.value) {
        await deleteTeamRecord(id);
      } else {
        deleteRecord(id);
        pushToCloud(true);
      }
    } catch (e: any) {
      alert(e.message || '删除失败');
    }
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
}

.header-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1.1rem;
  font-weight: 800;
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
  gap: 12px;
}

.record-item {
  display: flex;
  align-items: center;
  padding: 14px 16px;
  gap: 14px;
}

.item-date-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 68px;
  padding-right: 12px;
  border-right: 1px solid rgba(0, 0, 0, 0.06);
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
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.food-line {
  display: flex;
  align-items: center;
  gap: 6px;
}

.food-emoji {
  font-size: 1.2rem;
}

.food-name {
  font-size: 1.05rem;
  font-weight: 800;
}

.food-note {
  font-size: 0.8rem;
  color: var(--text-muted);
  font-style: italic;
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
  display: flex;
  align-items: center;
  gap: 6px;
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
</style>
