"""
按键位归并字根字形，生成 JSON 配置（供键盘绘制与打字训练）。

用法：
    python scripts/build-glyph-table.py

数据来源（无需中间文件）：
    - src/assets/fonts/wubi-roots.ttf   字形（私有区字形全集）
    - scripts/sources/data-wubi-v86.tsv 拆解数据（键位投票 + 使用频次）
    - scripts/sources/roots-map.json    PUA → 字根名（相似变体分组用）

输出：
    - scripts/sources/zigen-glyphs.json 每键一行对象：
        {
          "g": {
            "name":   "王",                          # 键名字根（键盘左上角）
            "short1": "一",                          # 一级简码（键盘右上角）
            "glyphs": ["五", "戋", "龶", "一"],       # 键盘主体（≤15，不含键名，相似相邻）
            "all":    ["一", "一", "王", ...]         # 完整字形（打字训练）
          },
          ...
        }
    - doc/字形归并说明.txt              规则、识别码明细、各键统计

规则：
    1. 只收录「有主键位的非识别码字形」
    2. 总字形（all）≤16 时不精简；超过 16 时按映射名合并相似变体，
       仍超过则按使用频次取前 15（键名不计入主体）
    3. 主体排序：相似组相邻（组间按最高频次降序，组内按频次降序）
"""
import json
import os
import sys

try:
    from fontTools.ttLib import TTFont
except ImportError:
    sys.exit('缺少 fontTools，请先执行: pip install fonttools')

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT = os.path.join(ROOT, 'src', 'assets', 'fonts', 'wubi-roots.ttf')
TSV = os.path.join(ROOT, 'scripts', 'sources', 'data-wubi-v86.tsv')
ROOTS_MAP = os.path.join(ROOT, 'scripts', 'sources', 'roots-map.json')
OUT_JSON = os.path.join(ROOT, 'scripts', 'sources', 'zigen-glyphs.json')
OUT_DOC = os.path.join(ROOT, 'doc', '字形归并说明.txt')

BODY_LIMIT = 15
ORDER = ['g', 'f', 'd', 's', 'a', 'h', 'j', 'k', 'l', 'm',
         't', 'r', 'e', 'w', 'q', 'y', 'u', 'i', 'o', 'p',
         'n', 'b', 'v', 'c', 'x']

KEY_NAME = {
    'g': '王', 'f': '土', 'd': '大', 's': '木', 'a': '工',
    'h': '目', 'j': '日', 'k': '口', 'l': '田', 'm': '山',
    't': '禾', 'r': '白', 'e': '月', 'w': '人', 'q': '金',
    'y': '言', 'u': '立', 'i': '水', 'o': '火', 'p': '之',
    'n': '已', 'b': '子', 'v': '女', 'c': '又', 'x': '纟',
}

SHORT1 = {
    'g': '一', 'f': '地', 'd': '在', 's': '要', 'a': '工',
    'h': '上', 'j': '是', 'k': '中', 'l': '国', 'm': '同',
    't': '和', 'r': '的', 'e': '有', 'w': '人', 'q': '我',
    'y': '主', 'u': '产', 'i': '不', 'o': '为', 'p': '这',
    'n': '民', 'b': '了', 'v': '发', 'c': '以', 'x': '经',
}

# 识别码符号（5 区 × 3 键，字体中为圆圈+笔画，非字根）
IDENT_PUA = {
    'E000', 'E015', 'E02D', 'E06A', 'E080', 'E097',
    'E0CD', 'E0DF', 'E0F4', 'E13D', 'E155', 'E171',
    'E1AD', 'E1DF', 'E1FA',
}


def load_votes() -> tuple[dict[str, str], dict[str, int]]:
    """PUA -> 主键位 / 使用频次（来自拆解数据，多数投票）"""
    votes: dict[str, dict[str, int]] = {}
    freq: dict[str, int] = {}
    with open(TSV, encoding='utf-8') as f:
        next(f)
        for line in f:
            cols = line.split('\t')
            if len(cols) < 8:
                continue
            code = ''.join(c for c in cols[1] if c.islower())
            units = [c for c in cols[7] if 0xE000 <= ord(c) <= 0xF8FF]
            for i in range(min(len(code), len(units))):
                p = f'{ord(units[i]):X}'
                votes.setdefault(p, {})
                votes[p][code[i]] = votes[p].get(code[i], 0) + 1
                # 只统计主键位一致的次数作为使用频次（避免错位污染）
                freq[p] = freq.get(p, 0) + 1
    main = {p: max(v.items(), key=lambda kv: kv[1])[0] for p, v in votes.items()}
    return main, freq


def main() -> None:
    main_key, pua_freq = load_votes()
    with open(ROOTS_MAP, encoding='utf-8') as f:
        roots_map = json.load(f)

    font = TTFont(FONT)
    font_pua = {
        f'{cp:X}' for cp in font.getBestCmap() if 0xE000 <= cp <= 0xF8FF
    }

    # 汇总：key -> [{pua, glyph, name, freq}]
    entries: dict[str, list[dict]] = {}
    removed_ident: list[str] = []
    for pua_hex in sorted(main_key):
        if pua_hex not in font_pua:
            continue
        key = main_key[pua_hex]
        if key not in ORDER:
            continue
        if pua_hex in IDENT_PUA:
            removed_ident.append(f'{key.upper()} U+{pua_hex}')
            continue
        glyph = chr(int(pua_hex, 16))
        entries.setdefault(key, []).append({
            'pua': pua_hex,
            'glyph': glyph,
            'name': roots_map.get(pua_hex, '') or glyph,
            'freq': pua_freq.get(pua_hex, 0),
        })

    result: dict[str, dict] = {}
    doc = ['字形归并说明（自动生成，可重跑）', '=' * 46, '',
           '输出：scripts/sources/zigen-glyphs.json（每键一行）',
           '  name   键名字根（键盘左上角）',
           '  short1 一级简码（键盘右上角）',
           '  glyphs 键盘主体（≤15，不含键名，相似相邻）',
           '  all    完整字形（打字训练）', '',
           f'[规则1] 已滤除识别码符号（{len(removed_ident)} 个）：']
    doc += [f'  {x}' for x in removed_ident]
    doc += ['', '各键：总字形数 → 主体数（>16 触发精简）']

    for key in ORDER:
        items = entries.get(key, [])
        all_glyphs: list[str] = []
        for e in items:
            if e['glyph'] not in all_glyphs:
                all_glyphs.append(e['glyph'])

        kname = KEY_NAME[key]
        kname_glyph = next((e['glyph'] for e in items if e['name'] == kname), None)
        total = len(all_glyphs)

        # 分组：映射名 → 字形组；组间按最高频次降序，组内按频次降序
        groups: dict[str, list[dict]] = {}
        for e in items:
            groups.setdefault(e['name'], []).append(e)
        ordered_groups = sorted(
            groups.items(), key=lambda kv: -max(e['freq'] for e in kv[1])
        )

        if total <= 16:
            body: list[str] = []
            for _, group in ordered_groups:
                for e in sorted(group, key=lambda x: -x['freq']):
                    if e['glyph'] != kname_glyph and e['glyph'] not in body:
                        body.append(e['glyph'])
        else:
            reps = []
            for _, group in ordered_groups:
                best = max(group, key=lambda e: e['freq'])
                if best['glyph'] != kname_glyph:
                    reps.append(best)
            body = [r['glyph'] for r in reps[:BODY_LIMIT]]

        body = body[:BODY_LIMIT]
        result[key] = {
            'name': kname,
            'short1': SHORT1[key],
            'glyphs': body,
            'all': all_glyphs,
        }
        flag = '精简' if total > 16 else '全保留'
        doc.append(f'  {key.upper()}  {total:2d} → 主体 {len(body):2d}  ({flag})')

    rows = []
    for key in ORDER:
        v = result[key]

        def arr(xs: list[str]) -> str:
            return '[' + ', '.join(json.dumps(x, ensure_ascii=False) for x in xs) + ']'

        rows.append(
            f'  "{key}": {{"name": "{v["name"]}", "short1": "{v["short1"]}", '
            f'"glyphs": {arr(v["glyphs"])}, "all": {arr(v["all"])}}}'
        )
    with open(OUT_JSON, 'w', encoding='utf-8') as f:
        f.write('{\n' + ',\n'.join(rows) + '\n}\n')
    with open(OUT_DOC, 'w', encoding='utf-8') as f:
        f.write('\n'.join(doc) + '\n')

    print(f'已生成 {OUT_JSON}')
    print(f'已生成 {OUT_DOC}')
    for key in ORDER:
        v = result[key]
        print(f'{key.upper()}({len(v["all"])}→{len(v["glyphs"])})', end='  ')
    print()


if __name__ == '__main__':
    main()
