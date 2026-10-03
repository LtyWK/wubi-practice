"""
字根标注器数据预生成脚本。

为 86 / 98 两套方案生成 tools/root-tagger/data/*.js：

  1. 枚举字体私有区字形（86: U+E000-F8FF，98: U+F0000-FFFFD）
  2. 空轮廓检测（blank=true 的卡片不进入人工筛选）
  3. 码表 + 拆解数据按位对齐，统计每个字形的键位投票（suggestKey / votes）
  4. 出现例字（examples，最多 6 个）
  5. 识别码候选检测（identLikely：遍布多键且几乎总在全码末位）
  6. 86 附带现有 roots-map 文本与现有配置归属（suggestKey 优先取现配置）

用法：
    python tools/root-tagger/scripts/build-data.py
"""
import json
import os
import sys
from collections import Counter, defaultdict

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.recordingPen import RecordingPen
from fontTools.ttLib import TTFont

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

TOOL_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECT = os.path.dirname(os.path.dirname(TOOL_DIR))
SOURCES = os.path.join(PROJECT, 'scripts', 'sources')
OUT_DIR = os.path.join(TOOL_DIR, 'data')

KEY_ORDER = 'gfdsahjklmtrewqyuiopnbvcx'

SCHEMES = {
    'wubi86': {
        'label': '86版（微软五笔）',
        'font': 'assets/wubi86-roots.ttf',
        'lo': 0xE000,
        'hi': 0xF8FF,
    },
    'wubi98': {
        'label': '98王码',
        'font': 'assets/98wb.otf',
        'lo': 0xF0000,
        'hi': 0xFFFFD,
    },
}


def is_han(ch: str) -> bool:
    """常用汉字范围（基本区 + 扩展 A）"""
    cp = ord(ch)
    return 0x4E00 <= cp <= 0x9FFF or 0x3400 <= cp <= 0x4DBF


def blank_codepoints(font: TTFont) -> set[int]:
    """检测无轮廓字形（cmap 有码点但无笔画）"""
    glyphset = font.getGlyphSet()
    blanks: set[int] = set()
    for cp, name in font.getBestCmap().items():
        pen = RecordingPen()
        try:
            glyphset[name].draw(pen)
        except Exception:
            blanks.add(cp)
            continue
        if not pen.value:
            blanks.add(cp)
    return blanks


def parse_level1() -> set[str]:
    """《通用规范汉字表》一级 3500 字（data-chars.tsv），用于例字优先排序"""
    path = os.path.join(SOURCES, 'data-chars.tsv')
    result: set[str] = set()
    lines = open(path, encoding='utf-8').read().splitlines()
    for ln in lines[1:]:
        cols = ln.split('\t')
        if len(cols) < 6:
            continue
        if cols[5] == '一级' and len(cols[1]) == 1:
            result.add(cols[1])
    return result


def parse86() -> list[tuple[str, str, list[int]]]:
    """解析 86 拆解 TSV：行 -> (字, 全码, PUA 序列)"""
    rows: list[tuple[str, str, list[int]]] = []
    path = os.path.join(SOURCES, 'data-wubi-v86.tsv')
    lines = open(path, encoding='utf-8').read().splitlines()
    for ln in lines[1:]:
        cols = ln.split('\t')
        if len(cols) < 8:
            continue
        ch = cols[0]
        if len(ch) != 1 or not is_han(ch):
            continue
        code = ''.join(c for c in (cols[1] or '') if 'a' <= c <= 'z')
        if not code:
            continue
        puas = [ord(c) for c in (cols[7] or '') if 0xE000 <= ord(c) <= 0xF8FF]
        if not puas:
            continue
        rows.append((ch, code, puas))
    return rows


def parse98() -> list[tuple[str, str, list[int]]]:
    """解析 98 拆解数据：行 -> (字, 全码, PUA 序列)。

    行格式：字 \t 〔※字根序列※☯※编码※☯※拼音※〕
    含「·」的多拆法行（均无编码）自动跳过。
    """
    rows: list[tuple[str, str, list[int]]] = []
    path = os.path.join(SOURCES, 'data-wubi-v98.tsv')
    for ln in open(path, encoding='utf-8').read().splitlines():
        if not ln.strip():
            continue
        cols = ln.split('\t')
        if len(cols) < 2:
            continue
        ch = cols[0]
        if len(ch) != 1 or not is_han(ch):
            continue
        inner = cols[1]
        if '〔' in inner:
            inner = inner[inner.index('〔') + 1:]
        if '〕' in inner:
            inner = inner[:inner.index('〕')]
        parts = inner.split('\u262f')  # ☯
        if len(parts) < 2:
            continue
        code = ''.join(c for c in parts[1] if 'a' <= c <= 'z')
        if not code:
            continue
        puas = [ord(c) for c in parts[0] if 0xF0000 <= ord(c) <= 0xFFFFD]
        if not puas:
            continue
        rows.append((ch, code, puas))
    return rows


def tally(rows: list[tuple[str, str, list[int]]], freq1: set[str]):
    """按位对齐统计：PUA -> 键位票数、例字、末位比例、键位集合。

    例字分两档收集（优先一级常用字），避免生僻字占满展示位。
    """
    votes: dict[int, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    common_ex: dict[int, list[str]] = defaultdict(list)
    other_ex: dict[int, list[str]] = defaultdict(list)
    keysets: dict[int, set[str]] = defaultdict(set)
    last_cnt: dict[int, int] = defaultdict(int)
    total_cnt: dict[int, int] = defaultdict(int)
    for ch, code, puas in rows:
        n = min(len(code), len(puas))
        is_common = ch in freq1
        for i in range(n):
            p, k = puas[i], code[i]
            votes[p][k] += 1
            total_cnt[p] += 1
            keysets[p].add(k)
            if i == n - 1:
                last_cnt[p] += 1
            bucket = common_ex[p] if is_common else other_ex[p]
            if len(bucket) < 8 and ch not in bucket:
                bucket.append(ch)
    examples: dict[int, list[str]] = {}
    for p in total_cnt:
        merged = common_ex[p] + [c for c in other_ex[p] if c not in common_ex[p]]
        examples[p] = merged[:6]
    return votes, examples, keysets, last_cnt, total_cnt


def glyph_sizes(font: TTFont, lo: int, hi: int) -> dict[int, tuple[int, int]]:
    """每个 PUA 字形的外接框尺寸（宽, 高）"""
    gs = font.getGlyphSet()
    out: dict[int, tuple[int, int]] = {}
    for cp, name in font.getBestCmap().items():
        if not (lo <= cp <= hi):
            continue
        pen = BoundsPen(gs)
        try:
            gs[name].draw(pen)
        except Exception:
            continue
        if pen.bounds is None:
            continue
        x0, y0, x1, y1 = pen.bounds
        out[cp] = (x1 - x0, y1 - y0)
    return out


def detect_ident(sizes, votes, keysets, last_cnt, total_cnt) -> set[int]:
    """识别码检测：识别码字形为统一的圆形符号模板（近似正方的大尺寸）。

    在同一套字体内，识别码字形外接框尺寸完全相同（86/98 均为 1636x1634）。
    取「近似方形大尺寸」中出现次数最多的模板；命中模板且末位占比 >= 0.5 的字形
    视为识别码。若模板命中的键位不足 8 个，视为误检返回空。
    """
    square = Counter(
        s for s in sizes.values() if s[0] >= 1500 and abs(s[0] - s[1]) <= 10
    )
    if not square:
        return set()
    template, _ = square.most_common(1)[0]
    hits = set()
    for cp, s in sizes.items():
        if s != template:
            continue
        total = total_cnt.get(cp, 0)
        if total == 0 or last_cnt[cp] / total >= 0.5:
            hits.add(cp)
    covered = {k for cp in hits if cp in keysets for k in keysets[cp]}
    if len(covered) < 8:
        return set()
    return hits


def load_json(path: str):
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def existing_key_map() -> dict[int, str]:
    """86 现有配置（zigen-glyphs.json）中已归属的字形 -> 键位"""
    path = os.path.join(SOURCES, 'zigen-glyphs.json')
    data = load_json(path)
    out: dict[int, str] = {}
    for key, item in data.items():
        for ch in item.get('all', []):
            if ch:
                out[ord(ch)] = key
    return out


def roots_text_map(lo: int, hi: int) -> dict[int, str]:
    """86 现有 roots-map（PUA -> 文本）"""
    path = os.path.join(SOURCES, 'roots-map.json')
    data = load_json(path)
    out: dict[int, str] = {}
    for k, v in data.items():
        if k.startswith('_'):
            continue
        cp = int(k.replace('U+', ''), 16)
        if lo <= cp <= hi and v:
            out[cp] = v
    return out


def build_scheme(scheme: str, freq1: set[str]) -> None:
    cfg = SCHEMES[scheme]
    lo, hi = cfg['lo'], cfg['hi']
    font_path = os.path.join(TOOL_DIR, cfg['font'])
    font = TTFont(font_path)

    font_cps = sorted(cp for cp in font.getBestCmap() if lo <= cp <= hi)
    blanks = blank_codepoints(font)
    sizes = glyph_sizes(font, lo, hi)
    rows = parse86() if scheme == 'wubi86' else parse98()
    votes, examples, keysets, last_cnt, total_cnt = tally(rows, freq1)
    idents = detect_ident(sizes, votes, keysets, last_cnt, total_cnt)

    existing = existing_key_map() if scheme == 'wubi86' else {}
    texts = roots_text_map(lo, hi) if scheme == 'wubi86' else {}

    # 拆解使用但字体缺失的 PUA（数据问题的预警）
    used = set(votes)
    missing = sorted(used - set(font_cps))
    if missing:
        print(f'[{scheme}] 警告：拆解用到但字体缺失 {len(missing)} 个 PUA:',
              ' '.join(f'U+{p:X}' for p in missing[:20]))

    cards = []
    for cp in font_cps:
        v = votes.get(cp, {})
        ordered_votes = {k: v[k] for k in sorted(v, key=lambda k: -v[k])}
        suggest = existing.get(cp)
        if suggest is None and ordered_votes:
            suggest = next(iter(ordered_votes))
        cards.append({
            'cp': cp,
            'blank': cp in blanks,
            'suggestKey': suggest,
            'votes': ordered_votes,
            'count': total_cnt.get(cp, 0),
            'examples': examples.get(cp, []),
            'text': texts.get(cp, ''),
            'identLikely': cp in idents,
        })

    payload = {
        'scheme': scheme,
        'label': cfg['label'],
        'font': cfg['font'],
        'lo': lo,
        'hi': hi,
        'cards': cards,
    }
    os.makedirs(OUT_DIR, exist_ok=True)
    out_path = os.path.join(OUT_DIR, f'{scheme}.js')
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write('window.RT_DATA = window.RT_DATA || {};\n')
        f.write(f'window.RT_DATA["{scheme}"] = ')
        f.write(json.dumps(payload, ensure_ascii=False))
        f.write(';\n')

    nonblank = sum(1 for c in cards if not c['blank'])
    print(f'[{scheme}] 卡片 {len(cards)}（非空 {nonblank}，空白 {len(cards) - nonblank}）'
          f'，有投票 {sum(1 for c in cards if c["count"] > 0)}'
          f'，识别码候选 {len(idents)}: '
          + ' '.join(f'U+{p:X}' for p in sorted(idents)))
    print(f'[{scheme}] 已写出 {out_path} ({os.path.getsize(out_path)} 字节)')


def main() -> None:
    freq1 = parse_level1()
    print(f'一级常用字: {len(freq1)}')
    build_scheme('wubi86', freq1)
    build_scheme('wubi98', freq1)


if __name__ == '__main__':
    main()
