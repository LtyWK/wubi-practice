<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { loadArticles } from '@/data/loader'
import { useFreeText } from '@/composables/useFreeText'
import type { Article } from '@/types'

const router = useRouter()
const { setFreeText } = useFreeText()

const articles = ref<Article[]>([])
const customTitle = ref('')
const customText = ref('')

onMounted(async () => {
  articles.value = await loadArticles()
})

function startArticle(article: Article): void {
  setFreeText(`《${article.title}》${article.author}`, article.paragraphs.join('\n'))
  router.push('/play/free')
}

function startCustom(): void {
  const text = customText.value.trim()
  if (!text) return
  setFreeText(customTitle.value.trim() || '自定义文本', text)
  router.push('/play/free')
}
</script>

<template>
  <section class="free">
    <h1 class="free__title">自由模式</h1>
    <p class="free__tip">自由练习不影响关卡进度，但会计入单字统计与智能加练。</p>

    <div class="free__grid">
      <section class="card">
        <h2 class="card__title">内置文章</h2>
        <p v-if="articles.length === 0" class="card__empty">文章库为空（运行 pnpm data:build 生成）。</p>
        <ul v-else class="articles">
          <li v-for="article in articles" :key="article.id">
            <button class="article__btn" @click="startArticle(article)">
              <span class="article__name">《{{ article.title }}》</span>
              <span class="article__meta">{{ article.author }} · 难度 {{ article.difficulty }}</span>
            </button>
          </li>
        </ul>
      </section>

      <section class="card">
        <h2 class="card__title">自定义文本</h2>
        <input v-model="customTitle" class="field" type="text" placeholder="标题（可选）" />
        <textarea
          v-model="customText"
          class="field field--area"
          rows="8"
          placeholder="粘贴要练习的文本，例如一段课文或工作常用句子…"
        ></textarea>
        <button class="btn btn--primary" :disabled="!customText.trim()" @click="startCustom">
          开始练习
        </button>
      </section>
    </div>
  </section>
</template>

<style scoped>
.free {
  max-width: 960px;
  margin: 0 auto;
}

.free__title {
  font-size: var(--font-xl);
}

.free__tip {
  color: var(--color-text-muted);
  font-size: var(--font-sm);
  margin: var(--space-2) 0 var(--space-5);
}

.free__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
}

@media (max-width: 768px) {
  .free__grid {
    grid-template-columns: 1fr;
  }
}

.card {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  padding: var(--space-5);
  box-shadow: var(--shadow-sm);
}

.card__title {
  font-size: var(--font-md);
  margin-bottom: var(--space-3);
}

.card__empty {
  color: var(--color-text-muted);
  font-size: var(--font-sm);
}

.articles {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.article__btn {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-key-bg);
  text-align: left;
}

.article__name {
  font-weight: 600;
}

.article__meta {
  color: var(--color-text-muted);
  font-size: var(--font-sm);
}

.field {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-family: inherit;
  font-size: var(--font-base);
  margin-bottom: var(--space-3);
  box-sizing: border-box;
}

.field--area {
  resize: vertical;
  line-height: 1.7;
}

.btn {
  padding: var(--space-2) var(--space-5);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.btn--primary {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: #fff;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
