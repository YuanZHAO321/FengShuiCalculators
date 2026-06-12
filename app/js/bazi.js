/* =========================================================================
 * bazi.js — Ba Zi (八字 / Four Pillars of Destiny)
 * ========================================================================= */

const BaZi = (function () {

  /* Ten God 十神 of a stem relative to the Day Master stem. */
  function tenGod(dmStem, otherStem) {
    const dmEl = CM.STEM_ELEMENT[dmStem], dmYang = CM.STEM_YANG[dmStem];
    const oEl = CM.STEM_ELEMENT[otherStem], oYang = CM.STEM_YANG[otherStem];
    const same = (dmYang === oYang);
    // element relations (0W,1F,2E,3M,4Wa) generating cycle W->F->E->M->Wa->W
    const generates = (a, b) => (a + 1) % 5 === b;   // a 生 b
    const controls = (a, b) => (a + 2) % 5 === b;    // a 克 b
    if (oEl === dmEl) return same ? "比肩" : "劫财";
    if (generates(dmEl, oEl)) return same ? "食神" : "伤官";   // 我生
    if (controls(dmEl, oEl)) return same ? "偏财" : "正财";    // 我克
    if (controls(oEl, dmEl)) return same ? "七杀" : "正官";    // 克我
    if (generates(oEl, dmEl)) return same ? "偏印" : "正印";   // 生我
    return "";
  }

  /* 12 Stages of life cycle 长生十二宫 for a stem at a branch. */
  const LIFE_STAGES = ["长生", "沐浴", "冠带", "临官", "帝旺", "衰", "病", "死", "墓", "绝", "胎", "养"];
  const LIFE_STAGES_EN = ["Growth", "Bath", "Cap", "Officer", "Prime", "Decline", "Illness", "Death", "Tomb", "Extinct", "Womb", "Nurture"];
  // 长生 branch for each stem (yang go forward, yin backward)
  const CHANGSHENG = [11, 6, 2, 9, 2, 9, 5, 0, 8, 3]; // 甲亥 乙午 丙寅 丁酉 戊寅 己酉 庚巳 辛子 壬申 癸卯
  function lifeStage(stem, branch) {
    const start = CHANGSHENG[stem];
    const dir = CM.STEM_YANG[stem] ? 1 : -1;
    const idx = ((branch - start) * dir % 12 + 12) % 12;
    return { cn: LIFE_STAGES[idx], en: LIFE_STAGES_EN[idx] };
  }

  /* Luck pillars 大运. Direction: yang-year male / yin-year female → forward.
   * Start age from days to the bounding 节 divided by 3. */
  function luckPillars(dt, chart) {
    const tz = dt.tzOffset == null ? 8 : dt.tzOffset;
    const yangYear = CM.STEM_YANG[chart.year.stem];
    const male = (dt.gender !== "Female");
    const forward = (yangYear === male);

    // sectional term longitudes that bound the birth solar-month
    const lambda = chart.lambda;
    const k = Math.floor((((lambda - 315) % 360 + 360) % 360) / 30);
    const curTermLon = (315 + k * 30) % 360;       // start of current 节
    const nextTermLon = (curTermLon + 30) % 360;

    const hour = dt.hourKnown ? dt.hour : 12;
    const minute = dt.hourKnown ? (dt.minute || 0) : 0;
    const birthJD = Astro.toJD(dt.year, dt.month, dt.day, hour, minute, 0, tz);

    let targetLon = forward ? nextTermLon : curTermLon;
    const guess = birthJD + (forward ? 15 : -15);
    const termJD = Astro.solarTermJD(targetLon, guess, dt.year, dt.month, tz);
    const days = Math.abs(termJD - birthJD);
    const startAgeFloat = days / 3;                  // 3 days = 1 year
    const startAge = Math.round(startAgeFloat * 10) / 10;

    // 3 days = 1 year → 1 day = 4 months; express remainder in months
    const startYears = Math.floor(days / 3);
    const startMonths = Math.round((days - startYears * 3) * 4);
    const termNo = ((((targetLon - 315) % 360) + 360) % 360) / 15 + 1;
    const termCivil = Astro.jdToCivil(termJD, tz);

    // generate 10 luck pillars from month pillar
    const list = [];
    let s = chart.month.stem, b = chart.month.branch;
    for (let i = 0; i < 10; i++) {
      s = (s + (forward ? 1 : -1) + 10) % 10;
      b = (b + (forward ? 1 : -1) + 12) % 12;
      list.push({
        stem: s, branch: b,
        age: Math.floor(startAge) + i * 10,
        year: chart.year.year + Math.floor(startAge) + i * 10,
        god: tenGod(chart.day.stem, s),
      });
    }
    return {
      forward, startAge, startYears, startMonths, list,
      term: { no: termNo, cn: CM.SOLAR_TERMS[termNo - 1][0], en: CM.SOLAR_TERMS[termNo - 1][1], civil: termCivil },
    };
  }

  /* Day-master seasonal standing (得令) from the month branch's main element. */
  function seasonStanding(dmEl, monthBranch) {
    const mEl = CM.STEM_ELEMENT[CM.HIDDEN_STEMS[monthBranch][0]];
    const generates = (a, b) => (a + 1) % 5 === b;
    if (mEl === dmEl) return { key: "旺", cn: "得令而旺", en: "in season — strong" };
    if (generates(mEl, dmEl)) return { key: "相", cn: "得生而相", en: "supported by the season — fairly strong" };
    if (generates(dmEl, mEl)) return { key: "休", cn: "泄气而休", en: "drained by the season — resting" };
    if ((dmEl + 2) % 5 === mEl) return { key: "囚", cn: "耗气而囚", en: "exhausted by the season — trapped" };
    return { key: "死", cn: "受克而死", en: "controlled by the season — weak" };
  }

  /* ---- 命局分析: weighted strength, 喜用神, ten-god distribution ---- */
  function analyze(chart, standing) {
    const dm = chart.day.stem;
    const dmEl = CM.STEM_ELEMENT[dm];
    const pillars = [
      { p: chart.year, w: 1 }, { p: chart.month, w: 1 },
      { p: chart.day, w: 1 }, { p: chart.hour, w: 1 },
    ].filter(x => x.p);

    // weighted element scores: visible stem 1.0; hidden 1.0/0.5/0.3;
    // the month branch (月令) counts ×1.8
    const score = [0, 0, 0, 0, 0];
    const HW = [1, 0.5, 0.3];
    pillars.forEach((x, i) => {
      const isDayStem = x.p === chart.day;
      if (!isDayStem) score[CM.STEM_ELEMENT[x.p.stem]] += 1; // DM itself isn't its own support
      const mult = x.p === chart.month ? 1.8 : 1;
      CM.HIDDEN_STEMS[x.p.branch].forEach((h, j) => {
        score[CM.STEM_ELEMENT[h]] += HW[j] * mult;
      });
    });

    // support = 同我(比劫) + 生我(印); the rest drains or attacks
    const resourceEl = (dmEl + 4) % 5;          // 生我
    const total = score.reduce((a, b) => a + b, 0);
    const support = score[dmEl] + score[resourceEl];
    const pct = total ? Math.round((support / total) * 100) : 50;

    let verdict, favorable;
    if (pct >= 55) {
      verdict = { key: "身强", en: "Strong Day Master" };
      favorable = [(dmEl + 1) % 5, (dmEl + 2) % 5, (dmEl + 3) % 5];   // 食伤·财·官杀
    } else if (pct <= 40) {
      verdict = { key: "身弱", en: "Weak Day Master" };
      favorable = [resourceEl, dmEl];                                  // 印·比劫
    } else {
      verdict = { key: "中和", en: "Balanced" };
      favorable = [resourceEl, dmEl];
    }

    // ten-god distribution over visible stems + main hidden stems
    const godCount = {};
    pillars.forEach(x => {
      if (x.p !== chart.day) {
        const g = tenGod(dm, x.p.stem);
        godCount[g] = (godCount[g] || 0) + 1;
      }
      const main = CM.HIDDEN_STEMS[x.p.branch][0];
      const g2 = tenGod(dm, main);
      if (g2) godCount[g2] = (godCount[g2] || 0) + 1;
    });
    let dominant = null;
    Object.keys(godCount).forEach(k => { if (!dominant || godCount[k] > godCount[dominant]) dominant = k; });

    return {
      score, pct, verdict, favorable, dominant, godCount,
      persona: CM.DM_PERSONA[dm],
    };
  }

  /* Element distribution (count weighted: stems 1, branch main hidden 1). */
  function elementCount(chart) {
    const cnt = [0, 0, 0, 0, 0];
    const pillars = [chart.year, chart.month, chart.day, chart.hour].filter(Boolean);
    pillars.forEach(p => {
      cnt[CM.STEM_ELEMENT[p.stem]]++;
      const hid = CM.HIDDEN_STEMS[p.branch];
      hid.forEach((h, i) => { cnt[CM.STEM_ELEMENT[h]] += (i === 0 ? 1 : 0.5); });
    });
    return cnt;
  }

  function compute(dt) {
    const chart = Astro.fourPillars(dt);
    const dm = chart.day.stem;
    const dayKong = Astro.xunKong(chart.day.jiazi);   // 旬空 judged from day pillar

    function pillarData(p, isDay) {
      if (!p) return null;
      const hidden = CM.HIDDEN_STEMS[p.branch].map(h => ({
        stem: h, god: tenGod(dm, h),
      }));
      return {
        stem: p.stem, branch: p.branch,
        stemGod: isDay ? "日主" : tenGod(dm, p.stem),
        hidden: hidden,
        nayin: Astro.naYin(Astro.jiaziIndex(p.stem, p.branch)),
        life: lifeStage(dm, p.branch),
        kong: !isDay && dayKong.indexOf(p.branch) >= 0,
      };
    }

    const out = {
      raw: chart,
      pillars: {
        year: pillarData(chart.year, false),
        month: pillarData(chart.month, false),
        day: pillarData(chart.day, true),
        hour: pillarData(chart.hour, false),
      },
      dayMaster: dm,
      dayMasterEl: CM.STEM_ELEMENT[dm],
      standing: seasonStanding(CM.STEM_ELEMENT[dm], chart.month.branch),
      kongBranches: dayKong,
      elementCount: elementCount(chart),
      solarTermNo: chart.solarTermNo,
    };
    out.luck = luckPillars(dt, chart);
    out.analysis = analyze(chart, out.standing);
    return out;
  }

  return { compute, tenGod, lifeStage, seasonStanding, analyze };
})();

if (typeof module !== "undefined") module.exports = BaZi;
