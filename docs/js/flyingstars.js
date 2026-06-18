/* =========================================================================
 * flyingstars.js — Xuan Kong Flying Stars (玄空飞星)
 *
 * Validated against the reference chart: Period 8, facing N2 (子 Zi).
 *   Period (base) star chart:  C=8 NW=9 W=1 NE=2 S=3 N=4 SW=5 E=6 SE=7
 *   Water  star chart:         C=4 (forward)   Mountain star: C=3 (backward)
 * ========================================================================= */

const FlyingStars = (function () {

  /* Palace layout positions (North up). Maps direction → grid row/col. */
  const GRID = {
    NW: [0, 0], N: [0, 1], NE: [0, 2],
    W:  [1, 0], C: [1, 1], E:  [1, 2],
    SW: [2, 0], S: [2, 1], SE: [2, 2],
  };

  /* Fly a number through the Luoshu palaces.
   * center = starting number in center; forward = 顺(+) / 逆(-). */
  function flyChart(center, forward) {
    const result = {};
    let n = center;
    const order = CM.LUOSHU_FLIGHT;   // C,NW,W,NE,S,N,SW,E,SE
    for (let i = 0; i < 9; i++) {
      let v = ((n - 1) % 9 + 9) % 9 + 1;       // wrap to 1..9
      result[order[i]] = v;
      n += forward ? 1 : -1;
    }
    return result;
  }

  /* Determine flight direction for a star whose center number is `starNo`,
   * given the facing/sitting mountain (cn) and its 三元 ordinal (0地/1天/2人).
   * Rule: take the star's home-trigram mountain at the same 三元 ordinal;
   * its yin/yang gives forward(yang)/backward(yin). */
  function starDirection(starNo, sanyuanOrd) {
    if (starNo === 5) {
      // 5 has no home trigram; borrows the facing/sitting mountain's own yin/yang
      return null; // handled by caller using mountain yin/yang
    }
    const tri = CM.STAR_TRIGRAM_MOUNTAINS[starNo];
    const mtn = tri[sanyuanOrd];
    return CM.MOUNTAIN_YANG[mtn];
  }

  /* mountainCode like "N2" → {dir, sanyuanOrd, cn, yang} */
  function parseMountain(code) {
    const idx = CM.MOUNTAINS.findIndex(m => m.code === code);
    const m = CM.MOUNTAINS[idx];
    const sanyuanOrd = idx % 3;            // 0=地,1=天,2=人 within direction triple
    const dir = code.replace(/[0-9]/g, "");
    return { dir, sanyuanOrd, cn: m.cn, py: m.py, yang: CM.MOUNTAIN_YANG[m.cn] };
  }

  /* Opposite direction (facing → sitting). */
  const OPPOSITE = { N: "S", S: "N", E: "W", W: "E", NE: "SW", SW: "NE", NW: "SE", SE: "NW" };

  function compute(period, facingCode, annualYear) {
    const facing = parseMountain(facingCode);
    const sitDir = OPPOSITE[facing.dir];

    // 1) Period / base (earth) star chart — period number in center, forward
    const base = flyChart(period, true);

    // 2) Water (facing) star: center = base number in facing palace
    const waterCenter = base[facing.dir];
    let waterDir = starDirection(waterCenter, facing.sanyuanOrd);
    if (waterDir === null) waterDir = facing.yang;   // star 5 borrows facing yin/yang
    const water = flyChart(waterCenter, waterDir);

    // 3) Mountain (sitting) star: center = base number in sitting palace
    const mtnCenter = base[sitDir];
    // sitting mountain is the opposite mountain at the same 三元 ordinal
    let mtnDir = starDirection(mtnCenter, facing.sanyuanOrd);
    if (mtnDir === null) mtnDir = !facing.yang;      // sitting opposite yin/yang
    const mountain = flyChart(mtnCenter, mtnDir);

    // 4) Annual star (流年飞星) — optional
    let annual = null;
    if (annualYear && annualYear > 0) {
      const ac = annualCenter(annualYear);
      annual = flyChart(ac, true);
    }

    // Assemble per-palace
    const palaces = {};
    ["NW", "N", "NE", "W", "C", "E", "SW", "S", "SE"].forEach(d => {
      palaces[d] = {
        dir: d,
        base: base[d],
        mountain: mountain[d],
        water: water[d],
        annual: annual ? annual[d] : null,
        grid: GRID[d],
      };
    });

    const result = {
      period, facing, sitDir,
      waterDir, mtnDir,
      palaces,
      facingCode, sittingCode: sittingCodeOf(facing),
      type: chartType(base, mountain, water, facing.dir, sitDir, period),
      annualYear: annualYear || 0,
    };
    result.analysis = analyze(result);
    return result;
  }

  /* Annual star center number for a given (solar/立春) year.
   * Formula: ((11 - (year-1900) mod 9 ... )) — use the standard:
   * center = ((year sum reduction)); we use: c = (year-4)%9 mapped. */
  function annualCenter(year) {
    // Annual center descends by 1 each year (wrapping 1→9).
    // Anchor: 2024 = 3, 2025 = 2, 2026 = 1, 2027 = 9 ...
    const c = 3 - (year - 2024);
    return ((c - 1) % 9 + 9) % 9 + 1;
  }

  function sittingCodeOf(facing) {
    // sitting mountain = opposite code with same number suffix
    const idx = CM.MOUNTAINS.findIndex(m => m.cn === facing.cn);
    const oppIdx = (idx + 12) % 24;
    return CM.MOUNTAINS[oppIdx].code;
  }

  /* ---- Palace-by-palace analysis: classic combos + star timeliness ---- */
  function timeliness(star, period) {
    if (star === period) return { t: "旺", w: 1.5 };                 // 当令
    if (star === (period % 9) + 1) return { t: "生", w: 1 };         // 生气 (next)
    if (star === ((period + 7) % 9) + 1) return { t: "退", w: -0.5 };// 退气 (previous)
    return { t: "", w: 0 };
  }
  const STAR_BASE = { 1: 0.5, 2: -1.5, 3: -1, 4: 0.5, 5: -2, 6: 0.5, 7: -1, 8: 1, 9: 1 };

  function analyze(r) {
    const out = [];
    ["NW", "N", "NE", "W", "C", "E", "SW", "S", "SE"].forEach(d => {
      const p = r.palaces[d];
      const key = Math.min(p.mountain, p.water) + "-" + Math.max(p.mountain, p.water);
      const combo = CM.FS_COMBOS[key];
      const tm = timeliness(p.mountain, r.period);
      const tw = timeliness(p.water, r.period);
      let score = (STAR_BASE[p.mountain] + tm.w) + (STAR_BASE[p.water] + tw.w);
      if (combo) score += combo.score;
      const rating = score >= 1.5 ? "吉" : score <= -1.5 ? "凶" : "平";
      const text = combo
        ? `${combo.cn} — ${combo.en}`
        : `山星${p.mountain}${tm.t}(${CM.FS_STAR_TAG[p.mountain]}) · 向星${p.water}${tw.t}(${CM.FS_STAR_TAG[p.water]})`;
      out.push({
        dir: d, rating, text,
        isFacing: d === r.facing.dir, isSitting: d === r.sitDir,
      });
    });
    return out;
  }

  /* Determine special chart type (旺山旺向 etc.) by comparing facing/sitting
   * palace stars to the period number. */
  function chartType(base, mountain, water, facingDir, sitDir, period) {
    const wf = water[facingDir];     // water star at facing
    const ms = mountain[sitDir];     // mountain star at sitting
    if (wf === period && ms === period) return "旺山旺向 (Prosperous Mountain & Water)";
    if (water[sitDir] === period && mountain[facingDir] === period) return "上山下水 (Reversed — Mountain to Water)";
    if (wf === period) return "双星到向 (Double Stars at Facing)";
    if (water[sitDir] === period) return "双星到坐 (Double Stars at Sitting)";
    return "—";
  }

  return { compute, annualCenter, parseMountain, analyze };
})();

if (typeof module !== "undefined") module.exports = FlyingStars;
