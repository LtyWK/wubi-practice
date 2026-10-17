<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useLevels } from '@/composables/useLevels'
import { useSave } from '@/composables/useSave'
import type { LevelConfig, StageConfig } from '@/types'

const router = useRouter()
const { stages, isStageUnlocked, isLevelPassed, levelResult, stageProgress, syncUnlocks } =
  useLevels()
const { getTypingProgress, getEndlessBest } = useSave()

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

function isIntro(level: LevelConfig): boolean {
  return level.type === 'intro'
}

/** 是否为跟打器关卡（S4/S5/S6） */
function isTyping(level: LevelConfig): boolean {
  return level.type === 'typing'
}

/** 秒数展示：整数不带小数位，否则保留 1 位（如 10、7.5） */
function secText(seconds: number): string {
  return Number.isInteger(seconds) ? String(seconds) : seconds.toFixed(1)
}

/** climb 关卡进度：总组数、已通关组数、历史最佳组速度 */
interface ClimbProgress {
  total: number
  done: number
  best: number
}

function climbProgress(level: LevelConfig): ClimbProgress {
  const size = level.typing?.groupSize ?? 10
  const total = Math.max(1, Math.ceil(level.length / size))
  const progress = getTypingProgress(level.id)
  const done = Math.min(progress?.groupIndex ?? 0, total)
  const bests = progress?.groupBests ?? []
  const best = bests.reduce((max, v) => (v > max ? v : max), 0)
  return { total, done, best }
}

/** climb 达标要求：每组 N 字 ≤X 秒（由组大小与组速度换算） */
function climbReqText(level: LevelConfig): string {
  const size = level.typing?.groupSize ?? 10
  const speed = level.typing?.groupSpeed ?? 60
  const seconds = speed > 0 ? (size / speed) * 60 : 0
  return `每组 ${size} 字 ≤${secText(seconds)} 秒`
}

/** typing 关规则文案：climb 用组规则，挑战模式按 mode 生成简短标签 */
function typingRuleText(level: LevelConfig): string {
  const cfg = level.typing
  if (!cfg) return ''
  switch (cfg.mode) {
    case 'climb':
      return climbReqText(level)
    case 'sprint': {
      const parts = ['限时冲刺']
      if (cfg.durationSec) parts.push(`限时 ${Math.max(1, Math.round(cfg.durationSec / 60))} 分钟`)
      if (cfg.charTarget) parts.push(`达标 ≥${cfg.charTarget} 字`)
      return parts.join(' · ')
    }
    case 'speedup': {
      const speeds = cfg.speedup ?? []
      return speeds.length > 0 ? `逐段提速 ${speeds.join('→')} 字/分` : '逐段提速'
    }
    case 'marathon':
      return `≥${level.require.speed} 字/分 · 正确率 ≥${pct(level.require.accuracy)}`
    case 'endless': {
      const parts = ['无尽词流']
      if (cfg.charTarget) parts.push(`单局 ≥${cfg.charTarget} 字`)
      if (cfg.errorLimit) parts.push(`错 ${cfg.errorLimit} 次结束`)
      return parts.join(' · ')
    }
    case 'gauntlet': {
      const count = cfg.segments?.length ?? 0
      return count > 0 ? `${count} 段综合测试` : '综合测试'
    }
  }
}

/** typing 关状态文案：climb 组进度与最佳组速度、无尽纪录、其余最佳成绩 */
function typingStatusText(level: LevelConfig): string {
  const cfg = level.typing
  if (cfg?.mode === 'climb') {
    const { total, done, best } = climbProgress(level)
    const bestPart = best > 0 ? `最佳 ${best.toFixed(0)} 字/分` : '未开始'
    return `进度 ${done}/${total} 组 · ${bestPart}`
  }
  if (cfg?.mode === 'endless') {
    const best = getEndlessBest()
    return best > 0 ? `纪录 ${best} 字` : '未开始'
  }
  const result = levelResult(level.id)
  return result ? `最佳 ${result.bestSpeed.toFixed(0)} 字/分` : '未开始'
}

/** 段位徽章文字（仅 typing 关有成绩时展示） */
function rankText(level: LevelConfig): string {
  if (!isTyping(level)) return ''
  return levelResult(level.id)?.rank ?? ''
}

/** 段位徽章样式类：S 金 / A 银 / B 铜 / C 灰 */
function rankClass(level: LevelConfig): string {
  const rank = rankText(level)
  return rank ? `rank rank--${rank.toLowerCase()}` : ''
}

function reqText(level: LevelConfig): string {
  if (isTyping(level)) return typingRuleText(level)
  if (isIntro(level)) return '阅读完毕'
  return `≥ ${level.require.speed} ${unitOf(level)} · ${pct(level.require.accuracy)}`
}

function bestText(level: LevelConfig): string {
  if (isTyping(level)) return typingStatusText(level)
  const best = levelResult(level.id)
  if (!best) return '尚无成绩'
  if (isIntro(level)) return '已阅读'
  return `最佳 ${best.bestSpeed.toFixed(0)} ${unitOf(level)}`
}

/** typing 关卡跳跟打器页面，其余沿用编码练习页面 */
function go(level: LevelConfig): void {
  if (isTyping(level)) {
    router.push(`/typing/${level.id}`)
    return
  }
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
  if (isTyping(level)) {
    const lines = [level.title, typingRuleText(level), typingStatusText(level)]
    if (best?.rank) lines.push(`段位：${best.rank}`)
    return lines.join('\n')
  }
  const req = isIntro(level)
    ? '阅读完毕'
    : `达标：≥ ${level.require.speed} ${unitOf(level)} · ${pct(level.require.accuracy)}`
  if (!best) return `${level.title}\n${req}\n未通关`
  if (isIntro(level)) return `${level.title}\n${req}\n已阅读`
  return `${level.title}\n${req}\n最佳：${best.bestSpeed.toFixed(0)} · ${pct(best.bestAccuracy)}`
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
                  <span class="card__req">{{ reqText(level) }}</span>
                  <progress
                    v-if="isTyping(level) && level.typing?.mode === 'climb'"
                    class="card__bar"
                    :value="climbProgress(level).done"
                    :max="climbProgress(level).total"
                  ></progress>
                  <span class="card__best">{{ bestText(level) }}</span>
                </span>
                <span class="card__side">
                  <span v-if="rankText(level)" :class="rankClass(level)">{{
                    rankText(level)
                  }}</span>
                  <span class="card__badge">{{ badge(stage, level) }}</span>
                </span>
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

/* climb 关卡：组进度条 */
.card__bar {
  width: 100%;
  height: 4px;
  border: none;
  border-radius: 2px;
  overflow: hidden;
  margin: 2px 0;
}

progress.card__bar::-webkit-progress-bar {
  background: var(--color-key-bg);
  border-radius: 2px;
}

progress.card__bar::-webkit-progress-value {
  background: var(--color-primary);
  border-radius: 2px;
}

progress.card__bar::-moz-progress-bar {
  background: var(--color-primary);
  border-radius: 2px;
}

/* 卡片右侧：段位徽章 + 状态文字 */
.card__side {
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

/* 跟打器段位徽章：S 金 / A 银 / B 铜 / C 灰 */
.rank {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: var(--font-sm);
  font-weight: 700;
  line-height: 1;
}

.rank--s {
  background: #d4a017;
  color: #3d2f00;
}

.rank--a {
  background: #aab4bf;
  color: #1f2430;
}

.rank--b {
  background: #9c6239;
  color: #ffffff;
}

.rank--c {
  background: var(--color-key-bg);
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
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
