/**
 * 字根标注器：把字体私有区字形分配到 25 个字母键，导出键盘渲染配置。
 *
 * 交互：左侧选键 → 中间点卡片分配（再点取消，点其他键的卡片=移入当前键）
 * 数据来自 data/wubi86.js、data/wubi98.js（scripts/build-data.py 生成）
 */
(() => {
  'use strict'

  /** 键位顺序（横竖撇捺折） */
  const KEY_ORDER = 'gfdsahjklmtrewqyuiopnbvcx'.split('')

  /** 键名字根（86/98 相同） */
  const KEY_NAMES = {
    g: '王', f: '土', d: '大', s: '木', a: '工',
    h: '目', j: '日', k: '口', l: '田', m: '山',
    t: '禾', r: '白', e: '月', w: '人', q: '金',
    y: '言', u: '立', i: '水', o: '火', p: '之',
    n: '已', b: '子', v: '女', c: '又', x: '纟',
  }

  /** 一级简码（86/98 相同） */
  const KEY_SHORT1 = {
    g: '一', f: '地', d: '在', s: '要', a: '工',
    h: '上', j: '是', k: '中', l: '国', m: '同',
    t: '和', r: '的', e: '有', w: '人', q: '我',
    y: '主', u: '产', i: '不', o: '为', p: '这',
    n: '民', b: '了', v: '发', c: '以', x: '经',
  }

  /** 五区色相（横绿 / 竖蓝 / 撇橙 / 捺紫 / 折青） */
  const AREA_HUE = {}
  const AREAS = [
    ['g', 'f', 'd', 's', 'a', 145],
    ['h', 'j', 'k', 'l', 'm', 212],
    ['t', 'r', 'e', 'w', 'q', 32],
    ['y', 'u', 'i', 'o', 'p', 282],
    ['n', 'b', 'v', 'c', 'x', 188],
  ]
  for (const area of AREAS) {
    const hue = area[area.length - 1]
    for (const k of area.slice(0, 5)) AREA_HUE[k] = hue
  }

  const STORAGE_STATE = (scheme) => `roottagger.v1.${scheme}`
  const STORAGE_SCHEME = 'roottagger.v1.scheme'

  const $ = (id) => document.getElementById(id)

  const els = {
    schemeTabs: $('schemeTabs'),
    progress: $('progress'),
    keyList: $('keyList'),
    layoutPanel: $('layoutPanel'),
    cardPool: $('cardPool'),
    cardCount: $('cardCount'),
    selectedRoots: $('selectedRoots'),
    currentKeyLabel: $('currentKeyLabel'),
    selectedCount: $('selectedCount'),
    infoGlyph: $('infoGlyph'),
    infoMeta: $('infoMeta'),
    chkSuggest: $('chkSuggest'),
    chkUnassigned: $('chkUnassigned'),
    chkHideIdent: $('chkHideIdent'),
    chkShowBlank: $('chkShowBlank'),
    search: $('search'),
    fileInput: $('fileInput'),
    sizeTabs: $('sizeTabs'),
    layoutGrid: $('layoutGrid'),
    layoutCount: $('layoutCount'),
    keycapLetter: $('keycapLetter'),
    keycapName: $('keycapName'),
    btnAutoFill: $('btnAutoFill'),
    btnClearLayout: $('btnClearLayout'),
    btnExportLayout: $('btnExportLayout'),
    btnSuggest: $('btnSuggest'),
    btnClear: $('btnClear'),
    btnImport: $('btnImport'),
    btnExport: $('btnExport'),
    markMenu: $('markMenu'),
    debugLog: $('debugLog'),
  }

  const state = {
    scheme: 'wubi98',
    currentKey: 'g',
    /** cp -> key */
    assign: new Map(),
    /** key -> cp[]（导出顺序） */
    order: new Map(),
    /** key -> { size: 4|5, cells: (null | { cp, bold, mark })[] }
     *  mark: null | 'red' | 'green'（标记类型，实际渲染色值由消费方按主题决定） */
    layout: new Map(),
  }

  let saveTimer
  /** 右键标记菜单的当前目标 { key, index } */
  let markMenuTarget = null
  /** 当前拖拽数据（内存传递，不依赖 dataTransfer.getData，规避部分浏览器数据丢失） */
  let dragPayload = null

  /** 读取拖拽数据：优先内存，回退 dataTransfer */
  function readDragPayload(e) {
    if (dragPayload) return dragPayload
    try {
      return JSON.parse(e.dataTransfer.getData('text/plain'))
    } catch {
      return null
    }
  }

  /** 写入拖拽数据：内存 + dataTransfer（后者用于拖拽行为兼容） */
  function writeDragPayload(e, payload) {
    dragPayload = payload
    try {
      e.dataTransfer.setData('text/plain', JSON.stringify(payload))
      e.dataTransfer.effectAllowed = 'move'
    } catch {
      /* 忽略 */
    }
  }

  // ---------- 调试日志 ----------

  /** 日志浮层开关（按 ` 切换；URL 加 ?debug 默认开启） */
  let debugOn = false
  try {
    debugOn = new URLSearchParams(location.search).has('debug')
  } catch {
    /* 忽略 */
  }
  const logLines = []

  /** 记录调试日志：console + window.__rtLog + 浮层 */
  function rtLog(...args) {
    const line =
      new Date().toLocaleTimeString('zh-CN', { hour12: false }) +
      ' ' +
      args.map((a) => (typeof a === 'object' && a !== null ? JSON.stringify(a) : String(a))).join(' ')
    logLines.push(line)
    if (logLines.length > 200) logLines.shift()
    window.__rtLog = logLines
    console.log('[RT]', ...args)
    if (debugOn) renderDebugLog()
  }

  function renderDebugLog() {
    if (!els.debugLog) return
    els.debugLog.hidden = !debugOn
    if (debugOn) {
      els.debugLog.textContent = logLines.slice(-40).join('\n')
      els.debugLog.scrollTop = els.debugLog.scrollHeight
    }
  }

  function toggleDebug() {
    debugOn = !debugOn
    renderDebugLog()
    rtLog(debugOn ? '调试日志已开启（再次按 ` 关闭）' : '调试日志已关闭')
  }

  // ---------- 工具函数 ----------

  function keyColor(k) {
    return `hsl(${AREA_HUE[k] ?? 210} 45% 40%)`
  }

  function keyColorBg(k) {
    return `hsl(${AREA_HUE[k] ?? 210} 60% 94%)`
  }

  function cpHex(cp) {
    return cp.toString(16).toUpperCase()
  }

  function currentData() {
    return window.RT_DATA?.[state.scheme]
  }

  function currentCards() {
    return currentData()?.cards ?? []
  }

  let cardIndex = null
  let cardIndexScheme = null

  function cardMap() {
    if (cardIndexScheme !== state.scheme) {
      cardIndex = new Map(currentCards().map((c) => [c.cp, c]))
      cardIndexScheme = state.scheme
    }
    return cardIndex
  }

  function download(filename, text) {
    const blob = new Blob([text], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  // ---------- 布局数据 ----------

  /** 取当前键布局（懒创建，默认 5×5 空矩阵） */
  function getLayout(key) {
    let lo = state.layout.get(key)
    if (!lo) {
      lo = { size: 5, cells: new Array(25).fill(null) }
      state.layout.set(key, lo)
    }
    return lo
  }

  /** 从布局中移除指定字根（所有出现位置） */
  function removeCpFromLayout(key, cp) {
    const lo = state.layout.get(key)
    if (!lo) return
    let changed = false
    lo.cells = lo.cells.map((c) => {
      if (c && c.cp === cp) {
        changed = true
        return null
      }
      return c
    })
    if (changed) return true
    return false
  }

  function serializeLayout() {
    const out = {}
    for (const [k, lo] of state.layout) {
      out[k] = {
        size: lo.size,
        cells: lo.cells.map((c) => (c ? { cp: c.cp, bold: !!c.bold, mark: c.mark ?? null } : null)),
      }
    }
    return out
  }

  function deserializeLayout(obj) {
    const map = new Map()
    const cmap = cardMap()
    for (const [k, lo] of Object.entries(obj ?? {})) {
      if (!KEY_ORDER.includes(k) || !lo) continue
      const size = lo.size === 4 ? 4 : 5
      const cells = new Array(size * size).fill(null)
      if (Array.isArray(lo.cells)) {
        lo.cells.slice(0, size * size).forEach((c, i) => {
          if (!c) return
          const cp =
            typeof c.cp === 'number' ? c.cp : typeof c.cp === 'string' ? c.cp.codePointAt(0) : NaN
          if (Number.isFinite(cp) && cmap.has(cp)) {
            const mark = c.mark === 'red' || c.mark === 'green' ? c.mark : null
            cells[i] = { cp, bold: !!c.bold, mark }
          }
        })
      }
      map.set(k, { size, cells })
    }
    return map
  }

  // ---------- 状态存取 ----------

  function saveState() {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      try {
        const payload = {
          assign: Object.fromEntries(state.assign),
          order: Object.fromEntries(state.order),
          layout: serializeLayout(),
        }
        localStorage.setItem(STORAGE_STATE(state.scheme), JSON.stringify(payload))
      } catch {
        /* 忽略写入失败 */
      }
    }, 150)
  }

  function readState(scheme) {
    try {
      const raw = localStorage.getItem(STORAGE_STATE(scheme))
      if (!raw) return null
      const data = JSON.parse(raw)
      if (!data || typeof data !== 'object') return null
      const cmap = new Map((window.RT_DATA?.[scheme]?.cards ?? []).map((c) => [c.cp, c]))
      const assign = new Map()
      const order = new Map(KEY_ORDER.map((k) => [k, []]))
      for (const [cpStr, k] of Object.entries(data.assign ?? {})) {
        const cp = Number(cpStr)
        if (KEY_ORDER.includes(k) && cmap.has(cp)) assign.set(cp, k)
      }
      for (const k of KEY_ORDER) {
        for (const cp of data.order?.[k] ?? []) {
          if (assign.get(cp) === k && !order.get(k).includes(cp)) order.get(k).push(cp)
        }
      }
      for (const [cp, k] of assign) {
        if (!order.get(k).includes(cp)) order.get(k).push(cp)
      }
      const layout = deserializeLayout(data.layout)
      return { assign, order, layout }
    } catch {
      return null
    }
  }

  /** 按统计建议预填（排除空白与识别码） */
  function applySuggest() {
    state.assign = new Map()
    state.order = new Map(KEY_ORDER.map((k) => [k, []]))
    for (const c of currentCards()) {
      if (c.blank || c.identLikely || !c.suggestKey) continue
      if (!KEY_ORDER.includes(c.suggestKey)) continue
      state.assign.set(c.cp, c.suggestKey)
      state.order.get(c.suggestKey).push(c.cp)
    }
  }

  // ---------- 渲染 ----------

  function renderSchemeTabs() {
    els.schemeTabs.innerHTML = ''
    for (const scheme of Object.keys(window.RT_DATA ?? {})) {
      const btn = document.createElement('button')
      btn.textContent = window.RT_DATA[scheme].label ?? scheme
      if (scheme === state.scheme) btn.classList.add('active')
      btn.addEventListener('click', () => {
        if (scheme === state.scheme) return
        loadScheme(scheme)
      })
      els.schemeTabs.appendChild(btn)
    }
  }

  function renderKeyList() {
    els.keyList.innerHTML = ''
    for (const k of KEY_ORDER) {
      const li = document.createElement('li')
      li.style.setProperty('--kc', keyColor(k))
      li.style.setProperty('--kc-bg', keyColorBg(k))
      if (k === state.currentKey) li.classList.add('active')
      const count = state.order.get(k)?.length ?? 0
      li.innerHTML =
        `<span class="k-letter">${k.toUpperCase()}</span>` +
        `<span class="k-name">${KEY_NAMES[k]}</span>` +
        `<span class="k-count">${count}</span>`
      li.addEventListener('click', () => {
        closeMarkMenu()
        state.currentKey = k
        renderAll()
      })
      els.keyList.appendChild(li)
    }
  }

  function matchCard(c, query) {
    if (cpHex(c.cp).toLowerCase().includes(query)) return true
    if (c.text && c.text.toLowerCase().includes(query)) return true
    if (c.examples?.some((ch) => ch.includes(query))) return true
    return false
  }

  function cardEl(c) {
    const assignedKey = state.assign.get(c.cp)
    const el = document.createElement('div')
    el.className = 'card'
    el.dataset.cp = String(c.cp)
    if (c.blank) el.classList.add('blank')
    if (c.identLikely) el.classList.add('ident')
    if (c.suggestKey) {
      el.classList.add('suggest')
      if (c.suggestKey === state.currentKey) el.classList.add('suggest-hit')
      const sug = document.createElement('span')
      sug.className = 'sug'
      sug.textContent = c.suggestKey
      el.appendChild(sug)
    }
    if (assignedKey) {
      el.classList.add('assigned')
      el.dataset.assign = assignedKey
      el.style.setProperty('--kc', keyColor(assignedKey))
      el.style.setProperty('--kc-bg', keyColorBg(assignedKey))
    }
    const glyph = document.createElement('span')
    glyph.className = 'glyph'
    glyph.textContent = c.blank ? '∅' : String.fromCodePoint(c.cp)
    el.appendChild(glyph)
    const cpEl = document.createElement('span')
    cpEl.className = 'cp'
    cpEl.textContent = cpHex(c.cp)
    el.appendChild(cpEl)
    if (!c.blank) {
      el.draggable = true
      el.addEventListener('click', () => toggleCard(c.cp))
      el.addEventListener('mouseenter', () => showInfo(c))
      el.addEventListener('dragstart', (e) => {
        rtLog('⬛ dragstart 卡片池', { cp: c.cp })
        writeDragPayload(e, { from: 'pool', cp: c.cp })
      })
    }
    return el
  }

  function renderPool() {
    const frag = document.createDocumentFragment()
    const query = els.search.value.trim().toLowerCase()
    let shown = 0
    for (const c of currentCards()) {
      if (c.blank && !els.chkShowBlank.checked) continue
      if (c.identLikely && els.chkHideIdent.checked) continue
      if (els.chkSuggest.checked && c.suggestKey !== state.currentKey) continue
      if (els.chkUnassigned.checked && state.assign.has(c.cp)) continue
      if (query && !matchCard(c, query)) continue
      frag.appendChild(cardEl(c))
      shown++
    }
    els.cardPool.innerHTML = ''
    els.cardPool.appendChild(frag)
    els.cardCount.textContent = `显示 ${shown} 张`
  }

  function renderSelected() {
    els.currentKeyLabel.textContent = state.currentKey.toUpperCase()
    const list = state.order.get(state.currentKey) ?? []
    els.selectedCount.textContent = String(list.length)
    els.selectedRoots.innerHTML = ''
    const lo = state.layout.get(state.currentKey)
    const placedSet = new Set(lo ? lo.cells.filter(Boolean).map((c) => c.cp) : [])
    list.forEach((cp, i) => {
      const li = document.createElement('li')
      li.draggable = true
      li.dataset.cp = String(cp)
      li.style.setProperty('--kc', keyColor(state.currentKey))
      if (placedSet.has(cp)) li.classList.add('placed')
      const idx = document.createElement('span')
      idx.className = 'idx'
      idx.textContent = String(i + 1)
      const glyph = document.createElement('span')
      glyph.className = 'glyph'
      glyph.textContent = String.fromCodePoint(cp)
      const cpEl = document.createElement('span')
      cpEl.className = 'cp'
      cpEl.textContent = cpHex(cp)
      const dot = document.createElement('span')
      if (placedSet.has(cp)) {
        dot.className = 'placed-dot'
        dot.title = '已放入矩阵'
      }
      const rm = document.createElement('button')
      rm.className = 'remove'
      rm.textContent = '×'
      rm.title = '移出当前键'
      rm.addEventListener('click', (e) => {
        e.stopPropagation()
        removeCp(cp)
      })
      li.append(idx, glyph, cpEl, dot, rm)
      li.addEventListener('dragstart', (e) => {
        rtLog('⬛ dragstart 列表项', { cp, key: state.currentKey })
        writeDragPayload(e, { from: 'list', cp })
        li.classList.add('dragging')
      })
      li.addEventListener('dragend', () => li.classList.remove('dragging'))
      li.addEventListener('dragover', (e) => {
        e.preventDefault()
        li.classList.add('drop-target')
      })
      li.addEventListener('dragleave', () => li.classList.remove('drop-target'))
      li.addEventListener('drop', (e) => {
        li.classList.remove('drop-target')
        const payload = readDragPayload(e)
        if (payload?.from === 'list') {
          e.preventDefault()
          e.stopPropagation()
          reorderCp(payload.cp, cp)
        }
        // 来自矩阵格子：冒泡给列表容器处理（拖出移除）
      })
      els.selectedRoots.appendChild(li)
    })
  }

  function renderProgress() {
    const target = currentCards().filter((c) => !c.blank && !c.identLikely)
    const done = target.filter((c) => state.assign.has(c.cp)).length
    els.progress.textContent = `已分配 ${done} / ${target.length}`
  }

  /** 布局编辑：键帽矩阵渲染 */
  function renderLayout() {
    const lo = getLayout(state.currentKey)
    els.keycapLetter.textContent = state.currentKey.toUpperCase()
    els.keycapName.textContent = KEY_NAMES[state.currentKey] ?? ''
    els.layoutGrid.dataset.size = String(lo.size)
    els.layoutGrid.style.gridTemplateColumns = `repeat(${lo.size}, 1fr)`
    els.layoutGrid.innerHTML = ''
    lo.cells.forEach((cell, i) => {
      const el = document.createElement('div')
      el.className = 'cell'
      el.dataset.index = String(i)
      if (cell) {
        el.classList.add('filled')
        if (cell.bold) el.classList.add('bold')
        if (cell.mark) el.classList.add(`mark-${cell.mark}`)
        el.draggable = true
        el.dataset.cp = String(cell.cp)
        el.title = `U+${cpHex(cell.cp)}（右键标记）`
        const glyph = document.createElement('span')
        glyph.className = 'glyph'
        glyph.textContent = String.fromCodePoint(cell.cp)
        el.appendChild(glyph)
        el.addEventListener('dragstart', (e) => {
          rtLog('⬛ dragstart 格子', { index: i, cp: cell.cp })
          writeDragPayload(e, { from: 'cell', index: i, cp: cell.cp })
        })
        el.addEventListener('mouseenter', () => showInfo(cardMap().get(cell.cp)))
        el.addEventListener('contextmenu', (e) => {
          e.preventDefault()
          e.stopPropagation()
          openMarkMenu(e.clientX, e.clientY, i)
        })
      }
      el.addEventListener('dragover', (e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        el.classList.add('drag-over')
      })
      el.addEventListener('dragleave', () => el.classList.remove('drag-over'))
      el.addEventListener('drop', (e) => {
        e.preventDefault()
        el.classList.remove('drag-over')
        handleCellDrop(i, e)
      })
      els.layoutGrid.appendChild(el)
    })
    const placed = lo.cells.filter(Boolean).length
    els.layoutCount.textContent = `已放置 ${placed} 个`
    for (const btn of els.sizeTabs.querySelectorAll('button')) {
      btn.classList.toggle('active', Number(btn.dataset.size) === lo.size)
    }
  }

  function renderAll() {
    renderKeyList()
    renderPool()
    renderSelected()
    renderProgress()
    renderLayout()
  }

  // ---------- 布局交互 ----------

  /** 矩阵格子放置：列表拖入 / 格子间交换 */
  function handleCellDrop(index, e) {
    const payload = readDragPayload(e)
    const cp = typeof payload?.cp === 'number' ? payload.cp : Number(payload?.cp)
    if (!payload || !Number.isFinite(cp)) {
      rtLog('❌ drop payload 无效', { payload, dt: e.dataTransfer?.getData('text/plain') })
      return
    }
    const lo = getLayout(state.currentKey)
    rtLog('📥 handleCellDrop', {
      from: payload.from,
      cp,
      index,
      size: lo.size,
      来源: dragPayload ? '内存' : 'dataTransfer',
    })
    if (payload.from === 'cell') {
      if (payload.index === index) {
        rtLog('（拖回原格，忽略）')
        return
      }
      const a = lo.cells[payload.index] ?? null
      const b = lo.cells[index] ?? null
      lo.cells[index] = a
      lo.cells[payload.index] = b
      rtLog('🔁 格子交换', { 源格: a?.cp ?? null, 目标格: b?.cp ?? null })
    } else if (payload.from === 'list' || payload.from === 'pool') {
      // 卡片池来源：先把字根归入当前键（若属于其他键则移过来）
      if (payload.from === 'pool') {
        const cur = state.assign.get(cp)
        if (cur && cur !== state.currentKey) {
          state.order.set(cur, state.order.get(cur).filter((x) => x !== cp))
          removeCpFromLayout(cur, cp)
          rtLog('📎 卡片池来源：从其他键移入', { from: cur, to: state.currentKey })
        }
        if (cur !== state.currentKey) {
          state.assign.set(cp, state.currentKey)
          state.order.get(state.currentKey).push(cp)
        }
      }
      const old = lo.cells[index]
      removeCpFromLayout(state.currentKey, cp)
      lo.cells[index] = { cp, bold: old ? old.bold : false, mark: old?.mark ?? null }
      if (old && old.cp !== cp) {
        flashMessage(`已替换：U+${cpHex(old.cp)} 移回列表（未放置），可继续拖拽替换或调整矩阵尺寸`)
        rtLog('🔀 替换', { 移出: old.cp, 放入: cp })
      } else {
        rtLog('➕ 放入', { cp, index, 来源: payload.from })
      }
    } else {
      rtLog('⚠️ 未知来源', payload.from)
      return
    }
    saveState()
    renderLayout()
    renderSelected()
    renderProgress()
  }

  function setLayoutSize(size) {
    const lo = getLayout(state.currentKey)
    if (lo.size === size) return
    const oldSize = lo.size
    const next = new Array(size * size).fill(null)
    let dropped = 0
    for (let r = 0; r < oldSize; r++) {
      for (let c = 0; c < oldSize; c++) {
        const cell = lo.cells[r * oldSize + c]
        if (!cell) continue
        if (r < size && c < size) next[r * size + c] = cell
        else dropped++
      }
    }
    if (dropped > 0 && !confirm(`切换到 ${size}×${size} 将移除放不下的 ${dropped} 个字根，继续？`)) {
      renderLayout()
      return
    }
    lo.size = size
    lo.cells = next
    saveState()
    renderLayout()
    renderSelected()
    renderProgress()
  }

  function autoFillLayout() {
    const lo = getLayout(state.currentKey)
    const list = state.order.get(state.currentKey) ?? []
    const total = lo.size * lo.size
    const cells = new Array(total).fill(null)
    list.slice(0, total).forEach((cp, i) => {
      cells[i] = { cp, bold: false, mark: null }
    })
    lo.cells = cells
    saveState()
    renderLayout()
    renderSelected()
    renderProgress()
    if (list.length > total) {
      flashMessage(
        `当前键有 ${list.length} 个字根，超出 ${total} 格：已填入前 ${total} 个，其余 ${list.length - total} 个可从列表拖入替换，或切换更大矩阵`,
      )
    } else {
      flashMessage(`已按列表顺序填充 ${list.length} 个字根`)
    }
  }

  function clearLayout() {
    if (!confirm('清空当前键的布局？')) return
    const lo = getLayout(state.currentKey)
    lo.cells = new Array(lo.size * lo.size).fill(null)
    saveState()
    renderLayout()
    renderSelected()
    renderProgress()
  }

  function exportLayout() {
    const layouts = {}
    for (const k of KEY_ORDER) {
      const lo = state.layout.get(k)
      if (!lo) continue
      layouts[k] = {
        size: lo.size,
        cells: lo.cells.map((c) =>
          c ? { cp: String.fromCodePoint(c.cp), bold: !!c.bold, mark: c.mark ?? null } : null,
        ),
      }
    }
    const payload = {
      scheme: state.scheme,
      label: currentData()?.label ?? state.scheme,
      layouts,
    }
    download(`${state.scheme}-layout.json`, JSON.stringify(payload, null, 2))
  }

  // ---------- 右键标记菜单 ----------

  function openMarkMenu(x, y, index) {
    markMenuTarget = { key: state.currentKey, index }
    updateMarkMenuState()
    els.markMenu.hidden = false
    const rect = els.markMenu.getBoundingClientRect()
    const left = Math.max(8, Math.min(x, window.innerWidth - rect.width - 8))
    const top = Math.max(8, Math.min(y, window.innerHeight - rect.height - 8))
    els.markMenu.style.left = `${left}px`
    els.markMenu.style.top = `${top}px`
  }

  function closeMarkMenu() {
    markMenuTarget = null
    els.markMenu.hidden = true
  }

  function updateMarkMenuState() {
    if (!markMenuTarget) return
    const lo = state.layout.get(markMenuTarget.key)
    const cell = lo?.cells[markMenuTarget.index]
    if (!cell) return
    for (const btn of els.markMenu.querySelectorAll('button')) {
      const act = btn.dataset.act
      const active =
        act === 'bold' ? !!cell.bold : act === 'red' ? cell.mark === 'red' : cell.mark === 'green'
      btn.classList.toggle('active', active)
    }
  }

  /** 应用菜单动作（toggle），菜单保持打开便于组合标记 */
  function applyMarkAction(act) {
    if (!markMenuTarget) return
    const lo = state.layout.get(markMenuTarget.key)
    const cell = lo?.cells[markMenuTarget.index]
    if (!cell) return
    if (act === 'bold') cell.bold = !cell.bold
    else if (act === 'red') cell.mark = cell.mark === 'red' ? null : 'red'
    else if (act === 'green') cell.mark = cell.mark === 'green' ? null : 'green'
    saveState()
    renderLayout()
    renderSelected()
    updateMarkMenuState()
  }

  // ---------- 交互 ----------

  function toggleCard(cp) {
    const cur = state.assign.get(cp)
    const k = state.currentKey
    if (cur === k) {
      state.assign.delete(cp)
      state.order.set(k, state.order.get(k).filter((x) => x !== cp))
      removeCpFromLayout(k, cp)
    } else {
      if (cur) {
        state.order.set(cur, state.order.get(cur).filter((x) => x !== cp))
        removeCpFromLayout(cur, cp)
      }
      state.assign.set(cp, k)
      state.order.get(k).push(cp)
    }
    saveState()
    renderKeyList()
    renderPool()
    renderSelected()
    renderProgress()
    renderLayout()
    showInfo(cardMap().get(cp))
  }

  function removeCp(cp) {
    state.assign.delete(cp)
    const k = state.currentKey
    state.order.set(k, state.order.get(k).filter((x) => x !== cp))
    removeCpFromLayout(k, cp)
    saveState()
    renderKeyList()
    renderPool()
    renderSelected()
    renderProgress()
    renderLayout()
  }

  function reorderCp(cp, beforeCp) {
    rtLog('↕ 列表排序', { cp, before: beforeCp })
    const list = state.order.get(state.currentKey)
    if (!list || cp === beforeCp) return
    const next = list.filter((x) => x !== cp)
    const idx = next.indexOf(beforeCp)
    if (idx < 0) return
    next.splice(idx, 0, cp)
    state.order.set(state.currentKey, next)
    saveState()
    renderSelected()
  }

  /** 底部信息栏提示（非阻塞） */
  function flashMessage(text) {
    els.infoGlyph.textContent = ''
    els.infoMeta.innerHTML = text
  }

  function showInfo(c) {
    if (!c) return
    els.infoGlyph.textContent = c.blank ? '' : String.fromCodePoint(c.cp)
    const parts = [`<b>U+${cpHex(c.cp)}</b>`]
    if (c.text) parts.push(`文本「${c.text}」`)
    if (c.examples?.length) parts.push(`例字「${c.examples.join('')}」`)
    const votes = Object.entries(c.votes ?? {})
      .slice(0, 6)
      .map(([k, n]) => `${k.toUpperCase()}:${n}`)
      .join(' ')
    if (votes) parts.push(`投票 ${votes}`)
    if (c.suggestKey) parts.push(`建议 ${c.suggestKey.toUpperCase()}`)
    const assigned = state.assign.get(c.cp)
    if (assigned) parts.push(`当前归属 <b>${assigned.toUpperCase()}</b>`)
    if (c.identLikely) parts.push('识别码字形')
    if (c.blank) parts.push('空白字形（不参与）')
    els.infoMeta.innerHTML = parts.join(' ｜ ')
  }

  // ---------- 方案加载 ----------

  function loadScheme(scheme) {
    closeMarkMenu()
    state.scheme = scheme
    try {
      localStorage.setItem(STORAGE_SCHEME, scheme)
    } catch {
      /* 忽略 */
    }
    state.currentKey = 'g'
    const saved = readState(scheme)
    if (saved) {
      state.assign = saved.assign
      state.order = saved.order
      state.layout = saved.layout
    } else {
      state.layout = new Map()
      applySuggest()
      saveState()
    }
    document.body.className = `scheme-${scheme}`
    renderSchemeTabs()
    renderAll()
    els.infoMeta.textContent = '点击卡片进行分配；无输入框焦点时按 A-Y 可快速切换当前键'
    els.infoGlyph.textContent = ''
  }

  // ---------- 导入导出 ----------

  function exportJson() {
    const roots = {}
    for (const k of KEY_ORDER) {
      roots[k] = (state.order.get(k) ?? []).map((cp) => String.fromCodePoint(cp))
    }
    const payload = {
      scheme: state.scheme,
      label: currentData()?.label ?? state.scheme,
      names: KEY_NAMES,
      short1: KEY_SHORT1,
      roots,
    }
    download(`${state.scheme}-zigen.json`, JSON.stringify(payload, null, 2))
  }

  /** 导入布局配置：仅保留仍属于对应键的字根 */
  function importLayout(data) {
    const map = deserializeLayout(data.layouts)
    if (map.size === 0) throw new Error('layouts 为空')
    state.layout = map
    for (const [k, lo] of state.layout) {
      lo.cells = lo.cells.map((c) => (c && state.assign.get(c.cp) === k ? c : null))
    }
    saveState()
    renderAll()
    els.infoMeta.textContent = `布局导入完成：${map.size} 个键`
  }

  function importJson(text) {
    const data = JSON.parse(text)
    if (data && typeof data.layouts === 'object' && data.layouts !== null) {
      importLayout(data)
      return
    }
    if (!data || typeof data.roots !== 'object') throw new Error('缺少 roots 或 layouts 字段')
    const cmap = cardMap()
    const assign = new Map()
    const order = new Map(KEY_ORDER.map((k) => [k, []]))
    let skipped = 0
    for (const k of KEY_ORDER) {
      for (const ch of data.roots[k] ?? []) {
        const cp = ch.codePointAt(0)
        if (!cmap.has(cp)) {
          skipped++
          continue
        }
        if (assign.has(cp)) continue
        assign.set(cp, k)
        order.get(k).push(cp)
      }
    }
    state.assign = assign
    state.order = order
    // 清理布局中已不属于对应键的字根
    for (const [k, lo] of state.layout) {
      lo.cells = lo.cells.map((c) => (c && state.assign.get(c.cp) === k ? c : null))
    }
    saveState()
    renderAll()
    els.infoMeta.textContent = `导入完成：分配 ${assign.size} 个字形${skipped ? `，忽略 ${skipped} 个不在当前字体的字形` : ''}`
  }

  // ---------- 事件绑定 ----------

  function bindEvents() {
    els.btnSuggest.addEventListener('click', () => {
      if (!confirm('按统计数据重新预填？当前分配会被覆盖。')) return
      applySuggest()
      saveState()
      renderAll()
    })

    els.btnClear.addEventListener('click', () => {
      if (!confirm('清空当前方案的全部标记？')) return
      state.assign = new Map()
      state.order = new Map(KEY_ORDER.map((k) => [k, []]))
      state.layout = new Map()
      saveState()
      renderAll()
    })

    els.btnExport.addEventListener('click', exportJson)

    els.btnImport.addEventListener('click', () => els.fileInput.click())

    els.fileInput.addEventListener('change', () => {
      const file = els.fileInput.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        try {
          importJson(String(reader.result))
        } catch (err) {
          alert(`导入失败：${err.message}`)
        }
      }
      reader.readAsText(file, 'utf-8')
      els.fileInput.value = ''
    })

    for (const el of [els.chkSuggest, els.chkUnassigned, els.chkHideIdent, els.chkShowBlank]) {
      el.addEventListener('change', renderPool)
    }
    els.search.addEventListener('input', renderPool)

    els.markMenu.addEventListener('click', (e) => {
      const btn = e.target.closest('button')
      if (btn) applyMarkAction(btn.dataset.act)
    })
    els.markMenu.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      e.stopPropagation()
    })
    document.addEventListener('click', (e) => {
      if (els.markMenu.hidden) return
      if (!els.markMenu.contains(e.target)) closeMarkMenu()
    })
    // 右键其他区域（格子的 contextmenu 已 stopPropagation，不会误触发）
    document.addEventListener('contextmenu', () => {
      if (!els.markMenu.hidden) closeMarkMenu()
    })
    // 布局区滚动时菜单会错位，直接关闭
    els.layoutPanel.addEventListener('scroll', () => {
      if (!els.markMenu.hidden) closeMarkMenu()
    })

    els.sizeTabs.addEventListener('click', (e) => {
      const btn = e.target.closest('button')
      if (btn) setLayoutSize(Number(btn.dataset.size))
    })

    els.btnAutoFill.addEventListener('click', autoFillLayout)
    els.btnClearLayout.addEventListener('click', clearLayout)
    els.btnExportLayout.addEventListener('click', exportLayout)

    // 调试：全局拖拽事件追踪（捕获阶段，验证事件是否到达页面）
    document.addEventListener(
      'dragstart',
      (e) => rtLog('⬛ [全局] dragstart', { cls: e.target.className, cp: e.target.dataset?.cp }),
      true,
    )
    document.addEventListener(
      'dragover',
      (e) => {
        if (window.__lastOverTarget !== e.target) {
          window.__lastOverTarget = e.target
          rtLog('↘ [全局] dragover', { cls: e.target.className })
        }
      },
      true,
    )
    document.addEventListener(
      'drop',
      (e) => {
        rtLog('⬇ [全局] drop', {
          cls: e.target.className,
          data: e.dataTransfer.getData('text/plain').slice(0, 90),
        })
      },
      true,
    )
    document.addEventListener(
      'dragend',
      () => {
        window.__lastOverTarget = null
        dragPayload = null
      },
      true,
    )

    // 从矩阵格子拖回列表 = 移出布局
    els.selectedRoots.addEventListener('dragover', (e) => e.preventDefault())
    els.selectedRoots.addEventListener('drop', (e) => {
      const payload = readDragPayload(e)
      if (payload?.from !== 'cell') return
      e.preventDefault()
      rtLog('⬇ 拖回列表移除', { cp: payload.cp })
      removeCpFromLayout(state.currentKey, payload.cp)
      saveState()
      renderLayout()
      renderSelected()
      renderProgress()
    })

    document.addEventListener('keydown', (e) => {
      if (e.key === '`') {
        toggleDebug()
        e.preventDefault()
        return
      }
      if (e.key === 'Escape') {
        closeMarkMenu()
        return
      }
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const k = e.key.toLowerCase()
      if (KEY_ORDER.includes(k)) {
        closeMarkMenu()
        state.currentKey = k
        renderAll()
        e.preventDefault()
      }
    })
  }

  // ---------- 启动 ----------

  function init() {
    // 页面与脚本版本一致性检查：缓存错配时给出明确提示，而不是交互静默失效
    const missing = Object.entries(els)
      .filter(([, el]) => !el)
      .map(([name]) => name)
    if (missing.length > 0) {
      document.body.innerHTML =
        '<p style="padding:40px;font-size:16px;line-height:1.9">' +
        `页面与脚本版本不一致（缺少元素：${missing.join('、')}）。<br>` +
        '请强制刷新页面：<b>Ctrl + F5</b>（macOS 为 Cmd + Shift + R）。</p>'
      return
    }
    if (!window.RT_DATA || Object.keys(window.RT_DATA).length === 0) {
      document.body.innerHTML =
        '<p style="padding:40px;font-size:16px">数据未加载：请先运行 <code>python tools/root-tagger/scripts/build-data.py</code></p>'
      return
    }
    const schemes = Object.keys(window.RT_DATA)
    let scheme = null
    try {
      scheme = localStorage.getItem(STORAGE_SCHEME)
    } catch {
      /* 忽略 */
    }
    if (!scheme || !schemes.includes(scheme)) {
      scheme = schemes.includes('wubi98') ? 'wubi98' : schemes[0]
    }
    bindEvents()
    loadScheme(scheme)
    rtLog('启动', { scheme, cards: currentCards().length })
  }

  init()
})()
