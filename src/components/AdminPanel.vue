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
        <button class="btn-secondary" @click="showBatchModal = true" title="批量多行文本导入地点">
          <FileText :size="14" />
          <span>批量文本导入</span>
        </button>
        <button v-if="selectedLocIds.length > 0" class="btn-danger" @click="handleBatchDelete">
          <Trash2 :size="14" />
          <span>批量删除 ({{ selectedLocIds.length }})</span>
        </button>
        <button v-if="settings.activeMode === 'personal'" class="btn-secondary" @click="handleResetPool" title="重置本轮池子">
          <RotateCcw :size="14" />
          <span>重置抽签状态</span>
        </button>
      </div>

      <!-- 批量选择控制工具条 -->
      <div v-if="locations.length > 0" class="select-all-bar">
        <label class="checkbox-label select-all-label">
          <input type="checkbox" :checked="isAllSelected" @change="toggleSelectAll" />
          <span>全选所有地点 ({{ selectedLocIds.length }}/{{ locations.length }})</span>
        </label>
      </div>

      <div class="locations-list">
        <div v-for="loc in locations" :key="loc.id" class="loc-card" :class="{ 'is-drawn': loc.isDrawn, 'is-selected': selectedLocIds.includes(loc.id) }">
          <div class="card-checkbox-wrapper">
            <input type="checkbox" :value="loc.id" v-model="selectedLocIds" class="loc-checkbox" />
          </div>
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

      <!-- 个人云端同步设置 (自定义 API Key / URL) -->
      <div class="config-card glass-card">
        <h4 class="card-heading">
          <CloudCloud :size="16" />
          <span>🏠 个人专属云端同步配置</span>
        </h4>
        <p class="status-sub">可在此绑定您个人专属的 JSONBin API Key 与 Bin 地址，实现个人数据的云端同步与备份。</p>
        
        <form @submit.prevent="handleSavePersonalConfig" class="sync-config-form">
          <div class="form-item">
            <label>个人 JSONBin API Key：</label>
            <input type="password" v-model="personalForm.apiKey" placeholder="示例: $2a$10$..." class="input-field" />
          </div>
          <div class="form-item">
            <label>个人 API URL (含 Bin ID)：</label>
            <input type="text" v-model="personalForm.apiUrl" placeholder="示例: https://api.jsonbin.io/v3/b/6a71..." class="input-field" />
          </div>
          <div class="btn-row">
            <button type="submit" class="btn-primary small-btn">保存个人云配置</button>
            <button type="button" class="btn-secondary small-btn" :disabled="isSyncing" @click="handlePushPersonal">
              <UploadCloud :size="14" /> 推送个人数据
            </button>
            <button type="button" class="btn-secondary small-btn" :disabled="isSyncing" @click="handlePullPersonal">
              <DownloadCloud :size="14" /> 拉取个人数据
            </button>
          </div>
        </form>
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

    <!-- 批量文本导入 Modal -->
    <div v-if="showBatchModal" class="modal-overlay" @click.self="showBatchModal = false">
      <div class="modal-content batch-modal-content">
        <h3 class="modal-title">📝 批量文本导入地点池</h3>
        <p class="modal-sub">支持多行文本，格式如：<code>地点名称 （标签：标签1, 标签2）</code></p>

        <div class="quick-sample-row">
          <button type="button" class="btn-text-link" @click="fillSampleText">
            📋 填入 5 个经典示例数据
          </button>
        </div>

        <textarea 
          v-model="batchInputText" 
          placeholder="在此粘贴多行地点数据，例如：
汆悦麻辣烫 （标签：麻辣烫, 自选, 汤底）
丰香园 （标签：中餐炒菜, 炒菜, 中餐）
刘一手 （标签：自助菜, 自助餐, 快餐）
平安美食城 （标签：综合, 美食城, 档口）
上海浓汤面 （标签：面条, 汤面, 本帮面）" 
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
  Crown, LogOut, Utensils, Cloud, Plus, RotateCcw, Edit3, Trash2, Lock, 
  Cloud as CloudCloud, UploadCloud, DownloadCloud, FileSpreadsheet, Download, Upload, FileText 
} from 'lucide-vue-next';
import { useBentoStore } from '../composables/useBentoStore';
import { useAdmin } from '../composables/useAdmin';
import { useCloudSync } from '../composables/useCloudSync';
import { useTeamWorkspace } from '../composables/useTeamWorkspace';
import { soundEffects } from '../composables/useAudio';
import { parseBatchLocationsText } from '../utils/parseBatchText';
import type { BentoLocation } from '../types';

const emit = defineEmits(['close']);

const { locations: personalLocations, addLocation, batchAddLocations, updateLocation, deleteLocation, batchDeleteLocations: batchDeletePersonalLocations, resetPool, restoreDefaultLocations, exportDataJSON, importDataJSON, settings } = useBentoStore();
const { logout, changePassword } = useAdmin();
const { isSyncing, pushToCloud, pullFromCloud } = useCloudSync();
const {
  team,
  locations: teamLocations,
  addLocation: addTeamLocation,
  batchAddLocations: batchAddTeamLocations,
  updateLocation: updateTeamLocation,
  deleteLocation: deleteTeamLocation,
  batchDeleteLocations: batchDeleteTeamLocations,
} = useTeamWorkspace();
const locations = computed(() => settings.value.activeMode === 'team' ? teamLocations.value : personalLocations.value);

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
  if (!confirm(`确认要删除选中的 ${selectedLocIds.value.length} 个午餐地点吗？`)) return;

  if (settings.value.soundEnabled) soundEffects.playTick(300);

  if (settings.value.activeMode === 'team') {
    try {
      await batchDeleteTeamLocations(selectedLocIds.value);
      alert(`已成功删除选中的 ${selectedLocIds.value.length} 个团队地点！`);
    } catch (e: any) {
      alert(`批量删除团队地点失败: ${e.message || e}`);
      return;
    }
  } else {
    batchDeletePersonalLocations(selectedLocIds.value);
    pushToCloud(true);
    alert(`已成功删除选中的 ${selectedLocIds.value.length} 个地点！`);
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
    if (!confirm(`警告：全量覆盖将清空现有的 ${locations.value.length} 个地点，确认使用本次解析出的 ${parsedPreview.value.length} 个地点替换吗？`)) {
      return;
    }
  }

  if (settings.value.soundEnabled) soundEffects.playTick(900);

  if (settings.value.activeMode === 'team') {
    try {
      await batchAddTeamLocations(parsedPreview.value, isOverwrite);
      alert(`成功批量${isOverwrite ? '覆盖' : '追加'}导入 ${parsedPreview.value.length} 个团队地点！`);
    } catch (e: any) {
      alert(`团队地点导入失败: ${e.message || e}`);
      return;
    }
  } else {
    batchAddLocations(parsedPreview.value, isOverwrite);
    pushToCloud(true);
    alert(`成功批量${isOverwrite ? '覆盖' : '追加'}导入 ${parsedPreview.value.length} 个地点！`);
  }

  batchInputText.value = '';
  showBatchModal.value = false;
}

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

async function handleRestoreDefault() {
  if (confirm('警告：这将会把地点池重置为初始预设的 16+ 美食地点，自定义的地点将被覆盖。是否继续？')) {
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
        alert('已成功将团队地点恢复/填充为系统预设的 16+ 美食地点池！');
      } catch (e: any) {
        alert(`重置团队地点失败: ${e.message || e}`);
      }
    } else {
      restoreDefaultLocations();
      pushToCloud(true);
    }
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

async function saveLoc() {
  if (settings.value.soundEnabled) soundEffects.playTick(800);
  const parsedTags = tagsInput.value
    .split(/[,，]/)
    .map(t => t.trim())
    .filter(Boolean);

  if (isEditLoc.value) {
    if (settings.value.activeMode === 'team') {
      await updateTeamLocation({ ...locForm.value, tags: parsedTags });
    } else {
      updateLocation({ ...locForm.value, tags: parsedTags });
    }
  } else {
    const value = {
      name: locForm.value.name,
      emoji: locForm.value.emoji || '🍱',
      tags: parsedTags,
      priceRange: locForm.value.priceRange || '￥20-35',
      recommendedDish: locForm.value.recommendedDish,
      weight: 1,
    };
    if (settings.value.activeMode === 'team') {
      await addTeamLocation(value);
    } else {
      addLocation(value);
    }
  }
  showLocModal.value = false;
}

async function handleDeleteLoc(id: string) {
  if (confirm('确定删除此午餐地点？')) {
    if (settings.value.soundEnabled) soundEffects.playTick(300);
    if (settings.value.activeMode === 'team') {
      await deleteTeamLocation(id);
    } else {
      deleteLocation(id);
    }
  }
}

function handleUpdatePassword() {
  const res = changePassword(pwdForm.value.oldPwd, pwdForm.value.newPwd);
  alert(res.message);
  if (res.success) {
    pwdForm.value = { oldPwd: '', newPwd: '' };
  }
}

const personalForm = ref({
  apiKey: settings.value.personalSyncConfig?.apiKey || '',
  apiUrl: settings.value.personalSyncConfig?.apiUrl || '',
});

function handleSavePersonalConfig() {
  if (!settings.value.personalSyncConfig) {
    settings.value.personalSyncConfig = { enabled: true, provider: 'jsonbin', apiUrl: '', apiKey: '', autoSync: false };
  }
  settings.value.personalSyncConfig.apiKey = personalForm.value.apiKey.trim();
  settings.value.personalSyncConfig.apiUrl = personalForm.value.apiUrl.trim();
  alert('已成功保存个人云端配置！');
}

async function handlePushPersonal() {
  handleSavePersonalConfig();
  const res = await pushToCloud(false, {
    apiKey: personalForm.value.apiKey.trim(),
    apiUrl: personalForm.value.apiUrl.trim(),
  });
  alert(res.message);
}

async function handlePullPersonal() {
  handleSavePersonalConfig();
  if (confirm('警告：从个人云端拉取将覆盖当前本地数据，是否继续？')) {
    const res = await pullFromCloud(false, {
      apiKey: personalForm.value.apiKey.trim(),
      apiUrl: personalForm.value.apiUrl.trim(),
    });
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
</style>

