<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <div class="app">
    <header class="app-header">
      <RouterLink to="/" class="app-title">五笔学习</RouterLink>
      <nav class="app-nav">
        <RouterLink to="/">关卡地图</RouterLink>
        <RouterLink to="/free">自由模式</RouterLink>
        <RouterLink to="/settings">存档</RouterLink>
      </nav>
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
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-6);
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
}

.app-title {
  font-size: var(--font-lg);
  font-weight: 600;
  color: var(--color-text);
  text-decoration: none;
}

.app-nav {
  display: flex;
  gap: var(--space-4);
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
</style>
