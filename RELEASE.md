# v1.1.0 — 风水计算器 Feng Shui Calculator

多 AI 源与对比输出、本地档案库、会话自动恢复，以及若干重要修复。

## 下载

| 平台 | 文件 | 说明 |
|---|---|---|
| macOS Apple Silicon (M1–M4) | `FengShuiCalculator-1.1.0-mac-arm64.dmg` | 拖入 Applications 即可 |
| macOS Intel | `FengShuiCalculator-1.1.0-mac-x64.dmg` | 同上 |
| Windows x64 安装版 | `FengShuiCalculator-1.1.0-win-x64.exe` | NSIS 安装向导 |
| Windows x64 免安装版 | `FengShuiCalculator-1.1.0-win-x64-portable.exe` | 单文件直接运行 |

> macOS 版本未签名公证：首次打开请右键应用 →「打开」，或执行
> `xattr -dr com.apple.quarantine "/Applications/Feng Shui Calculator.app"`。
> Windows SmartScreen 提示时选择「仍要运行」。

## ✨ 新增

- **多 API 源**：设置面板可配置任意多个 OpenAI 兼容服务（每个源独立的名称 / Base URL / Key / 模型列表，可拉取或手动维护）。
- **聊天窗口直接切换模型**：每个 AI 区块顶部有「源 · 模型」下拉，全局生效。
- **多模型对比输出**：勾选最多 3 个额外模型，同一问题并行发送对比回答；对比回复仅展示、不进入对话上下文，主模型回复正常延续追问。
- **每条 AI 回答标注来源**：气泡上方显示「API 源 · 模型名」。
- **思考型模型支持**：DeepSeek-R1、QwQ 等的 reasoning 过程实时显示在可折叠「思考过程」面板中。
- **退出自动保存**：四个计算器的输入、结果与 AI 对话自动持久化，重新打开原样恢复。
- **本地档案库**：每个盘可命名存档（可选只存输入或连同 AI 对话），「📂 档案库」一键加载并自动重新起盘。数据全部保存在本机。

## 🐞 修复

- **八字喜用神误判**：身强弱判定现在按月令旺衰（旺相休囚死）对生扶占比做修正——如 乙酉/己卯/甲辰/甲戌（甲木卯月得令）此前被误判为"中和→喜水木"，现正确判为"身强→喜火土金"。界面同时显示原始占比与修正后占比。
- **AI 空白回复**：思考型模型只返回 reasoning 导致界面停在"思考中"或直接空白的问题已修复；正文为空时显示具体诊断（含 finish_reason，提示换模型或追问）。
- **拉取模型后无下拉菜单**：原 datalist 交互不可靠，已改为「模型列表文本框（每行一个）+ 聊天窗口原生下拉」的方案。

## SHA-256 校验和

```
（构建后填写 — 见 dist/SHA256SUMS.txt）
```

## 已知限制
- macOS / Windows 安装包未做代码签名
- AI 解读质量取决于所接入的模型；所有内容仅供传统文化参考

---

**Full Changelog**: v1.0.0 → v1.1.0
