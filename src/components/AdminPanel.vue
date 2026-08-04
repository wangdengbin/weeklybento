<template>
  <div class="admin-panel">
    <div class="panel-header">
      <div class="header-left">
        <Crown class="crown-icon" :size="22" />
        <h3 class="panel-title">管理员控制台</h3>
      </div>
      <button class="icon-btn close-panel-btn" @click="handleLogout" title="退出管理模式">
        <LogOut :size="18" />
      </button>
    </div>

    <!-- 控制台选项卡 Nav -->
    <div class="panel-tabs">
      <button class="tab-btn" :class="{ active: activeTab === 'locations' }" @click="activeTab = 'locations'">
        <Utensils :size="16" />
        <span>地点池 ({{ locations.length }})</span>
      </button>
      <button class="tab-btn" :class="{ active: activeTab === 'cloud' }" @click="activeTab = 'cloud'">
        <Cloud :size="16" />
        <span>云同步/安全</span>
      </button>
    </div>

    <!-- TAB 1: 地点池配置 -->
    <div v-if="activeTab === 'locations'" class="tab-content">
      <div class="toolbar">
        <button class="btn-primary add-loc-btn" @click="openAddLocModal">
          <Plus :size="16" />
          <span>添加新午餐地点</span>
        </button>
        <button class="btn-secondary" @click="handleResetPool" title="重置本轮池子">
          <RotateCcw :size="14" />
          <span>重置抽签状态</span>
        </button>
      </div>

      <div class="locations-list">
        <div v-for="loc in locations" :key="loc.id" class="loc-card" :class="{ 'is-drawn': loc.isDrawn }">
          <div class="loc-emoji">{{ loc.emoji }}</div>
          <div class="loc-info">
            <div class="loc-name-row">
              <span class="loc-name">{{ loc.name }}</span>
              <span v-if="loc.isDrawn" class="drawn-badge">本轮已抽中</span>
            </div>
            <div class="loc-details">
              <span class="price">{{ loc.priceRange }}</span>
              <span class="dish" v-if="loc.recommendedDish">| {{ loc.recommendedDish }}</span>
            </div>
            <div class="tags-list">
              <span v-for="t in loc.tags" :key="t" class="tag-small">#{{ t }}</span>
            </div>
          </div>

          <div class="loc-actions">
            <button class="icon-action edit" @click="openEditLocModal(loc)">
              <Edit3 :size="15" />
            </button>
            <button class="icon-action delete" @click="handleDeleteLoc(loc.id)">
              <Trash2 :size="15" />
            </button>
          </div>
        </div>
      </div>

      <div class="danger-zone">
        <button class="restore-link" @click="handleRestoreDefault">
          ↺ 恢复为系统预设 16+ 经典美食地点池
        </button>
      </div>
    </div>

    <!-- TAB 2: 云端存储与密码设置 -->
    <div v-if="activeTab === 'cloud'" class="tab-content">
      <!-- 密码修改区 -->
      <div class="config-card glass-card">
        <h4 class="card-heading">
          <Lock :size="16" />
          <span>修改管理员密码</span>
        </h4>
        <form @submit.prevent="handleUpdatePassword" class="password-form">
          <input type="password" v-model="pwdForm.oldPwd" placeholder="当前旧密码" required class="input-field" />
          <input type="password" v-model="pwdForm.newPwd" placeholder="输入新密码 (至少4位)" required class="input-field" />
          <button type="submit" class="btn-primary small-btn">更新密码</button>
        </form>
      </div>

      <!-- 无后端前端直连云数据库 (安全隐藏明文 Key) -->
      <div class="config-card glass-card">
        <h4 class="card-heading">
          <CloudCloud :size="16" />
          <span>JSONBin 云数据库同步</span>
        </h4>
        <div class="cloud-status-box">
          <div class="status-indicator">
            <span class="status-green-dot"></span>
            <span class="status-title">环境变量云端托管中 (凭据已加密隐蔽)</span>
          </div>
          <p class="status-sub">所有改动将实时上传云端，并在启动时自动拉取同步。</p>
        </div>

        <div v-if="syncLog" class="sync-log-box">
          {{ syncLog }}
        </div>

        <div class="cloud-btn-row">
          <button class="btn-primary" :disabled="isSyncing" @click="handlePushCloud">
            <UploadCloud :size="16" />
            <span>强制推送至云端</span>
          </button>
          <button class="btn-secondary" :disabled="isSyncing" @click="handlePullCloud">
            <DownloadCloud :size="16" />
            <span>重新从云端拉取</span>
          </button>
        </div>
      </div>

      <!-- 数据备份导出/导入 -->
      <div class="config-card glass-card">
        <h4 class="card-heading">
          <FileSpreadsheet :size="16" />
          <span>JSON 数据备份与恢复</span>
        </h4>
        <div class="backup-btn-row">
          <button class="btn-secondary" @click="exportDataJSON">
            <Download :size="16" />
            <span>导出 JSON 备份</span>
          </button>
          <label class="btn-secondary file-upload-btn">
            <Upload :size="16" />
            <span>导入 JSON 数据</span>
            <input type="file" accept=".json" @change="handleImportFile" hidden />
          </label>
        </div>
      </div>
    </div>

    <!-- 地点新增/修改 Modal -->
    <div v-if="showLocModal" class="modal-overlay" @click.self="showLocModal = false">
      <div class="modal-content">
        <h3 class="modal-title">{{ isEditLoc ? '编辑午餐地点' : '新增午餐地点' }}</h3>
        <form @submit.prevent="saveLoc" class="loc-form">
          <div class="form-row-inline">
            <div class="form-item short">
              <label>Emoji 图标：</label>
              <input type="text" v-model="locForm.emoji" required class="input-field center-text" />
            </div>
            <div class="form-item flex-1">
              <label>地点/餐厅名称：</label>
              <input type="text" v-model="locForm.name" placeholder="如：萨莉亚" required class="input-field" />
            </div>
          </div>

          <div class="form-item">
            <label>推荐菜品 / 备注：</label>
            <input type="text" v-model="locForm.recommendedDish" placeholder="如：蒜香蜗牛加金米饭" class="input-field" />
          </div>

          <div class="form-row-inline">
            <div class="form-item flex-1">
              <label>人均消费区间：</label>
              <input type="text" v-model="locForm.priceRange" placeholder="如：￥20-35" class="input-field" />
            </div>
            <div class="form-item flex-1">
              <label>标签 (逗号分隔)：</label>
              <input type="text" v-model="tagsInput" placeholder="如：快餐, 盖饭" class="input-field" />
            </div>
          </div>

          <div class="modal-buttons">
            <button type="button" class="btn-secondary" @click="showLocModal = false">取消</button>
            <button type="submit" class="btn-primary">保存地点</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { 
  Crown, LogOut, Utensils, Cloud, Plus, RotateCcw, Edit3, Trash2, Lock, 
  Cloud as CloudCloud, UploadCloud, DownloadCloud, FileSpreadsheet, Download, Upload 
} from 'lucide-vue-next';
import { useBentoStore } from '../composables/useBentoStore';
import { useAdmin } from '../composables/useAdmin';
import { useCloudSync } from '../composables/useCloudSync';
import { soundEffects } from '../composables/useAudio';
import type { BentoLocation } from '../types';

const emit = defineEmits(['close']);

const { locations, addLocation, updateLocation, deleteLocation, resetPool, restoreDefaultLocations, exportDataJSON, importDataJSON, settings } = useBentoStore();
const { logout, changePassword } = useAdmin();
const { isSyncing, syncLog, pushToCloud, pullFromCloud } = useCloudSync();

const activeTab = ref<'locations' | 'cloud'>('locations');

// 密码表单
const pwdForm = ref({ oldPwd: '', newPwd: '' });

// 地点编辑弹窗表单
const showLocModal = ref(false);
const isEditLoc = ref(false);
const locForm = ref<BentoLocation>({
  id: '',
  name: '',
  emoji: '🍱',
  tags: [],
  priceRange: '￥20-35',
  recommendedDish: '',
  weight: 1,
  isDrawn: false,
  createdAt: Date.now()
});
const tagsInput = ref('');

function handleLogout() {
  logout();
  emit('close');
}

function handleResetPool() {
  if (confirm('确认将所有已抽中地点置为待抽状态？')) {
    if (settings.value.soundEnabled) soundEffects.playTick(600);
    resetPool();
    pushToCloud(true);
  }
}

function handleRestoreDefault() {
  if (confirm('警告：这将会把地点池重置为初始预设的 16+ 美食地点，自定义的地点将被覆盖。是否继续？')) {
    if (settings.value.soundEnabled) soundEffects.playTick(600);
    restoreDefaultLocations();
    pushToCloud(true);
  }
}

function openAddLocModal() {
  if (settings.value.soundEnabled) soundEffects.playTick(600);
  isEditLoc.value = false;
  locForm.value = {
    id: '',
    name: '',
    emoji: '🍲',
    tags: ['美味', '午餐'],
    priceRange: '￥20-35',
    recommendedDish: '',
    weight: 1,
    isDrawn: false,
    createdAt: Date.now()
  };
  tagsInput.value = '美味, 午餐';
  showLocModal.value = true;
}

function openEditLocModal(loc: BentoLocation) {
  if (settings.value.soundEnabled) soundEffects.playTick(600);
  isEditLoc.value = true;
  locForm.value = { ...loc };
  tagsInput.value = (loc.tags || []).join(', ');
  showLocModal.value = true;
}

function saveLoc() {
  if (settings.value.soundEnabled) soundEffects.playTick(800);
  const parsedTags = tagsInput.value
    .split(/[,，]/)
    .map(t => t.trim())
    .filter(Boolean);

  if (isEditLoc.value) {
    updateLocation({ ...locForm.value, tags: parsedTags });
  } else {
    addLocation({
      name: locForm.value.name,
      emoji: locForm.value.emoji || '🍱',
      tags: parsedTags,
      priceRange: locForm.value.priceRange || '￥20-35',
      recommendedDish: locForm.value.recommendedDish,
      weight: 1,
    });
  }
  pushToCloud(true);
  showLocModal.value = false;
}

function handleDeleteLoc(id: string) {
  if (confirm('确定删除此午餐地点？')) {
    if (settings.value.soundEnabled) soundEffects.playTick(300);
    deleteLocation(id);
    pushToCloud(true);
  }
}

function handleUpdatePassword() {
  const res = changePassword(pwdForm.value.oldPwd, pwdForm.value.newPwd);
  alert(res.message);
  if (res.success) {
    pwdForm.value = { oldPwd: '', newPwd: '' };
    pushToCloud(true);
  }
}

async function handlePushCloud() {
  const res = await pushToCloud(false);
  alert(res.message);
}

async function handlePullCloud() {
  if (confirm('警告：从云端拉取将用云端数据覆盖当前本地，是否继续？')) {
    const res = await pullFromCloud(false);
    alert(res.message);
  }
}

function handleImportFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const content = e.target?.result as string;
    if (content) {
      const ok = importDataJSON(content);
      if (ok) {
        alert('JSON 数据导入成功！');
        pushToCloud(true);
      } else {
        alert('JSON 导入失败，请检查文件格式。');
      }
    }
  };
  reader.readAsText(file);
}
</script>

<style scoped>
.admin-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #F3F4F6;
  padding-bottom: 12px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.crown-icon {
  color: #F59E0B;
}

.panel-title {
  font-size: 1.15rem;
  font-weight: 800;
}

.close-panel-btn {
  background: #F3F4F6;
}

.panel-tabs {
  display: flex;
  background: #F3F4F6;
  padding: 4px;
  border-radius: var(--radius-md);
  gap: 4px;
}

.tab-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  border: none;
  background: transparent;
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.2s ease;
}

.tab-btn.active {
  background: #FFFFFF;
  color: var(--primary);
  box-shadow: var(--shadow-sm);
}

.tab-content {
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-height: 60vh;
  overflow-y: auto;
  padding-right: 4px;
}

.toolbar {
  display: flex;
  gap: 8px;
}

.add-loc-btn {
  flex: 1;
  padding: 10px 14px;
  font-size: 0.9rem;
}

.locations-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.loc-card {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  background: #FAFAFA;
  border: 1px solid #E5E7EB;
  border-radius: var(--radius-md);
  gap: 12px;
}

.loc-card.is-drawn {
  opacity: 0.6;
  background: #F3F4F6;
}

.loc-emoji {
  font-size: 1.6rem;
}

.loc-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.loc-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.loc-name {
  font-weight: 800;
  font-size: 0.95rem;
}

.drawn-badge {
  font-size: 0.65rem;
  background: #E5E7EB;
  color: #6B7280;
  padding: 1px 6px;
  border-radius: 4px;
}

.loc-details {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.tags-list {
  display: flex;
  gap: 4px;
}

.tag-small {
  font-size: 0.65rem;
  color: var(--primary);
}

.loc-actions {
  display: flex;
  gap: 4px;
}

.icon-action {
  width: 30px;
  height: 30px;
  border-radius: 6px;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.icon-action.edit {
  background: #EFF6FF;
  color: #2563EB;
}

.icon-action.delete {
  background: #FEF2F2;
  color: #EF4444;
}

.danger-zone {
  text-align: center;
  margin-top: 10px;
}

.restore-link {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 0.75rem;
  cursor: pointer;
  text-decoration: underline;
}

.config-card {
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.card-heading {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.92rem;
  font-weight: 800;
  color: var(--text-main);
}

.password-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.small-btn {
  padding: 10px;
  font-size: 0.9rem;
}

.cloud-status-box {
  background: #F0FDF4;
  border: 1px solid #BBF7D0;
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
}

.status-green-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #22C55E;
}

.status-title {
  font-size: 0.82rem;
  font-weight: 800;
  color: #15803D;
}

.status-sub {
  font-size: 0.75rem;
  color: #166534;
}

.sync-log-box {
  font-size: 0.75rem;
  background: #FFF7ED;
  color: #C2410C;
  padding: 8px;
  border-radius: 6px;
}

.cloud-btn-row, .backup-btn-row {
  display: flex;
  gap: 10px;
  margin-top: 4px;
}

.cloud-btn-row button, .backup-btn-row button, .file-upload-btn {
  flex: 1;
}

.file-upload-btn {
  cursor: pointer;
}

.form-row-inline {
  display: flex;
  gap: 8px;
}

.form-item.short {
  width: 90px;
}

.flex-1 {
  flex: 1;
}

.center-text {
  text-align: center;
  font-size: 1.2rem;
}

.loc-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 12px;
}

.modal-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}
</style>
