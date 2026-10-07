<script setup lang="ts">
const props = defineProps<{
  /** 教学关标题 */
  title: string
  /** 正文段落 */
  paragraphs: string[]
}>()

const emit = defineEmits<{ (e: 'done'): void }>()
</script>

<template>
  <section class="intro">
    <header class="intro__head">
      <span class="intro__tag">教学关</span>
      <h1 class="intro__title">{{ props.title }}</h1>
    </header>

    <div class="intro__body">
      <p v-for="(p, i) in props.paragraphs" :key="i" class="intro__p">{{ p }}</p>
    </div>

    <footer class="intro__foot">
      <button class="btn btn--primary" @click="emit('done')">已阅读，返回关卡</button>
    </footer>
  </section>
</template>

<style scoped>
.intro {
  max-width: 760px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.intro__head {
  display: flex;
  align-items: baseline;
  gap: var(--space-3);
}

.intro__tag {
  flex: none;
  padding: 2px 10px;
  border-radius: var(--radius-sm);
  background: var(--color-primary-weak);
  color: var(--color-primary);
  font-size: var(--font-sm);
  font-weight: 600;
}

.intro__title {
  font-size: var(--font-lg);
}

.intro__body {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  padding: var(--space-5) var(--space-6);
  box-shadow: var(--shadow-sm);
}

.intro__p {
  margin: 0 0 var(--space-3);
  line-height: 1.9;
  color: var(--color-text);
}

.intro__p:last-child {
  margin-bottom: 0;
}

.intro__foot {
  display: flex;
  justify-content: flex-end;
}

.btn {
  padding: var(--space-2) var(--space-5);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text);
}

.btn--primary {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: var(--color-on-primary);
}
</style>
