/* =========================================================================
 * tongshu.js — Tong Shu / Chinese Almanac (通书)
 *
 * Validated against reference (2026-06-06, China time):
 *   12 Officers   → 6 执 Initiate
 *   28 Mansions   → 10 女 Weaving Maiden
 *   Yellow/Black  → 4 朱雀 Red Phoenix
 *   Na Yin (day)  → 钗钏金 Metal from the Ornaments
 *   Solar Term    → 9 芒种
 * ========================================================================= */

const TongShu = (function () {

  /* 12 Officers: officer index = (dayBranch - monthBranch) mod 12, 0=建. */
  function officer(dayBranch, monthBranch) {
    const idx = ((dayBranch - monthBranch) % 12 + 12) % 12;
    return { no: idx + 1, cn: CM.OFFICERS[idx][0], en: CM.OFFICERS[idx][1] };
  }

  /* 28 Constellations: continuous 28-day cycle. mansion0 = (JDN + 11) mod 28. */
  function mansion(jdn) {
    const idx = ((jdn + 11) % 28 + 28) % 28;
    const m = CM.MANSIONS[idx];
    return { no: idx + 1, cn: m[0], en: m[1], animal: m[2], planet: m[3], lucky: CM.MANSION_LUCK[idx] };
  }

  /* Yellow & Black Belt 12 day-gods.
   * 青龙 start branch = ((monthBranch - 2) mod 6) * 2.
   * god index = (dayBranch - qinglongBranch) mod 12. */
  function dayGod(dayBranch, monthBranch) {
    const qinglong = (((monthBranch - 2) % 6 + 6) % 6) * 2;
    const idx = ((dayBranch - qinglong) % 12 + 12) % 12;
    const g = CM.DAY_GODS[idx];
    return { no: idx + 1, cn: g[0], en: g[1], lucky: g[2] };
  }

  /* Horoscope colour for each of the 12 zodiac animals relative to day branch.
   * red = three-harmony triad of day branch + its six-harmony partner;
   * black = three-harmony triad of the clash branch;
   * grey = neutral. Returns array length 12 (index = branch). */
  const TRIADS = [[0, 4, 8], [1, 5, 9], [2, 6, 10], [3, 7, 11]]; // 申子辰/巳酉丑/寅午戌/亥卯未 by branch
  const SIX_HARMONY = { 0: 1, 1: 0, 2: 11, 11: 2, 3: 10, 10: 3, 4: 9, 9: 4, 5: 8, 8: 5, 6: 7, 7: 6 };
  function horoscope(dayBranch) {
    const clash = (dayBranch + 6) % 12;
    const triadOf = b => TRIADS.find(t => t.indexOf(b) >= 0);
    const red = new Set(triadOf(dayBranch));
    red.add(SIX_HARMONY[dayBranch]);
    const black = new Set(triadOf(clash));
    const colors = [];
    for (let b = 0; b < 12; b++) {
      if (red.has(b)) colors.push("red");
      else if (black.has(b)) colors.push("black");
      else colors.push("grey");
    }
    return colors;
  }

  function compute(dt) {
    const tz = dt.tzOffset == null ? 8 : dt.tzOffset;
    const chart = Astro.fourPillars(dt);
    const jdn = chart.day.jdn;
    const hour = dt.hourKnown ? dt.hour : 12;
    const minute = dt.hourKnown ? (dt.minute || 0) : 0;
    const jd = Astro.toJD(dt.year, dt.month, dt.day, hour, minute, 0, tz);

    const monthBranch = chart.month.branch;
    const dayBranch = chart.day.branch;
    const dayJiazi = chart.day.jiazi;

    // moon
    const moon = Astro.moonInfo(jd, dt.year, dt.month);
    const lunarDayNo = Astro.lunarDay(jd, dt.year, dt.month, tz);
    const wzIdx = Math.floor(Astro.norm360(moon.ecLon) / 30);

    // solar-term exact instants (current term began / next term)
    const ti = Astro.termInstants(jd, dt.year, dt.month);

    // day of week — JDN % 7: 0=Monday ... 5=Saturday, 6=Sunday
    const dow = (jdn % 7 + 7) % 7;
    const DOW = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

    // 冲煞: clash branch = day branch + 6; Sha direction from the day triad
    const clashBranch = (dayBranch + 6) % 12;
    const off = officer(dayBranch, monthBranch);
    const man = mansion(jdn);
    const god = dayGod(dayBranch, monthBranch);

    // day-quality rating: officer score + mansion luck + yellow/black belt
    const ratingScore = CM.OFFICER_SCORE[off.no - 1] + (man.lucky ? 1 : -1) + (god.lucky ? 2 : -2);
    const rating =
      ratingScore >= 3 ? { score: ratingScore, cn: "大吉", en: "Excellent", stars: 5 } :
      ratingScore >= 1 ? { score: ratingScore, cn: "吉", en: "Good", stars: 4 } :
      ratingScore >= -1 ? { score: ratingScore, cn: "平", en: "Fair", stars: 3 } :
      ratingScore >= -3 ? { score: ratingScore, cn: "凶", en: "Poor", stars: 2 } :
                          { score: ratingScore, cn: "大凶", en: "Very poor", stars: 1 };

    return {
      chart,
      date: { y: dt.year, m: dt.month, d: dt.day, dow: DOW[dow] },
      officer: off,
      rating: rating,
      yiji: CM.OFFICER_YIJI[off.no - 1],
      clash: { branch: clashBranch, zodiac: CM.ZODIAC[clashBranch], cn: CM.BRANCHES_CN[clashBranch], sha: CM.SHA_DIR[dayBranch] },
      mansion: man,
      dayGod: god,
      nayin: Astro.naYin(dayJiazi),
      kong: Astro.xunKong(dayJiazi),
      solarTerm: {
        no: chart.solarTermNo, cn: CM.SOLAR_TERMS[chart.solarTermNo - 1][0], en: CM.SOLAR_TERMS[chart.solarTermNo - 1][1],
        began: Astro.jdToCivil(ti.curJD, tz),
        nextNo: ti.nextNo, nextCn: CM.SOLAR_TERMS[ti.nextNo - 1][0], nextEn: CM.SOLAR_TERMS[ti.nextNo - 1][1],
        nextAt: Astro.jdToCivil(ti.nextJD, tz),
      },
      moon: {
        lunarDay: lunarDayNo,
        lunarDayCn: CM.LUNAR_DAY_CN[lunarDayNo],
        illum: moon.illum,
        phase: moon.phaseName,
        zodiac: CM.WZODIAC[wzIdx],
      },
      horoscope: horoscope(dayBranch),
    };
  }

  return { compute, officer, mansion, dayGod, horoscope };
})();

if (typeof module !== "undefined") module.exports = TongShu;
