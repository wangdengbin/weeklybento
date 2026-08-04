<template>
  <div class="history-container">
    <div class="history-header">
      <div class="header-title">
        <Calendar :size="20" class="text-orange" />
        <span>{{ isTeamMode ? `${team?.name || '团队'} 每日抽签记录` : '每日午餐记录' }}</span>
        <span class="mode-badge" :class="isTeamMode ? 'team-badge' : 'personal-badge'">
          {{ isTeamMode ? '👥 团队全员同步' : '🏠 个人记录' }}
        </span>
      </div>

      <!-- 管理员补录历史记录按钮 -->
      <button v-if="!isTeamMode && isAdminLoggedIn" class="btn-secondary add-rec-btn" @click="openAddModal">
        <Plus :size="16" />
        <span>补录记录</span>
      </button>
    </div>

    <!-- 列表展示 -->
    <div v-if="records.length === 0" class="empty-state glass-card">
      <UtensilsCrossed :size="48" class="empty-icon" />
      <p class="empty-text">{{ isTeamMode ? '团队暂无选餐记录，大家快去 Roll 一个吧！' : '尚无午餐记录，快去 Roll 一个吧！' }}</p>
    </div>

    <div v-else class="records-list">
      <div v-for="rec in records" :key="rec.id" class="record-item glass-card">
        <div class="item-date-col">
          <span class="date-str">{{ formatDate(rec.date) }}</span>
          <span class="time-str">{{ rec.drawnAt }}</span>
        </div>

        <div class="item-main-col">
          <div class="food-line">
            <span class="food-emoji">{{ rec.emoji }}</span>
            <span class="food-name">{{ rec.locationName }}</span>
          </div>

          <div v-if="rec.note" class="food-note">
            "{{ rec.note }}"
          </div>

          <div v-if="rec.tags && rec.tags.length" class="tags-wrap">
            <span v-for="t in rec.tags" :key="t" class="tag-mini"># {{ t }}</span>
          </div>
        </div>

        <!-- 个人模式管理员操作 -->
        <div v-if="!isTeamMode && isAdminLoggedIn" class="admin-actions">
          <button class="action-btn edit-btn" @click="openEditModal(rec)" title="管理员修改记录">
            <Edit3 :size="16" />
          </button>
          <button class="action-btn delete-btn" @click="confirmDelete(rec.id)" title="管理员删除记录">
            <Trash2 :size="16" />
          </button>
        </div>
      </div>
    </div>

    <!-- 管理员编辑/补录弹窗 Modal -->
    <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
      <div class="modal-content">
        <h3 class="modal-title">{{ isEditing ? '修改午餐记录 (管理员)' : '新增午餐记录 (管理员)' }}</h3>
        
        <form @submit.prevent="saveRecord" class="edit-form">
          <div class="form-item">
            <label>用餐日期：</label>
            <input type="date" v-model="form.date" required class="input-field" />
          </div>

          <div class="form-item">
            <label>选择地点：</label>
            <select v-model="form.locationId" @change="onLocationSelectChange" required class="input-field">
              <option v-for="loc in locations" :key="loc.id" :value="loc.id">
                {{ loc.emoji }} {{ loc.name }}
              </option>
            </select>
          </div>

          <div class="form-item">
            <label>用餐心得 / 备注：</label>
            <input type="text" v-model="form.note" placeholder="例如：加了卤蛋，非常美味！" class="input-field" />
          </div>

          <div class="modal-buttons">
            <button type="button" class="btn-secondary" @click="showModal = false">取消</button>
            <button type="submit" class="btn-primary">保存修改</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { Calendar, Plus, UtensilsCrossed, Edit3, Trash2 } from 'lucide-vue-next';
import { useBentoStore } from '../composables/useBentoStore';
import { useTeamWorkspace } from '../composables/useTeamWorkspace';
import { useAdmin } from '../composables/useAdmin';
import { soundEffects } from '../composables/useAudio';
import type { DailyRecord } from '../types';

const { records: personalRecords, locations, updateRecord, deleteRecord, addDailyRecord, settings } = useBentoStore();
const { team, history: teamHistory } = useTeamWorkspace();
const { isAdminLoggedIn } = useAdmin();

const isTeamMode = computed(() => settings.value.activeMode === 'team' && Boolean(team.value));
const records = computed(() => isTeamMode.value ? teamHistory.value : personalRecords.value);

const showModal = ref(false);
const isEditing = ref(false);

const form = ref({
  id: '',
  date: new Date().toISOString().slice(0, 10),
  locationId: '',
  locationName: '',
  emoji: '🍱',
  note: '',
  tags: [] as string[]
});

function formatDate(dateStr: string) {
  const today = new Date().toISOString().slice(0, 10);
  if (dateStr === today) return '今天';
  
  const dateObj = new Date(dateStr);
  const month = dateObj.getMonth() + 1;
  const day = dateObj.getDate();
  const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const week = weekDays[dateObj.getDay()];
  return `${month}月${day}日 (${week})`;
}

function openAddModal() {
  if (settings.value.soundEnabled) soundEffects.playTick(600);
  isEditing.value = false;
  form.value = {
    id: '',
    date: new Date().toISOString().slice(0, 10),
    locationId: locations.value[0]?.id || '',
    locationName: locations.value[0]?.name || '',
    emoji: locations.value[0]?.emoji || '🍱',
    note: '',
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
    locationId: rec.locationId,
    locationName: rec.locationName,
    emoji: rec.emoji,
    note: rec.note || '',
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

function saveRecord() {
  if (settings.value.soundEnabled) soundEffects.playTick(800);
  if (isEditing.value) {
    updateRecord({
      id: form.value.id,
      date: form.value.date,
      locationId: form.value.locationId,
      locationName: form.value.locationName,
      emoji: form.value.emoji,
      tags: form.value.tags,
      drawnAt: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      note: form.value.note
    });
  } else {
    const loc = locations.value.find(l => l.id === form.value.locationId);
    if (loc) {
      addDailyRecord(loc, form.value.date, form.value.note);
    }
  }
  showModal.value = false;
}

function confirmDelete(id: string) {
  if (confirm('管理员确认：是否删除此条记录？')) {
    if (settings.value.soundEnabled) soundEffects.playTick(400);
    deleteRecord(id);
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
</style>
