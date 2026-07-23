# RecordLive Android 开发规则

本文件适用于仓库根目录及其全部子目录，是开发代理进入本项目时必须先遵守的执行规则。完整架构、功能设计、里程碑步骤与完成状态以 [`docs/architecture.md`](docs/architecture.md) 为唯一来源，不在本文件重复维护。

## 1. 文档与决策职责

| 载体 | 职责 |
|---|---|
| 用户当前指令 | 决定本轮范围、功能取舍、里程碑启停和是否执行真机验证 |
| `AGENTS.md` | 规定长期有效的工程边界、分层职责、工作流程和最低验证要求 |
| `docs/architecture.md` | 维护完整架构、产品范围、iOS 参考矩阵、各 Milestone 实施步骤、状态和完成门 |
| `docs/milestone-*.md` | 记录单个阶段的设计细节、视觉规范或专项验收要求 |
| `docs/android-backup-contract-v1.md` | 是已授权并实现的 Milestone 5 Android 本机备份 v1 契约；M5.6 真机验收状态仍以 `docs/architecture.md` 为准 |
| 源码、Schema 与测试 | 是当前运行行为、数据结构和已验证能力的事实来源 |

发生冲突时，先遵循用户当前明确指令，再遵循本文件的工程边界；架构或阶段设计发生变化时，更新 `docs/architecture.md`，不要在多个文档复制同一份阶段清单。

## 2. 固定项目边界

- 本仓库只实现 Android 版 RecordLive，技术栈为 uni-app、Vue 3 和 TypeScript。
- 最终构建、交付和运行目标固定为 Android App。除纯文档外，所有功能、页面、组件、资源、网络请求、数据访问和媒体处理都必须存在可用的 Android App 运行路径，不得交付只能在 H5 正常工作的实现。
- H5 只用于界面开发、自动化和 smoke，不是产品发布目标。H5 专用代理、浏览器 API、DOM 能力或内存实现必须有对应的 Android App 实现；功能完成状态以 Android App 能够编译且其平台路径完整为前提。
- 设计和实现时优先检查 uni-app App 端兼容性，不得依赖 `window`、浏览器 `localStorage`、仅 H5 可用的 CSS/DOM 行为或仅开发服务器存在的代理来完成核心功能。必须存在平台差异时，将差异收敛在 `src/platform/` 或明确的条件编译边界内。
- iOS 工程只作为产品语义和交互行为参照，路径为 `/Users/zhangrui/Desktop/realzzz/repos/RecordLive/RecordLive/RecordLive`。
- 禁止修改、格式化、生成、移动或删除 iOS 工程中的任何源码、资源、配置、测试和构建文件；禁止为 Android 适配而改造 iOS 数据结构或功能。
- 查看 iOS 时只使用只读操作，例如 `rg`、`sed` 和 `git status --short`。不要在 iOS 工程中执行会产生缓存、依赖、构建产物或临时文件的命令。
- 不实现 iOS 与 Android 之间的数据导入、导出、迁移、同步或兼容备份。该限制对当前及未来阶段都有效。
- Android 本地备份只服务于 Android 应用自身。Milestone 5 本机备份 v1 已获得用户授权并完成 M5.1–M5.5；不得借此扩展到 iOS 兼容、云同步或其它高级能力。
- M5.1–M5.5 已实现；M5.6 Android 自定义基座与真机验收仍延期。Milestone 6 以及 WebDAV、分享、通知、系统日历、OCR、地图、桌面组件和购买等其它高级能力继续暂停，必须获得新的明确授权。
- Android 真机验收当前延期。除非用户明确要求，否则只执行自动化、H5 交互和资源构建验证，不把这些结果描述成真机验证。
- 不擅自清理、覆盖或回退工作区中的已有修改；不执行破坏性 Git 操作，不暂存、提交或推送，除非用户明确要求。

开始和结束涉及 iOS 参考的实现任务时，检查 iOS 仓库状态：

```bash
git -C /Users/zhangrui/Desktop/realzzz/repos/RecordLive status --short
```

如果该状态原本非空，只记录并保持只读，不清理其中的用户修改。

## 3. 产品还原原则

- 字段语义、状态定义、信息层级、主要交互、校验和确认逻辑优先只读参考 iOS 实现。
- 视觉继续使用 Android 版现有设计系统：真白/暖黑背景、暖棕强调色、统一线性图标、自定义顶部栏和底部 TabBar；除非用户明确要求，不做无关重设计。
- Android 使用 Android 平台习惯和能力，不照搬 iOS 导航、系统控件或 iPad 专属逻辑。
- 地图选择不进入 Android 当前产品范围；城市与场地使用现有列表选择交互。
- 底部 Tab 文案固定为“待观看”，内部领域模型可以继续使用“待看”语义。
- 卡片、日历等非详情场景中的海报和票根按 `3:4` 显示并居中裁剪；详情页顶部媒体以宽度为基准完整展示。
- 内置 JSON 可以作为 Android 静态资源随应用发布，但运行时不得读取 iOS 工程或 iOS 用户数据。
- 用户点名页面、字段或可见位置时，先在该范围内参考现有实现做最小修改，不扩展到未授权功能。

更细的页面和字段规则统一维护在 `docs/architecture.md`。

## 4. 代码分层职责

依赖方向固定为：

```text
pages -> features -> domain
              \-> platform interfaces
platform implementations -> domain
```

各目录职责如下：

- `src/domain/`：纯业务类型、状态规则、校验、查询模型和聚合计算；不得导入 Vue、Pinia、`uni` 或 `plus`。
- `src/features/`：按业务能力组织页面、用例和 feature 内组件；负责组合领域能力与平台接口，不直接操作底层 SQLite 或 Android 插件。
- `src/platform/`：SQLite、文件、Photo Picker 和其他 Android/uni-app 能力的实现边界；平台差异必须收敛在此层。
- `src/stores/`：保存 Tab、筛选、显示偏好、编辑草稿和短生命周期 UI 状态；不得作为演出业务实体的第二数据源。
- `src/components/`：跨 feature 复用的纯展示组件和统一交互组件；不得承载某个业务页面的持久化流程。
- `src/pages/`：uni-app 页面入口和应用级组合，只负责装配 feature、主题、安全区和主导航。
- `src/static/`：Android 应用自己的图标、插画和预置 JSON；复制自 iOS 的静态数据在进入本仓库后由 Android 项目独立维护。
- `tests/`：覆盖领域规则、Repository 契约、数据迁移和关键回归；修复业务缺陷时应补充能够防止复发的测试。
- `docs/`：保存架构和设计决策，不放运行时依赖，也不以文档内容替代代码验证。

## 5. 数据职责

- Android SQLite 是 App 端业务数据的唯一来源，所有读写通过 Repository 或明确的数据访问接口完成。
- H5 内存 Repository 只用于 UI 开发、自动化和 smoke，不代表真实 Android 持久化。
- Pinia 不持有 SQLite 演出实体副本。
- 海报、票根和缩略图保存在 Android 应用沙盒，数据库只保存相对路径及必要元数据，不保存图片 BLOB。
- Schema 变化必须通过向前迁移完成，并覆盖旧数据保留、失败回滚和 Repository 契约测试。
- 不读取 SwiftData、iCloud、iOS 数据库、iOS 备份或 iOS 外部存储。

## 6. 实现流程

1. 先确认用户点名的 Android 页面、字段或流程，并阅读相邻代码和 `docs/architecture.md` 中对应约束。
2. 需要参考 iOS 时，只读定位真实 SwiftUI 交互和计算方式，同时记录明确排除的平台专属能力。
3. 在现有分层内完成最小闭环；相同触发效果应复用同一 action、use case 或 Repository 方法。
4. 保持数据、交互和视觉职责分离，禁止为快速完成而让页面直接调用 SQLite、文件 API 或原生插件。
5. 按变更风险执行验证，并检查没有引入 iOS、iCloud 或跨平台迁移入口。
6. 对所有运行时代码和资源变更检查 Android App 代码路径；H5 中使用的代理、存储、媒体和交互方案必须确认 App 端存在对应实现，不能用 H5 结果替代 Android 兼容性判断。
7. 只有架构、里程碑范围、状态或完成门发生变化时才同步更新 `docs/architecture.md`；普通样式修复不重复更新阶段文档。
8. 交付时说明已实现内容、实际验证结果、未执行的真机项和仍存在的风险，不把 App 构建通过等同于 Android 设备可上线。

## 7. 验证职责

最低验证按改动类型选择：

| 改动类型 | 必须执行 |
|---|---|
| Markdown 或纯文档 | `git diff --check`，并人工检查链接、职责重复和规则冲突 |
| TypeScript、领域或 Repository | `npm run type-check`、`npm test`、`git diff --check` |
| Vue 页面、组件或样式 | 上述检查，加 `npm run build:h5`、`npm run build:app`、目标交互的 H5 浏览器验证和控制台检查 |
| 任意运行时代码或 App 资源 | 上述适用检查，加 `npm run build:app`，并人工确认没有 H5-only 核心路径 |
| SQLite、文件、Photo Picker、返回键等原生行为 | 先完成自动化和 App 构建；只有用户授权后再执行 Android 自定义基座或真机验收 |

`npm run build:app` 通过只代表 Android App 资源编译通过，不代表真机运行已经验收。真机验收延期期间，交付必须明确列出仍待设备验证的原生、网络、存储和媒体行为。

构建时已有且与本次改动无关的警告可以如实记录，但不得隐藏新错误。不要为了让检查通过而修改无关文件。

## 8. 阶段控制

- Milestone 0–5 的详细完成情况和剩余验收项统一查看 `docs/architecture.md`。
- M2.5 Android 真机验收保持延期，直至用户明确恢复。
- 当前工作阶段是 M1–M5 已实现功能的还原校准、缺陷修复与自动化完善，不自动推进 Milestone 6。
- Milestone 5 本机备份 v1 的 M5.1–M5.5 已完成；M5.6 真机验收、Milestone 6 发布准备和其它高级能力仍必须经过用户新的明确授权。
- 新需求如果会跨越当前阶段边界，先说明影响并等待用户决定，不以“顺便完善”为理由提前实现。
