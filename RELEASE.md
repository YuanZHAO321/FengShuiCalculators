# v1.0.0 — 风水计算器 Feng Shui Calculator

首个正式版本：四合一玄学排盘 + AI 智能解读，三平台桌面应用。

## 下载

| 平台 | 文件 | 说明 |
|---|---|---|
| macOS Apple Silicon (M1/M2/M3/M4) | `FengShuiCalculator-1.0.0-mac-arm64.dmg` | 拖入 Applications 即可 |
| macOS Intel | `FengShuiCalculator-1.0.0-mac-x64.dmg` | 同上 |
| Windows x64 安装版 | `FengShuiCalculator-1.0.0-win-x64.exe` | NSIS 安装向导，可自选目录 |
| Windows x64 免安装版 | `FengShuiCalculator-1.0.0-win-x64-portable.exe` | 单文件直接运行 |

> macOS 版本未签名公证：首次打开请右键应用 →「打开」，或执行
> `xattr -dr com.apple.quarantine "/Applications/Feng Shui Calculator.app"`。
> Windows SmartScreen 提示时选择「仍要运行」。

## ✨ 亮点

### 四大排盘模块
- **八字四柱**：四柱十神藏干纳音、十二长生、旬空、大运精确起运、身强弱与喜用神初判
- **玄空飞星**：山向星飞布、流年星、旺山旺向等格局判定、逐宫吉凶（二五交加/斗牛煞/交剑煞…）
- **通书黄历**：建除宜忌、冲煞、二十八宿、黄黑道、节气分钟级精确时刻、月相、生肖日运、五星评级
- **奇门遁甲**：时家转盘法定局、九星八门八神、值符值使、伏吟反吟/三奇得门检测、逐宫评级

排盘核心为自研 Meeus 天文历法引擎，关键结果已对照参考盘验证并有回归测试钉住。

### AI 智能解读（本版本新增）
- 接入**任意 OpenAI 兼容 API**：OpenAI / DeepSeek / Kimi / 智谱 / 通义 / OpenRouter / 本地 Ollama、LM Studio
- 设置面板支持**自动拉取模型列表**或手动填写模型名
- 每个计算器**一键分析**（内置结构化专家 Prompt）+ **追问聊天框**（流式输出、可停止、可复制）
- 盘面上下文**完全自解释**（术语全部带说明），对小参数模型友好
- 重新起盘后对话自动携带最新盘面；API Key 仅存本机
- 桌面版 AI 请求经主进程代理，**不受 CORS 限制**

## SHA-256 校验和

```
ed5fe91252bccf1f94bda10d8318359b1a5cf1f4c1228af8753bef8c7b562aeb  FengShuiCalculator-1.0.0-mac-arm64.dmg
9643199a10ff8b65790db55b439a67791eeae7fb609ac72dace72aac375f5835  FengShuiCalculator-1.0.0-mac-arm64.zip
080fc2f6997f5e7d86002507a644056aec30d528422b76e5b44089e34799b198  FengShuiCalculator-1.0.0-mac-x64.dmg
8169cdaebb168d99cfa9a7397f0ea8aa7b1a68934354099e503ad7b277d79310  FengShuiCalculator-1.0.0-mac-x64.zip
f609f44ec4a9274f2ea030ec054467ae677a746d7cd022491f96914bee708a43  FengShuiCalculator-1.0.0-win-x64.exe
d2e739f8cdbf061ccedaef1c57779ed10878f99ef4fa7b5e68c4724cc32d5fb2  FengShuiCalculator-1.0.0-win-x64-portable.exe
```

## 已知限制
- macOS / Windows 安装包未做代码签名
- AI 解读质量取决于所接入的模型；所有内容仅供传统文化参考

---

**Full Changelog**: 首个版本
