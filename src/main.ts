import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { useUiSettings } from './composables/useUiSettings'
import './style.css'

// 初始化主题（跟随系统 / 浅色 / 深色）
useUiSettings()

createApp(App).use(router).mount('#app')
