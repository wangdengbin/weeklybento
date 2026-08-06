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
            <p class="modal-subtitle">智能定位附近餐饮，一键由 AI 结构化整理并维护入库</p>
          </div>
        </div>
        <button class="close-btn" @click="$emit('close')" title="关闭">
          <X :size="18" />
        </button>
      </div>

      <!-- 控制面板栏 (扫描半径 & 按钮) -->
      <div class="scan-controls-bar">
        <div class="radius-selector">
          <span class="selector-label">扫描范围：</span>
          <button 
            v-for="r in [500, 1000, 2000]" 
            :key="r" 
            class="radius-pill" 
            :class="{ active: selectedRadius === r }"
            @click="selectedRadius = r"
          >
            {{ r }} 米
          </button>
        </div>

        <button 
          class="scan-action-btn primary-glow-btn" 
          :disabled="isLocating || isScanningPoi || isLoading"
          @click="startScan(false)"
        >
          <Sparkles v-if="!isLocating && !isScanningPoi && !isLoading" :size="16" />
          <Loader2 v-else :size="16" class="spin-icon" />
          <span>{{ getScanBtnText() }}</span>
        </button>
      </div>

      <!-- 📍 位置状态显示与手动指定编辑卡片 -->
      <div class="location-bar glass-card">
        <div v-if="!isEditingLocation" class="location-display-row">
          <div class="loc-info-content">
            <div class="loc-meta-header">
              <span class="loc-title-label">📍 参考位置</span>
              <span class="loc-source-pill" :class="isCustomLocation ? 'pill-custom' : 'pill-gps'">
                {{ isCustomLocation ? '✨ 手动指定' : '🛰️ GPS 自动定位' }}
              </span>
            </div>
            <strong class="loc-name-text" :title="locationName">
              {{ locationName || '正在获取当前位置...' }}
            </strong>
          </div>

          <button class="btn-edit-loc" @click="openLocationEdit" title="如果定位不准确，点击手动输入或指定新位置">
            <Edit3 :size="14" />
            <span>手动修改位置</span>
          </button>
        </div>

        <!-- 手动修改位置表单 -->
        <div v-else class="location-edit-panel">
          <div class="input-search-row">
            <div class="input-inner">
              <Search :size="15" class="search-icon" />
              <input 
                v-model="customInputText"
                type="text" 
                class="location-search-input" 
                placeholder="输入具体城市/大厦/商圈（如: 深圳科技园、杭州西湖、朝阳区...）"
                @keyup.enter="handleCustomLocationSubmit"
              />
            </div>
            <button class="btn-submit-loc primary-glow-btn" :disabled="!customInputText.trim()" @click="handleCustomLocationSubmit">
              <Check :size="14" />
              <span>搜索并检索</span>
            </button>
          </div>

          <div class="quick-preset-row">
            <span class="preset-title">热门地标：</span>
            <div class="preset-pills-list">
              <button 
                v-for="preset in ['深圳科技园', '上海陆家嘴', '杭州西湖', '北京三里屯', '广州天河城']" 
                :key="preset" 
                class="preset-pill"
                @click="customInputText = preset; handleCustomLocationSubmit()"
              >
                {{ preset }}
              </button>
            </div>
          </div>

          <div class="edit-footer-row">
            <button class="btn-reset-gps" @click="resetToGpsLocation">
              <Navigation :size="13" />
              <span>恢复 GPS 自动定位</span>
            </button>
            <button class="btn-cancel-edit" @click="isEditingLocation = false">
              取消
            </button>
          </div>
        </div>
      </div>

      <!-- ⚡ 500m / 24h 缓存命中提示卡片 -->
      <div v-if="isCacheHit && cacheInfo && !isCustomLocation" class="cache-banner glass-card">
        <div class="cache-banner-left">
          <Zap :size="16" class="text-amber-400" />
          <span>⚡ 已为您载入 <strong>{{ cacheInfo.distance }}m</strong> 内 ({{ cacheInfo.timeAgo }}前) 的 AI 整理缓存数据</span>
        </div>
        <button class="force-refresh-btn" @click="startScan(true)" title="忽略缓存重新扫描">
          <RotateCw :size="13" />
          <span>强制重新扫描</span>
        </button>
      </div>

      <!-- 错误提示 -->
      <div v-if="scanError || aiError" class="error-banner">
        <AlertCircle :size="16" />
        <span>{{ scanError || aiError }}</span>
      </div>

      <!-- 动态加载/扫描状态提示 -->
      <div v-if="isLocating || isScanningPoi || isLoading" class="loading-state-card">
        <div class="loading-animation">
          <div class="radar-pulse"></div>
          <Sparkles :size="28" class="ai-sparkle-glow" />
        </div>
        <p class="loading-text">{{ currentStageText }}</p>
        <span class="loading-subtext">正在精准匹配高分美食并让 DeepSeek AI 进行分类润色...</span>
      </div>

      <!-- 扫描与 AI 整理结果列表 -->
      <div v-else-if="organizedResults.length > 0" class="results-container">
        <div class="results-header">
          <span class="count-badge">扫描到 {{ organizedResults.length }} 家周边美食 ({{ locationName }})</span>
          <label class="select-all-label">
            <input type="checkbox" :checked="isAllSelected" @change="toggleSelectAll" />
            <span>全选全新/未入库地点 (已选 {{ selectedItems.length }})</span>
          </label>
        </div>

        <div class="results-grid">
          <div 
            v-for="(item, index) in organizedResults" 
            :key="index"
            class="result-card glass-card"
            :class="{ 
              'is-existing': isLocExisting(item.name),
              'is-selected': selectedItems.includes(item)
            }"
            @click="toggleSelectItem(item)"
          >
            <div class="card-left">
              <input 
                type="checkbox" 
                :checked="selectedItems.includes(item)"
                @click.stop="toggleSelectItem(item)" 
              />
              <span class="item-emoji">{{ item.emoji || '🍱' }}</span>
            </div>

            <div class="card-content">
              <div class="item-title-row">
                <h4 class="item-name">{{ item.name }}</h4>
                <span v-if="isLocExisting(item.name)" class="badge badge-existing">已在地点池</span>
                <span v-else class="badge badge-new">✨ 新发现</span>
              </div>

              <!-- 📍 优先展示具体地名/地址与距离 -->
              <div v-if="item.address || item.distance" class="item-location-address">
                <MapPin :size="12" class="address-pin-icon" />
                <span class="address-text">{{ item.address || '周边推荐' }}</span>
                <span v-if="item.distance" class="distance-badge">{{ typeof item.distance === 'number' ? `${item.distance}m` : item.distance }}</span>
              </div>

              <div class="item-meta">
                <span class="item-price">{{ item.priceRange || '￥25-40' }}</span>
                <span v-if="item.recommendedDish" class="item-dish">| 招牌：{{ item.recommendedDish }}</span>
              </div>

              <div class="item-tags">
                <span v-for="tag in (item.tags || [])" :key="tag" class="tag-badge">#{{ tag }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 无扫描数据时的空状态 -->
      <div v-else-if="!hasScanned" class="empty-scan-state">
        <MapPin :size="42" class="text-orange" />
        <h4>准备就绪！开始扫描附近 500m~2000m 的精致美食</h4>
        <p>点击上方【开始扫描】按钮，AI 将根据您的实际位置自动查找、整理并分配适宜餐池！</p>
      </div>

      <!-- 底部导入操作栏 -->
      <div class="modal-footer">
        <button class="btn-cancel" @click="$emit('close')">取消</button>
        <button 
          class="btn-confirm primary-glow-btn" 
          :disabled="selectedItems.length === 0"
          @click="handleImportSelected"
        >
          <Plus :size="16" />
          <span>批量维护/导入至地点池 ({{ selectedItems.length }})</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { 
  Compass, X, Sparkles, Loader2, Zap, RotateCw, AlertCircle, MapPin, Plus, Edit3, Search, Check, Navigation
} from 'lucide-vue-next';
import { useBentoStore } from '../composables/useBentoStore';
import { useBentoAI } from '../composables/useBentoAI';
import { 
  getUserCurrentLocation, 
  fetchNearbyPois, 
  getValidNearbyCache, 
  saveNearbyCache, 
  calculateDistance,
  reverseGeocode,
  searchPoisByCustomLocation
} from '../utils/locationService';
import type { ParsedLocationResult } from '../composables/useBentoAI';

const emit = defineEmits(['close', 'imported']);

const store = useBentoStore();
const { organizeScannedLocations, isLoading, aiError } = useBentoAI();

const selectedRadius = ref<number>(1000);
const isLocating = ref(false);
const isScanningPoi = ref(false);
const scanError = ref<string | null>(null);
const hasScanned = ref(false);
const currentStageText = ref('定位与扫描中...');

// 定位与结果数据
const locationName = ref<string>('');
const isCustomLocation = ref<boolean>(false);
const isEditingLocation = ref<boolean>(false);
const customInputText = ref<string>('');

const currentCoords = ref<{ lat: number; lng: number } | null>(null);
const organizedResults = ref<ParsedLocationResult[]>([]);
const selectedItems = ref<ParsedLocationResult[]>([]);

// 缓存状态
const isCacheHit = ref(false);
const cacheInfo = ref<{ distance: number; timeAgo: string } | null>(null);

// 手动设置/修改位置
function openLocationEdit() {
  customInputText.value = isCustomLocation.value ? locationName.value : '';
  isEditingLocation.value = true;
}

async function handleCustomLocationSubmit() {
  if (!customInputText.value.trim()) return;
  const targetLoc = customInputText.value.trim();
  locationName.value = targetLoc;
  isCustomLocation.value = true;
  isEditingLocation.value = false;

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
  isCacheHit.value = false;
  cacheInfo.value = null;
  isScanningPoi.value = true;
  currentStageText.value = `1/2 正在检索【${customLocName}】周边美食...`;

  try {
    const res = await searchPoisByCustomLocation(customLocName, selectedRadius.value);
    isScanningPoi.value = false;

    if (!res.pois || res.pois.length === 0) {
      scanError.value = `【${customLocName}】周边未检索到合适的餐饮商家`;
      return;
    }

    currentStageText.value = '2/2 ✨ DeepSeek AI 正在智能分类与润色...';
    const results = await organizeScannedLocations(res.pois);

    if (results && results.length > 0) {
      organizedResults.value = results;
      hasScanned.value = true;
      selectedItems.value = results.filter(item => !isLocExisting(item.name));
      if (selectedItems.value.length === 0) {
        selectedItems.value = [...results];
      }
    } else {
      scanError.value = 'AI 整理地点失败，请稍后重试';
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
  if (organizedResults.value.length === 0) return false;
  return selectedItems.value.length === organizedResults.value.length;
});

function toggleSelectAll() {
  if (isAllSelected.value) {
    selectedItems.value = [];
  } else {
    selectedItems.value = [...organizedResults.value];
  }
}

function toggleSelectItem(item: ParsedLocationResult) {
  const idx = selectedItems.value.findIndex(i => i.name === item.name);
  if (idx > -1) {
    selectedItems.value.splice(idx, 1);
  } else {
    selectedItems.value.push(item);
  }
}

function getScanBtnText(): string {
  if (isLocating.value) return '定位中...';
  if (isScanningPoi.value) return '获取附近商家...';
  if (isLoading.value) return '✨ AI 分析整理中...';
  return '开始扫描';
}

function formatTimeAgo(timestamp: number): string {
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 60) return `${diffSec}秒`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}分钟`;
  return `${Math.floor(diffSec / 3600)}小时`;
}

// 核心扫描入口逻辑
async function startScan(forceRefresh = false) {
  if (isCustomLocation.value && locationName.value) {
    return scanPoisForCustomLocation(locationName.value);
  }

  scanError.value = null;
  isLocating.value = true;
  isCacheHit.value = false;
  cacheInfo.value = null;
  currentStageText.value = '1/3 正在获取当前精准 GPS 位置...';

  try {
    // 1. 获取坐标
    const coords = await getUserCurrentLocation();
    currentCoords.value = coords;

    // 异步尝试获取可读逆地理编码地名
    reverseGeocode(coords.lat, coords.lng).then(name => {
      if (!isCustomLocation.value) {
        locationName.value = name;
      }
    });

    isLocating.value = false;

    // 2. 检查 500m / 24h 本地缓存（除非强制刷新）
    if (!forceRefresh) {
      const cache = getValidNearbyCache(coords.lat, coords.lng);
      if (cache && cache.organizedResults && cache.organizedResults.length > 0) {
        const dist = calculateDistance(coords.lat, coords.lng, cache.lat, cache.lng);
        isCacheHit.value = true;
        cacheInfo.value = {
          distance: dist,
          timeAgo: formatTimeAgo(cache.timestamp),
        };
        organizedResults.value = cache.organizedResults;
        hasScanned.value = true;

        selectedItems.value = organizedResults.value.filter(item => !isLocExisting(item.name));
        if (selectedItems.value.length === 0) {
          selectedItems.value = [...organizedResults.value];
        }
        return;
      }
    }

    // 3. 未命中缓存或强制刷新 -> 开始扫描 POI
    isScanningPoi.value = true;
    currentStageText.value = '2/3 正在检索周边 1000m 餐饮商家...';
    const pois = await fetchNearbyPois(coords.lat, coords.lng, selectedRadius.value);
    isScanningPoi.value = false;

    if (!pois || pois.length === 0) {
      scanError.value = '周边未扫描到合适的美食商家，请尝试扩大扫描范围';
      return;
    }

    // 4. 发送给 Supabase Edge Function 让 AI 整理
    currentStageText.value = '3/3 ✨ DeepSeek AI 正在智能分类与润色...';
    const results = await organizeScannedLocations(pois);

    if (results && results.length > 0) {
      organizedResults.value = results;
      hasScanned.value = true;

      // 自动保存到缓存
      saveNearbyCache({
        lat: coords.lat,
        lng: coords.lng,
        radius: selectedRadius.value,
        pois,
        organizedResults: results,
      });

      // 默认勾选全新发现的地点
      selectedItems.value = results.filter(item => !isLocExisting(item.name));
      if (selectedItems.value.length === 0) {
        selectedItems.value = [...results];
      }
    } else {
      scanError.value = 'AI 整理地点失败，请稍后重试';
    }
  } catch (err: any) {
    console.error('[NearbyScan Error]:', err);
    scanError.value = err.message || '获取位置或扫描附近失败';
  } finally {
    isLocating.value = false;
    isScanningPoi.value = false;
  }
}

// 批量一键导入/维护至地点池
function handleImportSelected() {
  if (selectedItems.value.length === 0) return;

  let addedCount = 0;
  selectedItems.value.forEach(item => {
    // 调用 useBentoStore 的 addLocation
    store.addLocation({
      name: item.name,
      emoji: item.emoji || '🍱',
      tags: item.tags && item.tags.length > 0 ? item.tags : ['周边推荐'],
      priceRange: item.priceRange || '￥25-40',
      recommendedDish: item.recommendedDish || '',
      weight: 1,
      mealCategories: item.mealCategories || ['lunch', 'dinner'],
    });
    addedCount++;
  });

  alert(`🎉 成功将 ${addedCount} 家周边美食由 AI 整理并导入维护至您的地点池！`);
  emit('imported');
  emit('close');
}

onMounted(() => {
  // 首次打开自动尝试一键扫描
  startScan(false);
});
</script>

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
  max-width: 660px;
  max-height: 88vh;
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

/* 控制栏 */
.scan-controls-bar {
  padding: 14px 24px;
  background: rgba(15, 23, 42, 0.4);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.radius-selector {
  display: flex;
  align-items: center;
  gap: 8px;
}

.selector-label {
  font-size: 0.85rem;
  color: #cbd5e1;
}

.radius-pill {
  padding: 5px 12px;
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.05);
  color: #94a3b8;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s;
}

.radius-pill.active {
  background: linear-gradient(135deg, rgba(249, 115, 22, 0.2), rgba(234, 88, 12, 0.3));
  border-color: #f97316;
  color: #fb923c;
  font-weight: 600;
}

.primary-glow-btn {
  background: linear-gradient(135deg, #f97316, #ea580c);
  color: #ffffff;
  border: none;
  padding: 8px 18px;
  border-radius: 12px;
  font-size: 0.85rem;
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
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.result-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
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
  gap: 12px;
}

.item-emoji {
  font-size: 1.6rem;
}

.card-content {
  flex: 1;
}

.item-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.item-name {
  font-size: 0.95rem;
  font-weight: 600;
  color: #ffffff;
  margin: 0;
}

.badge {
  font-size: 0.7rem;
  padding: 2px 8px;
  border-radius: 10px;
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

.item-location-address {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.78rem;
  margin-top: 3px;
  color: #e2e8f0;
}

.address-pin-icon {
  color: #f97316;
  flex-shrink: 0;
}

.address-text {
  color: #cbd5e1;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 320px;
}

.distance-badge {
  background: rgba(249, 115, 22, 0.15);
  color: #fb923c;
  border: 1px solid rgba(249, 115, 22, 0.3);
  font-size: 0.7rem;
  padding: 0 6px;
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
</style>

