<template>
  <div class="emoji-picker-popover glass-card">
    <div class="picker-header">
      <span class="header-title">选择地点图标 (Emoji)</span>
      <button class="close-picker-btn" type="button" @click="$emit('close')">✕</button>
    </div>
    
    <!-- 分类标签 Tab -->
    <div class="category-tabs">
      <button 
        v-for="(cat, idx) in categories" 
        :key="idx"
        type="button"
        class="cat-tab-btn" 
        :class="{ active: activeCatIdx === idx }"
        @click="activeCatIdx = idx"
      >
        {{ cat.icon }} {{ cat.name }}
      </button>
    </div>

    <!-- Emoji 网格 -->
    <div class="emoji-grid">
      <button
        v-for="emoji in categories[activeCatIdx].emojis"
        :key="emoji"
        type="button"
        class="emoji-btn"
        @click="selectEmoji(emoji)"
      >
        {{ emoji }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const emit = defineEmits<{
  (e: 'select', emoji: string): void;
  (e: 'close'): void;
}>();

const activeCatIdx = ref(0);

const categories = [
  {
    name: '主食快餐',
    icon: '🍱',
    emojis: [
      '🍱', '🍚', '🍜', '🍝', '🍣', '🥟', '🍔', '🍕', '🥪', '🌮', 
      '🥙', '🍳', '🥩', '🍗', '🍖', '🥘', '🍲', '🍛', '🍤', '🦪', 
      '🍢', '🍡', '🥞', '🥐', '🥖', '🥨', '🥯'
    ]
  },
  {
    name: '饮品甜点',
    icon: '🧋',
    emojis: [
      '🧋', '☕', '🍵', '🥤', '🍺', '🍻', '🍷', '🍸', '🍦', '🍧', 
      '🍰', '🎂', '🍩', '🍪', '🥠', '🍮', '🍭', '🍫', '🍧', '🥮'
    ]
  },
  {
    name: '蔬果轻食',
    icon: '🥗',
    emojis: [
      '🥗', '🥑', '🥦', '🥒', '🌽', '🥔', '🍠', '🍎', '🍉', '🍇', 
      '🍓', '🫐', '🍑', '🍍', '🥭', '🍋', '🥝', '🍅', '🍆'
    ]
  },
  {
    name: '趣味标记',
    icon: '🌟',
    emojis: [
      '⭐', '🌟', '🔥', '👑', '⚡', '🍀', '🎉', '🏆', '💎', '💯', 
      '🏪', '🏬', '🎪', '🎯', '📍', '🏷️', '❤️', '😋', '🤤', '👍'
    ]
  }
];

function selectEmoji(emoji: string) {
  emit('select', emoji);
  emit('close');
}
</script>

<style scoped>
.emoji-picker-popover {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 100;
  margin-top: 6px;
  width: 320px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 153, 51, 0.25);
  border-radius: 14px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
  animation: fadeInDown 0.2s ease-out;
}

@keyframes fadeInDown {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.picker-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.header-title {
  font-size: 13px;
  font-weight: 600;
  color: #555;
}

.close-picker-btn {
  background: none;
  border: none;
  font-size: 14px;
  color: #999;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
}

.close-picker-btn:hover {
  background: rgba(0, 0, 0, 0.05);
  color: #333;
}

.category-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 10px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.cat-tab-btn {
  font-size: 12px;
  padding: 4px 8px;
  border: none;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.04);
  color: #666;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s ease;
}

.cat-tab-btn.active {
  background: #ff9933;
  color: white;
  font-weight: bold;
}

.emoji-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 6px;
  max-height: 160px;
  overflow-y: auto;
  padding: 2px;
}

.emoji-btn {
  font-size: 20px;
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(0, 0, 0, 0.05);
  border-radius: 8px;
  padding: 4px 0;
  cursor: pointer;
  transition: transform 0.15s ease, background 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.emoji-btn:hover {
  transform: scale(1.25);
  background: #fff3e6;
  z-index: 10;
}
</style>
