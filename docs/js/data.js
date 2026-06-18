/* =========================================================================
 * data.js — Shared constants for Chinese metaphysics (玄学) calculators
 * Stems, branches, elements, Na Yin, hidden stems, trigrams, etc.
 * ========================================================================= */

const CM = {};

/* 10 Heavenly Stems 天干 */
CM.STEMS = ["Jia", "Yi", "Bing", "Ding", "Wu", "Ji", "Geng", "Xin", "Ren", "Gui"];
CM.STEMS_CN = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
/* element index per stem: 0 Wood,1 Fire,2 Earth,3 Metal,4 Water */
CM.STEM_ELEMENT = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4];
/* yang(true)/yin(false) per stem */
CM.STEM_YANG = [true, false, true, false, true, false, true, false, true, false];

/* 12 Earthly Branches 地支 */
CM.BRANCHES = ["Zi", "Chou", "Yin", "Mao", "Chen", "Si", "Wu", "Wei", "Shen", "You", "Xu", "Hai"];
CM.BRANCHES_CN = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
CM.ZODIAC = ["Rat", "Ox", "Tiger", "Rabbit", "Dragon", "Snake", "Horse", "Goat", "Monkey", "Rooster", "Dog", "Pig"];
/* element per branch */
CM.BRANCH_ELEMENT = [4, 2, 0, 0, 2, 1, 1, 2, 3, 3, 2, 4];
CM.BRANCH_YANG = [true, false, true, false, true, false, true, false, true, false, true, false];

CM.ELEMENTS = ["Wood", "Fire", "Earth", "Metal", "Water"];
CM.ELEMENTS_CN = ["木", "火", "土", "金", "水"];
CM.ELEMENT_COLOR = ["#2e7d32", "#c62828", "#a1672a", "#b08d00", "#1565c0"];

/* Hidden stems 藏干 — [本气(main), 中气, 余气] (stem indices) */
CM.HIDDEN_STEMS = {
  0:  [9],            // 子: 癸
  1:  [5, 9, 7],      // 丑: 己 癸 辛
  2:  [0, 2, 4],      // 寅: 甲 丙 戊
  3:  [1],            // 卯: 乙
  4:  [4, 1, 9],      // 辰: 戊 乙 癸
  5:  [2, 4, 6],      // 巳: 丙 戊 庚
  6:  [3, 5],         // 午: 丁 己
  7:  [5, 1, 3],      // 未: 己 乙 丁
  8:  [6, 8, 4],      // 申: 庚 壬 戊
  9:  [7],            // 酉: 辛
  10: [4, 7, 3],      // 戌: 戊 辛 丁
  11: [8, 0],         // 亥: 壬 甲
};

/* Na Yin 纳音 — one per Jiazi pair (index = floor(jiazi/2)), 30 entries */
CM.NAYIN = [
  ["海中金", "Gold in the Sea"],
  ["炉中火", "Fire in the Furnace"],
  ["大林木", "Wood of the Great Forest"],
  ["路旁土", "Earth on the Roadside"],
  ["剑锋金", "Metal of the Sword's Edge"],
  ["山头火", "Fire on the Mountain Top"],
  ["涧下水", "Water in the Stream"],
  ["城头土", "Earth of the City Wall"],
  ["白蜡金", "Metal of the White Wax"],
  ["杨柳木", "Wood of the Willow"],
  ["泉中水", "Water in the Spring"],
  ["屋上土", "Earth on the Roof"],
  ["霹雳火", "Fire of the Thunderbolt"],
  ["松柏木", "Wood of the Pine and Cypress"],
  ["长流水", "Water of the Long Stream"],
  ["砂中金", "Metal in the Sand"],
  ["山下火", "Fire at the Foot of the Mountain"],
  ["平地木", "Wood of the Plain"],
  ["壁上土", "Earth on the Wall"],
  ["金箔金", "Metal of the Gold Foil"],
  ["覆灯火", "Fire of the Lamp"],
  ["天河水", "Water of the Heavenly River"],
  ["大驿土", "Earth of the Great Post Road"],
  ["钗钏金", "Metal from the Ornaments"],
  ["桑柘木", "Wood of the Mulberry"],
  ["大溪水", "Water of the Great Stream"],
  ["沙中土", "Earth in the Sand"],
  ["天上火", "Fire in the Sky"],
  ["石榴木", "Wood of the Pomegranate"],
  ["大海水", "Water of the Great Sea"],
];

/* Ten Gods 十神 */
CM.TEN_GODS = {
  "比肩": "Friend (Companion)",
  "劫财": "Rob Wealth",
  "食神": "Eating God",
  "伤官": "Hurting Officer",
  "偏财": "Indirect Wealth",
  "正财": "Direct Wealth",
  "七杀": "Seven Killings",
  "正官": "Direct Officer",
  "偏印": "Indirect Resource",
  "正印": "Direct Resource",
};

/* 24 Mountains for Flying Stars (and compass) — 3 per trigram direction */
CM.MOUNTAINS = [
  { code: "N1",  cn: "壬", py: "Ren",  deg: [337.5, 352.5] },
  { code: "N2",  cn: "子", py: "Zi",   deg: [352.5, 7.5]   },
  { code: "N3",  cn: "癸", py: "Gui",  deg: [7.5, 22.5]    },
  { code: "NE1", cn: "丑", py: "Chou", deg: [22.5, 37.5]   },
  { code: "NE2", cn: "艮", py: "Gen",  deg: [37.5, 52.5]   },
  { code: "NE3", cn: "寅", py: "Yin",  deg: [52.5, 67.5]   },
  { code: "E1",  cn: "甲", py: "Jia",  deg: [67.5, 82.5]   },
  { code: "E2",  cn: "卯", py: "Mao",  deg: [82.5, 97.5]   },
  { code: "E3",  cn: "乙", py: "Yi",   deg: [97.5, 112.5]  },
  { code: "SE1", cn: "辰", py: "Chen", deg: [112.5, 127.5] },
  { code: "SE2", cn: "巽", py: "Xun",  deg: [127.5, 142.5] },
  { code: "SE3", cn: "巳", py: "Si",   deg: [142.5, 157.5] },
  { code: "S1",  cn: "丙", py: "Bing", deg: [157.5, 172.5] },
  { code: "S2",  cn: "午", py: "Wu",   deg: [172.5, 187.5] },
  { code: "S3",  cn: "丁", py: "Ding", deg: [187.5, 202.5] },
  { code: "SW1", cn: "未", py: "Wei",  deg: [202.5, 217.5] },
  { code: "SW2", cn: "坤", py: "Kun",  deg: [217.5, 232.5] },
  { code: "SW3", cn: "申", py: "Shen", deg: [232.5, 247.5] },
  { code: "W1",  cn: "庚", py: "Geng", deg: [247.5, 262.5] },
  { code: "W2",  cn: "酉", py: "Dui",  deg: [262.5, 277.5] },
  { code: "W3",  cn: "辛", py: "Xin",  deg: [277.5, 292.5] },
  { code: "NW1", cn: "戌", py: "Xu",   deg: [292.5, 307.5] },
  { code: "NW2", cn: "乾", py: "Qian", deg: [307.5, 322.5] },
  { code: "NW3", cn: "亥", py: "Hai",  deg: [322.5, 337.5] },
];

/* San Yuan dragon classification → yin/yang for flying-star direction.
 * Yang mountains fly forward (顺), yin mountains fly backward (逆). */
CM.MOUNTAIN_YANG = {
  // 地元 Earth: 甲庚丙壬 yang, 辰戌丑未 yin
  "甲": true, "庚": true, "丙": true, "壬": true,
  "辰": false, "戌": false, "丑": false, "未": false,
  // 天元 Heaven: 乾坤艮巽 yang, 子午卯酉 yin
  "乾": true, "坤": true, "艮": true, "巽": true,
  "子": false, "午": false, "卯": false, "酉": false,
  // 人元 Human: 寅申巳亥 yang, 乙辛丁癸 yin
  "寅": true, "申": true, "巳": true, "亥": true,
  "乙": false, "辛": false, "丁": false, "癸": false,
};

/* Star number → home trigram mountain (the 天/人/地 of that palace) used for
 * determining mountain/water star direction. We need, for a given facing
 * mountain and its 三元 position, the corresponding mountain of the star's
 * home trigram. Map: star number → its trigram's [地, 天, 人] mountains. */
CM.STAR_TRIGRAM_MOUNTAINS = {
  1: ["壬", "子", "癸"], // Kan 坎 (North)
  2: ["未", "坤", "申"], // Kun 坤 (SW)
  3: ["甲", "卯", "乙"], // Zhen 震 (East)
  4: ["辰", "巽", "巳"], // Xun 巽 (SE)
  6: ["戌", "乾", "亥"], // Qian 乾 (NW)
  7: ["庚", "酉", "辛"], // Dui 兑 (West)
  8: ["丑", "艮", "寅"], // Gen 艮 (NE)
  9: ["丙", "午", "丁"], // Li 离 (South)
};

/* Luoshu palace order for flying-star flight:
 * Center → NW → W → NE → S → N → SW → E → SE */
CM.LUOSHU_FLIGHT = ["C", "NW", "W", "NE", "S", "N", "SW", "E", "SE"];

/* Flying star meanings */
CM.STAR_INFO = {
  1: { cn: "一白", el: "Water",  name: "Tan Lang 贪狼",   nature: "Auspicious — wisdom, career, romance" },
  2: { cn: "二黑", el: "Earth",  name: "Ju Men 巨门",     nature: "Inauspicious — illness, the Sickness Star" },
  3: { cn: "三碧", el: "Wood",   name: "Lu Cun 禄存",     nature: "Inauspicious — quarrels, lawsuits, the Argument Star" },
  4: { cn: "四绿", el: "Wood",   name: "Wen Qu 文曲",     nature: "Auspicious — scholarship, romance, the Academic Star" },
  5: { cn: "五黄", el: "Earth",  name: "Lian Zhen 廉贞",  nature: "Very inauspicious — misfortune, the Five Yellow" },
  6: { cn: "六白", el: "Metal",  name: "Wu Qu 武曲",      nature: "Auspicious — authority, wealth, the Heaven Star" },
  7: { cn: "七赤", el: "Metal",  name: "Po Jun 破军",     nature: "Inauspicious (now retreating) — robbery, violence" },
  8: { cn: "八白", el: "Earth",  name: "Zuo Fu 左辅",     nature: "Most auspicious — wealth, prosperity (current Period)" },
  9: { cn: "九紫", el: "Fire",   name: "You Bi 右弼",     nature: "Auspicious — joy, fame, future prosperity" },
};

/* Day-master persona 日主性格 (by stem index) */
CM.DM_PERSONA = [
  ["参天之木", "正直坚毅,有担当,喜领导而恶屈从", "Towering tree — upright and resolute, a natural leader who dislikes bending"],
  ["花草之木", "柔韧灵活,善于应变,亲和而坚韧", "Flowering vine — flexible and adaptive, gentle yet tenacious"],
  ["太阳之火", "热情开朗,光明磊落,感染力强", "The sun — warm, open-hearted and radiant, naturally inspiring"],
  ["灯烛之火", "细腻专注,思虑深远,外柔内热", "Candle flame — delicate and focused, deep-thinking, quietly passionate"],
  ["城墙之土", "稳重可靠,守信重诺,不易动摇", "City-wall earth — steady and dependable, true to their word"],
  ["田园之土", "包容滋养,心思缜密,善于成全", "Garden soil — nurturing and meticulous, quietly supportive"],
  ["刀剑之金", "果断刚毅,重情重义,雷厉风行", "Sword metal — decisive and righteous, swift in action"],
  ["珠玉之金", "精致敏锐,自尊心强,追求完美", "Jewel metal — refined and perceptive, proud, perfectionist"],
  ["江河之水", "胸怀宽广,智慧奔放,不拘小节", "River water — broad-minded with free-flowing intelligence"],
  ["雨露之水", "聪颖内敛,温润细腻,韧性十足", "Dew water — subtle and intelligent, gentle and resilient"],
];

/* Remedial associations per element (for 喜用神 advice) */
CM.ELEMENT_ADVICE = [
  { dir: "东 East", color: "绿 green" },
  { dir: "南 South", color: "红 red" },
  { dir: "中/四隅 Center", color: "黄棕 yellow-brown" },
  { dir: "西 West", color: "白金 white-gold" },
  { dir: "北 North", color: "黑蓝 black-blue" },
];

/* Short keyword tag per flying star */
CM.FS_STAR_TAG = {
  1: "智慧人缘", 2: "病符忧患", 3: "口舌官非", 4: "文昌学业", 5: "灾祸意外",
  6: "权威驿马", 7: "破财盗劫", 8: "财富置业", 9: "喜庆姻缘",
};

/* Classic mountain–water star pairings, keyed "min-max". score feeds rating. */
CM.FS_COMBOS = {
  "1-4": { score: 2, cn: "一四同宫,文昌科名", en: "1-4: scholarship, writing & romance flourish" },
  "1-6": { score: 1.5, cn: "一六联珠,武贵文秀", en: "1-6: career authority and wisdom" },
  "6-8": { score: 2, cn: "六八武库,富而且贵", en: "6-8: wealth with authority" },
  "8-9": { score: 2, cn: "八九喜庆,旺财添丁", en: "8-9: prosperity and joyful events" },
  "1-8": { score: 1, cn: "一八生成,利财利智", en: "1-8: steady gains and clear thinking" },
  "4-9": { score: 1, cn: "四九合金,文采焕发", en: "4-9: creativity and refinement" },
  "2-5": { score: -3, cn: "二五交加,病符五黄,最忌动作", en: "2-5: Sickness meets Five Yellow — avoid disturbing this sector" },
  "5-5": { score: -3, cn: "双五黄临,灾祸之地,宜静不宜动", en: "5-5: double Five Yellow — keep quiet and undisturbed" },
  "2-2": { score: -2, cn: "双二黑到,病符加重", en: "2-2: doubled sickness energy" },
  "2-3": { score: -2, cn: "二三斗牛煞,是非官讼", en: "2-3: Bullfight Sha — quarrels and disputes" },
  "6-7": { score: -2, cn: "六七交剑煞,争斗损伤", en: "6-7: Crossed Swords Sha — conflict and injury" },
  "7-9": { score: -2, cn: "七九回禄,慎防火患", en: "7-9: fire hazard — take care with flames" },
  "5-9": { score: -2, cn: "九紫生五黄,凶性愈炽", en: "5-9: Fire feeds the Five Yellow — intensified misfortune" },
  "3-7": { score: -1.5, cn: "三七穿心,盗劫口舌", en: "3-7: robbery and slander" },
  "8-8": { score: 2, cn: "双八到宫,旺气盈门", en: "8-8: doubled prosperity" },
  "9-9": { score: 1.5, cn: "双九喜临,庆事重重", en: "9-9: doubled celebration" },
  "1-1": { score: 1, cn: "双一白会,智慧清纯", en: "1-1: doubled clarity and benefactors" },
};

/* ---- 12 Officers 建除 ---- */
CM.OFFICERS = [
  ["建", "Establish"], ["除", "Remove"], ["满", "Full"], ["平", "Balance"],
  ["定", "Stable"], ["执", "Initiate"], ["破", "Destruction"], ["危", "Danger"],
  ["成", "Success"], ["收", "Receive"], ["开", "Open"], ["闭", "Close"],
];

/* Conventional 宜/忌 (suitable / avoid) per Officer, index-aligned with OFFICERS */
CM.OFFICER_YIJI = [
  { yi: "出行、谒贵、上任 travel, audiences, taking office", ji: "动土、开仓、嫁娶 groundbreaking, opening stores, weddings" },
  { yi: "除旧、沐浴、治病、扫舍 cleansing, bathing, healing", ji: "嫁娶、远行 weddings, long journeys" },
  { yi: "祭祀、祈福、订婚 worship, blessings, engagements", ji: "动土、服药、上任 groundbreaking, taking medicine" },
  { yi: "修路、平地、粉饰 road works, levelling, decorating", ji: "祈福、求嗣、开市 blessings, opening business" },
  { yi: "订婚、嫁娶、开市、立约 engagements, weddings, contracts", ji: "诉讼、出行、移徙 lawsuits, travel, moving" },
  { yi: "捕捉、纳财、立约 catching, receiving wealth, contracts", ji: "开仓、出货、移徙 opening stores, shipping, moving" },
  { yi: "破屋、坏垣、治病 demolition, breaking, treating illness", ji: "诸吉事 all celebratory affairs" },
  { yi: "祭祀、安床 worship, installing the bed", ji: "登高、行船、冒险 climbing, sailing, risk-taking" },
  { yi: "开市、嫁娶、入学、上任 opening business, weddings, enrolment", ji: "诉讼 lawsuits" },
  { yi: "纳财、收账、入仓 receiving wealth, collecting debts, storage", ji: "开市、出行、安葬 opening business, travel, burials" },
  { yi: "开市、动工、嫁娶、入学 opening, construction, weddings", ji: "安葬、破土 burials, breaking ground" },
  { yi: "安葬、筑堤、填坑 burials, dykes, filling pits", ji: "开市、出行、动土 opening business, travel, groundbreaking" },
];

/* Day-quality score per Officer (建除满平定执破危成收开闭):
 * 2 大吉, 1 吉, 0 平, -1 凶, -2 大凶 */
CM.OFFICER_SCORE = [0, 1, 1, 0, 1, 0, -2, -1, 2, 0, 2, -1];

/* 煞 (Sha) direction by day-branch three-harmony triad:
 * 申子辰煞南 · 寅午戌煞北 · 巳酉丑煞东 · 亥卯未煞西. Index = branch. */
CM.SHA_DIR = [
  ["南", "South"], ["东", "East"], ["北", "North"], ["西", "West"],
  ["南", "South"], ["东", "East"], ["北", "North"], ["西", "West"],
  ["南", "South"], ["东", "East"], ["北", "North"], ["西", "West"],
];

/* ---- 28 Constellations 二十八宿 ---- */
CM.MANSIONS = [
  ["角", "Horn", "蛟", "Wood"], ["亢", "Neck", "龙", "Metal"], ["氐", "Root", "貉", "Earth"],
  ["房", "Room", "兔", "Sun"], ["心", "Heart", "狐", "Moon"], ["尾", "Tail", "虎", "Fire"],
  ["箕", "Winnowing Basket", "豹", "Water"], ["斗", "Dipper", "獬", "Wood"], ["牛", "Ox", "牛", "Metal"],
  ["女", "Weaving Maiden", "蝠", "Earth"], ["虚", "Emptiness", "鼠", "Sun"], ["危", "Rooftop", "燕", "Moon"],
  ["室", "Encampment", "猪", "Fire"], ["壁", "Wall", "貐", "Water"], ["奎", "Legs", "狼", "Wood"],
  ["娄", "Bond", "狗", "Metal"], ["胃", "Stomach", "雉", "Earth"], ["昴", "Hairy Head", "鸡", "Sun"],
  ["毕", "Net", "乌", "Moon"], ["觜", "Turtle Beak", "猴", "Fire"], ["参", "Three Stars", "猿", "Water"],
  ["井", "Well", "犴", "Wood"], ["鬼", "Ghost", "羊", "Metal"], ["柳", "Willow", "獐", "Earth"],
  ["星", "Star", "马", "Sun"], ["张", "Extended Net", "鹿", "Moon"], ["翼", "Wings", "蛇", "Fire"],
  ["轸", "Chariot", "蚓", "Water"],
];
/* auspicious(true)/inauspicious(false) of each mansion (吉凶) */
CM.MANSION_LUCK = [
  true, false, false, true, false, false, true, true, false, false,
  false, false, true, true, true, false, true, false, true, false,
  true, false, true, false, false, true, false, false,
];

/* ---- 12 Day Gods (Yellow & Black Belt) 黄黑道 ---- */
CM.DAY_GODS = [
  ["青龙", "Green Dragon", true], ["明堂", "Bright Hall", true], ["天刑", "Heavenly Punishment", false],
  ["朱雀", "Red Phoenix", false], ["金匮", "Golden Coffer", true], ["天德", "Heavenly Virtue", true],
  ["白虎", "White Tiger", false], ["玉堂", "Jade Hall", true], ["天牢", "Heavenly Prison", false],
  ["玄武", "Black Tortoise", false], ["司命", "Life Governor", true], ["勾陈", "Hook", false],
];

/* ---- 24 Solar Terms 二十四节气 (numbered from 立春 = 1) ---- */
CM.SOLAR_TERMS = [
  ["立春", "Beginning of Spring"], ["雨水", "Rain Water"], ["惊蛰", "Awakening of Insects"],
  ["春分", "Spring Equinox"], ["清明", "Pure Brightness"], ["谷雨", "Grain Rain"],
  ["立夏", "Beginning of Summer"], ["小满", "Lesser Fullness"], ["芒种", "Grain in Ear"],
  ["夏至", "Summer Solstice"], ["小暑", "Lesser Heat"], ["大暑", "Greater Heat"],
  ["立秋", "Beginning of Autumn"], ["处暑", "End of Heat"], ["白露", "White Dew"],
  ["秋分", "Autumn Equinox"], ["寒露", "Cold Dew"], ["霜降", "Frost's Descent"],
  ["立冬", "Beginning of Winter"], ["小雪", "Lesser Snow"], ["大雪", "Greater Snow"],
  ["冬至", "Winter Solstice"], ["小寒", "Lesser Cold"], ["大寒", "Greater Cold"],
];
/* The 12 "sectional" terms (节) that start each solar month, in branch order
 * starting from 寅 month: 立春, 惊蛰, 清明, 立夏, 芒种, 小暑, 立秋, 白露,
 * 寒露, 立冬, 大雪, 小寒. (longitudes 315,345,15,...) */

/* Moon phase names */
CM.MOON_PHASES = [
  "New Moon", "Waxing Crescent", "First Quarter", "Waxing Gibbous",
  "Full Moon", "Waning Gibbous", "Last Quarter", "Waning Crescent",
];
/* Chinese lunar-day numerals 初一..三十 */
CM.LUNAR_DAY_CN = [
  "", "初一", "初二", "初三", "初四", "初五", "初六", "初七", "初八", "初九", "初十",
  "十一", "十二", "十三", "十四", "十五", "十六", "十七", "十八", "十九", "二十",
  "廿壹", "廿二", "廿三", "廿四", "廿五", "廿六", "廿七", "廿八", "廿九", "三十",
];

/* Western zodiac (by ecliptic longitude) */
CM.WZODIAC = [
  ["Aries", "♈"], ["Taurus", "♉"], ["Gemini", "♊"], ["Cancer", "♋"],
  ["Leo", "♌"], ["Virgo", "♍"], ["Libra", "♎"], ["Scorpio", "♏"],
  ["Sagittarius", "♐"], ["Capricorn", "♑"], ["Aquarius", "♒"], ["Pisces", "♓"],
];

/* =======================  Qi Men Dun Jia constants  ===================== */
/* Palace (Luoshu number) → trigram, original star, original door */
CM.QM_PALACE = {
  1: { trigram: "坎", dir: "N",  star: "天蓬", door: "休门", doorEn: "Rest" },
  2: { trigram: "坤", dir: "SW", star: "天芮", door: "死门", doorEn: "Death" },
  3: { trigram: "震", dir: "E",  star: "天冲", door: "伤门", doorEn: "Injury" },
  4: { trigram: "巽", dir: "SE", star: "天辅", door: "杜门", doorEn: "Delusion" },
  5: { trigram: "中", dir: "C",  star: "天禽", door: "",     doorEn: "" },
  6: { trigram: "乾", dir: "NW", star: "天心", door: "开门", doorEn: "Open" },
  7: { trigram: "兑", dir: "W",  star: "天柱", door: "惊门", doorEn: "Fear" },
  8: { trigram: "艮", dir: "NE", star: "天任", door: "生门", doorEn: "Life" },
  9: { trigram: "离", dir: "S",  star: "天英", door: "景门", doorEn: "Scenery" },
};
/* Stem labels for Qi Men plate (三奇六仪) */
CM.QM_STEMS = ["戊", "己", "庚", "辛", "壬", "癸", "丁", "丙", "乙"];
/* 旬首 (xun leader) → its 仪 (yi) stem */
CM.QM_XUN_YI = { "甲子": "戊", "甲戌": "己", "甲申": "庚", "甲午": "辛", "甲辰": "壬", "甲寅": "癸" };
/* 8 Gods (八神) — yang order; yin遁 places them counter-clockwise */
CM.QM_GODS = ["值符", "螣蛇", "太阴", "六合", "白虎", "玄武", "九地", "九天"];
CM.QM_GODS_EN = ["Chief", "Snake", "Moon", "Harmony", "Tiger", "Tortoise", "Earth", "Heaven"];
/* Ring of the 8 outer palaces in 后天八卦 (later-heaven) clockwise order.
 * Used for rotating stars / doors / gods. Center (5) is handled separately. */
CM.QM_RING = [1, 8, 3, 4, 9, 2, 7, 6];

/* Three-yuan (上中下元) 局 number table by solar term.
 * Index = solar-term number (1..24, 立春=1). value: {yin:bool, ju:[upper,middle,lower]} */
CM.QM_JU = {
  // Yang Dun 阳遁 (winter solstice → before summer solstice)
  22: { yin: false, ju: [1, 7, 4] },  // 冬至
  23: { yin: false, ju: [2, 8, 5] },  // 小寒
  24: { yin: false, ju: [3, 9, 6] },  // 大寒
  1:  { yin: false, ju: [8, 5, 2] },  // 立春
  2:  { yin: false, ju: [9, 6, 3] },  // 雨水
  3:  { yin: false, ju: [1, 7, 4] },  // 惊蛰
  4:  { yin: false, ju: [3, 9, 6] },  // 春分
  5:  { yin: false, ju: [4, 1, 7] },  // 清明
  6:  { yin: false, ju: [5, 2, 8] },  // 谷雨
  7:  { yin: false, ju: [4, 1, 7] },  // 立夏
  8:  { yin: false, ju: [5, 2, 8] },  // 小满
  9:  { yin: false, ju: [6, 3, 9] },  // 芒种
  // Yin Dun 阴遁 (summer solstice → before winter solstice)
  10: { yin: true,  ju: [9, 3, 6] },  // 夏至
  11: { yin: true,  ju: [8, 2, 5] },  // 小暑
  12: { yin: true,  ju: [7, 1, 4] },  // 大暑
  13: { yin: true,  ju: [2, 5, 8] },  // 立秋
  14: { yin: true,  ju: [1, 4, 7] },  // 处暑
  15: { yin: true,  ju: [9, 3, 6] },  // 白露
  16: { yin: true,  ju: [7, 1, 4] },  // 秋分
  17: { yin: true,  ju: [6, 9, 3] },  // 寒露
  18: { yin: true,  ju: [5, 8, 2] },  // 霜降
  19: { yin: true,  ju: [6, 9, 3] },  // 立冬
  20: { yin: true,  ju: [5, 8, 2] },  // 小雪
  21: { yin: true,  ju: [4, 7, 1] },  // 大雪
};

if (typeof module !== "undefined") module.exports = CM;
