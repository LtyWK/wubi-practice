<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useLevels } from '@/composables/useLevels'
import type { LevelConfig, StageConfig } from '@/types'

const router = useRouter()
const { stages, isStageUnlocked, isLevelPassed, levelResult, stageProgress, syncUnlocks } =
  useLevels()

onMounted(() => {
  syncUnlocks()
})

const totalLevels = computed(() => stages.reduce((n, s) => n + s.levels.length, 0))
const passedLevels = computed(() => stages.reduce((n, s) => n + stageProgress(s).passed, 0))

function pct(n: number): string {
  return `${Math.round(n * 100)}%`
}

function unitOf(level: LevelConfig): string {
  return level.type === 'zigen' ? '键/分' : '字/分'
}

function go(level: LevelConfig): void {
  router.push(`/play/${level.id}`)
}

function stageClass(stage: StageConfig): Record<string, boolean> {
  return {
    'stage--locked': !isStageUnlocked(stage.id),
    'stage--done': isStageUnlocked(stage.id) && stageProgress(stage).passed === stage.levels.length,
  }
}

function cardClass(stage: StageConfig, level: LevelConfig): Record<string, boolean> {
  return {
    'card--passed': isLevelPassed(level.id),
    'card--open': isStageUnlocked(stage.id) && !isLevelPassed(level.id),
  }
}

function badge(stage: StageConfig, level: LevelConfig): string {
  if (isLevelPassed(level.id)) return '已通关'
  return isStageUnlocked(stage.id) ? '开始' : '未解锁'
}

function tip(level: LevelConfig): string {
  const best = levelResult(level.id)
  const req = `达标：≥ ${level.require.speed} ${unitOf(level)} · ${pct(level.require.accuracy)}`
  return best
    ? `${level.title}\n${req}\n最佳：${best.bestSpeed.toFixed(0)} · ${pct(best.bestAccuracy)}`
    : `${level.title}\n${req}\n未通关`
}
</script>

<template>
  <section class="map">
    <header class="map__head">
      <h1 class="map__title">关卡地图</h1>
      <p class="map__sub">
        {{ stages.length }} 个阶段 · {{ totalLevels }} 个小关 · 已通关 {{ passedLevels }}
      </p>
    </header>

    <ol class="stages">
      <li v-for="(stage, si) in stages" :key="stage.id" class="stage" :class="stageClass(stage)">
        <div class="stage__badge">{{ si + 1 }}</div>

        <div class="stage__body">
          <header class="stage__head">
            <h2 class="stage__title">{{ stage.title }}</h2>
            <span v-if="!isStageUnlocked(stage.id)" class="stage__lock">未解锁</span>
            <span v-else class="stage__count">
              {{ stageProgress(stage).passed }}/{{ stageProgress(stage).total }}
            </span>
          </header>
          <p class="stage__desc">{{ stage.description }}</p>

          <progress
            class="stage__bar"
            :value="stageProgress(stage).passed"
            :max="stageProgress(stage).total"
          ></progress>

          <ul class="levels">
            <li v-for="(level, li) in stage.levels" :key="level.id">
              <button
                class="card"
                :class="cardClass(stage, level)"
                :disabled="!isStageUnlocked(stage.id)"
                :title="tip(level)"
                @click="go(level)"
              >
                <span class="card__no">{{ li + 1 }}</span>
                <span class="card__body">
                  <span class="card__title">{{ level.title }}</span>
                  <span class="card__req">
                    ≥ {{ level.require.speed }} {{ unitOf(level) }} · {{ pct(level.require.accuracy) }}
                  </span>
                  <span class="card__best">
                    <template v-if="levelResult(level.id)">
                      最佳 {{ levelResult(level.id)?.bestSpeed.toFixed(0) }} {{ unitOf(level) }}
                    </template>
                    <template v-else>尚无成绩</template>
                  </span>
                </span>
                <span class="card__badge">{{ badge(stage, level) }}</span>
              </button>
            </li>
          </ul>
        </div>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.map {
  max-width: 900px;
  margin: 0 auto;
}

.map__head {
  margin-bottom: var(--space-5);
}

.map__title {
  font-size: var(--font-xl);
}

.map__sub {
  color: var(--color-text-muted);
  font-size: var(--font-sm);
  margin-top: var(--space-1);
}

.stages {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.stage {
  position: relative;
  display: flex;
  gap: var(--space-4);
}

/* 阶段间连接线 */
.stage:not(:last-child)::after {
  content: '';
  position: absolute;
  left: 21px;
  top: 44px;
  bottom: calc(-1 * var(--space-4));
  width: 2px;
  background: var(--color-border);
}

.stage__badge {
  flex: none;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-weight: 700;
  font-size: var(--font-md);
  background: var(--color-primary);
  color: var(--color-on-primary);
  z-index: 1;
}

.stage--locked .stage__badge {
  background: var(--color-locked);
}

.stage--done .stage__badge {
  background: var(--color-success);
}

.stage__body {
  flex: 1;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  padding: var(--space-4) var(--space-5);
  box-shadow: var(--shadow-sm);
  min-width: 0;
}

.stage--locked .stage__body {
  opacity: 0.6;
}

.stage__head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.stage__title {
  font-size: var(--font-md);
}

.stage__count {
  color: var(--color-primary);
  font-weight: 600;
}

.stage__lock {
  color: var(--color-text-muted);
  font-size: var(--font-sm);
}

.stage__desc {
  color: var(--color-text-muted);
  font-size: var(--font-sm);
  margin: var(--space-1) 0 var(--space-3);
}

.stage__bar {
  width: 100%;
  height: 6px;
  border: none;
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: var(--space-4);
}

progress.stage__bar::-webkit-progress-bar {
  background: var(--color-key-bg);
  border-radius: 3px;
}

progress.stage__bar::-webkit-progress-value {
  background: var(--color-success);
  border-radius: 3px;
}

progress.stage__bar::-moz-progress-bar {
  background: var(--color-success);
  border-radius: 3px;
}

.levels {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(300px, 100%), 1fr));
  gap: var(--space-3);
}

/* 小关卡片 */
.card {
  width: 100%;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  text-align: left;
  transition:
    border-color 0.15s,
    box-shadow 0.15s,
    transform 0.1s,
    background 0.15s;
}

.card:hover:not(:disabled) {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}

.card:active:not(:disabled) {
  transform: translateY(0) scale(0.99);
  box-shadow: var(--shadow-sm);
}

.card:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.card:disabled {
  cursor: not-allowed;
}

.card--passed {
  border-color: var(--sticky-ok-border);
  background: var(--color-success-weak);
}

.card__no {
  flex: none;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-weight: 600;
  font-size: var(--font-sm);
  background: var(--color-primary-weak);
  color: var(--color-primary);
}

.card--passed .card__no {
  background: var(--color-success-weak);
  color: var(--color-success);
}

.card__body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.card__title {
  font-size: var(--font-base);
  font-weight: 600;
  line-height: 1.4;
  color: var(--color-text);
}

.card__req,
.card__best {
  font-size: var(--font-sm);
  color: var(--color-text-muted);
}

.card__badge {
  flex: none;
  font-size: var(--font-sm);
  font-weight: 600;
  color: var(--color-primary);
  white-space: nowrap;
}

.card--passed .card__badge {
  color: var(--color-success);
}

/* 窄屏：单列卡片，压缩阶段留白与徽标，避免横向溢出 */
@media (max-width: 640px) {
  .stage {
    gap: var(--space-3);
  }

  .stage__badge {
    width: 34px;
    height: 34px;
    font-size: var(--font-sm);
  }

  .stage:not(:last-child)::after {
    left: 16px;
    top: 34px;
  }

  .stage__body {
    padding: var(--space-3) var(--space-4);
  }

  .levels {
    grid-template-columns: 1fr;
  }

  .card {
    padding: var(--space-3);
  }
}
</style>
