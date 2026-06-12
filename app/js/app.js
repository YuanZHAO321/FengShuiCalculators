/* =========================================================================
 * app.js — UI controller: tabs, form handling, rendering
 * ========================================================================= */
(function () {
  "use strict";
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));
  const elClass = i => "el-" + CM.ELEMENTS[i];

  function gzChar(stem, branch) { return CM.STEMS_CN[stem] + CM.BRANCHES_CN[branch]; }
  function gzPy(stem, branch) { return CM.STEMS[stem] + " " + CM.BRANCHES[branch]; }

  /* ---------------- Tabs (accessible, remembered) ---------------- */
  const TABS = $$(".tab");
  function selectTab(tab, focus) {
    TABS.forEach(t => {
      const on = t === tab;
      t.classList.toggle("active", on);
      t.setAttribute("aria-selected", on ? "true" : "false");
      t.tabIndex = on ? 0 : -1;
    });
    $$(".panel").forEach(p => p.classList.toggle("active", p.id === tab.dataset.tab));
    if (focus) tab.focus();
    try { localStorage.setItem("fsc-tab", tab.dataset.tab); } catch (e) { /* private mode */ }
  }
  TABS.forEach((tab, i) => {
    tab.addEventListener("click", () => selectTab(tab));
    tab.addEventListener("keydown", e => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      const next = (i + (e.key === "ArrowRight" ? 1 : -1) + TABS.length) % TABS.length;
      selectTab(TABS[next], true);
    });
  });
  try {
    const saved = localStorage.getItem("fsc-tab");
    const t = saved && TABS.find(x => x.dataset.tab === saved);
    if (t) selectTab(t);
  } catch (e) { /* private mode */ }

  /* ---------------- Date helpers ---------------- */
  const pad2 = n => String(n).padStart(2, "0");
  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }
  function nowHM() { const d = new Date(); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }
  function fmtCivil(c) {
    return `${c.year}-${pad2(c.month)}-${pad2(c.day)} ${pad2(c.hour)}:${pad2(c.minute)}`;
  }
  /* Fill a form's date/time with the current local moment. */
  function fillNow(prefix) {
    $("#" + prefix + "-date").value = todayISO();
    const t = $("#" + prefix + "-time");
    if (t) t.value = nowHM();
  }
  $$(".now-btn").forEach(btn => btn.addEventListener("click", () => {
    fillNow(btn.dataset.now);
    btn.closest("form").requestSubmit();
  }));
  function parseForm(prefix) {
    const dateEl = $("#" + prefix + "-date");
    const timeEl = $("#" + prefix + "-time");
    const tzEl = $("#" + prefix + "-tz");
    const [y, m, d] = dateEl.value.split("-").map(Number);
    let hh = 12, mm = 0, known = true;
    if (timeEl && timeEl.value) { [hh, mm] = timeEl.value.split(":").map(Number); }
    const hkEl = $("#" + prefix + "-hourknown");
    if (hkEl) known = hkEl.checked;
    const genderEl = $("#" + prefix + "-gender");
    return {
      year: y, month: m, day: d, hour: hh, minute: mm,
      hourKnown: known, tzOffset: tzEl ? parseFloat(tzEl.value) : 8,
      gender: genderEl ? genderEl.value : "Male",
    };
  }

  /* ======================================================================
   *  BA ZI
   * ==================================================================== */
  $("#bazi-form").addEventListener("submit", e => {
    e.preventDefault();
    const dt = parseForm("bz");
    const r = BaZi.compute(dt);
    $("#bazi-result").innerHTML = renderBaZi(r, dt);
    if (typeof AI !== "undefined") AI.setChart("bazi", r, dt);
  });

  function pillarCell(p) {
    if (!p) return '<td><em style="color:#999">—</em></td>';
    let hid = p.hidden.map(h =>
      `<span class="${elClass(CM.STEM_ELEMENT[h.stem])}">${CM.STEMS_CN[h.stem]}</span>` +
      `<small> ${CM.TEN_GODS[h.god] ? h.god : ""}</small>`).join(" · ");
    return `<td>
      <div class="god">${p.stemGod}</div>
      <div class="gz-char ${elClass(CM.STEM_ELEMENT[p.stem])}">${CM.STEMS_CN[p.stem]}</div>
      <div class="gz-char ${elClass(CM.BRANCH_ELEMENT[p.branch])}">${CM.BRANCHES_CN[p.branch]}${p.kong ? '<span class="kong-mark" title="旬空 Void">空</span>' : ""}</div>
      <div class="gz-py">${CM.STEMS[p.stem]} / ${CM.BRANCHES[p.branch]} (${CM.ZODIAC[p.branch]})</div>
      <div class="hidden-stems">${hid}</div>
      <div class="gz-el">${p.life.cn} ${p.life.en}</div>
      <div class="gz-el">${p.nayin[0]} · ${p.nayin[1]}</div>
    </td>`;
  }

  function renderBaZi(r, dt) {
    const P = r.pillars;
    const dm = r.dayMaster;
    let html = `<div class="section-title">Four Pillars 四柱 — Day Master:
      <span class="${elClass(r.dayMasterEl)}">${CM.STEMS_CN[dm]} ${CM.STEMS[dm]} (${CM.ELEMENTS[r.dayMasterEl]})</span>
      <span class="standing">${r.standing.key} · ${r.standing.cn} — ${r.standing.en}</span></div>`;
    html += `<table class="pillars">
      <tr><th>Hour 时</th><th>Day 日</th><th>Month 月</th><th>Year 年</th></tr>
      <tr>${pillarCell(P.hour)}${pillarCell(P.day)}${pillarCell(P.month)}${pillarCell(P.year)}</tr>
    </table>`;
    html += `<p class="note">旬空 Void branches (from the day pillar 旬): ` +
      r.kongBranches.map(b => `${CM.BRANCHES_CN[b]} ${CM.BRANCHES[b]}`).join(" · ") + `.</p>`;

    // element distribution
    const cnt = r.elementCount;
    const max = Math.max(...cnt, 1);
    html += `<div class="section-title">Five Elements Balance 五行分布</div>`;
    cnt.forEach((c, i) => {
      const w = Math.round((c / max) * 260) + 2;
      html += `<div class="elbar"><span class="lab ${elClass(i)}">${CM.ELEMENTS[i]} ${CM.ELEMENTS_CN[i]}</span>
        <span class="bar" style="width:${w}px;background:${CM.ELEMENT_COLOR[i]}"></span>
        <span>${c}</span></div>`;
    });

    // luck pillars
    const L = r.luck;
    const nowYear = new Date().getFullYear();
    const isCur = x => nowYear >= x.year && nowYear < x.year + 10;
    html += `<div class="section-title">Luck Pillars 大运 — ${L.forward ? "Forward 顺行" : "Reverse 逆行"}, starts at ${L.startYears}y ${L.startMonths}m (~age ${L.startAge})</div>`;
    html += `<p class="note">起运依据: ${L.forward ? "顺数至下一节" : "逆数至上一节"} ${L.term.cn} ${L.term.en} (${fmtCivil(L.term.civil)}), 3 days = 1 year. Highlighted = current decade.</p>`;
    html += `<div class="table-scroll"><table class="luck-table"><tr><th>Age</th>` +
      L.list.map(x => `<td class="${isCur(x) ? "luck-current" : ""}">${x.age}<br><small>${x.year}</small></td>`).join("") + `</tr>`;
    html += `<tr><th>Pillar</th>` +
      L.list.map(x => `<td class="${isCur(x) ? "luck-current" : ""}"><span class="${elClass(CM.STEM_ELEMENT[x.stem])}">${CM.STEMS_CN[x.stem]}</span>` +
        `<span class="${elClass(CM.BRANCH_ELEMENT[x.branch])}">${CM.BRANCHES_CN[x.branch]}</span></td>`).join("") + `</tr>`;
    html += `<tr><th>God</th>` + L.list.map(x => `<td class="${isCur(x) ? "luck-current" : ""}"><small>${x.god}</small></td>`).join("") + `</tr></table></div>`;

    // ---- analysis ----
    const A = r.analysis;
    html += `<div class="section-title">命局分析 Chart Analysis</div><div class="analysis card">`;
    html += `<div class="a-row"><span class="a-chip ${A.verdict.key === "身强" ? "r-ji" : A.verdict.key === "身弱" ? "r-xiong" : "r-ping"}">${A.verdict.key}</span>
      <b>${A.verdict.en}</b> — 比劫印绶共占 ${A.pct}%(${r.standing.cn})
      <div class="a-meter"><span style="width:${A.pct}%"></span></div></div>`;
    html += `<div class="a-row"><b>日主气质</b> ${CM.STEMS_CN[r.dayMaster]} · ${A.persona[0]}:${A.persona[1]}<br><small>${A.persona[2]}</small></div>`;
    html += `<div class="a-row"><b>喜用五行</b> ` + A.favorable.map(e =>
      `<span class="el-chip" style="border-color:${CM.ELEMENT_COLOR[e]};color:${CM.ELEMENT_COLOR[e]}">${CM.ELEMENTS_CN[e]} ${CM.ELEMENTS[e]} · ${CM.ELEMENT_ADVICE[e].dir} · ${CM.ELEMENT_ADVICE[e].color}</span>`).join(" ") + `</div>`;
    const gks = Object.keys(A.godCount);
    html += `<div class="a-row"><b>十神分布</b> ` + gks.map(k =>
      `<span class="g-chip${k === A.dominant ? " dom" : ""}">${k} ×${A.godCount[k]}</span>`).join(" ") +
      (A.dominant ? ` <small>主导: ${A.dominant} ${CM.TEN_GODS[A.dominant]}</small>` : "") + `</div>`;
    html += `</div>`;

    html += `<p class="note">Solar term at birth: ${CM.SOLAR_TERMS[r.solarTermNo - 1][0]} ${CM.SOLAR_TERMS[r.solarTermNo - 1][1]}. ` +
      `Hidden stems listed main→residual. Day boundary at 23:00 (late 子时). ` +
      `身强弱为简化判断(权重计分),仅供参考。</p>`;
    return html;
  }

  /* ======================================================================
   *  FLYING STARS
   * ==================================================================== */
  (function initFS() {
    const per = $("#fs-period");
    const ranges = ["1864-1884","1884-1904","1904-1924","1924-1944","1944-1964","1964-1984","1984-2004","2004-2024","2024-2044"];
    for (let i = 1; i <= 9; i++) per.add(new Option(`Period ${i} (${ranges[i-1]})`, i, i===9, i===9));
    const fac = $("#fs-facing");
    CM.MOUNTAINS.forEach(m => fac.add(new Option(`${m.code} — ${m.cn} ${m.py} (${m.deg[0]}°–${m.deg[1]}°)`, m.code)));
    fac.value = "N2";
    const yr = $("#fs-year");
    yr.add(new Option("None", 0));
    const cur = new Date().getFullYear();
    for (let y = 2044; y >= 1980; y--) yr.add(new Option(y, y, y === cur, y === cur));
  })();

  $("#fs-form").addEventListener("submit", e => {
    e.preventDefault();
    const period = +$("#fs-period").value;
    const facing = $("#fs-facing").value;
    const year = +$("#fs-year").value;
    const r = FlyingStars.compute(period, facing, year);
    $("#fs-result").innerHTML = renderFS(r);
    if (typeof AI !== "undefined") AI.setChart("flyingstars", r);
  });

  function renderFS(r) {
    const order = ["NW","N","NE","W","C","E","SW","S","SE"];
    const labels = { NW:"NW",N:"N ↑",NE:"NE",W:"W",C:"中",E:"E",SW:"SW",S:"S",SE:"SE" };
    let cells = order.map(d => {
      const p = r.palaces[d];
      const ann = p.annual ? `<div class="ann">${p.annual}</div>` : "";
      if (d === "C") {
        return `<div class="fs-cell center"><div class="dir">${labels[d]}</div>
          <div class="row1"><span class="mtn">${p.mountain}</span><span class="wtr">${p.water}</span></div>
          <div class="base">${p.base}</div>${ann}</div>`;
      }
      return `<div class="fs-cell"><div class="dir">${labels[d]}</div>
        <div class="row1"><span class="mtn">${p.mountain}</span><span class="wtr">${p.water}</span></div>
        <div class="base">${p.base}</div>${ann}</div>`;
    }).join("");

    const f = r.facing;
    let html = `<div class="fs-top">
      <div class="box"><div>Period</div><div class="big">${r.period}</div></div>
      <div class="box"><div>Facing 向</div><div class="big">${r.facingCode}</div><div>${f.cn} ${f.py}</div></div>
      <div class="box"><div>Sitting 坐</div><div class="big">${r.sittingCode}</div></div>
      <div class="box"><div>Chart Type</div><div style="font-size:14px;margin-top:8px">${r.type}</div></div>
    </div>`;
    html += `<div class="fs-chart">${cells}</div>`;
    html += `<div class="fs-legend">Each palace: <b class="mtn">left = Mountain Star 山星</b>, <b class="wtr">right = Water Star 向星</b>, center = Period/Base Star 运星` +
      (r.annualYear ? `, <span style="color:#6a1b9a">bottom-right = Annual ${r.annualYear} 流年</span>` : "") +
      `. North is up ↑.</div>`;

    // ---- per-palace analysis ----
    const DIR_CN = { N: "北", S: "南", E: "东", W: "西", NE: "东北", NW: "西北", SE: "东南", SW: "西南", C: "中" };
    html += `<div class="section-title">宫位分析 Palace Analysis</div><div class="analysis card">`;
    r.analysis.forEach(a => {
      const role = a.isFacing ? " · 向方" : a.isSitting ? " · 坐方" : "";
      html += `<div class="a-row"><span class="a-chip ${a.rating === "吉" ? "r-ji" : a.rating === "凶" ? "r-xiong" : "r-ping"}">${a.rating}</span>
        <b>${a.dir} ${DIR_CN[a.dir]}${role}</b> — ${a.text}</div>`;
    });
    html += `</div>`;

    // star reference
    html += `<div class="section-title">Star Reference 九星</div><table class="info-table">`;
    for (let s = 1; s <= 9; s++) {
      const si = CM.STAR_INFO[s];
      html += `<tr><td class="k">${s} ${si.cn} (${si.el})</td><td>${si.name} — ${si.nature}</td></tr>`;
    }
    html += `</table>`;
    return html;
  }

  /* ======================================================================
   *  TONG SHU
   * ==================================================================== */
  fillNow("ts");
  $("#ts-form").addEventListener("submit", e => {
    e.preventDefault();
    const dt = parseForm("ts");
    const r = TongShu.compute(dt);
    $("#tongshu-result").innerHTML = renderTongShu(r, dt);
    if (typeof AI !== "undefined") AI.setChart("tongshu", r, dt);
  });
  $("#ts-form").requestSubmit();   // show today's almanac on load

  function renderTongShu(r, dt) {
    const C = r.chart;
    const MON = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    let html = `<div class="section-title">${MON[dt.month-1]} ${dt.day}, ${dt.year} — ${r.date.dow}</div>`;

    const rt = r.rating;
    html += `<div class="day-rating ${rt.score >= 1 ? "r-ji" : rt.score <= -2 ? "r-xiong" : "r-ping"}">
      <span class="stars">${"★".repeat(rt.stars)}${"☆".repeat(5 - rt.stars)}</span>
      <b>${rt.cn} ${rt.en}</b>
      <small>建除 ${r.officer.cn} · ${r.mansion.cn}宿${r.mansion.lucky ? "吉" : "凶"} · ${r.dayGod.cn}${r.dayGod.lucky ? "黄道" : "黑道"}</small>
    </div>`;

    html += `<table class="info-table"><tr><th colspan="2">Day Basic Info 日基本信息</th></tr>`;
    const row = (k, v) => `<tr><td class="k">${k}</td><td>${v}</td></tr>`;
    html += row("12 Officers 建除", `${r.officer.no} — ${r.officer.cn} ${r.officer.en}`);
    html += row("宜 Suitable", `<span class="yi">${r.yiji.yi}</span>`);
    html += row("忌 Avoid", `<span class="ji">${r.yiji.ji}</span>`);
    html += row("冲煞 Clash &amp; Sha", `冲 ${r.clash.cn} Clash ${r.clash.zodiac} · 煞${r.clash.sha[0]} Sha ${r.clash.sha[1]}`);
    html += row("旬空 Void", r.kong.map(b => `${CM.BRANCHES_CN[b]} ${CM.BRANCHES[b]}`).join(" · "));
    html += row("28 Constellations 二十八宿", `${r.mansion.no} — ${r.mansion.cn} ${r.mansion.en} (${r.mansion.lucky ? "吉 auspicious" : "凶 inauspicious"})`);
    html += row("Yellow &amp; Black Belt 黄黑道", `<span style="color:${r.dayGod.lucky?'#2e7d32':'#c62828'}">${r.dayGod.no} — ${r.dayGod.cn} ${r.dayGod.en} (${r.dayGod.lucky?"黄道吉":"黑道凶"})</span>`);
    html += row("Na Yin 纳音 (day)", `${r.nayin[0]} · ${r.nayin[1]}`);
    html += row("Solar Term 节气", `${r.solarTerm.no} — ${r.solarTerm.cn} ${r.solarTerm.en} <small>(began ${fmtCivil(r.solarTerm.began)})</small>`);
    html += row("Next Term 下一节气", `${r.solarTerm.nextCn} ${r.solarTerm.nextEn} — ${fmtCivil(r.solarTerm.nextAt)}`);
    html += row("Moon 月相", `${r.moon.lunarDayCn} (day ${r.moon.lunarDay}) · ${r.moon.phase} · ${(r.moon.illum*100).toFixed(0)}% illuminated`);
    html += row("Moon Sign 月座", `${r.moon.zodiac[0]} ${r.moon.zodiac[1]}`);
    html += `</table>`;

    // four pillars (compact)
    html += `<div class="section-title">Four Pillars 四柱</div>`;
    html += `<table class="pillars"><tr><th>Hour</th><th>Day</th><th>Month</th><th>Year</th></tr><tr>`;
    [C.hour, C.day, C.month, C.year].forEach(p => {
      if (!p) { html += `<td>—</td>`; return; }
      html += `<td><div class="gz-char ${elClass(CM.STEM_ELEMENT[p.stem])}">${CM.STEMS_CN[p.stem]}</div>
        <div class="gz-char ${elClass(CM.BRANCH_ELEMENT[p.branch])}">${CM.BRANCHES_CN[p.branch]}</div>
        <div class="gz-py">${CM.STEMS[p.stem]} ${CM.BRANCHES[p.branch]}</div>
        <div class="gz-el">${CM.ZODIAC[p.branch]}</div></td>`;
    });
    html += `</tr></table>`;

    // horoscope
    html += `<div class="section-title">Horoscope Forecast 生肖运势</div><div class="horo">`;
    for (let b = 0; b < 12; b++) {
      const col = r.horoscope[b];
      html += `<div class="c-${col}">${CM.ZODIAC[b]}<br><small>${CM.BRANCHES_CN[b]}</small></div>`;
    }
    html += `</div><p class="note"><span class="c-red">Red</span> = harmonious (三合/六合), <span class="c-black">Black</span> = clashing triad, <span class="c-grey">Grey</span> = neutral, relative to the day branch.</p>`;
    return html;
  }

  /* ======================================================================
   *  QI MEN DUN JIA
   * ==================================================================== */
  fillNow("qm");
  $("#qm-form").addEventListener("submit", e => {
    e.preventDefault();
    const dt = parseForm("qm");
    dt.hourKnown = true;
    const r = QiMen.compute(dt);
    $("#qimen-result").innerHTML = renderQiMen(r);
    if (typeof AI !== "undefined") AI.setChart("qimen", r, dt);
  });
  $("#qm-form").requestSubmit();   // cast the chart for now on load

  function renderQiMen(r) {
    let html = `<table class="info-table"><tr><th colspan="2">Chart Parameters 局</th></tr>`;
    const row = (k, v) => `<tr><td class="k">${k}</td><td>${v}</td></tr>`;
    html += row("Day / Hour 干支", `${r.dayGz} 日 · ${r.hourGz} 时`);
    html += row("Solar Term 节气", `${r.term.no} ${r.term.cn} ${r.term.en}`);
    html += row("Dun & Ju 遁局", `${r.dun} · ${r.yuan} · <b>${r.juText}</b>`);
    html += row("Xun Leader 旬首", `${r.xunShou} (仪 ${r.fuYi})`);
    html += row("Duty Chief 值符 / Duty Door 值使", `${r.fuStar} / ${r.shiDoor} ${r.shiDoorEn}`);
    html += row("空亡 Void / 马星 Horse", `空亡 ${r.kongBranches.map(b => CM.BRANCHES_CN[b]).join("")} · 马星在${CM.BRANCHES_CN[r.horseBranch]}`);
    html += `</table>`;

    html += `<div class="section-title">Nine Palaces 九宫盘 (South ↑)</div>`;
    html += `<div class="qm-chart">`;
    r.palaces.forEach(p => {
      const center = p.palace === 5 ? " center" : "";
      const fuTag = p.isFu ? '<span class="tag">符</span>' : "";
      const hrTag = p.isHour ? '<span class="tag">时</span>' : "";
      const kongTag = p.isKong ? '<span class="tag tag-kong">空</span>' : "";
      const horseTag = p.isHorse ? '<span class="tag tag-horse">马</span>' : "";
      const qin = p.heavenStemQin ? `<span class="hstem">/${p.heavenStemQin}</span>` : "";
      const rChip = p.rating ? `<span class="cell-rating ${p.rating === "吉" ? "r-ji" : p.rating === "凶" ? "r-xiong" : "r-ping"}">${p.rating}</span>` : "";
      html += `<div class="qm-cell${center}">${rChip}
        <div class="god">${p.god ? p.god.cn + " " + p.god.en : ""}</div>
        <div class="star">${p.star || ""}</div>
        <div class="stems"><span class="hstem">${p.heavenStem || ""}${qin ? "" : ""}</span>${qin}</div>
        <div class="door">${p.door || ""}</div>
        <div class="stems"><span class="estem">${p.earthStem || ""}</span></div>
        <div class="pmeta">${p.palace} ${p.trigram} ${p.dir}${fuTag}${hrTag}${kongTag}${horseTag}</div>
      </div>`;
    });
    html += `</div>`;

    // ---- patterns & per-palace factors ----
    html += `<div class="section-title">格局分析 Pattern Analysis</div><div class="analysis card">`;
    if (r.patterns.length) {
      r.patterns.forEach(pt => {
        html += `<div class="a-row"><span class="a-chip ${pt.bad ? "r-xiong" : "r-ji"}">${pt.bad ? "凶" : "吉"}</span><b>${pt.cn}</b> — ${pt.en}</div>`;
      });
    } else {
      html += `<div class="a-row"><span class="a-chip r-ping">平</span>无伏吟反吟、三奇得门等特殊格局 — no special global pattern.</div>`;
    }
    const noted = r.palaces.filter(p => p.palace !== 5 && (p.factors || []).length);
    if (noted.length) {
      html += `<div class="a-row"><b>宫位标记</b> ` + noted.map(p =>
        `<span class="g-chip">${p.trigram}宫 ${p.dir}: ${p.factors.join("·")}</span>`).join(" ") + `</div>`;
    }
    html += `<div class="a-row"><small>吉/平/凶 chip per palace combines door (开休生吉 / 死伤惊凶), star (心任辅吉 / 蓬芮柱凶), 门迫 and 空亡. 仅供参考。</small></div>`;
    html += `</div>`;
    html += `<p class="note">Each palace top→bottom: <span style="color:#6a1b9a">God 八神</span>, <span style="color:#1565c0">Star 九星</span>, <span style="color:#b08d00">Heaven stem 天盘</span>, <span style="color:#c62828">Door 八门</span>, <span style="color:#2e7d32">Earth stem 地盘</span>. 符 = Duty Chief palace, 时 = hour-stem palace, 空 = 空亡 void, 马 = 驿马 horse. Hour-based 转盘 method (拆补法).</p>`;
    return html;
  }

})();
