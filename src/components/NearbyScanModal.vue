<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-card glass-modal nearby-scan-modal">
      <!-- 弹窗头部 -->
      <div class="modal-header">
        <div class="header-title-group">
          <div class="radar-icon-badge">
            <Compass :size="20" class="radar-icon spin-slow" />
          </div>
          <div>
            <h3 class="modal-title">📍 扫描周边美食 & AI 维护</h3>
            <p class="modal-subtitle">直接获取高德真实周边商家，选中后由 AI 智能整理维护入库</p>
          </div>
        </div>
        <button class="close-btn" @click="$emit('close')" title="关闭">
          <X :size="18" />
        </button>
      </div>

      <!-- ⚡ 统一控制中心 (位置定位 + 范围选择 + 扫描触发按钮) 紧凑型双栏 -->
      <div class="scan-control-panel-compact">
        <!-- 左侧：位置信息状态与编辑 -->
        <div class="panel-section location-sec">
          <div v-if="!isEditingLocation" class="location-view-row">
            <div class="loc-summary-info">
              <span class="loc-pin">📍</span>
              <strong class="loc-name-txt" :title="locationName">{{ locationName || (locationFailReason ? '定位失败，请手动指定' : '正在获取 GPS 位置...') }}</strong>
              <span class="loc-tag-badge" :class="isCustomLocation ? 'tag-custom' : 'tag-gps'">
                {{ isCustomLocation ? '手动指定' : 'GPS' }}
              </span>
            </div>
            <button v-if="!locationFailReason" class="mini-action-btn" @click="openLocationEdit()" title="修改参考位置">
              <Edit3 :size="12" />
              <span>修改</span>
            </button>
          </div>

          <!-- 位置修改内联编辑器 (支持高德 InputTips 模糊检索联想) -->
          <div v-else class="location-edit-inline">
            <div v-if="locationFailReason && locationFailInfo" class="geo-fail-hint">
              <span class="geo-fail-hint-head">{{ locationFailInfo.icon }} {{ locationFailInfo.title }}</span>
              <span v-if="locationFailInfo.tips[0]" class="geo-fail-hint-tip">{{ locationFailInfo.tips[0] }}</span>
            </div>
            <div class="inline-input-wrapper">
              <Search :size="13" class="inline-search-icon" />
              <input 
                ref="locationInputRef"
                v-model="customInputText"
                type="text" 
                class="inline-location-input" 
                placeholder="输入城市/写字楼/商圈（如: 悦来欣悦里、科技园）..."
                @input="handleInputTextChange"
                @focus="handleInputFocus"
                @keyup.enter="handleCustomLocationSubmit"
              />
              <button 
                v-if="customInputText" 
                class="inline-clear-btn" 
                @click="customInputText = ''; locationTips = []; showTipsDropdown = false" 
                title="清空输入"
              >
                <X :size="12" />
              </button>
              <button class="inline-confirm-btn" :disabled="!customInputText.trim()" @click="handleCustomLocationSubmit">
                确定使用
              </button>

              <!-- ⚡ 高德输入提示 (InputTips) 模糊匹配下拉弹窗 -->
              <div v-if="showTipsDropdown && locationTips.length > 0" class="input-tips-dropdown">
                <div 
                  v-for="tip in locationTips" 
                  :key="tip.id" 
                  class="tip-item"
                  @click="selectTip(tip)"
                >
                  <div class="tip-left">
                    <MapPin :size="13" class="tip-pin-icon" />
                    <span class="tip-name">{{ tip.name }}</span>
                  </div>
                  <span class="tip-district" :title="(tip.district || '') + ' ' + (tip.address || '')">
                    {{ tip.district || tip.address || '精准地标' }}
                  </span>
                </div>
              </div>
            </div>

            <div class="inline-actions">
              <button class="inline-reset-btn" @click="resetToGpsLocation">恢复 GPS 自动定位</button>
              <button class="inline-cancel-btn" @click="isEditingLocation = false; showTipsDropdown = false">取消</button>
            </div>
          </div>
        </div>

        <!-- 右侧：范围选择与扫描按钮 -->
        <div class="panel-section controls-sec">
          <div class="compact-filter">
            <span class="sec-lbl">类型:</span>
            <select v-model="selectedFoodType" class="radius-dropdown-select">
              <option value="all">全部美食</option>
              <option value="fastfood">快餐小吃</option>
              <option value="drinks">奶茶咖啡</option>
            </select>
          </div>

          <div class="compact-radius">
            <span class="sec-lbl">范围:</span>
            <select v-model="selectedRadius" class="radius-dropdown-select">
              <option :value="500">500 米</option>
              <option :value="1000">1000 米</option>
              <option :value="2000">2000 米</option>
            </select>
          </div>

          <button
            class="scan-action-btn primary-glow-btn compact-btn"
            :disabled="isLocating || isScanningPoi || isPolishing"
            @click="startScan(false)"
          >
            <Sparkles v-if="!isLocating && !isScanningPoi" :size="13" />
            <Loader2 v-else :size="13" class="spin-icon" />
            <span>{{ getScanBtnText() }}</span>
          </button>
        </div>
      </div>

      <!-- ⚡ 500m / 24h 缓存命中提示卡片 -->
      <div v-if="isCacheHit && cacheInfo && !isCustomLocation" class="cache-banner glass-card compact-banner">
        <div class="cache-banner-left">
          <Zap :size="14" class="text-amber-400" />
          <span>⚡ 已载入 <strong>{{ cacheInfo.distance }}m</strong> 内 ({{ cacheInfo.timeAgo }}前) 的本地扫描数据</span>
        </div>
        <button class="force-refresh-btn" @click="startScan(true)" title="忽略缓存重新扫描">
          <RotateCw :size="12" />
          <span>重新扫描</span>
        </button>
      </div>

      <!-- 错误提示（定位失败时由下方引导面板接管展示，避免重复提示） -->
      <div v-if="(scanError || aiError) && !locationFailReason" class="error-banner compact-banner">
        <AlertCircle :size="15" />
        <span>{{ scanError || aiError }}</span>
      </div>

      <!-- 🧭 自动定位失败引导面板：分场景说明原因 + 一键降级到手动输入 -->
      <div v-if="locationFailInfo && !isEditingLocation" class="geo-fail-panel" role="alert">
        <div class="geo-fail-icon">{{ locationFailInfo.icon }}</div>
        <div class="geo-fail-body">
          <h4 class="geo-fail-title">{{ locationFailInfo.title }}</h4>
          <p class="geo-fail-desc">{{ locationFailInfo.desc }}</p>
          <ul v-if="locationFailInfo.tips.length > 0" class="geo-fail-tips">
            <li v-for="(tip, i) in locationFailInfo.tips" :key="i">{{ tip }}</li>
          </ul>
          <div class="geo-fail-actions">
            <button class="geo-fail-btn geo-fail-primary" @click="openLocationEdit(true)">
              <MapPin :size="14" />
              <span>手动输入位置继续</span>
            </button>
            <button class="geo-fail-btn geo-fail-ghost" @click="startScan(true)">
              <RotateCw :size="13" />
              <span>重试自动定位</span>
            </button>
          </div>
        </div>
      </div>

      <!-- ✨ AI 润色结果预览确认面板 -->
      <div v-if="showPreview" class="preview-import-panel">
        <div class="preview-header">
          <div class="preview-title-row">
            <Sparkles :size="16" class="text-orange" />
            <span class="preview-title">AI 润色预览 ({{ previewItems.length }} 家)</span>
          </div>
          <span class="preview-sub">店名与地址为高德真实数据（只读），AI 仅增强标签/人均/推荐菜，可在此微调</span>

          <!-- 导入目标选择：个人地点池 / 任一搭子圈菜单 -->
          <div class="preview-target-row">
            <span class="target-lbl">📥 导入到：</span>
            <select v-model="importTarget" class="target-select" @change="handleTargetChange" :disabled="isPolishing">
              <option value="personal">🏠 个人地点池</option>
              <option v-for="t in importableTeams" :key="t.public_id" :value="t.public_id">
                👥 {{ t.name }} ({{ getRoleLabel(t.role) }})
              </option>
            </select>
            <span class="target-tip">导入后将自动切换到所选搭子圈</span>
          </div>
        </div>

        <div class="preview-list">
          <div v-for="item in previewItems" :key="item.id" class="preview-card glass-card">
            <div class="preview-name-row">
              <input v-model="item.emoji" class="preview-emoji-input" maxlength="4" title="修改 Emoji" />
              <div class="preview-name-col">
                <strong class="preview-name">{{ item.name }}</strong>
                <span class="preview-address">📍 {{ item.address || '暂无地址' }} · {{ item.distance }}米</span>
              </div>
            </div>
            <div class="preview-form-row">
              <label class="preview-field">
                <span>标签</span>
                <input v-model="item.tags" placeholder="逗号分隔，如: 快餐, 实惠" class="preview-input" />
              </label>
              <label class="preview-field preview-field-sm">
                <span>人均</span>
                <input v-model="item.priceRange" placeholder="￥20-35" class="preview-input" />
              </label>
            </div>
            <label class="preview-field">
              <span>推荐菜</span>
              <input v-model="item.recommendedDish" placeholder="招牌/推荐菜" class="preview-input" />
            </label>
            <div class="preview-cats">
              <label v-for="cat in MEAL_CATEGORIES" :key="cat.key" class="cat-check">
                <input type="checkbox" :value="cat.key" v-model="item.mealCategories" />
                <span>{{ cat.emoji }}{{ cat.name.replace('池', '') }}</span>
              </label>
            </div>
          </div>
        </div>

        <div class="preview-actions">
          <button class="btn-cancel" @click="cancelPreview">返回调整</button>
          <button class="btn-confirm primary-glow-btn" :disabled="isPolishing" @click="confirmImportPreview">
            <Loader2 v-if="isPolishing" :size="15" class="spin-icon" />
            <Sparkles v-else :size="15" />
            <span>{{ isPolishing ? '导入中...' : `✅ 确认导入 ${previewItems.length} 家` }}</span>
          </button>
        </div>
      </div>

      <!-- 动态加载/扫描状态提示 (包括 AI 智能润色导入状态) -->
      <div v-else-if="isLocating || isScanningPoi || isPolishing" class="loading-state-card flex-grow-loading">
        <div class="loading-animation">
          <div class="radar-pulse"></div>
          <Sparkles :size="28" class="ai-sparkle-glow" />
        </div>
        <p class="loading-text">{{ currentStageText }}</p>
        <span class="loading-subtext">正在与本地高德数据/云端 AI 通信中...</span>
      </div>

      <!-- 扫描得到的高德真实店铺列表 (直接展现，不经 AI 预先干预) -->
      <div v-else-if="scannedPois.length > 0" class="results-container">
        <div class="results-header">
          <span class="count-badge">高德搜索到 {{ scannedPois.length }} 家周边真实餐饮</span>
          <label class="select-all-label">
            <input type="checkbox" :checked="isAllSelected" @change="toggleSelectAll" />
            <span>全选未入库地点 (已选 {{ selectedItems.length }})</span>
          </label>
        </div>

        <div class="results-grid">
          <div 
            v-for="(item, index) in scannedPois"
            :key="index"
            class="result-card glass-card"
            :class="{ 
              'is-existing': isLocExisting(item.name),
              'is-selected': selectedItems.some(i => i.name === item.name)
            }"
            @click="toggleSelectItem(item)"
          >
            <div class="card-left">
              <input 
                type="checkbox" 
                :checked="selectedItems.some(i => i.name === item.name)"
                @click.stop="toggleSelectItem(item)" 
              />
              <span class="item-emoji">📍</span>
            </div>

            <div class="card-content">
              <div class="item-title-row">
                <h4 class="item-name">{{ item.name }}</h4>
                <span v-if="isLocExisting(item.name)" class="badge badge-existing">已在池中</span>
                <span v-else class="badge badge-new">✨ 真实新发现</span>
              </div>

              <!-- 📍 直接展示真实地址与精确距离 -->
              <div class="item-location-address">
                <span class="address-text">{{ item.address || '暂无详细地址' }}</span>
                <span v-if="item.distance" class="distance-badge">{{ item.distance }}米</span>
              </div>

              <div class="item-meta-simple">
                <span v-if="item.type" class="item-type-tag">分类：{{ item.type.split(';').pop() }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 分页加载更多 -->
        <div class="load-more-row">
          <button class="btn-secondary load-more-btn" :disabled="isLoadingMore" @click="loadMorePois">
            {{ isLoadingMore ? '加载中...' : '加载更多店铺' }}
          </button>
        </div>
      </div>

      <!-- 无扫描数据时的空状态 (定位失败时由引导面板接管) -->
      <div v-else-if="!hasScanned && !locationFailReason" class="empty-scan-state">
        <MapPin :size="42" class="text-orange" />
        <h4>准备就绪！开始扫描附近 500m~2000m 的真实美食</h4>
        <p>点击右上方【开始扫描】按钮，获取真实物理定位周边的商户店铺！</p>
      </div>

      <!-- 底部导入操作栏 -->
      <div v-if="!showPreview" class="modal-footer">
        <button class="btn-cancel" @click="$emit('close')">取消</button>
        <button 
          class="btn-confirm primary-glow-btn" 
          :disabled="selectedItems.length === 0 || isPolishing"
          @click="handleImportSelected"
        >
          <Sparkles :size="15" />
          <span>AI 润色分类并维护导入 ({{ selectedItems.length }})</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue';
import { 
  Compass, X, Sparkles, Loader2, Zap, RotateCw, AlertCircle, MapPin, Edit3, Search
} from 'lucide-vue-next';
import { useBentoStore } from '../composables/useBentoStore';
import { useBentoAI } from '../composables/useBentoAI';
import { useToast } from '../composables/useToast';
import { useTeamWorkspace } from '../composables/useTeamWorkspace';
import { soundEffects } from '../composables/useAudio';
import { MEAL_CATEGORIES, type MealCategory } from '../types';
import { 
  getUserCurrentLocation, 
  fetchNearbyPois, 
  getValidNearbyCache, 
  saveNearbyCache, 
  calculateDistance,
  reverseGeocode,
  searchPoisByCustomLocation,
  fetchInputTips,
  isGeolocationSupported,
  GeolocationError,
  type GeoFailReason,
  type ScannedPoiItem,
  type LocationTipItem
} from '../utils/locationService';

const { success: toastSuccess, error: toastError, info: toastInfo } = useToast();

// ✨ AI 润色预览确认的数据结构
interface PreviewImportItem {
  id: string;
  name: string;
  address: string;
  distance: number;
  emoji: string;
  tags: string;
  priceRange: string;
  recommendedDish: string;
  mealCategories: MealCategory[];
}

const emit = defineEmits(['close', 'imported']);

const store = useBentoStore();
const { myTeams, team, openTeam, batchAddLocations: batchAddTeamLocations } = useTeamWorkspace();

// 预览导入目标：'personal' 或搭子圈 public_id
const importTarget = ref<string>('personal');
// 仅展示可添加菜单的团队（排除只读 viewer 角色）
const importableTeams = computed(() => myTeams.value.filter(t => t.role !== 'viewer'));

function getRoleLabel(role: string) {
  return { owner: '所有者', admin: '管理员', member: '成员', viewer: '只读成员' }[role] || '成员';
}

function handleTargetChange() {
  if (store.settings.value.soundEnabled) soundEffects.playTick(600);
}
const { organizeScannedLocations, aiError } = useBentoAI();

const selectedRadius = ref<number>(1000);
const selectedFoodType = ref<'all' | 'fastfood' | 'drinks'>('fastfood');

const foodTypeMapping = {
  all: { types: '050000', keywords: '' },
  fastfood: { types: '050300', keywords: '' },
  drinks: { types: '050400|050500|050600|050700', keywords: '' }
};

const isLocating = ref(false);
const isScanningPoi = ref(false);
const isPolishing = ref(false); // AI 导入润色状态
const scanError = ref<string | null>(null);

// 🧭 自动定位失败引导（分场景提示 + 一键降级手动输入）
const locationFailReason = ref<GeoFailReason | null>(null);
const locationInputRef = ref<HTMLInputElement | null>(null);
const showPreview = ref(false); // AI 润色结果预览
const previewItems = ref<PreviewImportItem[]>([]);
const isLoadingMore = ref(false); // 分页加载状态
const currentPage = ref(1);
const scanContext = ref<{ mode: 'gps' | 'custom'; coords?: { lat: number; lng: number }; locName?: string } | null>(null);
const hasScanned = ref(false);
const currentStageText = ref('定位与扫描中...');

// 定位与结果数据
const locationName = ref<string>('');
const isCustomLocation = ref<boolean>(false);
const isEditingLocation = ref<boolean>(false);
const customInputText = ref<string>('');

// ⚡ 输入联想提示状态
const locationTips = ref<LocationTipItem[]>([]);
const showTipsDropdown = ref<boolean>(false);
const isSearchingTips = ref<boolean>(false);
let tipsTimer: any = null;

const currentCoords = ref<{ lat: number; lng: number } | null>(null);
const scannedPois = ref<ScannedPoiItem[]>([]);
const selectedItems = ref<ScannedPoiItem[]>([]);

// 缓存状态
const isCacheHit = ref(false);
const cacheInfo = ref<{ distance: number; timeAgo: string } | null>(null);

// 🧭 定位失败原因 → 引导面板文案（分场景）
const locationFailInfo = computed(() => {
  const reason = locationFailReason.value;
  if (!reason) return null;
  switch (reason) {
    case 'no-service':
      return {
        icon: '🚫',
        title: '当前环境不支持自动定位',
        desc: '未检测到可用的地理定位服务，可能是通过非 HTTPS 访问、浏览器禁用了定位，或系统不支持。',
        tips: ['请使用 HTTPS 或 localhost 访问本应用', '也可以直接手动输入位置，照常扫描周边商家'],
      };
    case 'denied':
      return {
        icon: '🔒',
        title: '定位权限被拒绝',
        desc: '浏览器拒绝了定位请求，无法自动获取当前位置。',
        tips: ['点击地址栏左侧锁形图标 → 站点设置 → 允许「位置」权限', '开启权限后点「重试自动定位」，或直接手动输入位置'],
      };
    case 'unavailable':
      return {
        icon: '📡',
        title: '定位信号不可用',
        desc: '未能获取到有效的定位信号，可能是系统定位服务未开启或信号较弱。',
        tips: ['检查设备/系统是否开启了「定位服务」', '到信号更好的位置后重试，或手动输入位置'],
      };
    case 'timeout':
      return {
        icon: '⏱️',
        title: '定位超时',
        desc: '获取位置耗时过长，可能是网络或定位服务较慢。',
        tips: ['检查网络连接后重试', '或直接手动输入位置继续'],
      };
    default:
      return {
        icon: '⚠️',
        title: '自动定位失败',
        desc: '无法获取当前位置，可以重试或手动输入一个参考位置。',
        tips: [],
      };
  }
});

// 手动设置/修改位置
async function openLocationEdit(autoFocus = false) {
  customInputText.value = isCustomLocation.value ? locationName.value : '';
  isEditingLocation.value = true;
  if (customInputText.value.trim()) {
    handleInputTextChange();
  }
  if (autoFocus) {
    await nextTick();
    locationInputRef.value?.focus();
  }
}

// 监听输入防抖检索高德模糊匹配地标列表
function handleInputTextChange() {
  if (tipsTimer) clearTimeout(tipsTimer);
  const text = customInputText.value.trim();
  if (!text) {
    locationTips.value = [];
    showTipsDropdown.value = false;
    return;
  }

  tipsTimer = setTimeout(async () => {
    isSearchingTips.value = true;
    const tips = await fetchInputTips(text, locationName.value);
    isSearchingTips.value = false;
    if (tips && tips.length > 0) {
      locationTips.value = tips;
      showTipsDropdown.value = true;
    } else {
      locationTips.value = [];
      showTipsDropdown.value = false;
    }
  }, 180);
}

function handleInputFocus() {
  if (customInputText.value.trim() && locationTips.value.length > 0) {
    showTipsDropdown.value = true;
  }
}

// 选中模糊匹配下拉列表中某一项
async function selectTip(tip: LocationTipItem) {
  showTipsDropdown.value = false;
  const fullLocName = `${tip.district ? tip.district + ' · ' : ''}${tip.name}`;
  customInputText.value = tip.name;
  locationName.value = fullLocName;
  isCustomLocation.value = true;
  isEditingLocation.value = false;

  locationFailReason.value = null;

  // 如果高德直接返回了坐标 (lng,lat)，直接采用精准坐标扫描周边！
  if (tip.location && tip.location.includes(',')) {
    const [lngStr, latStr] = tip.location.split(',');
    const lng = parseFloat(lngStr);
    const lat = parseFloat(latStr);
    if (!isNaN(lng) && !isNaN(lat)) {
      await scanPoisByCoords(lat, lng, fullLocName);
      return;
    }
  }

  await scanPoisForCustomLocation(tip.name);
}

// 直接以指定坐标进行周边 POI 检索
async function scanPoisByCoords(lat: number, lng: number, locDisplayName: string) {
  scanError.value = null;
  locationFailReason.value = null;
  isCacheHit.value = false;
  cacheInfo.value = null;
  scannedPois.value = [];
  selectedItems.value = [];
  currentPage.value = 1;
  scanContext.value = { mode: 'gps', coords: { lat, lng } };
  isScanningPoi.value = true;
  currentStageText.value = `正在检索【${locDisplayName}】周边真实美食...`;

  try {
    const { types, keywords } = foodTypeMapping[selectedFoodType.value];
    const pois = await fetchNearbyPois(lat, lng, selectedRadius.value, undefined, types, keywords, 1);
    isScanningPoi.value = false;

    if (!pois || pois.length === 0) {
      scanError.value = `【${locDisplayName}】周边未检索到合适的餐饮商家`;
      return;
    }

    scannedPois.value = pois;
    hasScanned.value = true;
    selectedItems.value = pois.filter(item => !isLocExisting(item.name));
    if (selectedItems.value.length === 0) {
      selectedItems.value = [...pois];
    }
  } catch (err: any) {
    console.error('[Coords Scan Error]:', err);
    scanError.value = err.message || '检索指定坐标周围失败';
  } finally {
    isLocating.value = false;
    isScanningPoi.value = false;
  }
}

async function handleCustomLocationSubmit() {
  if (!customInputText.value.trim()) return;

  // 如果下拉框有完全命中的项，优先选中第 1 项
  if (showTipsDropdown.value && locationTips.value.length > 0) {
    selectTip(locationTips.value[0]);
    return;
  }

  const targetLoc = customInputText.value.trim();
  locationName.value = targetLoc;
  isCustomLocation.value = true;
  isEditingLocation.value = false;
  showTipsDropdown.value = false;
  locationFailReason.value = null;

  await scanPoisForCustomLocation(targetLoc);
}

async function resetToGpsLocation() {
  isCustomLocation.value = false;
  isEditingLocation.value = false;
  customInputText.value = '';
  await startScan(true);
}

async function scanPoisForCustomLocation(customLocName: string) {
  scanError.value = null;
  locationFailReason.value = null;
  isCacheHit.value = false;
  cacheInfo.value = null;
  scannedPois.value = [];
  selectedItems.value = [];
  currentPage.value = 1;
  scanContext.value = { mode: 'custom', locName: customLocName };
  isScanningPoi.value = true;
  currentStageText.value = `正在检索【${customLocName}】周边真实美食商家...`;

  try {
    const { types, keywords } = foodTypeMapping[selectedFoodType.value];
    const res = await searchPoisByCustomLocation(customLocName, selectedRadius.value, undefined, types, keywords, 1);
    isScanningPoi.value = false;

    if (!res.pois || res.pois.length === 0) {
      scanError.value = `【${customLocName}】周边未检索到合适的餐饮商家`;
      return;
    }

    if (res.formattedAddress) {
      locationName.value = res.formattedAddress;
    }

    scannedPois.value = res.pois;
    hasScanned.value = true;

    // 默认全选未入库的
    selectedItems.value = res.pois.filter(item => !isLocExisting(item.name));
    if (selectedItems.value.length === 0) {
      selectedItems.value = [...res.pois];
    }
  } catch (err: any) {
    console.error('[Custom Location Scan Error]:', err);
    scanError.value = err.message || '检索自定义位置失败';
  } finally {
    isLocating.value = false;
    isScanningPoi.value = false;
  }
}

// 判断某个地点是否已存在于当前地点池
function isLocExisting(name: string): boolean {
  if (!name) return false;
  const cleanName = name.trim().toLowerCase();
  return store.locations.value.some(loc => 
    loc.name.trim().toLowerCase().includes(cleanName) || 
    cleanName.includes(loc.name.trim().toLowerCase())
  );
}

const isAllSelected = computed(() => {
  if (scannedPois.value.length === 0) return false;
  return selectedItems.value.length === scannedPois.value.length;
});

function toggleSelectAll() {
  if (isAllSelected.value) {
    selectedItems.value = [];
  } else {
    selectedItems.value = [...scannedPois.value];
  }
}

function toggleSelectItem(item: ScannedPoiItem) {
  const idx = selectedItems.value.findIndex(i => i.name === item.name);
  if (idx > -1) {
    selectedItems.value.splice(idx, 1);
  } else {
    selectedItems.value.push(item);
  }
}

function getScanBtnText(): string {
  if (isLocating.value) return '定位中...';
  if (isScanningPoi.value) return '获取商家中...';
  return '开始扫描';
}

function formatTimeAgo(timestamp: number): string {
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 60) return `${diffSec}秒`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}分钟`;
  return `${Math.floor(diffSec / 3600)}小时`;
}

// 核心扫描入口逻辑 (只获取数据，不进行 AI 预整理)
async function startScan(forceRefresh = false) {
  if (isCustomLocation.value && locationName.value) {
    return scanPoisForCustomLocation(locationName.value);
  }

  scanError.value = null;
  locationFailReason.value = null;
  scannedPois.value = [];
  selectedItems.value = [];
  isLocating.value = true;
  isCacheHit.value = false;
  cacheInfo.value = null;
  currentStageText.value = '正在获取当前精准 GPS 位置...';

  try {
    // 1. 获取坐标
    const coords = await getUserCurrentLocation();
    currentCoords.value = coords;

    // 异步尝试获取可读地名
    reverseGeocode(coords.lat, coords.lng).then(name => {
      if (!isCustomLocation.value) {
        locationName.value = name;
      }
    });

    isLocating.value = false;

    // 2. 检查 500m / 24h 本地缓存（除非强制刷新或有分类筛选）
    if (!forceRefresh && selectedFoodType.value === 'all') {
      const cache = getValidNearbyCache(coords.lat, coords.lng);
      if (cache && cache.pois && cache.pois.length > 0) {
        const dist = calculateDistance(coords.lat, coords.lng, cache.lat, cache.lng);
        isCacheHit.value = true;
        cacheInfo.value = {
          distance: dist,
          timeAgo: formatTimeAgo(cache.timestamp),
        };
        scannedPois.value = cache.pois;
        hasScanned.value = true;
        currentPage.value = 1;
        scanContext.value = { mode: 'gps', coords: { lat: coords.lat, lng: coords.lng } };

        selectedItems.value = cache.pois.filter(item => !isLocExisting(item.name));
        if (selectedItems.value.length === 0) {
          selectedItems.value = [...cache.pois];
        }
        return;
      }
    }

    // 3. 未命中缓存或强制刷新 -> 开始扫描 POI
    isScanningPoi.value = true;
    currentStageText.value = '正在检索高德周边餐饮商家...';
    currentPage.value = 1;
    scanContext.value = { mode: 'gps', coords: { lat: coords.lat, lng: coords.lng } };
    const { types, keywords } = foodTypeMapping[selectedFoodType.value];
    const pois = await fetchNearbyPois(coords.lat, coords.lng, selectedRadius.value, undefined, types, keywords, 1);
    isScanningPoi.value = false;

    if (!pois || pois.length === 0) {
      scanError.value = '周边未扫描到合适的美食商家，请尝试扩大扫描范围';
      return;
    }

    scannedPois.value = pois;
    hasScanned.value = true;

    // 自动保存到本地缓存
    saveNearbyCache({
      lat: coords.lat,
      lng: coords.lng,
      radius: selectedRadius.value,
      pois
    });

    // 默认勾选全新发现的地点
    selectedItems.value = pois.filter(item => !isLocExisting(item.name));
    if (selectedItems.value.length === 0) {
      selectedItems.value = [...pois];
    }
  } catch (err: any) {
    console.error('[NearbyScan Error]:', err);
    // 定位类失败：记录分类原因，由引导面板接管展示（scanError 保留作兜底，二者展示互斥）
    if (err instanceof GeolocationError) {
      locationFailReason.value = err.reason;
      locationName.value = '';
    }
    scanError.value = err.message || '获取位置或扫描附近失败';
  } finally {
    isLocating.value = false;
    isScanningPoi.value = false;
  }
}

// 第一步：选中地点后触发 AI 润色，进入预览确认
async function handleImportSelected() {
  if (selectedItems.value.length === 0) return;

  // Keep the exact AMap POI snapshot. AI is only allowed to enrich metadata;
  // it must never replace the real shop name/address with a guessed one.
  const selectedPois = [...selectedItems.value];
  isPolishing.value = true;
  currentStageText.value = `✨ DeepSeek AI 正在智能分类与润色选中的 ${selectedItems.value.length} 个商家...`;

  try {
    // 仅针对选中的 POI 让 AI 进行整理、润色、生成 Emoji 和推荐菜
    const results = await organizeScannedLocations(selectedPois);

    if (results && results.length > 0) {
      // 生成可编辑的预览数据（店名/地址始终以高德原始数据为准）
      previewItems.value = selectedPois.map((rawPoi, index) => {
        const item = (results.find(r => (r as any).id === rawPoi.id) || results[index] || {}) as any;
        return {
          id: rawPoi.id,
          name: rawPoi.name,
          address: rawPoi.address || '',
          distance: rawPoi.distance || 0,
          emoji: item.emoji || '🍱',
          tags: Array.isArray(item.tags) ? item.tags.join(', ') : '',
          priceRange: item.priceRange || '￥25-40',
          recommendedDish: item.recommendedDish || '',
          mealCategories: Array.isArray(item.mealCategories) ? item.mealCategories : ['lunch', 'dinner'],
        };
      });
      // 默认导入目标：团队模式优先当前搭子圈，否则个人地点池
      importTarget.value = (store.settings.value.activeMode === 'team' && team.value)
        ? team.value.public_id
        : 'personal';
      showPreview.value = true;
    } else {
      toastError('AI 整理分类失败，请重试');
    }
  } catch (err: any) {
    console.error('[AI Polish & Import Error]:', err);
    toastError(err.message || 'AI 维护导入过程中发生异常');
  } finally {
    isPolishing.value = false;
  }
}

// 返回调整：关闭预览，保留已勾选状态
function cancelPreview() {
  showPreview.value = false;
  previewItems.value = [];
}

// 第二步：确认导入预览中的地点（支持导入个人地点池或任一搭子圈菜单）
async function confirmImportPreview() {
  if (previewItems.value.length === 0 || isPolishing.value) return;

  // 组装标准地点数据（店名/地址以高德真实数据为准）
  const items: Omit<import('../types').BentoLocation, 'id' | 'isDrawn' | 'createdAt'>[] = previewItems.value.map(item => {
    const locationTags = item.tags.split(/[,，、\s]+/).map(s => s.trim()).filter(Boolean);
    if (locationTags.length === 0) locationTags.push('周边推荐');
    return {
      name: item.name,
      emoji: item.emoji || '🍱',
      tags: locationTags,
      priceRange: item.priceRange || '￥25-40',
      recommendedDish: item.recommendedDish || '',
      weight: 1,
      mealCategories: (item.mealCategories.length > 0 ? item.mealCategories : ['lunch', 'dinner']) as MealCategory[],
      address: item.address,
    };
  });

  isPolishing.value = true;
  try {
    if (importTarget.value === 'personal') {
      items.forEach(value => store.addLocation(value));
      toastSuccess(`🎉 成功将 ${items.length} 家周边真实美食，经 AI 润色后导入至个人地点池！`);
    } else {
      // 导入到指定搭子圈菜单
      const targetTeam = importableTeams.value.find(t => t.public_id === importTarget.value);
      if (!targetTeam) {
        toastError('未找到目标搭子圈，请刷新后重试');
        return;
      }
      if (team.value?.public_id !== targetTeam.public_id) {
        await openTeam(targetTeam.public_id);
        store.switchMode('team');
      }
      await batchAddTeamLocations(items);
      toastSuccess(`🎉 成功将 ${items.length} 家周边真实美食导入至搭子圈「${targetTeam.name}」的菜单！`);
    }

    emit('imported');
    showPreview.value = false;
    previewItems.value = [];
    emit('close');
  } catch (err: any) {
    console.error('[Confirm Import Error]:', err);
    toastError(err.message || '导入失败，请重试');
  } finally {
    isPolishing.value = false;
  }
}

// 分页：加载更多高德周边店铺（按 id 去重追加）
async function loadMorePois() {
  if (isLoadingMore.value || !scanContext.value) return;
  isLoadingMore.value = true;
  try {
    const nextPage = currentPage.value + 1;
    const { types, keywords } = foodTypeMapping[selectedFoodType.value];
    let newPois: ScannedPoiItem[] = [];

    if (scanContext.value.mode === 'gps' && scanContext.value.coords) {
      const { lat, lng } = scanContext.value.coords;
      newPois = await fetchNearbyPois(lat, lng, selectedRadius.value, undefined, types, keywords, nextPage);
    } else if (scanContext.value.mode === 'custom' && scanContext.value.locName) {
      const res = await searchPoisByCustomLocation(
        scanContext.value.locName, selectedRadius.value, undefined, types, keywords, nextPage
      );
      newPois = res.pois;
    }

    if (newPois.length > 0) {
      const existingIds = new Set(scannedPois.value.map(p => p.id));
      const fresh = newPois.filter(p => !existingIds.has(p.id));
      if (fresh.length === 0) {
        toastInfo('没有更多新店铺了');
        return;
      }
      scannedPois.value = [...scannedPois.value, ...fresh];
      currentPage.value = nextPage;
    } else {
      toastInfo('没有更多店铺了');
    }
  } catch (err: any) {
    toastError(err.message || '加载更多失败');
  } finally {
    isLoadingMore.value = false;
  }
}

onMounted(async () => {
  // 0. 无定位服务环境：直接展示引导面板，避免空转报错
  if (!isGeolocationSupported()) {
    locationFailReason.value = 'no-service';
    scanError.value = '当前环境不支持地理定位，请手动输入参考位置进行扫描';
    return;
  }

  // 1. 权限已被拒绝：自动进入手动输入流程（不伪造自定义位置，避免把占位文案当成真实地点去搜索）
  if (navigator.permissions) {
    try {
      const status = await navigator.permissions.query({ name: 'geolocation' });
      if (status.state === 'denied') {
        locationFailReason.value = 'denied';
        scanError.value = '定位权限已被禁用，无法自动获取当前位置。';
        openLocationEdit(true);
        return;
      }
    } catch (e) {
      console.warn('[Permissions Query Error]:', e);
    }
  }

  // 2. 首次打开自动尝试一键扫描 (如果权限是 prompt，则会自动请求权限)
  startScan(false);
});</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.75);
  backdrop-filter: blur(12px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  animation: fadeIn 0.25s ease-out;
}

.nearby-scan-modal {
  width: 100%;
  max-width: 960px;
  height: 92vh;
  max-height: 92vh;
  background: linear-gradient(135deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.98));
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 24px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 30px rgba(249, 115, 22, 0.15);
  display: flex;
  flex-direction: column;
  color: #f8fafc;
  overflow: hidden;
}

.modal-header {
  padding: 20px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-title-group {
  display: flex;
  align-items: center;
  gap: 14px;
}

.radar-icon-badge {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  background: linear-gradient(135deg, #f97316, #ea580c);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 15px rgba(249, 115, 22, 0.35);
}

.modal-title {
  font-size: 1.15rem;
  font-weight: 700;
  color: #ffffff;
  margin: 0;
}

.modal-subtitle {
  font-size: 0.8rem;
  color: #94a3b8;
  margin-top: 2px;
}

.close-btn {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #94a3b8;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
}

/* ⚡ 紧凑型统一控制中心 */
.scan-control-panel-compact {
  margin: 12px 24px;
  padding: 12px 16px;
  border-radius: 14px;
  background: rgba(15, 23, 42, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.panel-section {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.location-sec {
  flex: 1;
  min-width: 200px;
}

.controls-sec {
  flex-shrink: 0;
}

.location-view-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 12px;
}

.loc-summary-info {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.85rem;
  color: #e2e8f0;
  min-width: 0;
  flex: 1;
}

.loc-pin {
  font-size: 1rem;
}

.loc-name-txt {
  color: #ffffff;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 140px;
}

.loc-tag-badge {
  font-size: 0.68rem;
  padding: 1px 6px;
  border-radius: 8px;
  font-weight: 600;
  white-space: nowrap;
}

.tag-gps {
  background: rgba(59, 130, 246, 0.15);
  color: #60a5fa;
  border: 1px solid rgba(59, 130, 246, 0.25);
}

.tag-custom {
  background: rgba(16, 185, 129, 0.15);
  color: #34d399;
  border: 1px solid rgba(16, 185, 129, 0.25);
}

.mini-action-btn {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #cbd5e1;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 0.75rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
  transition: all 0.2s;
}

.mini-action-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  color: #ffffff;
  border-color: rgba(249, 115, 22, 0.4);
}

/* 内联修改器 */
.location-edit-inline {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}

.inline-input-wrapper {
  display: flex;
  position: relative;
  align-items: center;
  width: 100%;
  gap: 6px;
}

.inline-search-icon {
  position: absolute;
  left: 10px;
  color: #94a3b8;
  pointer-events: none;
}

.inline-location-input {
  flex: 1;
  padding: 5px 8px 5px 28px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(15, 23, 42, 0.7);
  color: #ffffff;
  font-size: 0.8rem;
  outline: none;
}

.inline-location-input:focus {
  border-color: #f97316;
}

.inline-confirm-btn {
  background: linear-gradient(135deg, #f97316, #ea580c);
  color: #ffffff;
  border: none;
  padding: 5px 12px;
  border-radius: 8px;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.inline-clear-btn {
  position: absolute;
  right: 68px;
  background: none;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  padding: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

.inline-clear-btn:hover {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.15);
}

/* ⚡ 模糊匹配动态下拉弹窗 */
.input-tips-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 6px;
  background: linear-gradient(135deg, rgba(30, 41, 59, 0.98), rgba(15, 23, 42, 0.98));
  border: 1px solid rgba(249, 115, 22, 0.3);
  border-radius: 12px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.6);
  z-index: 200;
  max-height: 220px;
  overflow-y: auto;
  padding: 6px;
}

.tip-item {
  padding: 8px 10px;
  border-radius: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.tip-item:hover {
  background: rgba(249, 115, 22, 0.2);
}

.tip-left {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1;
}

.tip-pin-icon {
  color: #f97316;
  flex-shrink: 0;
}

.tip-name {
  color: #ffffff;
  font-size: 0.8rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tip-district {
  color: #94a3b8;
  font-size: 0.72rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 140px;
}

.inline-actions {
  display: flex;
  gap: 12px;
  font-size: 0.75rem;
  padding-left: 2px;
}

.inline-reset-btn {
  background: none;
  border: none;
  color: #60a5fa;
  cursor: pointer;
  padding: 0;
}

.inline-reset-btn:hover {
  text-decoration: underline;
}

.inline-cancel-btn {
  background: none;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  padding: 0;
}

.inline-cancel-btn:hover {
  color: #ffffff;
}

/* 范围选择与扫描动作 */
.compact-radius,
.compact-filter {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8rem;
  color: #cbd5e1;
}

.radius-dropdown-select {
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #ffffff;
  border-radius: 6px;
  padding: 3px 6px;
  font-size: 0.78rem;
  outline: none;
  cursor: pointer;
}

.radius-dropdown-select option {
  background: #1e293b;
  color: #ffffff;
}

.compact-btn {
  padding: 6px 14px;
  font-size: 0.8rem;
}

.primary-glow-btn {
  background: linear-gradient(135deg, #f97316, #ea580c);
  color: #ffffff;
  border: none;
  border-radius: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  box-shadow: 0 4px 15px rgba(249, 115, 22, 0.3);
  transition: all 0.2s;
}

.primary-glow-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(249, 115, 22, 0.45);
}

.primary-glow-btn:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

/* 缓存提示 Banner */
.cache-banner {
  margin: 12px 24px 0 24px;
  padding: 10px 16px;
  border-radius: 12px;
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.25);
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.82rem;
  color: #fde68a;
}

.cache-banner-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.force-refresh-btn {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #fff;
  padding: 4px 10px;
  border-radius: 8px;
  font-size: 0.75rem;
  display: flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
  transition: background 0.2s;
}

.force-refresh-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.error-banner {
  margin: 12px 24px 0 24px;
  padding: 10px 16px;
  border-radius: 12px;
  background: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #fca5a5;
  font-size: 0.82rem;
  display: flex;
  align-items: center;
  gap: 8px;
}

/* 动态加载 Stage */
.loading-state-card {
  padding: 48px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.loading-animation {
  position: relative;
  width: 70px;
  height: 70px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
}

.radar-pulse {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 2px solid #f97316;
  animation: pulse-ring 1.5s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
}

.ai-sparkle-glow {
  color: #fb923c;
  animation: bounce-glow 1.2s infinite alternate;
}

.loading-text {
  font-size: 1rem;
  font-weight: 600;
  color: #f8fafc;
  margin: 0;
}

.loading-subtext {
  font-size: 0.8rem;
  color: #94a3b8;
  margin-top: 6px;
}

/* 结果 Grid */
.results-container {
  padding: 16px 24px;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.results-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.count-badge {
  font-size: 0.82rem;
  color: #cbd5e1;
  font-weight: 500;
}

.select-all-label {
  font-size: 0.8rem;
  color: #94a3b8;
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.results-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}

.result-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  padding: 12px;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 84px;
}

.result-card:hover {
  background: rgba(255, 255, 255, 0.07);
  border-color: rgba(249, 115, 22, 0.3);
}

.result-card.is-selected {
  background: rgba(249, 115, 22, 0.08);
  border-color: rgba(249, 115, 22, 0.4);
}

.card-left {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 2px;
}

.item-emoji {
  font-size: 1.2rem;
}

.card-content {
  flex: 1;
  min-width: 0;
}

.item-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.item-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: #ffffff;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 140px;
}

.badge {
  font-size: 0.65rem;
  padding: 1px 6px;
  border-radius: 6px;
  font-weight: 500;
}

.badge-new {
  background: rgba(34, 197, 94, 0.15);
  color: #4ade80;
  border: 1px solid rgba(34, 197, 94, 0.3);
}

.badge-existing {
  background: rgba(148, 163, 184, 0.15);
  color: #94a3b8;
  border: 1px solid rgba(148, 163, 184, 0.3);
}

.item-meta-simple {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
}

.item-type-tag {
  background: rgba(255, 255, 255, 0.06);
  color: #94a3b8;
  font-size: 0.72rem;
  padding: 2px 6px;
  border-radius: 6px;
}

.item-location-address {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.76rem;
  margin-top: 4px;
  color: #cbd5e1;
  min-width: 0;
}

.address-text {
  color: #94a3b8;
  font-weight: 400;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 170px;
}

.distance-badge {
  background: rgba(249, 115, 22, 0.15);
  color: #fb923c;
  border: 1px solid rgba(249, 115, 22, 0.3);
  font-size: 0.7rem;
  padding: 1px 6px;
  border-radius: 6px;
  font-weight: 600;
  flex-shrink: 0;
}

.item-meta {
  font-size: 0.78rem;
  color: #94a3b8;
  margin-top: 4px;
  display: flex;
  gap: 8px;
}

.item-price {
  color: #fb923c;
  font-weight: 500;
}

.item-tags {
  display: flex;
  gap: 6px;
  margin-top: 6px;
  flex-wrap: wrap;
}

.tag-badge {
  font-size: 0.72rem;
  background: rgba(255, 255, 255, 0.06);
  color: #cbd5e1;
  padding: 1px 7px;
  border-radius: 6px;
}

/* 空状态 */
.empty-scan-state {
  padding: 48px 24px;
  text-align: center;
  color: #94a3b8;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.empty-scan-state h4 {
  color: #fff;
  margin-top: 14px;
  font-size: 1rem;
}

.empty-scan-state p {
  font-size: 0.82rem;
  max-width: 400px;
  margin-top: 6px;
}

/* Modal 底部 */
.modal-footer {
  padding: 16px 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(15, 23, 42, 0.6);
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.btn-cancel {
  background: rgba(255, 255, 255, 0.08);
  color: #cbd5e1;
  border: 1px solid rgba(255, 255, 255, 0.12);
  padding: 8px 18px;
  border-radius: 12px;
  font-size: 0.85rem;
  cursor: pointer;
}

.btn-cancel:hover {
  background: rgba(255, 255, 255, 0.15);
}

@media (max-width: 640px) {
  .modal-overlay {
    padding: 8px;
  }

  .nearby-scan-modal {
    height: calc(100vh - 16px);
    max-height: none;
    border-radius: 18px;
  }

  .modal-header {
    padding: 14px 16px;
  }

  .header-title-group {
    gap: 10px;
  }

  .radar-icon-badge {
    width: 38px;
    height: 38px;
    border-radius: 11px;
  }

  .modal-title {
    font-size: 1rem;
  }

  .modal-subtitle {
    font-size: 0.72rem;
  }

  .scan-control-panel-compact {
    margin: 8px 12px;
    padding: 10px 12px;
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }

  .controls-sec {
    justify-content: space-between;
  }

  .results-container {
    padding: 10px 12px;
  }

  .results-header {
    align-items: flex-start;
    flex-direction: column;
    gap: 8px;
  }

  .results-grid {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .result-card {
    min-height: 72px;
    padding: 10px;
  }

  .item-name {
    max-width: 190px;
  }

  .address-text {
    max-width: 220px;
  }

  .modal-footer {
    padding: 12px;
  }

  .btn-confirm {
    flex: 1;
    justify-content: center;
  }
}

@keyframes pulse-ring {
  0% { transform: scale(0.95); opacity: 0.8; }
  100% { transform: scale(1.6); opacity: 0; }
}

@keyframes bounce-glow {
  from { transform: scale(1); filter: drop-shadow(0 0 4px #f97316); }
  to { transform: scale(1.15); filter: drop-shadow(0 0 12px #f97316); }
}

.spin-slow {
  animation: spin 10s linear infinite;
}

.spin-icon {
  animation: spin 1s linear infinite;
}

/* 📍 位置状态卡片与编辑样式 */
.location-bar {
  margin: 12px 24px 0 24px;
  padding: 12px 16px;
  border-radius: 14px;
  background: rgba(30, 41, 59, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 0.25s ease;
}

.location-display-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.loc-info-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  flex: 1;
}

.loc-meta-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.loc-title-label {
  font-size: 0.78rem;
  color: #94a3b8;
  font-weight: 500;
}

.loc-name-text {
  color: #ffffff;
  font-size: 0.95rem;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.loc-source-pill {
  font-size: 0.7rem;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 500;
  flex-shrink: 0;
}

.pill-gps {
  background: rgba(59, 130, 246, 0.15);
  color: #60a5fa;
  border: 1px solid rgba(59, 130, 246, 0.3);
}

.pill-custom {
  background: rgba(16, 185, 129, 0.15);
  color: #34d399;
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.btn-edit-loc {
  flex-shrink: 0;
  background: rgba(249, 115, 22, 0.12);
  border: 1px solid rgba(249, 115, 22, 0.3);
  color: #fb923c;
  padding: 6px 14px;
  border-radius: 10px;
  font-size: 0.8rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s ease;
}

.btn-edit-loc:hover {
  background: rgba(249, 115, 22, 0.25);
  border-color: #f97316;
  color: #ffffff;
  transform: translateY(-1px);
}

/* 编辑面板 */
.location-edit-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.input-search-row {
  display: flex;
  gap: 10px;
}

.input-inner {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 12px;
  color: #94a3b8;
}

.location-search-input {
  width: 100%;
  padding: 8px 12px 8px 36px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(15, 23, 42, 0.8);
  color: #ffffff;
  font-size: 0.85rem;
  outline: none;
  transition: border-color 0.2s;
}

.location-search-input:focus {
  border-color: #f97316;
  box-shadow: 0 0 0 2px rgba(249, 115, 22, 0.2);
}

.btn-submit-loc {
  padding: 8px 14px;
  font-size: 0.8rem;
  white-space: nowrap;
}

.quick-preset-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.78rem;
  color: #94a3b8;
}

.preset-title {
  white-space: nowrap;
}

.preset-pills-list {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.preset-pill {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #cbd5e1;
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
}

.preset-pill:hover {
  background: rgba(249, 115, 22, 0.15);
  border-color: rgba(249, 115, 22, 0.35);
  color: #fb923c;
}

.edit-footer-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 4px;
}

.btn-reset-gps {
  background: none;
  border: none;
  color: #60a5fa;
  font-size: 0.78rem;
  display: flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
  padding: 0;
}

.btn-reset-gps:hover {
  text-decoration: underline;
  color: #93c5fd;
}

.btn-cancel-edit {
  background: rgba(255, 255, 255, 0.08);
  border: none;
  color: #94a3b8;
  padding: 4px 12px;
  border-radius: 8px;
  font-size: 0.78rem;
  cursor: pointer;
}

.btn-cancel-edit:hover {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* ✨ AI 润色预览面板 */
.preview-import-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
}

.preview-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.preview-title-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.preview-title {
  font-size: 1rem;
  font-weight: 800;
  color: #0f172a;
}

.preview-sub {
  font-size: 0.72rem;
  color: var(--text-muted);
  line-height: 1.4;
}

.preview-target-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
  background: #fff7ed;
  border: 1px solid #ffedd5;
  border-radius: 10px;
  padding: 6px 10px;
}

.target-lbl {
  font-size: 0.78rem;
  font-weight: 800;
  color: #c2410c;
  white-space: nowrap;
}

.target-select {
  flex: 1;
  min-width: 0;
  border: 1px solid #fdba74;
  border-radius: 8px;
  background: #fff;
  color: #1e293b;
  font-size: 0.82rem;
  font-weight: 700;
  padding: 6px 8px;
  cursor: pointer;
  box-sizing: border-box;
}

.target-tip {
  flex-shrink: 0;
  font-size: 0.66rem;
  color: #b45309;
  font-weight: 600;
}

.preview-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
  max-height: 46vh;
  padding-right: 2px;
}

.preview-card {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.preview-name-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.preview-emoji-input {
  width: 44px;
  text-align: center;
  font-size: 1.3rem;
  border: 1px solid #ffe4d6;
  border-radius: 10px;
  background: #fff7ed;
  padding: 4px 0;
  flex-shrink: 0;
}

.preview-name-col {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.preview-name {
  font-size: 0.95rem;
  font-weight: 800;
  color: #0f172a;
}

.preview-address {
  font-size: 0.74rem;
  color: var(--text-muted);
}

.preview-form-row {
  display: flex;
  gap: 8px;
}

.preview-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  font-size: 0.72rem;
  font-weight: 700;
  color: #475569;
}

.preview-field-sm {
  flex: 0 0 34%;
}

.preview-input {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 6px 8px;
  font-size: 0.82rem;
  font-weight: 600;
  color: #1e293b;
  background: #fff;
  width: 100%;
  box-sizing: border-box;
}

.preview-cats {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.cat-check {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 0.72rem;
  font-weight: 600;
  color: #475569;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 999px;
  padding: 3px 8px;
  cursor: pointer;
}

.cat-check:has(input:checked) {
  background: #fff7ed;
  border-color: #fdba74;
  color: #c2410c;
}

.preview-actions {
  display: flex;
  gap: 10px;
}

.preview-actions .btn-cancel,
.preview-actions .btn-confirm {
  flex: 1;
}

.load-more-row {
  display: flex;
  justify-content: center;
  margin-top: 8px;
}

.load-more-btn {
  padding: 8px 20px;
  font-size: 0.82rem;
}

/* 🧭 自动定位失败引导面板 */
.geo-fail-hint {
  font-size: 0.75rem;
  color: #fde68a;
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.25);
  border-radius: 8px;
  padding: 6px 10px;
  line-height: 1.5;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.geo-fail-hint-head {
  font-weight: 700;
}

.geo-fail-hint-tip {
  color: #cbd5e1;
  font-size: 0.72rem;
}

.geo-fail-panel {
  margin: 12px 24px 0 24px;
  padding: 16px 18px;
  border-radius: 14px;
  background: linear-gradient(135deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.95));
  border: 1px solid rgba(245, 158, 11, 0.35);
  display: flex;
  gap: 14px;
  align-items: flex-start;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
  animation: fadeInUp 0.3s ease-out;
}

.geo-fail-icon {
  font-size: 1.6rem;
  line-height: 1;
  flex-shrink: 0;
  margin-top: 2px;
}

.geo-fail-body {
  flex: 1;
  min-width: 0;
}

.geo-fail-title {
  color: #fde68a;
  font-size: 0.95rem;
  font-weight: 700;
  margin: 0;
}

.geo-fail-desc {
  color: #cbd5e1;
  font-size: 0.82rem;
  margin: 6px 0 0 0;
  line-height: 1.5;
}

.geo-fail-tips {
  margin: 8px 0 0 0;
  padding-left: 18px;
  color: #94a3b8;
  font-size: 0.78rem;
  line-height: 1.7;
}

.geo-fail-actions {
  display: flex;
  gap: 10px;
  margin-top: 12px;
  flex-wrap: wrap;
}

.geo-fail-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border-radius: 10px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}

.geo-fail-primary {
  background: linear-gradient(135deg, #f97316, #ea580c);
  color: #ffffff;
  box-shadow: 0 4px 15px rgba(249, 115, 22, 0.3);
}

.geo-fail-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(249, 115, 22, 0.45);
}

.geo-fail-ghost {
  background: rgba(255, 255, 255, 0.08);
  color: #e2e8f0;
  border: 1px solid rgba(255, 255, 255, 0.15);
}

.geo-fail-ghost:hover {
  background: rgba(255, 255, 255, 0.16);
}

@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (max-width: 640px) {
  .geo-fail-panel {
    margin: 8px 12px 0 12px;
    padding: 12px 14px;
    flex-direction: column;
  }

  .geo-fail-actions .geo-fail-btn {
    flex: 1;
    justify-content: center;
  }
}
</style>
