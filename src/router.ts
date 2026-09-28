import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'level-select',
    component: () => import('./views/LevelSelectView.vue'),
  },
  {
    path: '/zigen/:id',
    name: 'zigen',
    component: () => import('./views/ZigenView.vue'),
  },
  {
    path: '/practice/:id',
    name: 'practice',
    component: () => import('./views/PracticeView.vue'),
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
