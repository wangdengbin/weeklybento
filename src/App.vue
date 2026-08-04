<template>
  <div id="app">
    <!-- 头部导航 & 管理员暗门 -->
    <HeaderNav
      @open-admin-modal="showAdminModal = true"
      @open-team-modal="showTeamModal = true"
    />

    <!-- 主 View 视图 -->
    <main class="main-content">
      <SlotMachine 
        v-if="currentTab === 'roll'" 
        @roll-complete="handleRollComplete" 
      />

      <HistoryView 
        v-if="currentTab === 'history'" 
      />
    </main>

    <!-- 抽中结果弹窗 -->
    <ResultModal 
      :visible="showResultModal" 
      :result-data="latestResult" 
      @close="showResultModal = false"
      @reroll="handleRerollFromModal"
    />

    <!-- 管理员密码验证/控制台 Modal -->
    <AdminModal 
      :visible="showAdminModal" 
      @close="showAdminModal = false" 
    />

    <TeamWorkspaceModal
      :visible="showTeamModal"
      @close="showTeamModal = false"
    />

    <!-- 底部 H5 移动端 Sweet TabBar -->
    <nav class="bottom-nav">
      <button 
        class="nav-item" 
        :class="{ active: currentTab === 'roll' }"
        @click="switchTab('roll')"
      >
        <div class="icon-wrap">
          <Dices :size="20" />
        </div>
        <span>随机 ROLL</span>
      </button>

      <button 
        class="nav-item" 
        :class="{ active: currentTab === 'history' }"
        @click="switchTab('history')"
      >
        <div class="icon-wrap">
          <CalendarDays :size="20" />
        </div>
        <span>每日记录</span>
      </button>

      <button 
        class="nav-item" 
        @click="showAdminModal = true"
      >
        <div class="icon-wrap">
          <SlidersHorizontal :size="20" />
        </div>
        <span>地点管理</span>
      </button>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Dices, CalendarDays, SlidersHorizontal } from 'lucide-vue-next';
import HeaderNav from './components/HeaderNav.vue';
import SlotMachine from './components/SlotMachine.vue';
import HistoryView from './components/HistoryView.vue';
import ResultModal from './components/ResultModal.vue';
import AdminModal from './components/AdminModal.vue';
import TeamWorkspaceModal from './components/TeamWorkspaceModal.vue';
import { soundEffects } from './composables/useAudio';
import { useBentoStore } from './composables/useBentoStore';
import { useTeamWorkspace } from './composables/useTeamWorkspace';
import type { BentoLocation } from './types';

const currentTab = ref<'roll' | 'history'>('roll');
const showResultModal = ref(false);
const showAdminModal = ref(false);
const showTeamModal = ref(false);

const { settings } = useBentoStore();
const { team, initialize } = useTeamWorkspace();

const latestResult = ref<{ location: BentoLocation; fortune: string } | null>(null);

// 应用启动时自动从云端获取最新数据
onMounted(async () => {
  await initialize();
  if (team.value) settings.value.activeMode = 'team';
  if (!team.value && new URL(window.location.href).searchParams.has('team')) {
    showTeamModal.value = true;
  }
});

function switchTab(tab: 'roll' | 'history') {
  if (settings.value.soundEnabled) soundEffects.playTick(700);
  currentTab.value = tab;
}

function handleRollComplete(result: { location: BentoLocation; fortune: string }) {
  latestResult.value = result;
  showResultModal.value = true;
}

function handleRerollFromModal() {
  currentTab.value = 'roll';
}
</script>

<style scoped>
.main-content {
  flex: 1;
  padding-bottom: 90px;
}
</style>
