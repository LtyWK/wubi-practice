<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <div class="app">
    <header class="app-header">
      <div class="app-header__inner">
        <RouterLink to="/" class="app-title">五笔学习</RouterLink>
        <nav class="app-nav">
          <RouterLink to="/">关卡地图</RouterLink>
          <RouterLink to="/free">自由模式</RouterLink>
          <RouterLink to="/appearance">外观</RouterLink>
          <RouterLink to="/settings">存档</RouterLink>
        </nav>
      </div>
    </header>
    <main class="app-main">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-header {
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
  padding: var(--space-3) var(--space-6);
}

/* 导航居中，容器边界与练习页文字/键盘卡片对齐 */
.app-header__inner {
  position: relative;
  max-width: 1000px;
  margin: 0 auto;
  min-height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.app-title {
  position: absolute;
  left: 0;
  font-size: var(--font-lg);
  font-weight: 600;
  color: var(--color-text);
  text-decoration: none;
}

.app-nav {
  display: flex;
  gap: var(--space-5);
}

.app-nav a {
  color: var(--color-text-muted);
  text-decoration: none;
  font-size: var(--font-base);
}

.app-nav a.router-link-exact-active {
  color: var(--color-primary);
  font-weight: 600;
}

.app-main {
  flex: 1;
  padding: var(--space-6);
}

/* 窄屏：标题与导航换行排布，避免重叠 */
@media (max-width: 760px) {
  .app-header__inner {
    flex-direction: column;
    gap: var(--space-2);
  }

  .app-title {
    position: static;
  }
}
</style>
