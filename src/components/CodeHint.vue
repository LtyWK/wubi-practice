<script setup lang="ts">
import { computed } from 'vue'
import type { HintItem } from '@/schemes/base'

const props = defineProps<{
  char: string
  code: string
  items: HintItem[]
  /** 已接受的输入 */
  input: string
}>()

const codeChars = computed(() => props.code.split(''))
</script>

<template>
  <div class="hint">
    <div class="hint__line">
      <span class="hint__char">{{ props.char }}</span>
      <template v-if="props.items.length">
        <span class="hint__arrow">→</span>
        <span class="hint__roots">
          （{{ props.items.map((it) => it.text).join(' + ') }}）
        </span>
      </template>
      <span class="hint__arrow">→</span>
      <span class="hint__code">
        <span
          v-for="(c, i) in codeChars"
          :key="i"
          class="hint__code-char"
          :class="{ 'hint__code-char--typed': i < props.input.length }"
        >
          {{ c.toUpperCase() }}
        </span>
      </span>
    </div>
  </div>
</template>

<style scoped>
.hint {
  text-align: center;
}

.hint__line {
  display: inline-flex;
  align-items: baseline;
  gap: var(--space-2);
  font-size: var(--font-lg);
  flex-wrap: wrap;
  justify-content: center;
}

.hint__char {
  font-weight: 600;
}

.hint__arrow {
  color: var(--color-text-muted);
}

.hint__code-char {
  font-weight: 700;
  color: var(--color-text);
  letter-spacing: 0.05em;
}

.hint__code-char--typed {
  color: var(--color-success);
}

.hint__roots {
  color: var(--color-text-muted);
  font-size: var(--font-base);
}
</style>
