# OMO Route Panel

## English

Inspect and safely edit **new-task routing** inside OMO's native TUI. Compare
upstream recommendations, your overrides and the effective candidate chains
against the current host's available models. Open it with `/route-panel`
inside OMO; no browser or background server is required.

The npm package contains the precompiled extension. See
[first public release status](https://github.com/GodCC6/omo-route-panel/blob/main/docs/first-public-release.md)
for the verified version and installation results, and the
[release guide](https://github.com/GodCC6/omo-route-panel/blob/main/docs/releasing.md)
for ordinary npm account publishing.

### Features

- **Routes:** categories, agents and model profile; search the complete host
  catalog, reorder candidates, select reasoning and restore chain inheritance.
- **Background:** Recall, Reflection, Dream, Facts, Nudge and Memory Sync;
  distinguish editable user declarations from effective values and their sources.
  Dynamic selection stays dynamic; Nudge and Sync have no model picker.
- **Review and Apply:** combine accepted changes in one user-native-file buffer,
  inspect declarations and native effects, then explicitly save. Conflicting
  external changes block stale writes. Undo the last save after reopening.
- **Native integration:** English keyboard UI, host themes and compact terminal
  layouts. No inference probes, active-session monitoring or second model runtime.

### Installation

Prerequisites: an interactive OMO installation and Node `26.11.1` on PATH for
restricted native-report workers. Set `OMO_ROUTE_PANEL_NODE_PATH` to an absolute
Node executable path if needed. See compatibility below before loading.

Install persistently in OMO:

```sh
omo install npm:omo-route-panel
```

For one session:

```sh
omo -e npm:omo-route-panel
```

Alternatively, build a source checkout:

```sh
bun install --frozen-lockfile
bun run build
omo -e /absolute/path/to/omo-route-panel
```

Then run `/route-panel` in OMO. Source builds use Node `26.11.1` and Bun
`1.3.14`; the precompiled package needs no TypeScript compiler or build step.
OMO's package manager retains its own installation prerequisites.
The npm distribution is designed to contain precompiled `dist/src` and
`dist/extension`, with no compiler install hook. Its sole runtime dependency is
`jsonc-parser`. Terminal helpers come from OMO's `@earendil-works/pi-tui` peer
(`"*"`, optional peer metadata), rather than installing a second TUI. A source
checkout's pinned TUI alias is development-only; do not copy development
`node_modules` into a production package. See the [release guide](https://github.com/GodCC6/omo-route-panel/blob/main/docs/releasing.md)
for artifact verification and publication.

### Workflow

1. Open in **User** scope. Use **More... > Change scope** for **Current project**
   interpretation; both scopes edit only the supported user-level native file.
2. Type to search, press `Tab` to switch **Routes** / **Background**, and press
   `Enter` to open an item. In a route editor, **Use chain** accepts local candidate
   edits into the shared buffer. Valid background field choices enter it directly.
3. Select **Changes** (or `F4`) to inspect the target file, saved/proposed
   declarations and effective results. **Apply (N)** (or `Ctrl-S` from the main
   view or Changes) writes accepted changes together and requests host reload.
   A completed save is reported separately if reload fails.
4. **More... > Undo last save** prepares a reversal for inspection and explicit
   Apply. Relevant external edits block undo; unrelated edits are preserved.

In the main view, `Esc` clears nonempty search first. With empty search it closes
when clean or offers **Keep editing** / **Discard & close** when dirty. Closing,
discarding or ordinary host reload does not restore unapplied drafts. Scope
changes and Refresh require applying or discarding pending changes first.

### Compatibility and limits

The recorded native-host acceptance environment is macOS arm64 with OMO
`5.1.51`. Node engines remain exactly `26.11.1`; no broader Node, OMO or operating
system support is implied. Host installation identity, report structure,
real/mirror equivalence and registry availability are checked at runtime.
Unavailable evidence is explained rather than replaced with guessed semantics.
Complete references preserve `provider + "/" + rawModelId`, including nested
provider-like segments. Availability does not prove provider health, successful
inference or the configuration of an active session.

The dated [terminal boundary record](https://github.com/GodCC6/omo-route-panel/blob/main/docs/archive/native/tui-boundaries-2026-10-29.md)
reports 179 base tests and light/dark host acceptance at `120x40`, `70x24`,
`40x12` and `18x8` on 2026-10-29. These are historical results, not checks of
a newly packaged release. The [redesign record](https://github.com/GodCC6/omo-route-panel/blob/main/docs/archive/native/tui-redesign-implementation-2026-10-29.md)
also preserves the native source-evidence failure observed in that run;
[background semantics](https://github.com/GodCC6/omo-route-panel/blob/main/docs/background-semantics.md) and current release evidence
govern later compatibility claims.

### Documentation and support

Start with the [documentation index](https://github.com/GodCC6/omo-route-panel/blob/main/docs/README.md), [interaction design](https://github.com/GodCC6/omo-route-panel/blob/main/DESIGN.md),
[contributor guide](https://github.com/GodCC6/omo-route-panel/blob/main/CONTRIBUTING.md), [release guide](https://github.com/GodCC6/omo-route-panel/blob/main/docs/releasing.md),
[first public release status](https://github.com/GodCC6/omo-route-panel/blob/main/docs/first-public-release.md) and
[security policy](https://github.com/GodCC6/omo-route-panel/blob/main/SECURITY.md). For non-sensitive bugs, use the [issue tracker](https://github.com/GodCC6/omo-route-panel/issues)
when available and include versions, terminal size and synthetic reproduction
steps. GitHub private vulnerability reporting is enabled for security issues;
do not post credentials or personal configuration in issues.

License: MIT. See [LICENSE](LICENSE) and the release guide for distribution checks. The
[archive](https://github.com/GodCC6/omo-route-panel/blob/main/docs/archive/README.md) contains superseded Web instructions and dated
implementation evidence, not current installation guidance.

## 简体中文

在 OMO 原生 TUI 中查看并安全编辑**新任务路由**，根据当前宿主的可用模型集合，对照
上游推荐、个人覆盖与有效候选链。在 OMO 内运行 `/route-panel` 即可打开；无需浏览器
或后台服务器。

npm 包包含预编译扩展。已验证版本与安装结果见
[首次公开发布状态](https://github.com/GodCC6/omo-route-panel/blob/main/docs/first-public-release.md)，
普通 npm 账号发布步骤见[发布指南](https://github.com/GodCC6/omo-route-panel/blob/main/docs/releasing.md)。

### 功能

- **Routes：** 编辑类别、代理和模型配置档；搜索完整宿主模型目录、调整候选顺序、
  选择推理档位和恢复候选链继承。
- **Background：** 查看 Recall、Reflection、Dream、Facts、Nudge 和 Memory Sync；
  区分可编辑的用户声明、有效值及来源。动态选模保持动态描述，Nudge 和 Sync 不提供模型选择器。
- **核对与 Apply：** 将已接受的修改汇集到同一个用户原生文件缓冲，核对声明和原生
  生效结果后显式保存。外部冲突会阻止过时写入；重新打开后仍可撤销最近一次保存。
- **原生集成：** 英文键盘界面、宿主主题和紧凑终端布局；不发送推理探测、不监控活动
  会话，也不构建第二套模型运行时。

### 安装

前置条件：交互式 OMO，以及 PATH 中的 Node `26.11.1`，供受限原生报告 worker 使用。
必要时通过 `OMO_ROUTE_PANEL_NODE_PATH` 指定 Node 可执行文件的绝对路径。加载前请阅读
下方兼容性说明。

在 OMO 中持久安装：

```sh
omo install npm:omo-route-panel
```

单次会话加载：

```sh
omo -e npm:omo-route-panel
```

也可从源码检出目录构建：

```sh
bun install --frozen-lockfile
bun run build
omo -e /absolute/path/to/omo-route-panel
```

然后在 OMO 内运行 `/route-panel`。源码构建使用 Node `26.11.1` 和 Bun `1.3.14`；
预编译包无需 TypeScript 编译器或构建步骤；OMO 包管理器本身的安装前置条件仍然适用。
npm 分发设计为携带预编译的 `dist/src`
和 `dist/extension`，无需安装时编译。唯一运行时依赖是 `jsonc-parser`；终端辅助函数
由 OMO 的 `@earendil-works/pi-tui` peer 提供（范围 `"*"`，并标记为可选 peer），不再安装
第二套 TUI。源码目录中的固定版本 TUI 别名仅用于开发，请勿把开发用 `node_modules`
复制到生产包。产物验证与发布步骤见[发布指南](https://github.com/GodCC6/omo-route-panel/blob/main/docs/releasing.md)。

### 工作流程

1. 默认打开 **User** 范围。通过 **More... > Change scope** 切换 **Current project**
   解释上下文；两种范围均只编辑受支持的用户级原生文件。
2. 直接输入以搜索，按 `Tab` 切换 **Routes** / **Background**，按 `Enter` 打开条目。
   路由编辑器中的 **Use chain** 将局部候选修改接受到共享缓冲；合法的后台字段选择直接进入缓冲。
3. 选择 **Changes**（或 `F4`）核对目标文件、已保存与拟议声明及有效结果。在主视图或
   Changes 中选择 **Apply (N)**（或 `Ctrl-S`），一次写入已接受的修改并请求宿主重载。
   如果保存已完成但重载失败，会单独说明。
4. **More... > Undo last save** 将撤销操作放入变更视图，仍需核对并显式 Apply。
   相关字段的外部修改会阻止撤销，无关修改予以保留。

主视图中，`Esc` 优先清空非空搜索。搜索为空时，无修改则关闭，有修改则提供
**Keep editing** / **Discard & close**。关闭、丢弃或普通宿主重载后，不会恢复未保存草稿。
切换范围或 Refresh 前，需要先 Apply 或丢弃待保存修改。

### 兼容性与边界

已记录的原生宿主验收环境为 macOS arm64 和 OMO `5.1.51`。Node engines 仍精确限定
为 `26.11.1`，不据此宣称支持更广的 Node、OMO 版本或操作系统。运行时检查宿主安装
身份、报告结构、真实与镜像解析一致性以及注册表可用性；证据不足时明确说明，不猜测语义。
完整模型引用严格保留 `provider + "/" + rawModelId`，包括 ID 内类似 provider 的嵌套片段。
可用集合不证明供应商健康、推理成功或活动会话的配置。

带日期的[终端边界记录](https://github.com/GodCC6/omo-route-panel/blob/main/docs/archive/native/tui-boundaries-2026-10-29.md)记载了
2026-10-29 的 179 项基础测试，以及 `120x40`、`70x24`、`40x12`、`18x8` 的明暗主题
宿主验收；这些是历史结果，不是新打包版本的检查。[重设计记录](https://github.com/GodCC6/omo-route-panel/blob/main/docs/archive/native/tui-redesign-implementation-2026-10-29.md)
也保留了当时原生源码证据检查失败的事实；后续兼容性结论以[后台语义](https://github.com/GodCC6/omo-route-panel/blob/main/docs/background-semantics.md)
和当前发布证据为准。

### 文档与支持

参见[文档索引](https://github.com/GodCC6/omo-route-panel/blob/main/docs/README.md)、[交互设计](https://github.com/GodCC6/omo-route-panel/blob/main/DESIGN.md)、[贡献指南](https://github.com/GodCC6/omo-route-panel/blob/main/CONTRIBUTING.md)、
[发布指南](https://github.com/GodCC6/omo-route-panel/blob/main/docs/releasing.md)、[首次公开发布状态](https://github.com/GodCC6/omo-route-panel/blob/main/docs/first-public-release.md)和[安全政策](https://github.com/GodCC6/omo-route-panel/blob/main/SECURITY.md)。非敏感问题可在[issue 渠道](https://github.com/GodCC6/omo-route-panel/issues)
可用后报告，并附版本、终端尺寸和合成数据复现步骤。仓库已开启 GitHub 私密安全漏洞报告；
不要在 issue 中发布凭证或个人配置。

许可证为 MIT，参见 [LICENSE](LICENSE)；分发检查见发布指南。
[归档](https://github.com/GodCC6/omo-route-panel/blob/main/docs/archive/README.md)保存退役 Web 说明和带日期的实现证据，不是当前安装指南。
