# 风水计算器 · Feng Shui Calculator

**四合一中国玄学计算器 + AI 智能解读桌面应用**
Ba Zi (Four Pillars) · Xuan Kong Flying Stars · Tong Shu Almanac · Qi Men Dun Jia — with AI-powered chart analysis via any OpenAI-compatible API.

> 仅供学习与传统文化研究参考 · For study & reference only

---

## ✨ 功能 Features

### 四大排盘模块

| 模块 | 中文 | 计算内容 |
|---|---|---|
| **Ba Zi** | 八字四柱 | 四柱干支、十神、藏干、纳音、十二长生、旬空、日主旺衰（旺相休囚死）、五行分布、大运（精确起运时间）；内置身强身弱判定与喜用神初判 |
| **Flying Stars** | 玄空飞星 | 元运盘、山星/向星/流年星九宫飞布、格局判定（旺山旺向/上山下水/双星到向坐）、逐宫吉凶评级（二五交加、斗牛煞、交剑煞、一四同宫等经典组合） |
| **Tong Shu** | 通书黄历 | 建除十二神宜忌、冲煞方位、旬空、二十八宿、黄黑道、纳音、节气精确时刻、月相农历、十二生肖每日运势、★1–5 当日综合评级 |
| **Qi Men Dun Jia** | 奇门遁甲 | 时家转盘奇门：定局（节气+三元）、三奇六仪、九星八门八神、值符值使、空亡驿马标记、伏吟反吟/三奇得门等格局检测、逐宫吉凶 |

排盘核心为自研天文历法引擎（Meeus 太阳/月亮理论），节气精确到分钟级，立春换年、23:00 换日等传统规则完整实现，并有回归测试钉住已验证的参考值（`npm test`）。

### 🤖 AI 智能解读

- **多 API 源**：可同时配置多个 OpenAI 兼容服务（OpenAI、DeepSeek、Moonshot/Kimi、智谱 GLM、通义千问、OpenRouter、本地 Ollama / LM Studio…），每个源可一键拉取模型列表或手动维护常用模型。
- **模型随手切换 + 对比输出**：每个聊天窗口顶部直接选择「源 · 模型」；还可勾选最多 3 个额外模型，同一问题并行发给多家对比回答。每条回答都标注其 API 源与模型名。
- **一键分析**：每个计算器起盘后点击「✦ 一键分析」，内置专家级预设 Prompt 按固定结构输出全面解读。
- **追问聊天**：基于当前盘继续提问（"明年适合换工作吗？"），流式输出、停止生成、复制回答；重新起盘后下一条消息自动携带最新盘面。
- **思考型模型支持**：DeepSeek-R1、QwQ 等推理模型的思考过程实时显示在可折叠面板中，不再表现为长时间空白；正文为空时给出明确诊断（finish_reason）。
- **劣质模型友好**：发送给 AI 的盘面上下文完全自解释——每个干支、星曜、宫位都带括号说明与术语速查表，并明确指示"数值已由程序算好，不要重新排盘"，小模型也能正确解读。
- **隐私**：API Key 仅保存在本机；桌面版通过主进程代理请求，不受 CORS 限制。

### 💾 本地数据

- **退出自动保存**：四个计算器的输入、结果与 AI 对话在退出/切换时自动保存，下次打开原样恢复。
- **档案库**：每个盘可命名存档（可选只存输入、或连同 AI 对话一起），随时从「📂 档案库」一键加载重新起盘，无需重复输入。所有数据仅存本机。

## 📦 下载 Download

前往 [Releases](../../releases) 页面下载：

| 平台 | 文件 |
|---|---|
| macOS (Apple Silicon) | `FengShuiCalculator-x.y.z-mac-arm64.dmg` |
| macOS (Intel) | `FengShuiCalculator-x.y.z-mac-x64.dmg` |
| Windows (x64) | `FengShuiCalculator-x.y.z-win-x64.exe`（安装版 / portable 免安装版） |

> macOS 版本未签名公证，首次打开如提示"无法验证开发者"，请右键点击应用 →「打开」，或在 终端 执行 `xattr -dr com.apple.quarantine "/Applications/Feng Shui Calculator.app"`。

**无需安装也可使用**：本应用是纯前端实现，直接用浏览器打开 `app/index.html` 即可（浏览器中 AI 功能可能受部分服务商 CORS 限制，桌面版无此问题）。

## 🔧 AI 配置 AI Setup

点击应用右上角「⚙ AI 设置」：

| 服务商 | Base URL | 备注 |
|---|---|---|
| OpenAI | `https://api.openai.com/v1` | |
| DeepSeek | `https://api.deepseek.com/v1` | |
| Moonshot (Kimi) | `https://api.moonshot.cn/v1` | |
| 智谱 GLM | `https://open.bigmodel.cn/api/paas/v4` | |
| OpenRouter | `https://openrouter.ai/api/v1` | 聚合多家模型 |
| Ollama（本地） | `http://localhost:11434/v1` | API Key 任意填 |
| LM Studio（本地） | `http://localhost:1234/v1` | API Key 任意填 |

填好 Base URL 与 Key 后点「⇣ 拉取模型」自动获取模型列表（或直接手填模型名），「测试连接」验证，保存即可。

## 🛠 开发 Development

```bash
npm install        # 安装 Electron 与打包工具
npm start          # 本地运行桌面应用
npm test           # 排盘算法 + AI 上下文回归测试（纯 Node，无需浏览器）

npm run dist:mac-arm64   # 打包 macOS Apple Silicon
npm run dist:mac-x64     # 打包 macOS Intel
npm run dist:win         # 打包 Windows x64（macOS/Linux 上交叉构建）
```

推送 `v*` 标签会触发 GitHub Actions 自动构建三平台安装包并附到草稿 Release。

### 架构

```
app/                    纯前端应用（无构建步骤，可直接浏览器打开）
├── index.html          四个计算器的标签页 UI
├── css/style.css       朱砂/鎏金/宣纸视觉主题，自动暗色模式
└── js/
    ├── data.js         玄学常量表（干支、纳音、星宿、奇门局表…）
    ├── astro.js        天文历法核心（儒略日、太阳黄经、月相、干支）
    ├── bazi.js         八字模块            ├── flyingstars.js  玄空飞星模块
    ├── tongshu.js      通书模块            ├── qimen.js        奇门遁甲模块
    ├── ai-context.js   盘面 → AI 自解释上下文序列化 + 预设 Prompt
    ├── ai.js           OpenAI 兼容客户端 + 设置面板 + 聊天 UI
    └── app.js          UI 控制器
electron/
├── main.js             主进程（窗口 + AI 请求 IPC 代理，免 CORS）
└── preload.js          contextBridge 暴露 window.aiBridge
```

AI 请求链路：渲染进程检测到 `window.aiBridge`（桌面版）时走主进程 `net.fetch` 代理（含 SSE 流式转发与中止）；在浏览器中则直接 `fetch`。两条链路都支持流式输出，并在服务商不支持流式时自动回退为普通请求。

## ⚖️ 免责声明 Disclaimer

本项目是传统玄学算法的教学/参考实现，所有"吉凶"评级与 AI 解读均为民俗文化内容，不构成任何医疗、法律、投资建议。AI 输出由所接入的第三方模型生成，请自行甄别。

## 📄 License

MIT
