/* Regression check against the validated reference values in README.md.
 * Run: node docs/test/check.js  (from repo root, or anywhere — paths resolved) */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const jsDir = path.join(__dirname, "..", "js");
const ctx = { console, module: undefined };
vm.createContext(ctx);
for (const f of ["data.js", "astro.js", "bazi.js", "flyingstars.js", "tongshu.js", "qimen.js", "ai-context.js"]) {
  vm.runInContext(fs.readFileSync(path.join(jsDir, f), "utf8"), ctx, { filename: f });
}
// top-level const in vm scripts lives in the context's lexical env, not on ctx
const { CM, Astro, BaZi, FlyingStars, TongShu, QiMen, AIContext } =
  vm.runInContext("({ CM, Astro, BaZi, FlyingStars, TongShu, QiMen, AIContext })", ctx);

let fails = 0;
function eq(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { fails++; console.log(`FAIL ${label}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); }
  else console.log(`ok   ${label}`);
}
const gz = p => CM.STEMS_CN[p.stem] + CM.BRANCHES_CN[p.branch];

/* ---- Ba Zi: 2026-06-06 19:39 CST → 丙午 甲午 辛亥 戊戌 ---- */
{
  const r = BaZi.compute({ year: 2026, month: 6, day: 6, hour: 19, minute: 39, hourKnown: true, tzOffset: 8, gender: "Male" });
  eq("bazi year", gz(r.raw.year), "丙午");
  eq("bazi month", gz(r.raw.month), "甲午");
  eq("bazi day", gz(r.raw.day), "辛亥");
  eq("bazi hour", gz(r.raw.hour), "戊戌");
}

/* ---- Year-boundary cases around 立春 ---- */
{
  // 2024-02-04 was 立春 (16:27 CST). Morning of Feb 4 → still 癸卯 year.
  const a = Astro.fourPillars({ year: 2024, month: 2, day: 4, hour: 10, minute: 0, hourKnown: true, tzOffset: 8 });
  eq("year before lichun", gz(a.year), "癸卯");
  const b = Astro.fourPillars({ year: 2024, month: 2, day: 4, hour: 20, minute: 0, hourKnown: true, tzOffset: 8 });
  eq("year after lichun", gz(b.year), "甲辰");
  const c = Astro.fourPillars({ year: 2024, month: 1, day: 15, hour: 12, minute: 0, hourKnown: true, tzOffset: 8 });
  eq("january is prev year", gz(c.year), "癸卯");
}

/* ---- Day boundary at 23:00 ---- */
{
  const a = Astro.fourPillars({ year: 2026, month: 6, day: 6, hour: 23, minute: 30, hourKnown: true, tzOffset: 8 });
  const b = Astro.fourPillars({ year: 2026, month: 6, day: 7, hour: 1, minute: 0, hourKnown: true, tzOffset: 8 });
  eq("23:00 day rollover", gz(a.day), gz(b.day));
}

/* ---- Tong Shu: 2026-06-06 → 执 / 女 / 朱雀 / 钗钏金 / 芒种 ---- */
{
  const r = TongShu.compute({ year: 2026, month: 6, day: 6, hour: 19, minute: 39, hourKnown: true, tzOffset: 8 });
  eq("ts officer", r.officer.cn, "执");
  eq("ts officer no", r.officer.no, 6);
  eq("ts mansion", r.mansion.cn, "女");
  eq("ts mansion no", r.mansion.no, 10);
  eq("ts dayGod", r.dayGod.cn, "朱雀");
  eq("ts nayin", r.nayin[0], "钗钏金");
  eq("ts term no", r.solarTerm.no, 9);
  eq("ts moon phase", r.moon.phase, "Waning Gibbous");
  eq("ts lunar day cn", r.moon.lunarDayCn, "廿壹");
}

/* ---- Flying Stars: Period 8 facing N2(子) — full reference chart ---- */
{
  const r = FlyingStars.compute(8, "N2", 0);
  const want = { // [mountain, water, base] — mountain 3 flies reverse, water 4 forward
    C: [3, 4, 8], NW: [2, 5, 9], W: [1, 6, 1], NE: [9, 7, 2], S: [8, 8, 3],
    N: [7, 9, 4], SW: [6, 1, 5], E: [5, 2, 6], SE: [4, 3, 7],
  };
  let allOk = true;
  for (const d of Object.keys(want)) {
    const p = r.palaces[d];
    if (p.mountain !== want[d][0] || p.water !== want[d][1] || p.base !== want[d][2]) {
      allOk = false;
      console.log(`FAIL fs ${d}: got [${p.mountain},${p.water},${p.base}] want [${want[d]}]`);
      fails++;
    }
  }
  if (allOk) console.log("ok   fs P8 N2 full chart");
  eq("fs annual 2026", FlyingStars.annualCenter(2026), 1);
  eq("fs annual 2024", FlyingStars.annualCenter(2024), 3);
  eq("fs annual 2027", FlyingStars.annualCenter(2027), 9);
}

/* ---- Qi Men: internal consistency, 2026-06-06 19:39 ---- */
{
  const r = QiMen.compute({ year: 2026, month: 6, day: 6, hour: 19, minute: 39, hourKnown: true, tzOffset: 8 });
  eq("qm day gz", r.dayGz, "辛亥");
  eq("qm hour gz", r.hourGz, "戊戌");
  eq("qm term", r.term.cn, "芒种");
  // every outer palace must have a star, door, god; stems all 9 distinct on earth plate
  const earthStems = r.palaces.map(p => p.earthStem).filter(Boolean);
  eq("qm earth stems count", new Set(earthStems).size, 9);
  const outer = r.palaces.filter(p => p.palace !== 5);
  eq("qm doors count", outer.filter(p => p.door).length, 8);
  eq("qm gods count", outer.filter(p => p.god).length, 8);
}

/* ---- New features ---- */
{
  eq("jiaziIndex 甲子", Astro.jiaziIndex(0, 0), 0);
  eq("jiaziIndex 辛亥", Astro.jiaziIndex(7, 11), 47);
  eq("jiaziIndex 癸亥", Astro.jiaziIndex(9, 11), 59);
  eq("xunKong 甲子旬", Astro.xunKong(5), [10, 11]);   // 甲子旬 → 戌亥
  eq("xunKong 甲寅旬", Astro.xunKong(55), [0, 1]);    // 甲寅旬 → 子丑

  // accurate lunar day: real new moon 2026-05-16 20:01 UTC
  const nm = Astro.prevNewMoonJD(Astro.toJD(2026, 6, 6, 19, 39, 0, 8), 2026, 6);
  const c = Astro.jdToCivil(nm, 0);
  eq("prev new moon date", [c.year, c.month, c.day], [2026, 5, 16]);
  eq("prev new moon time ±3min", Math.abs(c.hour * 60 + c.minute - (20 * 60 + 1)) <= 3, true);
  // new moon instant = 05-17 04:01 CST → 05-17 is 初一, 05-18 is 初二
  eq("lunar day 05-17", Astro.lunarDay(Astro.toJD(2026, 5, 17, 12, 0, 0, 8), 2026, 5, 8), 1);
  eq("lunar day 05-18", Astro.lunarDay(Astro.toJD(2026, 5, 18, 12, 0, 0, 8), 2026, 5, 8), 2);
  // jdToCivil round-trips toJD
  const rt = Astro.jdToCivil(Astro.toJD(1990, 1, 1, 23, 59, 0, 8), 8);
  eq("jd round-trip", [rt.year, rt.month, rt.day, rt.hour, rt.minute], [1990, 1, 1, 23, 59]);

  // Ba Zi extras
  const b = BaZi.compute({ year: 2026, month: 6, day: 6, hour: 19, minute: 39, hourKnown: true, tzOffset: 8, gender: "Male" });
  eq("bazi kong (辛亥→甲辰旬)", b.kongBranches, [2, 3]);          // 甲辰旬 → 寅卯
  eq("bazi standing exists", typeof b.standing.cn, "string");
  eq("bazi luck term", typeof b.luck.term.cn, "string");
  eq("bazi luck start parts", b.luck.startYears >= 0 && b.luck.startMonths >= 0 && b.luck.startMonths < 12, true);

  // Tong Shu extras: day 辛亥 → 冲巳(Snake), 亥卯未煞西
  const t = TongShu.compute({ year: 2026, month: 6, day: 6, hour: 12, minute: 0, hourKnown: true, tzOffset: 8 });
  eq("ts clash", t.clash.cn, "巳");
  eq("ts sha", t.clash.sha[0], "西");
  eq("ts yiji", typeof t.yiji.yi, "string");
  eq("ts term began day", t.solarTerm.began.day, 5);              // 芒种 2026-06-05 CST
  eq("ts next term", t.solarTerm.nextCn, "夏至");
  eq("ts next term day", t.solarTerm.nextAt.day, 21);

  // Qi Men extras: hour 戊戌 → 甲午旬, 空亡 辰巳; hour branch 戌 → 马在申
  const q = QiMen.compute({ year: 2026, month: 6, day: 6, hour: 19, minute: 39, hourKnown: true, tzOffset: 8 });
  eq("qm kong branches", q.kongBranches, [4, 5]);
  eq("qm horse branch", q.horseBranch, 8);
  eq("qm kong palaces marked", q.palaces.filter(p => p.isKong).length >= 1, true);
  eq("qm horse palace marked", q.palaces.filter(p => p.isHorse).length, 1);
}

/* ---- Analysis modules ---- */
{
  const b = BaZi.compute({ year: 2026, month: 6, day: 6, hour: 19, minute: 39, hourKnown: true, tzOffset: 8, gender: "Male" });
  const A = b.analysis;
  eq("bz analysis pct range", A.pct >= 0 && A.pct <= 100, true);
  eq("bz analysis verdict", ["身强", "身弱", "中和"].indexOf(A.verdict.key) >= 0, true);
  eq("bz favorable count", A.favorable.length >= 2, true);
  eq("bz persona", A.persona[0], "珠玉之金");      // day master 辛
  // 辛金生于午月(火),火克金 → 受克而死 → 弱方,喜印比(土金)
  eq("bz standing key", b.standing.key, "死");
  eq("bz weak favors 土金", A.verdict.key === "身弱" ? JSON.stringify(A.favorable) === "[2,3]" : true, true);

  const f = FlyingStars.compute(8, "N2", 0);
  eq("fs analysis 9 palaces", f.analysis.length, 9);
  const fsN = f.analysis.find(a => a.dir === "N");
  eq("fs facing flag", fsN.isFacing, true);
  // facing N has water star 9 (8-9 combo? mountain=7,water=9 → "7-9" fire combo, 凶)
  eq("fs N combo 7-9", fsN.text.indexOf("回禄") >= 0, true);
  const fsS = f.analysis.find(a => a.dir === "S");
  eq("fs S double 8", fsS.text.indexOf("双八") >= 0, true);   // S: mtn 8, water 8
  eq("fs S rating", fsS.rating, "吉");
  eq("fs ratings valid", f.analysis.every(a => ["吉", "平", "凶"].indexOf(a.rating) >= 0), true);

  const t = TongShu.compute({ year: 2026, month: 6, day: 6, hour: 12, minute: 0, hourKnown: true, tzOffset: 8 });
  // 执(0) + 女宿凶(-1) + 朱雀黑道(-2) = -3 → 凶
  eq("ts rating score", t.rating.score, -3);
  eq("ts rating label", t.rating.cn, "凶");
  eq("ts rating stars", t.rating.stars, 2);

  const q = QiMen.compute({ year: 2026, month: 6, day: 6, hour: 19, minute: 39, hourKnown: true, tzOffset: 8 });
  eq("qm patterns array", Array.isArray(q.patterns), true);
  const outer2 = q.palaces.filter(p => p.palace !== 5);
  eq("qm ratings on outer", outer2.every(p => ["吉", "平", "凶"].indexOf(p.rating) >= 0), true);
  eq("qm factors arrays", outer2.every(p => Array.isArray(p.factors)), true);
}

/* ---- 喜用神: seasonal standing must shift the strength verdict ---- */
{
  // 乙酉年 己卯月 甲辰日 甲戌时 — 甲木生卯月得令(羊刃),应判身强,喜火土金,
  // 而不是按未修正占比误判中和→喜水木 (user-reported bug)
  const chart = {
    year: { stem: 1, branch: 9 },   // 乙酉
    month: { stem: 5, branch: 3 },  // 己卯
    day: { stem: 0, branch: 4 },    // 甲辰
    hour: { stem: 0, branch: 10 },  // 甲戌
  };
  const standing = BaZi.seasonStanding(CM.STEM_ELEMENT[0], 3);
  eq("standing 甲卯月 = 旺", standing.key, "旺");
  const A = BaZi.analyze(chart, standing);
  eq("乙酉己卯甲辰甲戌 verdict", A.verdict.key, "身强");
  eq("乙酉己卯甲辰甲戌 favors 火土金", A.favorable, [1, 2, 3]);
  eq("adjPct > pct when 旺", A.adjPct > A.pct, true);
}

/* ---- AI context serializers ---- */
{
  const dt = { year: 2026, month: 6, day: 6, hour: 19, minute: 39, hourKnown: true, tzOffset: 8, gender: "Male" };
  const sb = AIContext.serialize("bazi", { result: BaZi.compute(dt), input: dt });
  eq("ai bazi has pillars", sb.indexOf("辛亥") >= 0 && sb.indexOf("丙午") >= 0, true);
  eq("ai bazi glosses day master", sb.indexOf("日主") >= 0 && sb.indexOf("辛(阴金)") >= 0, true);
  eq("ai bazi has luck", sb.indexOf("大运") >= 0, true);

  const sf = AIContext.serialize("flyingstars", { result: FlyingStars.compute(8, "N2", 2026) });
  eq("ai fs has palaces", sf.indexOf("山星") >= 0 && sf.indexOf("向星") >= 0, true);
  eq("ai fs has annual", sf.indexOf("流年星") >= 0, true);
  eq("ai fs facing marked", sf.indexOf("向方") >= 0, true);

  const st = AIContext.serialize("tongshu", { result: TongShu.compute(dt), input: dt });
  eq("ai ts officer", st.indexOf("执日") >= 0, true);
  eq("ai ts clash", st.indexOf("冲蛇") >= 0, true);
  eq("ai ts rating stars", st.indexOf("★") >= 0, true);

  const sq = AIContext.serialize("qimen", { result: QiMen.compute(dt) });
  eq("ai qm ju", sq.indexOf("局") >= 0 && sq.indexOf("值符") >= 0, true);
  eq("ai qm nine palaces", sq.split("宫(").length >= 8, true);

  // system prompts & presets exist for all four modules
  ["bazi", "flyingstars", "tongshu", "qimen"].forEach(k => {
    eq(`ai sys ${k}`, AIContext.systemPrompt(k).indexOf("盘面数据") >= 0, true);
    eq(`ai preset ${k}`, AIContext.preset(k).length > 50, true);
  });
}

/* ---- Astro sanity: solar longitude at J2000 epoch & solstice ---- */
{
  // 2026 summer solstice ≈ June 21 10:24 UTC → λ=90
  const jd = Astro.solarTermJD(90, Astro.toJD(2026, 6, 21, 12, 0, 0, 0), 2026, 6, 0);
  const lam = Astro.sunLongitude(jd, 2026, 6);
  eq("solstice λ≈90", Math.abs(((lam - 90 + 180) % 360) - 180) < 0.001, true);
}

console.log(fails ? `\n${fails} FAILURE(S)` : "\nALL PASS");
process.exit(fails ? 1 : 0);
