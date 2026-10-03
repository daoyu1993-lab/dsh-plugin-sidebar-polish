/**
 * Verify rule 13 of dsh-plugin-sidebar-polish in a real engine (headless Chrome):
 * "an idle session row gets the same grey dot the official status renderer would
 * paint".
 *
 * What is compared, and against what
 * ---------------------------------
 * The shipped stylesheets (`preview/*.css`, extracted verbatim from the DSH
 * bundles) and the official `StateDot.module.css` define the reference: a 10px
 * box whose `::after{inset:20%}` paints a 6px `currentColor` circle, coloured by
 * `--dsw-alias-state-idle-primary`. The "official" row renders exactly that
 * markup; the "plugin" row renders only the empty
 * `div[data-slot="sidebar.session.row.leading"]` anchor the workspace browser
 * emits for an idle row, and lets the plugin's stylesheet draw the dot.
 *
 * Because both rows sit in the same 16×20px slot of the same row type, the two
 * slot crops must be pixel-identical — that is the claim being tested, not a
 * hand-picked tolerance. The negative rows prove the rule stays off when it
 * should: a seat another plugin occupies, an archived/blank row (no anchor at
 * all) and a row that already carries a coloured dot.
 *
 * Both themes are checked (light, dark); the dark pass flips
 * `data-ds-dark-theme` on <body> and the page is re-rendered from scratch.
 *
 * Usage: node tools/verify-idle-dot.mjs
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
/** Resolve a path in both layouts: this workspace (`dsh-plugin-x/…`) and the plugin repo. */
const read = (p) =>
  readFileSync(
    [join(root, p), join(root, p.replace(/^dsh-plugin-[^/]+\//, ''))].find((candidate) =>
      existsSync(candidate),
    ) ?? join(root, p),
    'utf8',
  );

/** The plugin's stylesheet, lifted out of the `const CSS = \`…\`` template. */
const PLUGIN_CSS = (() => {
  const src = read('dsh-plugin-sidebar-polish/client.js');
  const start = src.indexOf('const CSS = `') + 'const CSS = `'.length;
  const end = src.indexOf('\n`;', start);
  if (start < 'const CSS = `'.length || end < 0) throw new Error('cannot locate the CSS template in client.js');
  return src.slice(start, end);
})();

const SHIPPED_CSS = ['palette.css', 'layout.css', 'shell.css', 'workspace.css', 'theme.css']
  .map((f) => read(join('preview', f)))
  .join('\n');

/** The official state-dot stylesheet (class hashes are irrelevant to painting). */
const STATEDOT_CSS = read(
  'core/dsh/node_modules/@deepseek-ai/dsh-client-ui-primitives/lib/StateDot.module.css',
);

/** Official solid-state markup: 10px box, colour painted by the ::after. */
const officialDot = (state) =>
  `<span class="dot" data-state="${state}" aria-hidden="true" style="width:10px;height:10px"></span>`;

/** The renderer's seat anchor: present only while the row's primary state is idle. */
const seat = (inner = '') =>
  `<div data-slot="sidebar.session.row.leading" style="display:contents">${inner}</div>`;

const row = (id, slot, title, cls = '') =>
  `<div class="jJkEga_sessionRow ${cls}" data-row-key="session:${id}" role="treeitem">
      <span class="jJkEga_slot" data-slot-of="${id}">${slot}</span>
      <span class="jJkEga_title">${title}</span>
      <span class="jJkEga_time">1 分钟前</span>
    </div>`;

const ROWS = [
  row('official', `${officialDot('idle')}`, '官方 idle 点（基准）'),
  row('plugin', seat(), '插件补的灰点'),
  row('occupied', seat('<span class="otherMark"></span>'), '座位被别的插件占用'),
  row('archived', '', '归档行（官方不渲染座位）', 'jJkEga_archived'),
  row('blank', '', '新会话占位行（官方不渲染座位）'),
  row('done', officialDot('done'), '有状态的行（绿点不该被覆盖）'),
];

const PAGE = (dark) => `<!doctype html><html lang="zh" data-platform="darwin"><head><meta charset="utf-8">
<style>${SHIPPED_CSS}</style>
<style>${STATEDOT_CSS}</style>
<style>
  html, body { margin: 0; background: var(--dsw-alias-bg-base); }
  #side { width: 280px; padding: 8px 0; }
  .jJkEga_sessionRow { height: 36px; }
  /* A seat occupant: any plugin mark, deliberately not a dot of our colour. */
  .otherMark { display: inline-block; width: 10px; height: 10px; border-radius: 2px; background: #4176e6; }
</style>
<style id="sidebar-polish">${PLUGIN_CSS}</style>
</head><body${dark ? ' data-ds-dark-theme' : ''}>
<div data-slot="sidebar"><div id="side">${ROWS.join('\n')}</div></div>
<pre id="out" hidden></pre>
<script>
const rows = [...document.querySelectorAll('[data-slot-of]')].map((slot) => {
  const r = slot.getBoundingClientRect();
  const after = getComputedStyle(slot, '::after');
  return {
    id: slot.dataset.slotOf,
    rect: { x: r.x, y: r.y, w: r.width, h: r.height },
    after: { content: after.content, width: after.width, height: after.height, background: after.backgroundColor, borderRadius: after.borderRadius },
    seat: (() => {
      const seat = slot.querySelector('[data-slot="sidebar.session.row.leading"]');
      return seat === null ? 'absent' : seat.children.length === 0 ? 'empty' : 'occupied';
    })(),
  };
});
const bg = getComputedStyle(document.body).backgroundColor;
const idleToken = getComputedStyle(document.body).getPropertyValue('--dsw-alias-state-idle-primary').trim();
document.getElementById('out').textContent = 'RESULT:' + JSON.stringify({ rows, bg, idleToken });
</script>
</body></html>`;

const CHROME = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
].find((p) => existsSync(p));
if (!CHROME) throw new Error('no Chrome/Chromium found to run the verification');

/** Pillow lives in the bundled runtime; keep the pixel probe self-contained. */
const PYTHON = '/Users/wangdaoyu/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/python/bin/python3';

const PY = `
import json, sys
from PIL import Image

meta = json.load(open(sys.argv[1]))
img = Image.open(sys.argv[2]).convert('RGB')
bg = meta['bg']

def rgb(v):
    v = v.strip()
    if v.startswith('rgb'):
        parts = v[v.index('(')+1:v.index(')')].replace('/', ',').split(',')
        return tuple(round(float(p)) for p in parts[:3])
    return (0, 0, 0)

bg = rgb(bg)
out = {}
for r in meta['rows']:
    rect = r['rect']
    x0, y0 = round(rect['x']), round(rect['y'])
    crop = img.crop((x0, y0, x0 + round(rect['w']), y0 + round(rect['h'])))
    px = [crop.getpixel((x, y)) for y in range(crop.height) for x in range(crop.width)]
    fg = [(i, p) for i, p in enumerate(px) if max(abs(p[c] - bg[c]) for c in range(3)) > 24]
    entry = {'size': [crop.width, crop.height], 'fg': len(fg), 'pixels': px}
    if fg:
        xs = [i % crop.width for i, _ in fg]
        ys = [i // crop.width for i, _ in fg]
        core = [p for _, p in fg]
        # The fully painted pixel: antialiased edges blend towards the background,
        # so the pixel furthest from the background is the dot's real colour.
        deepest = max(fg, key=lambda pair: max(abs(pair[1][c] - bg[c]) for c in range(3)))[1]
        mean = tuple(round(sum(p[c] for p in core) / len(core)) for c in range(3))
        entry.update({
            'bbox': [min(xs), min(ys), max(xs) - min(xs) + 1, max(ys) - min(ys) + 1],
            'center': [(min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2],
            'mean': list(mean),
            'core': list(deepest),
            'maxDiffFromBg': max(max(abs(p[c] - bg[c]) for c in range(3)) for _, p in fg),
        })
    out[r['id']] = entry
print('PIXELS:' + json.dumps(out))
`;

let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
};

const run = (dark) => {
  const page = join(tmpdir(), `dsh-idle-dot-${dark ? 'dark' : 'light'}.html`);
  const shot = join(tmpdir(), `dsh-idle-dot-${dark ? 'dark' : 'light'}.png`);
  writeFileSync(page, PAGE(dark));

  const dom = execFileSync(
    CHROME,
    ['--headless=new', '--disable-gpu', '--no-first-run', '--force-device-scale-factor=1',
     '--hide-scrollbars', '--window-size=420,340', '--virtual-time-budget=2000',
     `--screenshot=${shot}`, '--dump-dom', `file://${page}`],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  const match = dom.match(/RESULT:(\{.*?\})<\/pre>/s);
  if (!match) throw new Error('the measuring page produced no RESULT payload');
  const meta = JSON.parse(match[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&'));

  const pyFile = join(tmpdir(), 'dsh-idle-dot-pixels.py');
  const metaFile = join(tmpdir(), `dsh-idle-dot-${dark ? 'dark' : 'light'}.json`);
  writeFileSync(pyFile, PY);
  writeFileSync(metaFile, JSON.stringify(meta));
  const pixelsOut = execFileSync(PYTHON, [pyFile, metaFile, shot], { encoding: 'utf8' });
  const pixels = JSON.parse(pixelsOut.match(/PIXELS:(\{.*\})/s)[1]);
  return { meta, pixels, shot };
};

for (const theme of ['light', 'dark']) {
  const dark = theme === 'dark';
  const { meta, pixels } = run(dark);
  const byId = Object.fromEntries(meta.rows.map((r) => [r.id, r]));
  console.log(`\n── ${theme} ───────────────────────────────────────────`);

  // 1. the row shapes this rule keys on
  check('[基准] 官方 idle 行渲染 StateDot', byId.official.seat === 'absent' && byId.official.after.content === 'none', byId.official.seat);
  check('[命中] idle 行渲染空座位锚点', byId.plugin.seat === 'empty', byId.plugin.seat);
  check('[负例] 座位被占用 → occupied', byId.occupied.seat === 'occupied', byId.occupied.seat);
  check('[负例] 归档行 / 新会话行不渲染座位锚点', byId.archived.seat === 'absent' && byId.blank.seat === 'absent', `${byId.archived.seat}/${byId.blank.seat}`);

  // 2. our ::after is a 6px round box in the idle token colour
  check('灰点 ::after content 生效', byId.plugin.after.content === '""', byId.plugin.after.content);
  check('灰点 ::after 为 6px 圆', byId.plugin.after.width === '6px' && byId.plugin.after.height === '6px' && byId.plugin.after.borderRadius === '50%', `${byId.plugin.after.width}×${byId.plugin.after.height} ${byId.plugin.after.borderRadius}`);
  const idleRgb = (() => {
    const hex = meta.idleToken; // #rrggbb
    return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  })();
  check(
    `灰点颜色 = idle 状态色 ${meta.idleToken}`,
    pixels.plugin.core.every((v, i) => Math.abs(v - idleRgb[i]) <= 1),
    `core rgb(${pixels.plugin.core.join(',')}) vs rgb(${idleRgb.join(',')})`,
  );

  // 3. pixel-identical to the official dot in both themes
  const a = pixels.official.pixels;
  const b = pixels.plugin.pixels;
  const maxDiff = Math.max(...a.map((p, i) => Math.max(...p.map((c, k) => Math.abs(c - b[i][k])))));
  check(
    '灰点与官方 idle 点逐像素一致（同尺寸/同颜色/同圆心）',
    maxDiff === 0,
    `max channel diff = ${maxDiff}; bbox ${JSON.stringify(pixels.official.bbox)} vs ${JSON.stringify(pixels.plugin.bbox)}`,
  );
  check(
    '可见直径 = 6px（官方 .dot 10px × inset 20%）',
    pixels.official.bbox[2] === pixels.plugin.bbox[2] && pixels.plugin.bbox[2] === 6,
    `${pixels.official.bbox[2]}px / ${pixels.plugin.bbox[2]}px`,
  );

  // 4. the rule stays off when it should
  const occupiedIsMarkOnly =
    byId.occupied.after.content === 'none' &&
    pixels.occupied.bbox !== undefined &&
    pixels.occupied.bbox[2] === 10 &&
    !pixels.occupied.core.every((v, i) => Math.abs(v - idleRgb[i]) <= 1);
  check(
    '[负例] 座位被占用 → 只剩插件自己的标记，没有灰点',
    occupiedIsMarkOnly,
    `content=${byId.occupied.after.content} bbox=${JSON.stringify(pixels.occupied.bbox)} core=rgb(${pixels.occupied.core.join(',')})`,
  );
  check('[负例] 归档行 → 不画灰点', byId.archived.after.content === 'none' && pixels.archived.bbox === undefined, byId.archived.after.content);
  check('[负例] 新会话占位行 → 不画灰点', byId.blank.after.content === 'none' && pixels.blank.bbox === undefined, byId.blank.after.content);
  check('[负例] 已有绿点的行不受影响', pixels.done.fg > 0 && byId.done.after.content === 'none', `${pixels.done.fg} px`);
}

console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
