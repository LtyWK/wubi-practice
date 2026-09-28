import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'map',
    component: () => import('./views/LevelSelectView.vue'),
  },
  {
    path: '/play/:id',
    name: 'play',
    component: () => import('./views/PlayView.vue'),
  },
  {
    path: '/free',
    name: 'free',
    component: () => import('./views/FreeView.vue'),
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('./views/SettingsView.vue'),
  },
  {
    path: '/zigen/:id',
    redirect: (to) => `/play/${String(to.params.id)}`,
  },
  {
    path: '/practice/:id',
    redirect: (to) => `/play/${String(to.params.id)}`,
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

export default router
