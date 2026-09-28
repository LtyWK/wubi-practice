<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useLevels } from '@/composables/useLevels'
import type { LevelConfig } from '@/types'

const router = useRouter()
const { stages, isStageUnlocked, isLevelPassed, levelResult, stageProgress, syncUnlocks } =
  useLevels()

onMounted(() => {
  syncUnlocks()
})

function pct(n: number): string {
  return `${Math.round(n * 100)}%`
}

function go(level: LevelConfig): void {
  router.push(`/play/${level.id}`)
}
</script>

<template>
  <section class="stages">
    <h1 class="stages__title">关卡地图（临时列表，地图化界面开发中）</h1>

    <section
      v-for="stage in stages"
      :key="stage.id"
      class="stage"
      :class="{ 'stage--locked': !isStageUnlocked(stage.id) }"
    >
      <header class="stage__head">
        <h2 class="stage__title">{{ stage.title }}</h2>
        <span class="stage__progress">
          {{ stageProgress(stage).passed }}/{{ stageProgress(stage).total }}
        </span>
      </header>
      <p class="stage__desc">{{ stage.description }}</p>

      <ul class="levels">
        <li v-for="level in stage.levels" :key="level.id" class="level">
          <button
            class="level__btn"
            :class="{ 'level__btn--passed': isLevelPassed(level.id) }"
            :disabled="!isStageUnlocked(stage.id)"
            @click="go(level)"
          >
            <span class="level__name">{{ level.title }}</span>
            <span class="level__meta">
              ≥ {{ level.require.speed }} · {{ pct(level.require.accuracy) }}
            </span>
            <span class="level__best">
              <template v-if="levelResult(level.id)">
                最佳 {{ levelResult(level.id)?.bestSpeed.toFixed(0) }}
              </template>
              <template v-else>—</template>
            </span>
            <span class="level__state">
              {{ isLevelPassed(level.id) ? '已通关' : isStageUnlocked(stage.id) ? '开始' : '未解锁' }}
            </span>
          </button>
        </li>
      </ul>
    </section>
  </section>
</template>

<style scoped>
.stages {
  max-width: 760px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.stages__title {
  font-size: var(--font-lg);
  color: var(--color-text-muted);
}

.stage {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  padding: var(--space-5);
  box-shadow: var(--shadow-sm);
}

.stage--locked {
  opacity: 0.55;
}

.stage__head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.stage__title {
  font-size: var(--font-md);
}

.stage__progress {
  color: var(--color-primary);
  font-weight: 600;
}

.stage__desc {
  color: var(--color-text-muted);
  font-size: var(--font-sm);
  margin-bottom: var(--space-4);
}

.levels {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: var(--space-3);
}

.level__btn {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-key-bg);
  text-align: left;
}

.level__btn--passed {
  border-color: var(--color-success);
  background: var(--color-success-weak);
}

.level__btn:disabled {
  cursor: not-allowed;
}

.level__name {
  font-weight: 600;
}

.level__meta,
.level__best {
  font-size: var(--font-sm);
  color: var(--color-text-muted);
}

.level__state {
  font-size: var(--font-sm);
  color: var(--color-primary);
  font-weight: 600;
}
</style>
