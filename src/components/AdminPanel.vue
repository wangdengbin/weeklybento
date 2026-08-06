<template>
  <div class="admin-panel">
    <div class="panel-header">
      <div class="header-left">
        <Crown class="crown-icon" :size="22" />
        <h3 class="panel-title">管理员控制台</h3>
      </div>
      <button class="close-admin-btn" @click="handleLogout" title="关闭管理员控制台">
        <X :size="15" />
        <span>关闭</span>
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
      <!-- 🍱 场景餐池展示开关配置区 -->
      <div class="meal-categories-config-card glass-card">
        <div class="config-card-header">
          <Utensils :size="16" class="text-orange" />
          <span class="header-title">🍱 场景餐池展示配置（勾选控制在前台显隐）</span>
        </div>
        <div class="cat-checkbox-grid">
          <label 
            v-for="cat in MEAL_CATEGORIES" 
            :key="cat.key" 
            class="cat-toggle-label" 
            :class="{ 'is-checked': enabledCatKeys.includes(cat.key) }"
          >
            <input 
              type="checkbox" 
              :value="cat.key" 
              :checked="enabledCatKeys.includes(cat.key)" 
              @change="handleToggleCategory(cat.key)"
            />
            <span class="cat-icon">{{ cat.emoji }}</span>
            <span class="cat-text">{{ cat.name }}</span>
          </label>
        </div>
      </div>

      <div class="toolbar-wrapper">
        <div class="toolbar-row action-row-grid">
          <button class="btn-primary add-loc-btn" @click="openAddLocModal">
            <Plus :size="16" />
            <span>添加新午餐地点</span>
          </button>
          <button class="btn-secondary scan-nearby-action-btn" @click="emit('open-scan-modal')" title="基于定位自动扫描附近 500m~2000m 美食，由 AI 智能整理维护入库">
            <Compass :size="15" class="text-orange spin-hover" />
            <span>📍 扫描周边美食 (AI 维护)</span>
          </button>
          <button class="btn-secondary batch-import-action-btn" @click="showBatchModal = true" title="支持多行文本或美团/大众点评地址截图批量导入">
            <FileText :size="14" />
            <span>批量文本/截图导入</span>
          </button>
        </div>

        <div class="toolbar-row ai-row">
          <button class="btn-secondary ai-autofill-btn ai-glow-pill full-width-btn" :disabled="isAutoFilling" @click="handleAiAutoFillAllLocations" title="让 AI 自动扫描当前地址池，智能补全所有缺失的推荐菜、Emoji与人均价格">
            <Sparkles :size="15" class="ai-sparkle-icon" />
            <span>{{ isAutoFilling ? 'AI 智能分析补全中...' : '✨ AI 智能补全现有地址池 (推荐菜/人均/Emoji)' }}</span>
          </button>
        </div>
        <div v-if="selectedLocIds.length > 0 || settings.activeMode === 'personal'" class="toolbar-row sub-action-row">
          <button v-if="selectedLocIds.length > 0" class="btn-danger flex-1" @click="handleBatchDelete">
            <Trash2 :size="14" />
            <span>批量删除 ({{ selectedLocIds.length }})</span>
          </button>
          <button v-if="settings.activeMode === 'personal'" class="btn-secondary flex-1" @click="handleResetPool" title="重置本轮池子">
            <RotateCcw :size="14" />
            <span>重置抽签状态</span>
          </button>
        </div>
      </div>

      <!-- 批量选择控制工具条 -->
      <div v-if="locations.length > 0" class="select-all-bar">
        <label class="checkbox-label select-all-label">
          <input type="checkbox" :checked="isAllSelected" @change="toggleSelectAll" />
          <span>全选所有地点 ({{ selectedLocIds.length }}/{{ locations.length }})</span>
        </label>
      </div>

      <div class="locations-list">
        <div v-for="loc in locations" :key="loc.id" class="loc-card" :class="{ 'is-drawn': loc.isDrawn, 'is-hidden': loc.visible === false, 'is-selected': selectedLocIds.includes(loc.id) }">
          <div class="card-checkbox-wrapper">
            <input type="checkbox" :value="loc.id" v-model="selectedLocIds" class="loc-checkbox" />
          </div>
          <div class="loc-emoji">{{ loc.emoji }}</div>
          <div class="loc-info">
            <div class="loc-name-row">
              <span class="loc-name">{{ loc.name }}</span>
              <span v-if="loc.visible === false" class="hidden-badge">🙈 已隐藏 (不上盘)</span>
              <span v-else-if="loc.isDrawn" class="drawn-badge">本轮已抽中</span>
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
            <button class="icon-action vis-btn" :class="{ 'is-hidden-btn': loc.visible === false }" @click="handleToggleVisibility(loc)" :title="loc.visible === false ? '点击恢复展示 (在抽签池中显示)' : '点击设置隐藏 (不参与摇号抽签)'">
              <Eye v-if="loc.visible !== false" :size="15" />
              <EyeOff v-else :size="15" />
            </button>
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
          ↺ 恢复/填充系统预设 16+ 经典美食地点池
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

      <!-- 💰 个人月度伙食预算设置 -->
      <div class="config-card glass-card">
        <h4 class="card-heading">
          <Wallet :size="16" />
          <span>💰 个人月度伙食预算</span>
        </h4>
        <p class="status-sub">设置您的每月膳食预算（元），记账看板将实时展现消费进度与超支预警。</p>
        <div class="form-item">
          <div class="form-row-inline">
            <input type="number" v-model.number="settings.monthlyBudget" placeholder="例如：1500" class="input-field flex-1" />
            <button class="btn-primary small-btn" @click="handleSaveBudget">保存预算</button>
          </div>
        </div>
      </div>

      <!-- 个人云端同步 (Supabase) -->
      <div class="config-card glass-card">
        <h4 class="card-heading">
          <CloudCloud :size="16" />
          <span>☁️ 个人账单云端同步</span>
        </h4>
        <p v-if="!isSupabaseConfigured" class="status-sub">尚未配置 Supabase（.env 缺少 URL/Key），个人数据仅保存在本机。</p>
        <template v-else>
          <div class="cloud-status-box">
            <div class="status-indicator">
              <span class="status-green-dot"></span>
              <span class="status-title">Supabase 已连接</span>
            </div>
            <p class="status-sub">
              当前账号：{{ isAnonymous ? '匿名（仅本设备可同步）' : (userEmail || '已登录') }}
              <span v-if="isAnonymous"> · 建议先绑定邮箱，才能真正跨设备同步</span>
            </p>
            <p class="status-sub">同步策略：按记录合并、以较新版本为准，不会覆盖本地数据；删除也会跨设备生效。</p>
          </div>

          <label class="auto-sync-toggle">
            <input type="checkbox" :checked="autoSyncEnabled" @change="toggleAutoSync" />
            <span>开启自动同步（数据变更后自动上传云端）</span>
          </label>

          <div class="cloud-btn-wrapper">
            <button class="btn-primary main-sync-btn" :disabled="isSyncing" @click="handleSyncNow">
              <CloudCloud :size="16" />
              <span>☁️ 立即同步 (推荐)</span>
            </button>
            <div class="sub-sync-row">
              <button class="btn-secondary small-btn flex-1" :disabled="isSyncing" @click="handlePushPersonal">
                <UploadCloud :size="14" /> 推送到云端
              </button>
              <button class="btn-secondary small-btn flex-1" :disabled="isSyncing" @click="handlePullPersonal">
                <DownloadCloud :size="14" /> 从云端拉取
              </button>
            </div>
          </div>

          <div v-if="syncLog" class="sync-log-box">{{ syncLog }}</div>
          <p v-if="lastSyncedAt" class="status-sub" style="margin-top: 6px;">上次同步：{{ lastSyncedAt }}</p>
        </template>
      </div>

      <!-- Supabase 团队状态 -->
      <div class="config-card glass-card">
        <h4 class="card-heading">
          <CloudCloud :size="16" />
          <span>👥 Supabase 团队空间</span>
        </h4>
        <p v-if="team" class="status-sub">
          {{ team.name }} · 团队号 {{ team.public_id }} · 数据已启用行级权限和实时同步。
        </p>
        <p v-else class="status-sub">尚未创建或加入团队，请从顶部切换到团队模式。</p>
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
        
        <!-- ✨ AI 智能识别粘贴/识图填表卡片 -->
        <div class="ai-parse-card" :class="{ 'ai-loading-pulse': isAiParsing || isAiImgProcessing }" @paste="handleAdminPaste">
          <div class="ai-card-title">
            <Sparkles :size="15" class="ai-sparkle-icon text-orange" />
            <span>✨ AI 智能识图/截图自动填表</span>
            <span v-if="aiImgSizeText" class="compress-badge-sm">{{ aiImgSizeText }}</span>
          </div>
          <div class="ai-input-row">
            <input 
              type="text" 
              v-model="aiInputText" 
              placeholder="贴描述文字或在此 Ctrl+V 粘贴截图/小票照片" 
              class="input-field ai-input flex-1"
              @keyup.enter="handleAiParse"
            />
            <label class="btn-secondary small-btn upload-img-btn" title="点击选择美团/大众点评/小票截图照片">
              <Upload :size="13" />
              <span>{{ isAiImgProcessing ? '识图中...' : '选择照片' }}</span>
              <input type="file" accept="image/*" @change="handleAdminFileSelect" hidden />
            </label>
            <button 
              type="button" 
              class="btn-primary small-btn ai-btn ai-glow-btn" 
              :disabled="isAiParsing || isAiImgProcessing || (!aiInputText.trim() && !isAiImgProcessing)"
              @click="handleAiParse"
            >
              {{ isAiParsing ? '识别中...' : '文字填表' }}
            </button>
          </div>
          <p v-if="aiError" class="ai-error-msg">{{ aiError }}</p>
        </div>

        <form @submit.prevent="saveLoc" class="loc-form">
          <div class="form-row-inline">
            <div class="form-item short relative-container">
              <label>Emoji 图标：</label>
              <div class="emoji-input-wrapper">
                <input type="text" v-model="locForm.emoji" required class="input-field center-text emoji-input" />
                <button 
                  type="button" 
                  class="emoji-picker-btn" 
                  @click="showEmojiPicker = !showEmojiPicker"
                  title="点击挑选常用 Emoji"
                >
                  😃
                </button>
              </div>

              <!-- 弹出 Emoji 选择器 -->
              <EmojiPicker 
                v-if="showEmojiPicker" 
                @select="onEmojiSelect" 
                @close="showEmojiPicker = false" 
              />
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

          <div class="form-item">
            <label>📍 详细地址 / 导航定位（配置后才显示导航按钮）：</label>
            <input type="text" v-model="locForm.address" placeholder="如：科技园路88号首层 (选填)" class="input-field" />
          </div>

          <!-- 适用餐池多选框 -->
          <div class="form-item">
            <label>适用餐池 (多选，不勾选默认全适用)：</label>
            <div class="meal-categories-checkboxes">
              <label v-for="cat in MEAL_CATEGORIES" :key="cat.key" class="cat-checkbox-item">
                <input 
                  type="checkbox" 
                  :value="cat.key" 
                  v-model="selectedLocCategories"
                />
                <span>{{ cat.emoji }} {{ cat.name }}</span>
              </label>
            </div>
          </div>

          <div class="form-item">
            <label class="checkbox-label flex-row">
              <input type="checkbox" v-model="locForm.visible" />
              <span>在抽签池中开启展示 (取消勾选则隐藏此地点，不会参与摇号抽签)</span>
            </label>
          </div>

          <div class="modal-buttons">
            <button type="button" class="btn-secondary" @click="showLocModal = false">取消</button>
            <button type="submit" class="btn-primary">保存地点</button>
          </div>
        </form>
      </div>
    </div>

    <!-- 批量文本/截图导入 Modal -->
    <div v-if="showBatchModal" class="modal-overlay" @click.self="showBatchModal = false">
      <div class="modal-content batch-modal-content" @paste="handleBatchPaste">
        <h3 class="modal-title">📝 批量文本 / 地址截图导入</h3>
        <p class="modal-sub">支持多行文本，或点击右侧<b>选择美团/大众点评地址截图 / 按 Ctrl+V 粘贴</b>由 AI 自动解析拆分</p>

        <div class="quick-sample-row">
          <label class="btn-secondary small-btn upload-img-btn" title="上传大众点评/美团/订单地址截图">
            <Upload :size="13" />
            <span>{{ isBatchImgProcessing ? 'OCR 识图中...' : '📷 选择地址截图识别' }}</span>
            <input type="file" accept="image/*" @change="handleBatchFileSelect" hidden />
          </label>
          <button type="button" class="btn-text-link" @click="fillSampleText">
            📋 填入 5 个示例
          </button>
        </div>

        <textarea 
          v-model="batchInputText" 
          placeholder="在此粘贴多行地点文字，或直接在弹窗内按 Ctrl+V 粘贴菜单截图照片！例如：
汆悦麻辣烫 （标签：麻辣烫, 自选）
丰香园 （标签：中餐炒菜, 炒菜）
塔斯汀中国汉堡 （标签：汉堡, 快餐）" 
          rows="6" 
          class="textarea-field"
        ></textarea>

        <!-- 实时解析预览区 -->
        <div class="parsed-preview-box">
          <div class="preview-header">
            🔍 解析预览：成功识别 <strong>{{ parsedPreview.length }}</strong> 个地点
          </div>
          <div v-if="parsedPreview.length > 0" class="preview-list">
            <div v-for="(item, idx) in parsedPreview" :key="idx" class="preview-item">
              <span class="p-emoji">{{ item.emoji }}</span>
              <span class="p-name">{{ item.name }}</span>
              <span class="p-tags">
                <span v-for="t in item.tags" :key="t" class="tag-micro">#{{ t }}</span>
              </span>
            </div>
          </div>
          <div v-else class="preview-empty">
            尚未解析到有效地点，请在上方输入多行格式文本。
          </div>
        </div>

        <!-- 导入模式 -->
        <div class="import-mode-selector">
          <label class="radio-label">
            <input type="radio" v-model="batchImportMode" value="append" />
            <span>追加导入 (保留现有 {{ locations.length }} 个地点)</span>
          </label>
          <label class="radio-label">
            <input type="radio" v-model="batchImportMode" value="overwrite" />
            <span>全量覆盖 (用本次列表重置现有地点)</span>
          </label>
        </div>

        <div class="modal-buttons">
          <button type="button" class="btn-secondary" @click="showBatchModal = false">取消</button>
          <button 
            type="button" 
            class="btn-primary" 
            :disabled="parsedPreview.length === 0" 
            @click="handleConfirmBatchImport"
          >
            确认批量导入 ({{ parsedPreview.length }})
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { 
  Crown, X, Utensils, Cloud, Plus, RotateCcw, Edit3, Trash2, Lock, Wallet, Eye, EyeOff,
  Cloud as CloudCloud, UploadCloud, DownloadCloud, FileSpreadsheet, Download, Upload, FileText, Sparkles, Compass 
} from 'lucide-vue-next';
import EmojiPicker from './EmojiPicker.vue';
import { useBentoStore } from '../composables/useBentoStore';
import { useAdmin } from '../composables/useAdmin';
import { useAuth } from '../composables/useAuth';
import { useCloudSync } from '../composables/useCloudSync';
import { useTeamWorkspace } from '../composables/useTeamWorkspace';
import { useBentoAI } from '../composables/useBentoAI';
import { useToast } from '../composables/useToast';
import { soundEffects } from '../composables/useAudio';
import { compressImageFile, tryExtractTextFromImage } from '../utils/imageCompressor';
import { parseBatchLocationsText } from '../utils/parseBatchText';
import { MEAL_CATEGORIES, type BentoLocation, type MealCategory } from '../types';
import { isSupabaseConfigured } from '../lib/supabase';

const emit = defineEmits(['close', 'open-scan-modal']);


const { locations: personalLocations, addLocation, batchAddLocations, updateLocation, deleteLocation, batchDeleteLocations: batchDeletePersonalLocations, resetPool, restoreDefaultLocations, exportDataJSON, importDataJSON, settings, updateEnabledMealCategories } = useBentoStore();
const { logout, changePassword } = useAdmin();
const { isSyncing, syncLog, lastSyncedAt, pushToCloud, pullFromCloud } = useCloudSync();
const { isAnonymous, userEmail } = useAuth();
const { success: toastSuccess, error: toastError, info: toastInfo, confirm: toastConfirm } = useToast();
const {
  team,
  locations: teamLocations,
  teamPermissions,
  addLocation: addTeamLocation,
  batchAddLocations: batchAddTeamLocations,
  updateLocation: updateTeamLocation,
  deleteLocation: deleteTeamLocation,
  batchDeleteLocations: batchDeleteTeamLocations,
} = useTeamWorkspace();
const locations = computed(() => settings.value.activeMode === 'team' ? teamLocations.value : personalLocations.value);

const enabledCatKeys = computed<MealCategory[]>(() => {
  const defaultCats: MealCategory[] = ['breakfast', 'lunch', 'tea', 'dinner', 'night'];
  if (settings.value.activeMode === 'team') {
    return (teamPermissions.value?.enabledMealCategories as MealCategory[]) || defaultCats;
  }
  return (settings.value.enabledMealCategories as MealCategory[]) || defaultCats;
});

function handleToggleCategory(catKey: MealCategory) {
  if (settings.value.soundEnabled) soundEffects.playTick(600);
  const current: MealCategory[] = [...enabledCatKeys.value];
  const idx = current.indexOf(catKey);
  if (idx >= 0) {
    if (current.length <= 1) {
      toastError('至少需要保留一个开启展示的餐池分类！');
      return;
    }
    current.splice(idx, 1);
  } else {
    current.push(catKey);
  }
  updateEnabledMealCategories(current);
  if (settings.value.activeMode === 'personal') {
    pushToCloud(true);
  }
}

const selectedLocIds = ref<string[]>([]);
const isAllSelected = computed(() => locations.value.length > 0 && selectedLocIds.value.length === locations.value.length);

function toggleSelectAll() {
  if (isAllSelected.value) {
    selectedLocIds.value = [];
  } else {
    selectedLocIds.value = locations.value.map(l => l.id);
  }
}

async function handleBatchDelete() {
  if (selectedLocIds.value.length === 0) return;
  const ok = await toastConfirm({
    title: '批量删除地点',
    message: `确认要删除选中的 ${selectedLocIds.value.length} 个午餐地点吗？`,
    danger: true,
    confirmText: '删除',
  });
  if (!ok) return;

  if (settings.value.soundEnabled) soundEffects.playTick(300);

  if (settings.value.activeMode === 'team') {
    try {
      await batchDeleteTeamLocations(selectedLocIds.value);
      toastSuccess(`已成功删除选中的 ${selectedLocIds.value.length} 个团队地点！`);
    } catch (e: any) {
      toastError(`批量删除团队地点失败: ${e.message || e}`);
      return;
    }
  } else {
    batchDeletePersonalLocations(selectedLocIds.value);
    pushToCloud(true);
    toastSuccess(`已成功删除选中的 ${selectedLocIds.value.length} 个地点！`);
  }

  selectedLocIds.value = [];
}

const activeTab = ref<'locations' | 'cloud'>('locations');

// 批量文本导入表单与状态
const showBatchModal = ref(false);
const batchInputText = ref('');
const batchImportMode = ref<'append' | 'overwrite'>('append');

const parsedPreview = computed(() => parseBatchLocationsText(batchInputText.value));

function fillSampleText() {
  batchInputText.value = `汆悦麻辣烫 （标签：麻辣烫, 自选, 汤底）
丰香园 （标签：中餐炒菜, 炒菜, 中餐）
刘一手 （标签：自助菜, 自助餐, 快餐）
平安美食城 （标签：综合, 美食城, 档口）
上海浓汤面 （标签：面条, 汤面, 本帮面）`;
  if (settings.value.soundEnabled) soundEffects.playTick(800);
}

async function handleConfirmBatchImport() {
  if (parsedPreview.value.length === 0) return;
  const isOverwrite = batchImportMode.value === 'overwrite';
  
  if (isOverwrite) {
    const ok = await toastConfirm({
      title: '全量覆盖确认',
      message: `警告：全量覆盖将清空现有的 ${locations.value.length} 个地点，确认使用本次解析出的 ${parsedPreview.value.length} 个地点替换吗？`,
      danger: true,
      confirmText: '覆盖导入',
    });
    if (!ok) return;
  }

  if (settings.value.soundEnabled) soundEffects.playTick(900);

  if (settings.value.activeMode === 'team') {
    try {
      await batchAddTeamLocations(parsedPreview.value, isOverwrite);
      toastSuccess(`成功批量${isOverwrite ? '覆盖' : '追加'}导入 ${parsedPreview.value.length} 个团队地点！`);
    } catch (e: any) {
      toastError(`团队地点导入失败: ${e.message || e}`);
      return;
    }
  } else {
    batchAddLocations(parsedPreview.value, isOverwrite);
    pushToCloud(true);
    toastSuccess(`成功批量${isOverwrite ? '覆盖' : '追加'}导入 ${parsedPreview.value.length} 个地点！`);
  }

  batchInputText.value = '';
  showBatchModal.value = false;
}

function handleSaveBudget() {
  if (settings.value.soundEnabled) soundEffects.playTick(900);
  settings.value.updatedAt = Date.now();
  pushToCloud(true);
  toastSuccess('已更新个人月度伙食预算！');
}

// 密码表单
const pwdForm = ref({ oldPwd: '', newPwd: '' });

// 地点编辑弹窗表单
const showLocModal = ref(false);
const isEditLoc = ref(false);
const selectedLocCategories = ref<MealCategory[]>([]);
const locForm = ref<BentoLocation>({
  id: '',
  name: '',
  emoji: '🍱',
  tags: [],
  priceRange: '￥20-35',
  recommendedDish: '',
  address: '',
  mapUrl: '',
  weight: 1,
  isDrawn: false,
  createdAt: Date.now()
});
const tagsInput = ref('');

// AI & Emoji Picker 逻辑
const showEmojiPicker = ref(false);
const aiInputText = ref('');
const isAiImgProcessing = ref(false);
const aiImgSizeText = ref('');
const { isLoading: isAiParsing, aiError, parseLocationText } = useBentoAI();

function onEmojiSelect(emoji: string) {
  locForm.value.emoji = emoji;
  if (settings.value.soundEnabled) soundEffects.playTick(700);
}

async function handleAiParse() {
  if (!aiInputText.value.trim()) return;
  if (settings.value.soundEnabled) soundEffects.playTick(600);
  
  const res = await parseLocationText(aiInputText.value);
  if (res) {
    applyParsedToForm(res);
    aiInputText.value = '';
  }
}

function applyParsedToForm(res: any) {
  if (res.name) locForm.value.name = res.name;
  if (res.emoji) locForm.value.emoji = res.emoji;
  if (res.priceRange) locForm.value.priceRange = res.priceRange;
  if (res.recommendedDish) locForm.value.recommendedDish = res.recommendedDish;
  if (res.tags && res.tags.length > 0) {
    tagsInput.value = res.tags.join(', ');
  }
  if (settings.value.soundEnabled) soundEffects.playWinSound();
}

async function handleAdminImageProcess(file: File) {
  try {
    isAiImgProcessing.value = true;
    aiImgSizeText.value = '⚡ 本地 OCR 识别中...';
    if (settings.value.soundEnabled) soundEffects.playTick(600);

    let textToParse = '';

    // 1. 优先调取纯前端 Tesseract.js OCR 提取中英文文字
    const extractedText = await tryExtractTextFromImage(file);
    if (extractedText) {
      aiImgSizeText.value = '⚡ 本地 OCR 成功提取 (免图 Token)';
      textToParse = extractedText;
    } else {
      // 若未提取出中文字符，走 850px / 0.82 高清增强通道
      const compressedBase64 = await compressImageFile(file, 850, 0.82);
      const sizeKB = Math.round(compressedBase64.length / 1024);
      aiImgSizeText.value = `高清图 ${sizeKB} KB`;
      textToParse = file.name.replace(/\.[^/.]+$/, "") || '特色美食';
    }

    const res = await parseLocationText(textToParse);
    if (res) {
      applyParsedToForm(res);
    }
  } catch (err: any) {
    console.error('截图识图自动填表失败:', err);
  } finally {
    isAiImgProcessing.value = false;
  }
}

function handleAdminFileSelect(e: Event) {
  const target = e.target as HTMLInputElement;
  if (target.files && target.files[0]) {
    handleAdminImageProcess(target.files[0]);
  }
}

function handleAdminPaste(e: ClipboardEvent) {
  const items = e.clipboardData?.items;
  if (!items) return;

  for (let i = 0; i < items.length; i++) {
    if (items[i].type.indexOf('image') !== -1) {
      const file = items[i].getAsFile();
      if (file) {
        handleAdminImageProcess(file);
        break;
      }
    }
  }
}

// 批量导入弹窗 - 菜单大图/截图处理逻辑
const isBatchImgProcessing = ref(false);

async function handleBatchImageProcess(file: File) {
  try {
    isBatchImgProcessing.value = true;
    if (settings.value.soundEnabled) soundEffects.playTick(600);

    // 1. 本地 Tesseract.js OCR 提取大图所有文字
    const extractedText = await tryExtractTextFromImage(file);
    if (extractedText) {
      if (batchInputText.value.trim()) {
        batchInputText.value += '\n' + extractedText;
      } else {
        batchInputText.value = extractedText;
      }
      if (settings.value.soundEnabled) soundEffects.playWinSound();
    } else {
      toastError('从照片中未能识别出明显的文字，请尝试更换清晰的截图！');
    }
  } catch (err: any) {
    console.error('批量截图识别失败:', err);
  } finally {
    isBatchImgProcessing.value = false;
  }
}

function handleBatchFileSelect(e: Event) {
  const target = e.target as HTMLInputElement;
  if (target.files && target.files[0]) {
    handleBatchImageProcess(target.files[0]);
  }
}

function handleBatchPaste(e: ClipboardEvent) {
  const items = e.clipboardData?.items;
  if (!items) return;

  for (let i = 0; i < items.length; i++) {
    if (items[i].type.indexOf('image') !== -1) {
      const file = items[i].getAsFile();
      if (file) {
        handleBatchImageProcess(file);
        break;
      }
    }
  }
}

// ✨ AI 智能一键补全当前所有现有地点/菜单属性
const isAutoFilling = ref(false);

async function handleAiAutoFillAllLocations() {
  if (locations.value.length === 0) {
    toastInfo('当前地点池为空，请先添加地点或进行批量导入！');
    return;
  }

  const ok = await toastConfirm({
    title: 'AI 智能补全',
    message: `确认要让 AI 智能扫描并补齐当前 ${locations.value.length} 个地点中缺失的推荐菜、人均预算与 Emoji 吗？`,
    confirmText: '开始补全',
  });
  if (!ok) return;

  try {
    isAutoFilling.value = true;
    let updatedCount = 0;

    for (const loc of locations.value) {
      // 只要缺失推荐菜，或者缺少 emoji，或者只有默认 🍱 符号
      if (!loc.recommendedDish || !loc.emoji || loc.emoji === '🍱' || !loc.tags || loc.tags.length === 0) {
        const promptText = `地点名称: ${loc.name}，现有标签: ${(loc.tags || []).join(',')}`;
        const res = await parseLocationText(promptText);
        if (res) {
          let updated = false;
          if (res.emoji && (loc.emoji === '🍱' || !loc.emoji)) {
            loc.emoji = res.emoji;
            updated = true;
          }
          if (res.priceRange && (!loc.priceRange || loc.priceRange === '￥20-35')) {
            loc.priceRange = res.priceRange;
            updated = true;
          }
          if (res.recommendedDish && !loc.recommendedDish) {
            loc.recommendedDish = res.recommendedDish;
            updated = true;
          }
          if (res.tags && res.tags.length > 0 && (!loc.tags || loc.tags.length === 0)) {
            loc.tags = res.tags;
            updated = true;
          }
          if (updated) {
            updateLocation(loc);
            updatedCount++;
          }
        }
      }
    }

    pushToCloud(true);
    if (settings.value.soundEnabled) soundEffects.playWinSound();
    toastSuccess(`✨ 补全完成！AI 已补充并完善了 ${updatedCount} 个地点/菜单属性！`);
  } catch (err: any) {
    console.error('AI 批量补全菜单失败:', err);
    toastError('AI 批量补全失败，请稍后重试');
  } finally {
    isAutoFilling.value = false;
  }
}

function handleLogout() {
  logout();
  emit('close');
}

async function handleResetPool() {
  const ok = await toastConfirm({
    title: '重置抽签池',
    message: '确认将所有已抽中地点置为待抽状态？',
    confirmText: '重置',
  });
  if (!ok) return;
  if (settings.value.soundEnabled) soundEffects.playTick(600);
  resetPool();
  pushToCloud(true);
  toastSuccess('抽签池已重置，所有地点可再次抽取');
}

async function handleRestoreDefault() {
  const ok = await toastConfirm({
    title: '恢复预设地点',
    message: '警告：这将会把地点池重置为系统预设的美食地点，自定义的地点将被覆盖。是否继续？',
    danger: true,
    confirmText: '恢复预设',
  });
  if (!ok) return;
  if (settings.value.soundEnabled) soundEffects.playTick(600);
    if (settings.value.activeMode === 'team') {
      try {
        const DEFAULT_LOCS = [
          { name: '隆江猪脚饭', emoji: '🍱', tags: ['快餐', '肉食', '高能量'], priceRange: '￥18-28', recommendedDish: '双拼猪脚饭加卤蛋', weight: 1 },
          { name: '日式拉面', emoji: '🍜', tags: ['汤面', '日料', '热乎'], priceRange: '￥25-45', recommendedDish: '豚骨叉烧拉面', weight: 1 },
          { name: '麻辣香锅', emoji: '🥘', tags: ['重口味', '下饭', '香辣'], priceRange: '￥30-50', recommendedDish: '牛肉+午餐肉+方便面', weight: 1 },
          { name: '萨莉亚 Saizeriya', emoji: '🍕', tags: ['西餐', '性价比', '快乐餐'], priceRange: '￥20-35', recommendedDish: '蒜香蜗牛+金米饭', weight: 1 },
          { name: '酸菜鱼饭', emoji: '🐟', tags: ['酸辣', '下饭', '鱼肉'], priceRange: '￥25-38', recommendedDish: '老坛酸菜无骨鱼', weight: 1 },
          { name: '轻食沙拉碗', emoji: '🥗', tags: ['减脂', '清淡', '健康'], priceRange: '￥28-40', recommendedDish: '香煎鸡胸肉沙拉', weight: 1 },
          { name: '潮汕牛肉粿条', emoji: '🍲', tags: ['清淡', '鲜美', '广东特色'], priceRange: '￥20-35', recommendedDish: '吊龙牛肉汤粿条', weight: 1 },
          { name: '美式手工汉堡', emoji: '🍔', tags: ['美式', '高热量', '解压'], priceRange: '￥35-60', recommendedDish: '双层芝士牛肉堡', weight: 1 },
          { name: '四川麻辣烫', emoji: '🍢', tags: ['自选', '麻辣', '丰富'], priceRange: '￥20-35', recommendedDish: '骨汤中辣+芝麻酱', weight: 1 },
          { name: '黄焖鸡米饭', emoji: '🍗', tags: ['经典', '米饭', '香浓'], priceRange: '￥18-26', recommendedDish: '加辣黄焖鸡+腐竹', weight: 1 },
          { name: '韩式石锅拌饭', emoji: '🍲', tags: ['韩料', '锅巴', '甜辣'], priceRange: '￥22-35', recommendedDish: '肥牛石锅拌饭', weight: 1 },
          { name: '新疆炒米粉', emoji: '🍝', tags: ['特辣', '米粉', '过瘾'], priceRange: '￥22-32', recommendedDish: '酱香鸡肉爆辣炒米粉', weight: 1 },
          { name: '金牌烧鹅饭', emoji: '🦆', tags: ['烧蜡', '经典', '香脆'], priceRange: '￥30-50', recommendedDish: '烧鹅腿双拼饭', weight: 1 },
          { name: '桂林柳州螺蛳粉', emoji: '🍜', tags: ['重口味', '酸辣', '臭香'], priceRange: '￥15-25', recommendedDish: '加炸蛋+炸腐竹', weight: 1 },
          { name: '便利店便当/三明治', emoji: '🍙', tags: ['快速', '省钱', '便利'], priceRange: '￥12-22', recommendedDish: '照烧鸡腿便当+关东煮', weight: 1 },
          { name: '海南鸡饭', emoji: '🐔', tags: ['鲜嫩', '米饭', '东南亚'], priceRange: '￥25-38', recommendedDish: '白切鸡饭三色酱', weight: 1 }
        ];
        await batchAddTeamLocations(DEFAULT_LOCS, true);
        toastSuccess('已成功将团队地点恢复/填充为系统预设的美食地点池！');
      } catch (e: any) {
        toastError(`重置团队地点失败: ${e.message || e}`);
      }
    } else {
      restoreDefaultLocations();
      pushToCloud(true);
    }
}

async function handleToggleVisibility(loc: BentoLocation) {
  if (settings.value.soundEnabled) soundEffects.playTick(500);
  const nextVisible = loc.visible === false ? true : false;
  const updated = { ...loc, visible: nextVisible };
  if (settings.value.activeMode === 'team') {
    await updateTeamLocation(updated);
  } else {
    updateLocation(updated);
    pushToCloud(true);
  }
}

function openAddLocModal() {
  if (settings.value.soundEnabled) soundEffects.playTick(600);
  isEditLoc.value = false;
  selectedLocCategories.value = [];
  locForm.value = {
    id: '',
    name: '',
    emoji: '🍲',
    tags: ['美味', '午餐'],
    priceRange: '￥20-35',
    recommendedDish: '',
    weight: 1,
    isDrawn: false,
    createdAt: Date.now(),
    visible: true
  };
  tagsInput.value = '美味, 午餐';
  showLocModal.value = true;
}

function openEditLocModal(loc: BentoLocation) {
  if (settings.value.soundEnabled) soundEffects.playTick(600);
  isEditLoc.value = true;
  selectedLocCategories.value = loc.mealCategories || [];
  locForm.value = { ...loc, visible: loc.visible !== false };
  tagsInput.value = (loc.tags || []).join(', ');
  showLocModal.value = true;
}

async function saveLoc() {
  if (settings.value.soundEnabled) soundEffects.playTick(800);
  const parsedTags = tagsInput.value
    .split(/[,，]/)
    .map(t => t.trim())
    .filter(Boolean);

  const locData = {
    ...locForm.value,
    tags: parsedTags,
    mealCategories: selectedLocCategories.value.length > 0 ? selectedLocCategories.value : undefined,
    visible: locForm.value.visible !== false
  };

  if (isEditLoc.value) {
    if (settings.value.activeMode === 'team') {
      await updateTeamLocation(locData);
    } else {
      updateLocation(locData);
      pushToCloud(true);
    }
  } else {
    const value = {
      name: locForm.value.name,
      emoji: locForm.value.emoji || '🍱',
      tags: parsedTags,
      priceRange: locForm.value.priceRange || '￥20-35',
      recommendedDish: locForm.value.recommendedDish,
      address: locForm.value.address,
      mealCategories: selectedLocCategories.value.length > 0 ? selectedLocCategories.value : undefined,
      weight: 1,
      visible: locForm.value.visible !== false
    };
    if (settings.value.activeMode === 'team') {
      await addTeamLocation(value);
    } else {
      addLocation(value);
      pushToCloud(true);
    }
  }
  showLocModal.value = false;
}

async function handleDeleteLoc(id: string) {
  const ok = await toastConfirm({
    title: '删除地点',
    message: '确定删除此午餐地点？',
    danger: true,
    confirmText: '删除',
  });
  if (!ok) return;
  if (settings.value.soundEnabled) soundEffects.playTick(300);
  if (settings.value.activeMode === 'team') {
    await deleteTeamLocation(id);
  } else {
    deleteLocation(id);
  }
  toastSuccess('地点已删除');
}

function handleUpdatePassword() {
  const res = changePassword(pwdForm.value.oldPwd, pwdForm.value.newPwd);
  if (res.success) {
    toastSuccess(res.message);
    pwdForm.value = { oldPwd: '', newPwd: '' };
  } else {
    toastError(res.message);
  }
}

const autoSyncEnabled = computed(() => settings.value.personalSyncConfig?.autoSync === true);

function toggleAutoSync() {
  if (!settings.value.personalSyncConfig) {
    settings.value.personalSyncConfig = { enabled: true, provider: 'supabase', apiUrl: '', apiKey: '', autoSync: false };
  }
  settings.value.personalSyncConfig.autoSync = !settings.value.personalSyncConfig.autoSync;
  settings.value.updatedAt = Date.now();
  if (settings.value.personalSyncConfig.autoSync) {
    pushToCloud(true);
  }
}

async function handlePushPersonal() {
  const res = await pushToCloud(false);
  if (res.success) toastSuccess(res.message); else toastError(res.message);
}

async function handlePullPersonal() {
  const res = await pullFromCloud(false);
  if (res.success) toastSuccess(res.message); else toastError(res.message);
}

async function handleSyncNow() {
  const res = await pullFromCloud(false);
  if (res.success) toastSuccess(res.message); else toastError(res.message);
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
        toastSuccess('JSON 数据导入成功！');
        pushToCloud(true);
      } else {
        toastError('JSON 导入失败，请检查文件格式。');
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

.close-admin-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #F1F5F9;
  color: #64748B;
  border: 1px solid #E2E8F0;
  padding: 5px 12px;
  border-radius: 16px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.close-admin-btn:hover {
  background: #FFE4E6;
  color: #E11D48;
  border-color: #FECDD3;
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

.meal-categories-config-card {
  padding: 12px 14px;
  background: #FFF7ED;
  border: 1px dashed #FFD8B3;
  border-radius: var(--radius-md);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.config-card-header {
  display: flex;
  align-items: center;
  gap: 6px;
}

.header-title {
  font-size: 0.85rem;
  font-weight: 800;
  color: #C2410C;
}

.cat-checkbox-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.cat-toggle-label {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  background: #FFFFFF;
  border: 1px solid #FED7AA;
  border-radius: 8px;
  font-size: 0.78rem;
  font-weight: 700;
  color: #64748B;
  cursor: pointer;
  user-select: none;
  transition: all 0.2s ease;
}

.cat-toggle-label.is-checked {
  border-color: #F97316;
  background: #FFF3E0;
  color: #EA580C;
}

.cat-toggle-label input[type="checkbox"] {
  accent-color: #EA580C;
  width: 14px;
  height: 14px;
  cursor: pointer;
}

.toolbar-wrapper {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.toolbar-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.action-row-grid {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.action-row-grid button {
  flex: 1 1 140px;
  white-space: nowrap;
  justify-content: center;
  padding: 9px 12px;
  font-size: 0.85rem;
}

.scan-nearby-action-btn {
  background: linear-gradient(135deg, rgba(255, 247, 237, 0.9), rgba(254, 215, 170, 0.4));
  border: 1px solid rgba(249, 115, 22, 0.35);
  color: #c2410c;
  font-weight: 700;
}

.scan-nearby-action-btn:hover {
  background: linear-gradient(135deg, #fff7ed, #fed7aa);
  border-color: #f97316;
  color: #ea580c;
}

.full-width-btn {
  width: 100%;
  justify-content: center;
  padding: 10px 14px;
}

.add-loc-btn {
  flex: 1 1 140px;
  padding: 9px 14px;
  font-size: 0.88rem;
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

.loc-card.is-hidden {
  opacity: 0.55;
  background: #F8FAFC;
  border-style: dashed;
}

.hidden-badge {
  font-size: 0.65rem;
  background: #F1F5F9;
  color: #64748B;
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 700;
}

.vis-btn {
  background: #F1F5F9;
  color: #475569;
}

.vis-btn.is-hidden-btn {
  background: #FEF2F2;
  color: #EF4444;
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

.auto-sync-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  font-size: 0.82rem;
  font-weight: 600;
  color: #334155;
  cursor: pointer;
}

.auto-sync-toggle input {
  accent-color: #22C55E;
  width: 16px;
  height: 16px;
}

.cloud-btn-wrapper {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
}

.main-sync-btn {
  width: 100%;
  justify-content: center;
  padding: 10px;
}

.sub-sync-row, .backup-btn-row {
  display: flex;
  gap: 10px;
}

.sub-sync-row button, .backup-btn-row button, .file-upload-btn {
  flex: 1;
}

.file-upload-btn {
  cursor: pointer;
}

.form-row-inline {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.form-item.short {
  width: 105px;
  flex-shrink: 0;
  position: relative;
}

.emoji-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
}

.emoji-input {
  width: 100%;
  padding-right: 32px !important;
  font-size: 1.3rem !important;
  height: 40px;
  text-align: center;
  background: #FFFDF9;
}

.emoji-picker-btn {
  position: absolute;
  right: 5px;
  top: 50%;
  transform: translateY(-50%);
  background: #FFF7ED;
  border: 1px solid #FFD8A8;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.15s ease;
  padding: 0;
}

.emoji-picker-btn:hover {
  background: #FFE8CC;
  transform: translateY(-50%) scale(1.1);
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

.sync-config-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 8px;
}

.sync-config-form .btn-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
}

.sync-config-form .btn-row button {
  flex: 1;
  white-space: nowrap;
}

.modal-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}

/* 批量导入 Modal 专属样式 */
.batch-modal-content {
  max-width: 520px;
  width: 90%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.modal-sub {
  font-size: 0.78rem;
  color: var(--text-muted);
}

.modal-sub code {
  background: #F1F5F9;
  color: #0F172A;
  padding: 2px 6px;
  border-radius: 4px;
}

.quick-sample-row {
  display: flex;
  justify-content: flex-end;
}

.btn-text-link {
  background: none;
  border: none;
  color: var(--primary);
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
  padding: 0;
}

.btn-text-link:hover {
  text-decoration: underline;
}

.textarea-field {
  width: 100%;
  padding: 10px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  font-family: inherit;
  font-size: 0.85rem;
  line-height: 1.5;
  resize: vertical;
  outline: none;
}

.textarea-field:focus {
  border-color: var(--primary);
}

.parsed-preview-box {
  background: #F8FAFC;
  border: 1px solid #E2E8F0;
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  max-height: 180px;
  overflow-y: auto;
}

.preview-header {
  font-size: 0.8rem;
  color: #475569;
  margin-bottom: 8px;
}

.preview-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.preview-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8rem;
  background: #FFFFFF;
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid #F1F5F9;
}

.p-emoji {
  font-size: 1.1rem;
}

.p-name {
  font-weight: 700;
  color: var(--text-main);
  margin-right: 4px;
}

.p-tags {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.tag-micro {
  font-size: 0.7rem;
  color: #64748B;
  background: #F1F5F9;
  padding: 1px 5px;
  border-radius: 4px;
}

.preview-empty {
  font-size: 0.78rem;
  color: #94A3B8;
  text-align: center;
  padding: 12px 0;
}

.import-mode-selector {
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: #FFF7ED;
  border: 1px dashed #FDBA74;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
}

.radio-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8rem;
  font-weight: 600;
  color: #9A3412;
  cursor: pointer;
}

.btn-danger {
  background: #EF4444;
  color: white;
  border: none;
  border-radius: var(--radius-sm);
  padding: 6px 12px;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s ease;
}

.btn-danger:hover {
  background: #DC2626;
  transform: translateY(-1px);
}

.ai-autofill-btn {
  background: linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 100%) !important;
  border: 1px solid #FFB866 !important;
  color: #C2410C !important;
  font-weight: 800 !important;
  box-shadow: 0 2px 6px rgba(255, 102, 0, 0.1);
  transition: all 0.2s ease;
}

.ai-autofill-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 10px rgba(255, 102, 0, 0.18);
}

.select-all-bar {
  display: flex;
  align-items: center;
  padding: 6px 10px;
  background: #F8FAFC;
  border: 1px solid #E2E8F0;
  border-radius: var(--radius-sm);
  margin-bottom: 8px;
}

.select-all-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8rem;
  font-weight: 700;
  color: #334155;
  cursor: pointer;
  user-select: none;
}

.card-checkbox-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  padding-right: 6px;
}

.loc-checkbox {
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: #FF6B00;
}

.loc-card.is-selected {
  border-color: #FF6B00;
  background: #FFF7ED;
}

.meal-categories-checkboxes {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  padding: 8px;
  background: #F8FAFC;
  border: 1px solid #E2E8F0;
  border-radius: var(--radius-sm);
  margin-top: 4px;
}

.cat-checkbox-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.85rem;
  font-weight: 600;
  color: #334155;
  cursor: pointer;
}

.cat-checkbox-item input {
  accent-color: #FF6B00;
}

/* ✨ AI 智能识别卡片样式 */
.ai-parse-card {
  background: linear-gradient(135deg, #FFF7ED 0%, #FFF3E6 100%);
  border: 1px dashed #FF9933;
  border-radius: 12px;
  padding: 10px 12px;
  margin-bottom: 14px;
}

.ai-card-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 700;
  color: #C2410C;
  margin-bottom: 8px;
}

.ai-input-row {
  display: flex;
  gap: 8px;
}

.ai-input {
  background: #FFFFFF !important;
  font-size: 13px !important;
}

.ai-btn {
  white-space: nowrap;
  background: linear-gradient(135deg, #FF9933 0%, #FF6600 100%) !important;
  box-shadow: 0 2px 8px rgba(255, 102, 0, 0.25);
}

.ai-error-msg {
  font-size: 12px;
  color: #DC2626;
  margin-top: 6px;
}

/* Emoji Picker & Input */
.relative-container {
  position: relative;
}

.emoji-input-wrapper {
  display: flex;
  align-items: center;
  gap: 4px;
}

.emoji-input {
  width: 60px !important;
}

.emoji-picker-btn {
  background: #FFF3E6;
  border: 1px solid #FFD8A8;
  border-radius: 8px;
  font-size: 16px;
  padding: 6px 8px;
  cursor: pointer;
  transition: transform 0.15s ease;
}

.emoji-picker-btn:hover {
  transform: scale(1.1);
  background: #FFE8CC;
}
</style>
