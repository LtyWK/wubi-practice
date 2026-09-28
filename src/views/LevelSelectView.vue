<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { LEVELS } from '@/data/levels'
import { useProgress } from '@/composables/useProgress'

const router = useRouter()
const { isUnlocked, unlock, bestOf } = useProgress()

onMounted(() => {
  const first = LEVELS[0]
  if (first) unlock(first.id)
})

function go(id: string, type: 'zigen' | 'danzi'): void {
  router.push(type === 'zigen' ? `/zigen/${id}` : `/practice/${id}`)
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`
}
</script>

<template>
  <section class="levels">
    <h1 class="levels__title">关卡选择</h1>
    <ul class="levels__list">
      <li
        v-for="(level, i) in LEVELS"
        :key="level.id"
        class="level"
        :class="{ 'level--locked': !isUnlocked(level.id) }"
      >
        <button
          class="level__btn"
          :disabled="!isUnlocked(level.id)"
          @click="go(level.id, level.type)"
        >
          <span class="level__no">{{ i + 1 }}</span>
          <span class="level__body">
            <span class="level__name">{{ level.title }}</span>
            <span class="level__req">
              达标：≥ {{ level.require.speed }} 字/分 · ≥ {{ pct(level.require.accuracy) }}
            </span>
          </span>
          <span class="level__best">
            <template v-if="bestOf(level.id)">
              最佳 {{ bestOf(level.id)?.speed.toFixed(0) }} 字/分 ·
              {{ pct(bestOf(level.id)?.accuracy ?? 0) }}
            </template>
            <template v-else>最佳 —</template>
          </span>
          <span class="level__state">{{ isUnlocked(level.id) ? '开始' : '未解锁' }}</span>
        </button>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.levels {
  max-width: 760px;
  margin: 0 auto;
}

.levels__title {
  font-size: var(--font-xl);
  margin-bottom: var(--space-5);
}

.levels__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.level__btn {
  width: 100%;
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
  text-align: left;
}

.level--locked .level__btn {
  opacity: 0.55;
  cursor: not-allowed;
}

.level__no {
  flex: none;
  width: 2rem;
  height: 2rem;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(--color-primary-weak);
  color: var(--color-primary);
  font-weight: 600;
}

.level__body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.level__name {
  font-size: var(--font-md);
  font-weight: 600;
}

.level__req {
  color: var(--color-text-muted);
  font-size: var(--font-sm);
}

.level__best {
  color: var(--color-text-muted);
  font-size: var(--font-sm);
  white-space: nowrap;
}

.level__state {
  flex: none;
  color: var(--color-primary);
  font-weight: 600;
  font-size: var(--font-sm);
}
</style>
