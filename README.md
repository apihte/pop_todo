# 浮动代办 / Floating Todo

Tauri 2 + Svelte 5 + TypeScript 的轻量桌面代办 Demo。无服务端、无账号、无网络同步，代办保存在本机。

## 功能

- 72 × 72 透明悬浮窗口，未完成数量角标（超过 99 显示 `99+`）；
- 可设置是否置顶：右键悬浮图标或展开列表，或打开系统托盘菜单，勾选/取消“置顶显示”；默认开启，立即生效并保存，重启后恢复，图标与列表共用此设置；
- 点击图标按所在屏幕的象限展开列表（默认 360 × 480）；收起后图标回到展开前的位置，即使拖动过列表；
- 勾选完成/恢复、移除；点击“＋新增代办”打开完整表单，与编辑共用标题、内容、截止时间弹窗；
- 点击代办文字区域打开编辑弹窗，修改标题、具体内容和截止时间；复选框和移除按钮不触发编辑；
- 拖动悬浮图标移动，展开时可拖动标题区域；
- 本地持久化、按紧急程度排序、失败提示和重试；
- 有时间的正常事项蓝色、当天到期黄色、超时红色、未设置时间白色；图标与代办项同步状态，可在设置中自定义颜色；
- 多语言：简体中文 / English（US），设置中切换，独立 JSON 语言文件可扩展；
- 窗口位置恢复，工作区边界保护，托盘重新定位；
- 托盘显示/隐藏/退出，右键窗口提供辅助菜单，防止重复启动；
- 数据读取失败时禁用修改，避免覆盖损坏文件；保存失败保留内存更改，退出前确认。

## 展开与收起

以悬浮图标中心所在的显示器为准：图标在右上时向左下展开，右下时向左上展开，左下时向右上展开，左上时向右下展开。默认以图标中心作为面板的一个角；空间不足时微调位置，让面板留在当前屏幕的工作区内。

展开后可以单独拖动面板。点击面板顶部图标或 × 收起时，图标仍回到展开前的位置；只有拖动悬浮图标或主动使用托盘“重新定位”才会改变记住的位置。原显示器移除时，回退到主屏幕。

## 编辑代办

1. 展开列表，点击“＋新增代办”打开空白新增弹窗；点击已有项文字区域则打开预填的编辑弹窗。
2. 填写“标题”“具体内容”“截止时间”，点击“保存”。
3. 点击“取消”或按 Esc 丢弃未提交草稿，回到列表；编辑时不会因 Esc 直接收起列表。

最终标题必须非空，最多 200 个 Unicode 码点。保存时标题为空则从内容提取第一句话：到首个 `。！？.!?` 或换行处，保留句末标点；无分隔符则取整段，超过 200 字符自动截取。自动提取不修改原内容。标题和内容都为空（含全空白）时提示“标题必须不为空”。手动标题超过上限则报错。具体内容可留空、支持多行，最多 10000 个 Unicode 码点。截止时间可选，精度到分钟，可通过“清除截止时间”移除，也允许设置过去的时间。按本机时区输入/显示、以 UTC ISO 时间保存；系统时区改变后，同一截止时刻会按新时区显示。夏令时跳过的无效本地时间会提示错误，重复时段使用系统 Date 的默认解释。

列表显示标题、状态和截止时间，详细内容在编辑弹窗查看。旧版代办自动补充空内容和空截止时间，无需手动修改数据文件。新增取消不创建记录；新增保存失败重试同一草稿不会重复创建。

保存失败时草稿仍留在编辑弹窗，并保留内存中的修改，可重试保存；这种情况下“取消”仅关闭弹窗，不回滚已经尝试提交到内存的修改。未保存成功前不要退出。

## 状态、排序与颜色设置

- 正常（默认蓝色 `#3b82f6`）：已设置截止时间，且截止日期在未来。
- 未设置时间（默认白色 `#ffffff`）：没有 deadline，未完成事项中优先级最低；按添加顺序排列。
- 当天到期（默认黄色 `#eab308`）：本机日历日期为今天，且尚未超过具体截止时刻。
- 已超时（默认红色 `#ef4444`）：当前时间超过截止时刻。
- 已完成：灰色删除线，不参与图标到期告警。

图标按“超时 > 当天到期 > 正常 > 未设置时间”取最高紧急程度，仅有无时间未完成项时为白色；无代办或全部完成时仍为正常蓝色。角标始终是全部未完成数量。列表每项独立配色，并显示状态文字，避免仅靠颜色区分。

列表排序为 **超时 → 当天到期 → 正常 → 未设置时间 → 已完成**。同状态下有 deadline 的按截止时刻从早到晚排列，无 deadline 的放在同状态有时间项之后，按添加时间正序排列；时间相同时保持稳定顺序。完成、删除、编辑或时间变化后自动重新计算。

运行时每秒检查时间，跨天和超时无需点击即可更新，窗口重新获得焦点时也刷新；后台计时实际频率可能受系统休眠与 WebView 节流影响。本次只有视觉状态，不发送到期通知。

从列表右上角 ⚙、右键菜单“设置”或托盘“设置”打开设置。可用颜色选择器修改四种状态颜色，点击“保存”应用并持久化，取消不应用颜色草稿；“恢复默认颜色”后仍需保存。悬浮图标与列表共用颜色，已完成灰色固定。设置中的“置顶显示”是立即生效的独立设置，取消颜色草稿不会撤销置顶操作。

## 多语言与扩展

从“设置 → 语言”选择语言，立即生效并保存；取消颜色设置不会撤销语言选择。当前包含简体中文（`zh_cn`）和 English (US)（`en_us`），默认简体中文。切换只修改控件、提示、状态名称、日期显示格式及原生菜单，不修改用户输入的代办内容，也不改变截止时间实际时刻。

语言文件位于 **`src/locales/`**，采用 UTF-8 JSON。文件名使用小写语言/地区码和下划线，例如：

```text
src/locales/
├── zh_cn.json
├── en_us.json
└── ja_jp.json  # 以后新增的语言文件
```

`lang` 是语言在下拉列表中的显示名；其他键对应控件或提示：

```json
{
  "lang": "简体中文",
  "common.save": "保存",
  "common.cancel": "取消",
  "todo.title": "标题",
  "todo.count": "{count} 件未完成",
  "todo.editItem": "编辑“{title}”"
}
```

扩展步骤：

1. 复制 `src/locales/zh_cn.json`，以新语言码命名，例如 `ja_jp.json`。
2. 设置 `lang` 为该语言的自称，翻译各键的值，**不要翻译键名**。
3. 保留 `{count}`、`{title}`、`{date}`、`{status}` 等占位符名称。不要在翻译中写 HTML；所有文字按纯文本显示。
4. 执行 `npm test`、`npm run build`，再重新构建桌面应用。

使用 Vite glob 自动发现文件，**无需改注册表、UI 代码或 Rust 语言列表**。文件名 `zh_cn` 转成标准运行时标签 `zh-CN`；`lang` 只负责显示。缺失条目逐项回退到简体中文，不支持或已删除的语言选择回退到 `zh_cn`。无效文件名、非字符串/空翻译、占位符不匹配会报错，应修正文件后再构建。

这些文件属于编译资源，新增语言需重新构建，不是向已安装程序旁放文件即热加载。日期选择器的原生控件外观/部分浏览器内部文字仍可能取决于操作系统和 WebView 设置。桌面托盘与原生菜单翻译逻辑已编写，但仍需原生环境验收。

语言偏好保存在 `window.json.language`；浏览器预览使用独立 localStorage。保存失败时保留原语言并提示重试。原生菜单同步失败时保留已保存的界面语言，设置中提供重试。

## 开发环境

- Node.js **22.12+ 或 24 LTS**，npm；
- Rust stable（`rustc`、`cargo` 在 PATH 中）；
- 各平台 Tauri 前置依赖：<https://v2.tauri.app/start/prerequisites/>。

### Windows

安装 Microsoft C++ Build Tools，勾选“使用 C++ 的桌面开发”和 Windows SDK；安装 Rust 的 MSVC 工具链及 WebView2 Runtime。安装后重新打开终端，确认 `rustc --version` 和 `cargo --version` 正常。

### macOS

安装 Xcode Command Line Tools（`xcode-select --install`）和 Rust。

### Linux（Ubuntu/Debian）

```bash
sudo apt-get update
sudo apt-get install -y libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev librsvg2-dev libayatana-appindicator3-dev patchelf
```

不同发行版请参考官方依赖说明。

## 运行

```bash
npm ci
npm run desktop:dev
```

只有前端依赖时也能预览 UI：

```bash
npm run dev
```

打开 <http://127.0.0.1:1420>。**浏览器预览不是桌面应用**：使用独立 localStorage，不具备置顶、透明桌面窗口、系统托盘和原生窗口拖动功能，不与桌面数据互通。

## 检查与打包

```bash
npm run check         # TypeScript / Svelte 静态检查
npm test              # 领域、存储、状态与组件测试
npm run build         # 前端生产构建（不是桌面安装包）
npm run desktop:build # 在本机平台生成桌面安装包
```

输出：`src-tauri/target/release/bundle/`。Windows 通常为 MSI / NSIS，macOS 为 app / DMG，Linux 为 deb / rpm / AppImage。三平台需要分别在对应操作系统构建，并非在 Windows 上一次生成所有平台安装包。

`.github/workflows/desktop.yml` 提供三平台 CI 打包与制品上传模板。未配置发布签名；公开发布需要 Windows 代码签名、macOS 签名与公证。当前 demo 不支持自动更新。

## 数据

使用 Tauri Store：

- `todos.json`：`version: 1` 与 `todos` 数组；每项包括 `id`、`title`、`content`、`deadline`（UTC ISO 字符串或 `null`）、`completed`、`createdAt`、`updatedAt`。本次为兼容性增量扩展，旧记录缺失的 `content` / `deadline` 读取为 `''` / `null`，下次保存时写入；
- `window.json`：悬浮图标左上角的物理像素坐标 `iconPosition`（兼容负坐标显示器；旧 `anchor` 自动转换），以及布尔设置 `alwaysOnTop`（默认 `true`）、`statusColors`（`normal` / `today` / `overdue` / `unscheduled` 六位十六进制色值；旧三色配置自动为 `unscheduled` 补白色，不重置原有自定义颜色）以及 `language`（如 `zh_cn` / `en_us`）；
- 每次启动默认收起，不恢复展开状态。

数据目录由 Tauri 的应用数据目录决定，identifier 为 `com.apihte.floating-todo`：

- Windows：`%APPDATA%/com.apihte.floating-todo/`；
- macOS：`~/Library/Application Support/com.apihte.floating-todo/`；
- Linux：`$XDG_DATA_HOME/com.apihte.floating-todo/`，通常为 `~/.local/share/com.apihte.floating-todo/`。

数据未加密，不适合存储密码。若读取失败，应用不会自动清空原文件。先退出并备份 `todos.json`，检查或修复内容；如希望从空列表重新开始，可在备份后自行移走该文件再启动。

## 平台限制

- Tauri 使用系统 WebView；实际安装包大小和内存占用应以各平台 release 版本实测为准。
- Windows 缺少 WebView2 时，默认安装程序可能需要联网安装运行时。
- Linux Wayland 的窗口绝对定位、全局置顶受合成器限制，不能保证所有桌面环境完全一致；推荐优先验证 X11。
- Linux 托盘可能需要 AppIndicator 扩展；可使用右键悬浮图标菜单退出，不完全依赖托盘左击事件。
- macOS 透明窗口启用了 Tauri 的 `macos-private-api` 支持，当前目标是直接分发 Demo；若计划上架 Mac App Store，需要重新评估私有 API 限制。
- 已保存位置所在显示器移除后，启动或下次展开/收起会回退到主屏幕；还可通过托盘“重新定位”恢复。混合 DPI、多屏和托盘行为仍需三平台实机验收。

## 工程结构

```text
src/components/          UI 组件
src/lib/                 代办校验、排序、角标、窗口几何与语言文件校验
src/locales/             UTF-8 JSON 语言文件
src/services/            Tauri Store / 浏览器预览适配和窗口 API
src/stores/              代办状态、串行持久化、失败重试
src-tauri/src/           Rust 入口、托盘、单实例和生命周期
src-tauri/capabilities/  前端权限
src-tauri/icons/         平台图标
tests/                   自动化测试
```

实现进度及验证记录见 `docs/07-progress.md`。
