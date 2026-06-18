# v1.1.1 — 风水计算器 Feng Shui Calculator

本地档案库新增**导入 / 导出**：备份、迁移或在多台设备间同步你的存档。

## 下载

| 平台 | 文件 | 说明 |
|---|---|---|
| macOS Apple Silicon (M1–M4) | `FengShuiCalculator-1.1.1-mac-arm64.dmg` | 拖入 Applications 即可 |
| macOS Intel | `FengShuiCalculator-1.1.1-mac-x64.dmg` | 同上 |
| Windows x64 安装版 | `FengShuiCalculator-1.1.1-win-x64.exe` | NSIS 安装向导 |
| Windows x64 免安装版 | `FengShuiCalculator-1.1.1-win-x64-portable.exe` | 单文件直接运行 |

> macOS 版本未签名公证：首次打开请右键应用 →「打开」，或执行
> `xattr -dr com.apple.quarantine "/Applications/Feng Shui Calculator.app"`。
> Windows SmartScreen 提示时选择「仍要运行」。

## ✨ 新增

- **档案库导出**：「📂 档案库 → ⬆ 导出」将存档保存为 JSON 文件（`fengshui-archive-YYYY-MM-DD.json`），含输入参数及可选的 AI 对话。
- **可选导出条目**：每条存档前有勾选框，配合「全选」开关，只导出你勾选的条目；导出按钮实时显示已选数量，未选时禁用。
- **档案库导入**：「⬇ 导入」选择 JSON 文件即可并入本地档案库。按 `id` 去重（重复导入同一文件不会产生副本），逐条校验并跳过格式无效的条目，完成后提示「导入 N 条，跳过 M 条，忽略 K 条」。
- 数据仍全部保存在本机；导入/导出均为手动操作的本地文件，不经网络。

## 下载校验（SHA-256）

```
297bb0ca40cd58723e68e06b5006941b87070a05c43ccdf1cde5396bb37eb0f2  FengShuiCalculator-1.1.1-mac-arm64.dmg
c96bc210810c8ca039a397ba8f1b3741f6c1d840f0c0f7ee3dd3f33a9337cf07  FengShuiCalculator-1.1.1-mac-x64.dmg
ec1f37ba74be63b199b1434e7d41a36b975f1023d09fd4b328372439a95de89a  FengShuiCalculator-1.1.1-win-x64.exe
3e86b5b558594697687399d6f710cfa9d528b9b38f3d4288fa445f1a815b8115  FengShuiCalculator-1.1.1-win-x64-portable.exe
```

## 已知限制
- macOS / Windows 安装包未做代码签名
- 导出文件为明文 JSON，若含 AI 对话请注意妥善保管
- AI 解读质量取决于所接入的模型；所有内容仅供传统文化参考

---

**Full Changelog**: v1.1.0 → v1.1.1
