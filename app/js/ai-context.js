/* =========================================================================
 * ai-context.js — serialize each calculator's current chart into a fully
 * self-describing plain-text context for an LLM, plus the preset one-click
 * analysis prompts and the system prompt.
 *
 * Design rule ("weak-model compatibility"): the context must stand alone —
 * every term is glossed inline, every value is labelled with what it means
 * and what the model should do with it, so even a small model can read it
 * without prior knowledge of this app.
 * ========================================================================= */

const AIContext = (function () {
  "use strict";

  const ZODIAC_CN = ["鼠", "牛", "虎", "兔", "龙", "蛇", "马", "羊", "猴", "鸡", "狗", "猪"];
  const pad2 = n => String(n).padStart(2, "0");

  const stemDesc = i => `${CM.STEMS_CN[i]}(${CM.STEM_YANG[i] ? "阳" : "阴"}${CM.ELEMENTS_CN[CM.STEM_ELEMENT[i]]})`;
  const branchDesc = i => `${CM.BRANCHES_CN[i]}(${CM.ELEMENTS_CN[CM.BRANCH_ELEMENT[i]]},生肖${ZODIAC_CN[i]})`;
  const fmtCivil = c => `${c.year}-${pad2(c.month)}-${pad2(c.day)} ${pad2(c.hour)}:${pad2(c.minute)}`;
  const fmtTz = tz => "UTC" + (tz >= 0 ? "+" : "") + tz;

  /* ------------------------------ System ------------------------------ */

  const MODULE_NAMES = {
    bazi: "八字四柱 (Ba Zi)",
    flyingstars: "玄空飞星 (Flying Stars)",
    tongshu: "通书择日 (Tong Shu Almanac)",
    qimen: "奇门遁甲 (Qi Men Dun Jia)",
  };

  function systemPrompt(moduleKey) {
    return [
      `你是一位精通中国传统玄学（八字命理、玄空风水、择日学、奇门遁甲）的资深顾问，现在为用户解读「${MODULE_NAMES[moduleKey] || moduleKey}」的盘面。`,
      "",
      "你必须遵守的规则：",
      "1. 用户消息开头会附带一段【盘面数据】，它由排盘程序按传统算法精确计算并已校验，是唯一事实来源。直接采用其中的干支、星曜、宫位等数值，绝对不要自己重新排盘、推算或更改任何数值。",
      "2. 数据中每个术语都附有括号说明，按说明理解即可，不要凭空引入数据里不存在的星煞或数值。",
      "3. 数据中“程序初步评级/分析”是简化的规则打分，可作为参考基线；你可以在传统理论框架内补充、细化甚至有理有据地修正，但需说明理由。",
      "4. 输出使用与用户相同的语言（用户未指明时默认简体中文），用 Markdown 排版：小标题、要点列表，重要结论加粗。先给一句话总评，再分项展开，最后给可执行的建议。",
      "5. 语气专业、具体、克制：结合盘面给出有针对性的判断，避免空泛套话；不做绝对化的吉凶断言，不渲染恐慌。",
      "6. 涉及健康、法律、投资等重大决定时，提醒用户此为传统民俗文化参考，应以专业意见为准。",
    ].join("\n");
  }

  /* ------------------------------- Ba Zi ------------------------------- */

  function serializeBaZi(r, dt) {
    const L = [];
    L.push("【盘面数据 · 八字四柱】");
    L.push("（由程序按传统子平法排出：年柱以立春换年，月柱以节气定月，日柱 23:00 换日，请直接采用）");
    L.push(`- 出生(公历): ${dt.year}-${pad2(dt.month)}-${pad2(dt.day)} ${dt.hourKnown ? pad2(dt.hour) + ":" + pad2(dt.minute || 0) : "时辰未知"}，时区 ${fmtTz(dt.tzOffset)}，性别: ${dt.gender === "Female" ? "女" : "男"}`);
    L.push("");
    L.push("一、四柱（每柱=天干+地支；“十神”=该干与日主的生克关系标签）");
    const order = [["年柱", r.pillars.year], ["月柱", r.pillars.month], ["日柱", r.pillars.day], ["时柱", r.pillars.hour]];
    order.forEach(([name, p]) => {
      if (!p) { L.push(`- ${name}: 缺（出生时辰未知，不排时柱）`); return; }
      const hid = p.hidden.map(h => `${CM.STEMS_CN[h.stem]}(${h.god || "日主本气"})`).join("、");
      L.push(`- ${name}: ${CM.STEMS_CN[p.stem]}${CM.BRANCHES_CN[p.branch]} —— 天干${stemDesc(p.stem)},十神=${p.stemGod}；地支${branchDesc(p.branch)},藏干(支中所藏天干及其十神): ${hid}；纳音=${p.nayin[0]}；日主于此支处“${p.life.cn}”位(十二长生)${p.kong ? "；此支逢旬空(空亡,力量减弱)" : ""}`);
    });
    L.push(`- 旬空(以日柱所在旬判定的空亡地支): ${r.kongBranches.map(b => CM.BRANCHES_CN[b]).join("、")}`);
    L.push("");
    L.push(`二、日主(=日柱天干,代表命主本人): ${stemDesc(r.dayMaster)}，意象“${r.analysis.persona[0]}”`);
    L.push(`- 月令旺衰(日主在出生月支的季节状态,旺相休囚死五等): ${r.standing.key} —— ${r.standing.cn}`);
    L.push("");
    const cnt = r.elementCount;
    L.push("三、五行分布（四柱天干+藏干的加权计数,数值越大该五行越多）");
    L.push("- " + cnt.map((c, i) => `${CM.ELEMENTS_CN[i]} ${Math.round(c * 10) / 10}`).join("，"));
    L.push("");
    const Lk = r.luck;
    L.push(`四、大运（每步管10年；本盘${Lk.forward ? "顺行" : "逆行"}，约 ${Lk.startYears} 岁 ${Lk.startMonths} 个月起运）`);
    L.push("- " + Lk.list.map(x => `${x.age}岁(${x.year}年)起 ${CM.STEMS_CN[x.stem]}${CM.BRANCHES_CN[x.branch]}[干十神=${x.god}]`).join("；"));
    L.push("");
    const A = r.analysis;
    L.push("五、程序初步分析（简化加权打分,供参考基线）");
    L.push(`- 身强弱: ${A.verdict.key}（生扶日主的力量[比劫+印绶]占总量 ${A.pct}%，按月令${r.standing.key}修正为 ${A.adjPct}%；修正后≥55%判身强,≤40%判身弱,之间为中和）`);
    L.push(`- 喜用五行(初判对命主有利的五行): ${A.favorable.map(e => CM.ELEMENTS_CN[e]).join("、")}`);
    L.push(`- 十神分布: ${Object.keys(A.godCount).map(k => `${k}×${A.godCount[k]}`).join("，")}${A.dominant ? `；主导十神=${A.dominant}` : ""}`);
    L.push("");
    L.push("术语速查: 十神十类——比肩/劫财(与日主同五行)、食神/伤官(日主所生)、正财/偏财(日主所克,主财)、正官/七杀(克日主,主事业压力)、正印/偏印(生日主,主庇护学识)。纳音=六十甲子的五行别名。旬空=地支落空亡,该柱力量虚浮。十二长生=干在支上的气数阶段(长生沐浴冠带临官帝旺衰病死墓绝胎养)。");
    return L.join("\n");
  }

  const PRESET_BAZI = [
    "请对这张八字命盘做一次全面深入的分析，按以下结构输出：",
    "1. **总评**：一句话概括此命局的核心特点；",
    "2. **日主与格局**：结合月令旺衰、五行分布判断身强身弱，评估程序初判是否成立，并指出命局格局与病药；",
    "3. **用神喜忌**：明确喜用五行与忌讳五行，给出方位、颜色、行业上的趋避建议；",
    "4. **性格画像**：由日主意象与十神分布推断性格优势与盲点；",
    "5. **事业与财运**：结合财官食伤的配置分析适合的发展方向；",
    "6. **婚姻六亲**：从配偶星(男看财星/女看官星)与日支分析；",
    "7. **健康提示**：由五行偏枯指出需要留意的脏腑系统；",
    "8. **大运走势**：逐步点评列出的大运，指出最值得把握和需要谨慎的十年，特别说明当前/即将进入的大运。",
  ].join("\n");

  /* ---------------------------- Flying Stars ---------------------------- */

  function serializeFS(r) {
    const DIR_CN = { N: "北", S: "南", E: "东", W: "西", NE: "东北", NW: "西北", SE: "东南", SW: "西南", C: "中宫" };
    const L = [];
    L.push("【盘面数据 · 玄空飞星宅运盘】");
    L.push("（由程序按玄空飞星法排出：运星入中顺飞，山星/向星按三元龙阴阳顺逆飞布，请直接采用）");
    const ranges = ["1864-1884", "1884-1904", "1904-1924", "1924-1944", "1944-1964", "1964-1984", "1984-2004", "2004-2024", "2024-2044"];
    L.push(`- 元运(以建造/入住时期定): ${r.period}运（${ranges[r.period - 1]}年）`);
    L.push(`- 坐向: 向${r.facingCode}(${r.facing.cn}山,二十四山之一)，坐${r.sittingCode}；即房屋朝向${DIR_CN[r.facing.dir]}方、背靠${DIR_CN[r.sitDir]}方`);
    L.push(`- 格局类型: ${r.type}（旺山旺向=丁财两旺;上山下水=损丁破财,需地形配合;双星到向=旺财;双星到坐=旺丁）`);
    if (r.annualYear) L.push(`- 流年: ${r.annualYear}年（流年星已布入各宫）`);
    L.push("");
    L.push("九宫飞星明细（每宫三/四颗星：山星主人丁健康人际，向星主财运事业，运星为底盘" + (r.annualYear ? "，流年星主当年应期" : "") + "）：");
    ["N", "NE", "E", "SE", "S", "SW", "W", "NW", "C"].forEach(d => {
      const p = r.palaces[d];
      const a = r.analysis.find(x => x.dir === d);
      const role = a.isFacing ? "【向方·纳气口】" : a.isSitting ? "【坐方·靠山】" : "";
      L.push(`- ${DIR_CN[d]}(${d})${role}: 山星${p.mountain}, 向星${p.water}, 运星${p.base}${p.annual ? `, 流年星${p.annual}` : ""} → 程序评级=${a.rating}（${a.text}）`);
    });
    L.push("");
    L.push("九星含义速查（数字=星名,当运为旺,下一运为生气,上一运为退气）：");
    for (let s = 1; s <= 9; s++) {
      const si = CM.STAR_INFO[s];
      L.push(`- ${s} ${si.cn} ${si.name.split(" ")[0]}（五行${si.el}）: ${CM.FS_STAR_TAG[s]}`);
    }
    L.push(`- 本盘当运星=${r.period}，生气星=${(r.period % 9) + 1}，退气星=${((r.period + 7) % 9) + 1}`);
    L.push("");
    L.push("解读规则速查: “山管人丁水管财”——看健康人事以山星为主，看财运以向星为主；旺星宜动宜开门见水(向星)或见山(山星)，衰死星宜静。二黑病符、五黄灾星所到之宫忌动土忌久坐卧；流年星与宫内山向星的组合会引动吉凶。");
    return L.join("\n");
  }

  const PRESET_FS = [
    "请基于这张宅运飞星盘做一次完整的风水分析，按以下结构输出：",
    "1. **总评**：格局类型与整体宅运一句话定调；",
    "2. **财位布局**：找出当运向星与生气向星所在方位，说明如何催财（开门、动水、常活动等）；",
    "3. **人丁健康位**：找出旺山星方位，说明如何利用（卧室、靠山、高物）；",
    "4. **凶位化解**：逐一指出二黑、五黄、三碧、七赤等凶星组合所在方位，给出具体化解方法（金属化土煞、安静勿动土等）；",
    "5. **文昌与桃花**：指出一四同宫或一白四绿方位的利用建议；",
    "6. **逐宫速查表**：用表格列出八方+中宫的吉凶与一句话建议；",
    "7. **流年提醒**：若有流年星，指出今年特别要注意的方位与月份性建议。",
  ].join("\n");

  /* ------------------------------ Tong Shu ------------------------------ */

  function serializeTS(r, dt) {
    const L = [];
    const C = r.chart;
    L.push("【盘面数据 · 通书黄历】");
    L.push("（由程序按传统通书规则排出：建除随月建，纳音随日柱，节气按真太阳黄经计算，请直接采用）");
    L.push(`- 查询日期(公历): ${dt.year}-${pad2(dt.month)}-${pad2(dt.day)} ${r.date.dow}，时区 ${fmtTz(dt.tzOffset)}`);
    const gz = p => CM.STEMS_CN[p.stem] + CM.BRANCHES_CN[p.branch];
    L.push(`- 当日四柱干支: 年${gz(C.year)} 月${gz(C.month)} 日${gz(C.day)}${C.hour ? ` 时${gz(C.hour)}` : ""}（日支=${branchDesc(C.day.branch)}）`);
    L.push("");
    L.push(`一、综合评级(程序按建除+星宿+黄黑道打分): ${"★".repeat(r.rating.stars)}${"☆".repeat(5 - r.rating.stars)} ${r.rating.cn}（5星制,分数${r.rating.score}）`);
    L.push("");
    L.push("二、当日神煞与宜忌");
    L.push(`- 建除十二神(值日): ${r.officer.cn}日（第${r.officer.no}位）—— 传统宜: ${r.yiji.yi}；忌: ${r.yiji.ji}`);
    L.push(`- 冲煞: 冲${ZODIAC_CN[r.clash.branch]}(${r.clash.cn}) —— 属${ZODIAC_CN[r.clash.branch]}者今日诸事谨慎；煞${r.clash.sha[0]}方 —— 当日忌朝${r.clash.sha[0]}方动作(如动土、安床朝向)`);
    L.push(`- 旬空(空亡地支): ${r.kong.map(b => CM.BRANCHES_CN[b]).join("、")}（涉及此地支的时辰/事项力量虚浮）`);
    L.push(`- 二十八宿(值日星宿): ${r.mansion.cn}宿（第${r.mansion.no}宿,${r.mansion.lucky ? "吉" : "凶"}）`);
    L.push(`- 黄黑道(十二天神): ${r.dayGod.cn}（${r.dayGod.lucky ? "黄道吉日类" : "黑道凶日类"}）`);
    L.push(`- 日纳音: ${r.nayin[0]}`);
    L.push("");
    L.push("三、节气与月相");
    L.push(`- 当前节气: ${r.solarTerm.cn}（自 ${fmtCivil(r.solarTerm.began)} 起）；下一节气: ${r.solarTerm.nextCn}（${fmtCivil(r.solarTerm.nextAt)}）`);
    L.push(`- 农历日/月相: ${r.moon.lunarDayCn}（农历第${r.moon.lunarDay}日），${r.moon.phase}，月面照亮约${Math.round(r.moon.illum * 100)}%`);
    L.push("");
    const groups = { red: [], black: [], grey: [] };
    r.horoscope.forEach((c, b) => groups[c].push(ZODIAC_CN[b]));
    L.push("四、当日十二生肖关系（相对日支的合冲关系）");
    L.push(`- 相合得利(三合/六合): ${groups.red.join("、")}`);
    L.push(`- 相冲不利(冲方三合局): ${groups.black.join("、")}`);
    L.push(`- 平: ${groups.grey.join("、")}`);
    L.push("");
    L.push("术语速查: 建除十二神=建除满平定执破危成收开闭,循环值日定吉凶;二十八宿=每日轮值星宿;黄黑道=青龙明堂金匮天德玉堂司命为黄道吉,余为黑道;冲煞=与日支六冲的生肖及煞方。");
    return L.join("\n");
  }

  const PRESET_TS = [
    "请基于这份当日黄历数据做一次完整的择日解读，按以下结构输出：",
    "1. **今日总评**：综合评级一句话定调，今天总体适合做什么类型的事；",
    "2. **最宜事项**：结合建除、星宿、黄黑道，列出今天最适合进行的 3-5 类事情并说明依据；",
    "3. **最忌事项**：列出今天应避免的事情，特别说明冲煞生肖与煞方的注意点；",
    "4. **生肖提示**：对相合与相冲的生肖分别给一句话建议；",
    "5. **时辰建议**：结合旬空地支，提示哪些时辰（地支时段）做事偏弱、哪些较稳；",
    "6. **节气养生**：结合当前节气与月相给一条起居/养生建议。",
  ].join("\n");

  /* ------------------------------- Qi Men ------------------------------- */

  function serializeQM(r) {
    const L = [];
    L.push("【盘面数据 · 奇门遁甲时盘】");
    L.push("（由程序按时家奇门·转盘法排出：以节气+三元定局，值符随时干、值使随时辰转动，请直接采用）");
    L.push(`- 起局四柱: 日柱${r.dayGz} · 时柱${r.hourGz}`);
    L.push(`- 节气: ${r.term.cn}；${r.dun}；${r.yuan}；定局=${r.juText}`);
    L.push(`- 旬首: ${r.xunShou}（遁干${r.fuYi}）；值符星(本时段主事之星)=${r.fuStar}；值使门(本时段主事之门)=${r.shiDoor}`);
    L.push(`- 空亡地支: ${r.kongBranches.map(b => CM.BRANCHES_CN[b]).join("、")}；驿马(动象)在${CM.BRANCHES_CN[r.horseBranch]}支`);
    L.push("");
    if (r.patterns.length) {
      L.push("全局格局(程序检出):");
      r.patterns.forEach(pt => L.push(`- [${pt.bad ? "凶" : "吉"}] ${pt.cn} —— ${pt.en}`));
    } else {
      L.push("全局格局: 无伏吟/反吟/三奇得门等特殊格局检出。");
    }
    L.push("");
    L.push("九宫明细（每宫: 八神/九星/天盘干/八门/地盘干；标记: 值符宫=值符星所落、时干宫=时干所落即“用神”常驻处、空亡=力弱、驿马=主动变）：");
    r.palaces.forEach(p => {
      const DIRCN = { N: "北", S: "南", E: "东", W: "西", NE: "东北", NW: "西北", SE: "东南", SW: "西南", C: "中" };
      const tags = [];
      if (p.isFu) tags.push("值符宫");
      if (p.isHour) tags.push("时干宫");
      if (p.isKong) tags.push("空亡");
      if (p.isHorse) tags.push("驿马");
      if (p.palace === 5) {
        L.push(`- 中5宫: 地盘干${p.earthStem}（寄坤2宫,不单独断事）`);
        return;
      }
      L.push(`- ${p.trigram}${p.palace}宫(${DIRCN[p.dir]}方): 八神=${p.god ? p.god.cn : "—"}, 九星=${p.star}, 天盘干=${p.heavenStem}${p.heavenStemQin ? "/" + p.heavenStemQin : ""}, 八门=${p.door || "—"}, 地盘干=${p.earthStem}${tags.length ? `, 标记[${tags.join("、")}]` : ""}${p.factors && p.factors.length ? `, 不利因素[${p.factors.join("、")}]` : ""} → 程序评级=${p.rating}`);
    });
    L.push("");
    L.push("含义速查:");
    L.push("- 八门: 开门(求名营商,吉)、休门(休养谒贵,吉)、生门(求财生计,吉)、景门(文书喜庆,中)、杜门(隐匿堵塞,中偏凶)、惊门(惊恐口舌,凶)、伤门(伤害竞争,凶)、死门(死滞凶丧,大凶)。");
    L.push("- 九星: 天心(医药谋略,吉)、天任(稳重承载,吉)、天辅(文教辅佐,吉)、天禽(中正,吉)、天冲(行动冲击,中)、天英(虚名急躁,中)、天蓬(盗贼冒险,凶)、天芮(疾病结党,凶)、天柱(破坏口舌,凶)。");
    L.push("- 八神: 值符(贵人庇护)、螣蛇(虚惊多变)、太阴(暗中庇荫)、六合(合作婚恋)、白虎(凶猛伤灾)、玄武(暧昧盗失)、九地(沉稳收敛)、九天(高远进取)。");
    L.push("- 三奇=乙(日奇)丙(月奇)丁(星奇),临吉门为得使,主贵人机遇;六仪=戊己庚辛壬癸;庚为阻隔之神。门迫=门五行克宫五行,吉门减吉、凶门增凶;空亡=该宫之事虚而不实或时机未到;驿马=动态、出行、变动之象。");
    return L.join("\n");
  }

  const PRESET_QM = [
    "请基于这张奇门遁甲时盘做一次全面解读，按以下结构输出：",
    "1. **盘面总评**：定局、值符值使与全局格局一句话定调，当前时空能量适合“动”还是“静”；",
    "2. **值符值使分析**：值符星、值使门所落宫位及其状态，说明本时段主导力量；",
    "3. **三奇六仪要点**：乙丙丁三奇所落宫位吉凶，庚金所在及其阻隔含义；",
    "4. **八方吉凶**：按九宫逐方位点评（结合星、门、神、空亡、驿马、门迫），指出最有利与最不利的方位；",
    "5. **应用建议**：给出此时段出行方位、谈判合作、求财求职等具体趋避建议；",
    "6. **提醒**：说明奇门时盘仅对本时辰（2小时内）有效，重大决策应另行起局并以现实条件为准。",
  ].join("\n");

  /* ------------------------------ Dispatch ------------------------------ */

  const SERIALIZERS = {
    bazi: (payload) => serializeBaZi(payload.result, payload.input),
    flyingstars: (payload) => serializeFS(payload.result),
    tongshu: (payload) => serializeTS(payload.result, payload.input),
    qimen: (payload) => serializeQM(payload.result),
  };
  const PRESETS = { bazi: PRESET_BAZI, flyingstars: PRESET_FS, tongshu: PRESET_TS, qimen: PRESET_QM };

  return {
    MODULE_NAMES,
    systemPrompt,
    preset: key => PRESETS[key],
    serialize: (key, payload) => SERIALIZERS[key](payload),
  };
})();

if (typeof module !== "undefined") module.exports = AIContext;
