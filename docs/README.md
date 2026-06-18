# 风水计算器 · Feng Shui Calculator

A self-contained, client-side implementation of four Chinese-metaphysics
(玄学) calculators, reproducing the functionality of the chinesemetasoft.com
reference pages found in the parent folders. **No server or build step** — just
open `index.html` in a browser.

## Modules

| Module | 中文 | What it computes |
|---|---|---|
| **Ba Zi** | 八字 / 四柱 | Four Pillars, hidden stems, Ten Gods, Na Yin, 12 life stages, 旬空 void branches, day-master seasonal standing (旺相休囚死), five-element balance, Luck Pillars (大运) with exact start date & current-decade highlight. **Analysis**: weighted strength scoring → 身强/身弱/中和 verdict, 喜用神 favorable elements (with directions/colors), day-master persona, ten-god distribution |
| **Flying Stars** | 玄空飞星 | Period/base, Mountain (山) & Water (向) star charts, annual star (defaults to the current year), chart-type classification. **Analysis**: per-palace 吉/平/凶 rating from classic combos (二五交加, 斗牛煞, 交剑煞, 一四同宫…) + star timeliness (旺生退) |
| **Tong Shu** | 通书 | 12 Officers with 宜/忌, 冲煞 (clash & Sha direction), 旬空, 28 Constellations, Yellow/Black day-god, Na Yin, solar term with exact begin/next instants, moon phase, zodiac horoscope. **Analysis**: ★1–5 day-quality rating (officer + mansion + yellow/black belt) |
| **Qi Men Dun Jia** | 奇门遁甲 | Hour-based 时家 chart (转盘/拆补法): 局 number, 三奇六仪, 九星, 八门, 八神, plus 空亡/驿马 palace markers. **Analysis**: 伏吟/反吟, 三奇得门, 门迫 detection and per-palace 吉/平/凶 rating |

The UI follows a cinnabar / antique-gold / rice-paper palette and switches to a
dark ink theme automatically via `prefers-color-scheme: dark`. The analysis
verdicts are simplified rule-based readings, intended for study only.

## Architecture

```
docs/
├── index.html          UI: tabbed forms for the 4 calculators
├── css/style.css       styling (matches the original #B93430 red theme)
└── js/
    ├── data.js         constants (stems, branches, Na Yin, mansions, QMDJ tables…)
    ├── astro.js        astronomy/calendar core — the foundation of everything
    ├── bazi.js         Ba Zi module
    ├── flyingstars.js  Xuan Kong Flying Stars module
    ├── tongshu.js      Tong Shu almanac module
    ├── qimen.js        Qi Men Dun Jia module
    ├── ai-context.js   chart → self-describing LLM context + preset prompts
    ├── ai.js           OpenAI-compatible client, settings panel, chat UI
    └── app.js          UI controller (tabs, forms, rendering)
```

### AI integration

Each calculator panel gets an "AI 智能解读" section: a one-click preset
analysis button plus a follow-up chat box. `ai-context.js` serializes the
current chart into a fully self-describing plain-text block (every term
glossed inline, with an explicit "the numbers are already computed — do not
re-cast" instruction) so even small models can read it. `ai.js` talks to any
OpenAI-compatible `/chat/completions` endpoint (configurable base URL / API
key / model, with `/models` auto-discovery), streams via SSE with a
non-streaming fallback, and prefers the Electron IPC proxy (`window.aiBridge`)
over `fetch` to avoid CORS in the desktop build.

### `astro.js` — the engine

All four modules rest on a shared calendar/astronomy core:

- **Julian Day** conversions (civil ↔ JD/JDN, both directions) with timezone
  offset.
- **Apparent solar longitude** via Meeus' low-precision solar theory (~0.01°),
  including ΔT. This drives **solar terms** and the **month pillar** directly
  (the month branch is read straight from the sun's ecliptic longitude; 节
  boundaries are accurate to a few minutes), plus exact term instants
  (`termInstants`).
- **Lunar longitude** via the truncated Meeus ch. 47 series (39 main terms +
  planetary perturbations + nutation, ~0.003°). Drives phase/illumination and
  the **lunar day**, which is counted in civil days from the exact instant of
  the previous new moon (`prevNewMoonJD`, Newton iteration on elongation) —
  not approximated from moon age.
- **GanZhi (干支)** for year (立春 boundary), month (五虎遁), day (JDN, 23:00
  day-change), and hour (五鼠遁) pillars; closed-form `jiaziIndex` (CRT) and
  `xunKong` (旬空) helpers.

## Validation

The algorithms were reverse-engineered from the saved reference pages and then
checked against their rendered output:

- **Four Pillars** — 2026-06-06 19:39 (CST) → 年 丙午 / 月 甲午 / 日 辛亥 / 时 戊戌 ✓
- **Tong Shu** — same date → 12 Officers `6 执 Initiate`, 28 Mansions `10 女`,
  Yellow/Black `4 朱雀`, Na Yin `钗钏金`, moon `廿壹 Waning Gibbous ~70%` ✓
- **Flying Stars** — Period 8 facing N2 (子) → every one of the 9 palaces
  (Mountain/Water/Base stars) matches the reference chart exactly ✓

The Qi Men chart is produced with the standard 转盘 时家奇门 method and was
hand-verified for internal consistency (局 selection via 符头/三元, 值符/值使
placement, star/door/god rotation).

All of the above (plus 立春 year-boundary cases, the 23:00 day rollover, the
2026-05-16 20:01 UTC new moon, 冲煞/旬空/驿马 values, …) are pinned in a
regression suite — run it with:

```bash
node docs/test/check.js          # algorithms + AI-context serializers
npx electron docs/test/e2e-capture.cjs   # Electron smoke test + screenshots
```

## Notes & conventions

- Times are reckoned in a configurable UTC offset, defaulting to **+8 (China
  Standard Time)**, as is traditional for Chinese metaphysics.
- The day pillar advances at **23:00** (late 子时 → next day).
- Hidden stems are listed main-qi (本气) first.
- The moon's western zodiac sign uses tropical ecliptic longitude; near a sign
  boundary it can differ from sources that round differently.
- This is an educational/reference implementation of the underlying algorithms,
  not affiliated with chinesemetasoft.com.
