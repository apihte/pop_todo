# Demo 实施进度

## 基线

按会话中用户确认的 Tauri 方案实施：Tauri 2 + Svelte + TypeScript + Store，本地单窗口悬浮代办。未增加云同步、提醒、账号或远端服务。

## 实现

| 能力 | 状态 | 代码 |
|---|---|---|
| 工程、前端与 Tauri 配置 | 已编写 | `package.json`、`src-tauri/` |
| 角标、展开/收起、列表、新增/完成/删除 | 前端验证通过 | `src/components/`、`src/App.svelte` |
| 输入校验、中文输入法 Enter、Esc 取消 | 自动化验证通过 | `TodoEditor.svelte`、`src/lib/todos.ts` |
| Store 保存与串行写入、失败重试 | 自动化验证通过（桌面 API 使用 mock） | `src/services/storage.ts`、`src/stores/todo-store.ts` |
| 损坏文件保护 | 已编写，前端边界测试通过 | Rust 先读 JSON，校验成功后才允许 Store 注册/写入 |
| 窗口锚点、边界、DPI、位置恢复 | 纯几何测试通过，待桌面实测 | `src/lib/geometry.ts`、`src/services/window-service.ts` |
| 托盘、右键菜单、单实例、退出确认 | 已编写，待桌面实测 | `src-tauri/src/lib.rs`、`src/App.svelte` |
| 编辑标题、具体内容和截止时间 | 前端与持久化边界测试通过，原生 WebView 待实测 | `TodoEditor.svelte`、`src/lib/deadline.ts`、`updateTodo` |
| 新增共用编辑弹窗、标题提取、状态配色和紧急程度排序 | 自动化通过，桌面后台节流待实测 | `src/lib/status.ts`、`src/stores/clock.ts`、`TodoEditor.svelte` |
| 设置界面与自定义状态颜色 | 前端/存储适配测试通过，托盘入口待实测 | `SettingsPanel.svelte`、`color-storage.ts` |
| 可选置顶及重启恢复 | 前端菜单适配测试通过，Rust 与原生行为待实测 | `src/services/pin-service.ts`、`src-tauri/src/lib.rs` |
| 多语言 JSON 文件、设置切换与原生菜单翻译 | 前端与适配测试通过，原生菜单待实测 | `src/locales/`、`src/stores/i18n.ts`、`set_menu_language` |
| 三平台打包 CI | 已配置，未在此环境执行 | `.github/workflows/desktop.yml` |

## 与原方案的实现细化

- 使用 Svelte 5 与当前兼容构建工具，避免旧依赖的已知漏洞。
- 窗口每次启动默认收起；保存位置和是否置顶，不恢复展开模式。
- 置顶默认开启，在右键菜单与托盘菜单中通过“置顶显示”勾选项切换；Rust 统一拥有设置、操作窗口、保存 `window.json.alwaysOnTop` 并同步菜单状态，保存失败尝试恢复旧状态并提示错误。
- 新增和编辑共用完整弹窗，按钮统一为“保存”；标题为空从内容首句自动提取（中文/英文句末标点或换行），保留标点并截取到 200 Unicode 码点；标题和内容全空白时提示“标题必须不为空”。
- 新需求：点击代办文字打开窗口内模态编辑界面，编辑 `title`、`content`、`deadline`；内容可空、最多 10000 个 Unicode 码点，截止时间可空或为过去时间。使用本机时区输入到分钟，存储为 UTC ISO 时刻，允许清除。不发送到期通知。
- 状态按本机时区计算：超时（红）> 当天未超时（黄）> 有截止时间的正常（蓝）> 未设置时间（白），已完成灰色且排除告警；图标显示最高紧急状态，角标仍为未完成总数。每秒 tick、焦点/可见性恢复时更新。列表按状态优先，同状态按截止时间正序；无时间放在同状态有时间之后，按添加顺序。
- 增加设置弹窗、列表齿轮/右键/托盘入口，四状态颜色支持保存、取消与恢复默认，存于 `window.json.statusColors`；保留置顶入口。存储失败不应用颜色并恢复 Store 缓存；新增草稿重试用固定 ID 防重复。
- 新增 `unscheduled` 未设置时间状态，默认白色，未完成项中优先级最低；已完成仍在末尾。仅有无时间未完成项时图标白色，空列表/全部完成保持原来的蓝色。旧三色配置读取时补白色，不丢失原设置；支持自定义新状态颜色，中英文语言文件新增对应标签，白色图标采用深色符号及边框保证可见。
- 语言文件使用 `src/locales/{language_region}.json`，`lang` 为显示名。Vite glob 自动发现，新增文件不需要改注册列表。当前简体中文/English (US)，缺失键回退简体中文，校验文件名、字符串值及占位符。语言选择立即持久化到 `window.json.language`，界面、现有错误、日期格式、ARIA 标签、上下文/托盘菜单共同切换；不翻译用户内容。
- Rust 原生菜单初始值与前端共用 JSON 基线，前端将当前词典通过 `set_menu_language` 同步到托盘和窗口标题，不在 Rust 硬编码每种语言。新增语言需要重新编译资源，非已安装应用热加载。
- `version: 1` 数据采用增量兼容扩展，旧字段缺失补 `content: ''` / `deadline: null`，新字段非法则拒绝加载而非静默清空。更新只修改编辑字段与 `updatedAt`，保留 ID、完成状态、创建时间。
- 编辑采用本地草稿、焦点限制与恢复、背景 inert；取消/Esc 不提交草稿，不收起列表。保存失败保留草稿与内存修改，允许重试；失败后取消不会回滚已经提交到内存的修改。
- Store 默认加载可能吞掉 JSON 读取错误，且退出时可能保存注册的 Store。因此 `read_todo_document` 先在 Rust 中只读解析，前端校验数据版本和字段；失败时不注册 `todos.json`，禁用修改并保留原文件。不自动清空或覆盖损坏数据。
- 浏览器预览使用独立 localStorage，供无需 Rust 时查看 UI，不冒充桌面功能。
- 展开前读取悬浮图标的实时边界，以图标中心所在显示器的四象限向屏幕内侧展开，工作区空间不足时进行限制；收起恢复原图标位置，展开面板移动与 DPI 变化不保存图标位置。位置以物理像素记录在 `window.json.iconPosition`，兼容旧 `anchor`。显示器失效时回退主屏幕，另提供托盘重新定位。不承诺 Wayland 强制置顶与绝对定位。
- 不采用 Electron 的 `contextIsolation` / `nodeIntegration` 配置；Tauri 使用 capability 和 CSP。

## 验证记录

- `npm run check`：通过，0 errors / 0 warnings。
- `npm test`：16 个测试文件，共 100 项通过；覆盖四象限、屏幕与工作区边界、拖完立即展开、面板拖动后原位恢复、负坐标及混合 DPI、旧锚点恢复。之前的 88 项用例也保持通过；新增无时间状态分类/聚合/排序、截止时间增删、白色 UI 可读性、旧颜色配置迁移及新颜色保存恢复。新增自动发现/文件名和占位符校验、缺失键回退、语言保存/恢复/失败回滚、设置中运行时切换、现有错误重新翻译、日期格式和用户内容不变，以及原生菜单命令适配测试。原有业务/状态/存储测试通过，桌面 API 使用 mock。
- `npm run build`：前端生产构建通过；这不代表 Rust 或桌面安装包已构建。
- `npm audit --omit=dev`：生产依赖未发现已知漏洞。
- `npm ci --ignore-scripts --no-audit --no-fund`：锁文件可复现安装通过；安装后测试与检查再次通过。
- `npm run tauri -- info`：检测到 Windows 10、Node 24、MSVC Build Tools、WebView2、Rust/Cargo（MSVC 工具链）。
- `npm run desktop:build -- --bundles nsis`：本次窗口定位修改已成功重新编译并生成 Windows x64 安装包 `src-tauri/target/release/bundle/nsis/Floating Todo_0.1.0_x64-setup.exe`（1.64 MiB）。尚未实机验收本次位置修改。

## 后续本机验收

在 Rust stable MSVC 工具链可用的终端运行：

1. `cargo fmt --manifest-path src-tauri/Cargo.toml`。
2. `npm run desktop:dev`，验证透明、拖动与点击、展开锚点、托盘和退出；分别通过托盘和右键菜单开/关置顶，确认相互同步、图标与展开列表均生效、重启恢复选择；模拟设置保存失败，确认恢复旧状态并提示。
3. 新增/勾选/删除后重启，确认持久化；断开外接屏后恢复位置。
4. 备份后破坏 `todos.json`，确认报错、禁用修改、退出不覆盖损坏文件。
5. 编辑代办标题、多行内容、截止时间，验证原生 WebView 日期时间选择器和中文输入法；保存重启后恢复；取消草稿、清除 deadline、编辑已完成项、保存失败重试。
6. 验证新增即打开弹窗、内容首句成为标题、同状态 deadline 排序与无时间添加顺序；跨天/超时自动变色，完成/删除告警项恢复图标；在列表/右键/托盘打开设置，修改颜色后重启恢复，测试休眠唤醒与后台节流。
7. 从设置切换语言，确认悬浮图标 ARIA/提示、列表、编辑器、设置、错误、原生右键/托盘菜单和窗口标题更新；重启恢复语言，新增一份语言 JSON 并重新构建验证自动列出。验证语言/颜色/置顶设置互不覆盖。
8. 新增无时间代办，验证白色状态/图标与低优先级，添加或清除截止时间后分类重新计算，混合列表顺序及已完成位置正确；验证旧三色配置和新状态颜色保存。
9. `npm run desktop:build`，安装并验证 release 程序；分别在 macOS / Linux 构建并手工验收。

当前已生成 Windows x64 安装包；本次窗口定位变更的原生桌面行为仍待实机确认，macOS / Linux 未打包验收。
