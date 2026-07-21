# RecordLive Android 架构

状态：Milestone 1 已实现；Milestone 2 的 M2.1–M2.4 已完成、M2.5 按用户要求延期；Milestone 3 已通过自动化与 H5 交互验证
目标平台：Android App  
iOS 只读产品参照：`/Users/zhangrui/Desktop/realzzz/repos/RecordLive/RecordLive/RecordLive`

## 1. 架构决策摘要

Android 版本使用 uni-app、Vue 3 和 TypeScript 独立实现，不逐文件翻译 SwiftUI，也不与 iOS 共用运行时代码、数据库、备份格式或同步通道。

从 Milestone 2 开始遵循以下产品参考原则：

- 演出字段语义、状态语义、页面信息结构、主要操作流程和确认逻辑只读参考 iOS 项目；
- Android 页面保持 Milestone 1 已确认的真白/暖黑、暖棕强调色、统一线性图标和自定义 TabBar 风格；
- 不要求像素级复刻 iOS，也不照搬 iOS 导航栏、系统控件或平台专属交互；
- Android 平台能力优先使用 Android Photo Picker、返回键、安全区和文档选择器等原生习惯；
- iCloud、iOS 备份、iOS 导入导出和 iOS/Android 数据迁移不属于 Android 产品范围。

Android 本地备份与恢复不在 Milestone 2 开发，整体调整到 Milestone 5。Milestone 0 已完成的备份契约只作为冻结的未来设计输入，不代表当前需要接入运行时。

## 2. iOS 工程只读边界

iOS 工程仅用于读取产品语义和交互行为。Android 开发期间不得修改 iOS 工程中的任何内容。

禁止操作包括但不限于：

- 编辑、格式化、重写、删除、移动或重命名任何 Swift、资源、测试和配置文件；
- 修改 `.xcodeproj`、`.xcworkspace`、Swift Package、签名、Entitlements、Build Settings 或 Scheme；
- 向 iOS 仓库生成快照、代码、迁移文件、构建产物或临时文件；
- 使用脚本、格式化器、代码生成器或依赖解析命令对 iOS checkout 产生写入；
- 为配合 Android 实现而给 iOS 增加兼容字段、导出能力、迁移入口或同步逻辑。

允许操作仅限：

- 使用 `rg`、`sed` 等只读命令查看 Swift 源码；
- 把已存在的页面行为、字段和文案作为 Android 产品参考；
- 使用 `git status --short` 检查 iOS checkout 是否保持原状。

每个 Android 里程碑切片开始和结束时都必须执行：

```bash
git -C /Users/zhangrui/Desktop/realzzz/repos/RecordLive status --short
```

Android 任务不得清理或覆盖 iOS 仓库中可能存在的用户改动。预期基线为空；若不为空，只记录状态并继续保持只读。

## 3. Milestone 2 的 iOS 参考矩阵

以下路径均相对于 iOS 只读产品参照根目录。

| Android 能力 | iOS 只读参考 | Android 实现要求 |
|---|---|---|
| 四个主入口和页面职责 | `ContentView.swift`、`Views/HomeNew.swift`、`Views/WantSee.swift` | 保留当前 Android 四 Tab 和自定义顶部栏，不复制 iOS Tab/NavigationStack 样式 |
| 演出新增与编辑 | `Views/AddOrEditActiveView.swift` | 参考字段分组、日期时间选择、状态/分类选择、媒体选择、保存校验和重复时间提醒；使用现有 Android 视觉组件 |
| 演出详情 | `Views/ActiveDetailView.swift` | 参考信息层级、编辑入口、删除确认和媒体展示；WebDAV、歌曲、分享等后续功能不进入 M2 |
| 演出搜索 | `Views/SearchView.swift`、`Views/HomeNew.swift` | 参考搜索入口和进入详情的路径；M2 只返回演出记录，不提前实现全部聚合搜索 |
| 分类管理 | `Views/Settings.swift`、`Views/SettingsGroup/CustomCategoryView.swift` | 设置页作为入口，分类 CRUD 放在独立页面；删除必须确认，表单只能选择已存在分类 |
| 标签管理 | `Views/Settings.swift`、`Views/SettingsGroup/Tags.swift` | 设置页作为入口，标签 CRUD 放在独立页面；表单使用受控多选，不保存重复标签文本 |
| 海报与票根 | `Views/AddOrEditActiveView.swift`、`Views/ActiveDetailView.swift` | 行为参考 iOS，文件实现改用 Android Photo Picker 和应用沙盒相对路径 |
| 演出数据语义 | `Models/Active.swift`、`Extensions/Active+Extension.swift` | 映射到 Android 领域模型和 SQLite Schema，不读取 SwiftData 数据文件 |

明确不参考、不移植的 M2 页面与能力：

- `Views/SettingsGroup/IcloudSyncView.swift`；
- `Views/SettingsGroup/BackupView.swift`；
- `Views/SettingsGroup/Backup_ImportAndroid.swift`；
- `Views/SettingsGroup/ImportAndroidTools.swift`；
- iOS 分享导入、iCloud、跨设备同步和跨平台数据迁移流程。

## 4. 产品范围

首个可上线范围：

- 记录现场、待观看、印记、设置四个主入口；
- 演出新增、编辑、删除、列表、详情和搜索；
- 海报、票根、分类、标签；
- 已看、待看、已取消、待开票、未赴约；
- 月历印记；
- 主题及必要的显示设置；
- Android 本地备份和恢复，但实现时间调整到 Milestone 5。

首版不包含桌面组件、Google Play Billing、OCR、地图、全部票务链接解析和实时云同步。这些能力必须经过独立原生边界设计后再进入里程碑。

## 5. 技术基线

- uni-app Vue 3；
- TypeScript 严格模式；
- Composition API；
- Pinia 只保存界面状态；
- `plus.sqlite` 保存 Android 业务数据；
- `_doc/recordlive/media/` 保存海报、票根和缩略图；
- Vitest 测试纯领域逻辑、Repository 契约和 H5 内存实现；
- HBuilderX 自定义基座验证 SQLite、Photo Picker、文件和返回键等 App 原生能力。

DCloud CLI 依赖必须作为一个整体升级，不能只升级某一个 `@dcloudio/*` 包。`package.json` 当前锁定到与本机 HBuilderX 对应的同一编译器版本。

## 6. 分层与依赖方向

```text
src/
  domain/                 纯业务类型、校验和状态规则
  features/               按业务能力组织用例和页面
    app-shell/
    performances/
    reference-data/
    want-see/
    imprints/
    settings/
    backup/               Milestone 5 才接入页面和运行时
  platform/               uni-app、SQLite、文件和 Android 原生边界
    database/
    files/
    photo-picker/
    backup/               Milestone 5
    notifications/
    billing/
    widgets/
  stores/                 Pinia 页面状态和草稿
  components/             跨 feature 复用的显示组件
  pages/                  uni-app 页面入口，只负责组合 feature
```

依赖方向固定为：

```text
pages -> features -> domain
              \-> platform interfaces
platform implementations -> domain
```

领域层不能导入 `uni`、`plus`、Vue 或 Pinia。页面不能直接调用 `plus.sqlite`、文件 API 或 Android 插件。

## 7. 数据所有权与 Repository

Android SQLite 是业务数据唯一来源。Pinia 不保存演出实体副本，仅保存：

- 当前 Tab；
- 筛选和排序条件；
- 编辑页面草稿；
- 一次性提示和加载状态。

数据库文件使用 `_doc/recordlive/recordlive.db`。图片不写入 SQLite BLOB；`media_assets` 只保存 Android 应用沙盒内的相对路径、类型、尺寸、字节数和哈希。

业务写入必须通过 Repository：

```ts
interface PerformanceRepository {
  get(id: string): Promise<Performance | null>
  list(query: PerformanceQuery): Promise<PerformancePage>
  save(draft: PerformanceDraft): Promise<Performance>
  remove(id: string): Promise<void>
}

interface ReferenceDataRepository {
  listCategories(): Promise<PerformanceCategory[]>
  saveCategory(draft: CategoryDraft): Promise<PerformanceCategory>
  removeCategory(id: string): Promise<void>
  listTags(): Promise<PerformanceTag[]>
  saveTag(draft: TagDraft): Promise<PerformanceTag>
  removeTag(id: string): Promise<void>
}
```

保存演出、标签关系和媒体引用必须放在同一个数据库事务中。替换图片时先写新文件并完成校验，事务成功后再删除旧文件；失败时删除新临时文件并保持旧记录不变。

H5 使用与 SQLite Repository 相同接口的内存实现，只承担 UI 开发和自动化 smoke。H5 数据不能被描述为真实持久化，Android 自定义基座才是 SQLite 验收环境。

## 8. 演出状态与字段语义

状态语义与 iOS `Active.active_status` 保持一致：

| 值 | 状态 | 说明 |
|---:|---|---|
| 0 | 正常 | 根据演出时间派生为已看或待看 |
| 1 | 已取消 | 不参与正常时间派生 |
| 2 | 待开票 | 独立状态 |
| 3 | 未赴约 | 独立状态 |

“已看”和“待看”不是持久化枚举，必须通过 `status === 0` 和 `startedAtMs` 相对当前时间计算。

M2 表单的首批字段：

- 名称、开始时间、城市、场馆、备注；
- 状态、分类、标签；
- 海报、票根；
- 阵容、嘉宾、剧目、渠道、朋友、出品方；
- 阵容、嘉宾与剧目/主题录入参考 iOS 的选择页交互：表单只显示添加入口或已选名称，进入独立页面后逐个手动添加，并支持修改、删除和调整顺序；阵容与嘉宾共用从 iOS 原样复制的 `src/features/performances/names.json`，并合并已有记录中的阵容、嘉宾；剧目/主题仅使用从 iOS 原样复制的 `src/features/performances/musical.json`、`src/features/performances/opera.json` 与已有记录中的剧目数据，禁止与阵容/嘉宾预选数据混用；不实现识图与批量输入模式；
- 票面价、实付价、其他花费及币种；
- 座位、评分。

Android 不复制 SwiftData 模型，也不读取 iOS 数据库或外部存储文件。字段只通过产品语义映射到 `src/domain` 和 `database/schema-v1.sql`。

## 9. SQLite runtime 与迁移

首版 Schema 位于 `database/schema-v1.sql`。M2 启动流程：

1. 通过 `DatabaseDriver` 打开 `_doc/recordlive/recordlive.db`；
2. 启用 foreign keys；
3. 创建 `schema_migrations`；
4. 在事务中顺序执行未应用迁移；
5. 记录迁移版本和完成时间；
6. 创建 Repository；
7. Repository 就绪后才渲染真实业务列表。

禁止通过删除数据库解决版本升级。每次 Schema 变化必须包含：

- 新的迁移文件；
- 从上一版本升级的测试；
- 从空数据库创建的测试；
- 迁移失败保持旧数据不变的回滚测试。

备份恢复测试从 Milestone 5 开始加入，不作为 M2 的完成门。

## 10. 媒体与文件一致性

- 图片通过 Android Photo Picker 选择，M2 默认不申请相册全量读取权限；
- 原图、缩略图和数据库引用都使用稳定 UUID；
- 海报在列表卡片、海报模式、印记日历和编辑预览等紧凑展示区域统一使用 `3:4` 容器，图片保持原始宽高比并居中裁剪，不允许拉伸；
- 演出详情页顶部海报是上述规则的明确例外：以页面完整宽度为基准等比计算高度，展示整张图片，不使用固定高度裁剪；
- 默认演出卡片的信息层级只读参考 iOS `ActiveCard.swift`：左侧 `3:4` 海报，右侧依次显示最多两行演出名称、演出时间、演出场地和倒计时 Tag；Android 保留现有主题色、触控反馈和无海报占位样式；
- 海报模式只显示纯 `3:4` 海报，不叠加状态角标、渐变、名称或场地信息；手机端允许统一选择每行 `2–8` 张并持久化，不实现 iOS 的 iPad 专属列数分支；
- 页面只持有预览 URI 或草稿引用，保存成功前不把临时文件当成正式媒体；
- 删除演出时必须显示是否同时删除应用沙盒媒体的确认；
- 文件写入、SQLite 事务或缩略图生成任一步失败时，不得留下悬空数据库引用；
- M2 不实现从 iOS 导入图片、读取 iOS 外部存储或共享媒体目录。

## 11. 原生边界与权限

以下模块必须通过 interface 隔离：

- SQLite；
- Android Photo Picker 和文件写入；
- Android 本地备份文件选择、ZIP 和分享（Milestone 5）；
- 通知与系统日历；
- Android AppWidget；
- Google Play Billing；
- Android Keystore；
- OCR 与地图。

默认不声明额外 Android 敏感权限。只有用户主动进入对应功能时才按需申请，并提供拒绝后的可继续使用路径。

- 图片优先使用系统 Photo Picker；
- 文件导入优先使用系统文档选择器；
- 相机权限只在未来支持直接拍摄票根时申请；
- 定位权限只在用户主动使用地图定位时申请；
- 不申请 `READ_LOGS`、`GET_ACCOUNTS`、`READ_PHONE_STATE` 或 `WRITE_SETTINGS`。

## 12. Android 本地备份与恢复（Milestone 5）

`docs/android-backup-contract-v1.md` 是 Milestone 0 形成的未来契约。M2、M3 和 M4 不实现备份 ZIP、文件选择、恢复事务或自动恢复点。

Milestone 5 实现时必须遵守：

- 只用于当前 Android 应用自身的数据备份和恢复；
- 不读取或生成 iOS 数据格式；
- 不提供“从 iOS 导入”“导出到 iOS”或跨平台同步入口；
- 恢复前校验 Schema、文件路径、大小和哈希；
- 恢复操作先生成当前 Android 数据恢复点；
- 数据库恢复和媒体落盘失败时可回滚；
- 不包含 WebDAV 密码、购买凭证或系统密钥。

在 Milestone 5 实现前，设置页最多显示明确标注为后续计划的入口，不得提供看似可用但会操作数据的备份交互。

## 13. 里程碑

### Milestone 0：工程与契约（已完成）

- Vue 3 + TypeScript CLI 工程可构建；
- Android 架构、SQLite v1 Schema 和未来本地备份契约完成；
- Android 本地备份 manifest 的纯契约校验完成；
- 类型检查、单元测试、H5 构建和 App 资源构建通过。

### Milestone 1：应用骨架（已实现）

- 完整主屏设计已确认；
- 四个 Tab、主题、安全区和空状态已实现；
- 未提前加入 CRUD；
- Android 真机 Tab、返回键和深色模式仍作为设备验收项。

### Milestone 2：核心记录闭环

- SQLite runtime、迁移、H5 内存实现和 Repository；
- 分类与标签独立管理页面；
- 演出新增、编辑、删除、列表和详情；
- 海报与票根的 Android 文件闭环；
- 演出搜索；
- 不实现 Android 本地备份和恢复。

### Milestone 3：待看与筛选

- 状态派生；
- 分类、标签、年份和状态筛选；
- 卡片、海报展示方式；
- 设置持久化。

### Milestone 4：印记

- 42 格月历；
- 年度统计和排行；
- 消费、城市、阵容等聚合查询。

### Milestone 5：数据安全、高级与原生功能

- Android 本地备份和恢复；
- WebDAV、分享、通知、系统日历；
- 票务链接解析；
- OCR、地图、桌面组件、购买。

### Milestone 6：发布

- 隐私政策和权限审计；
- 签名 AAB；
- 升级、备份恢复和数据损坏演练；
- 主流 Android 版本真机验证；
- 应用商店材料。

## 14. Milestone 2 实施切片与完成门

M2 按以下顺序实现，每个切片通过验证后再进入下一片：

1. **M2.1 数据基础（自动化门已通过）**：`DatabaseDriver`、迁移器、SQLite 实现、H5 内存实现和 Repository 契约；Android 自定义基座验证并入 M2.5 真机验收；
2. **M2.2 基础字典（H5 交互与自动化门已通过）**：分类管理、标签管理和独立页面已实现；演出表单受控选择随 M2.3 接入，Android SQLite 真机验证并入 M2.5；
3. **M2.3 演出编辑闭环（实现及 H5 交互门已通过，持续进行功能还原校准）**：新增/编辑表单、字段校验、相近两小时提醒、海报和票根事务边界已实现；城市与场地改为独立选择流程，包含默认地区、其它地区、城市搜索、常去城市和按城市筛选场地，不移植 iOS 地图选择；Android Photo Picker、图片压缩和沙盒文件真机验证并入 M2.5；
4. **M2.4 浏览闭环（实现及 H5 交互门已通过）**：时间倒序列表、分页加载、名称/地点/备注/演出内容搜索、详情、编辑回跳刷新、删除确认和媒体清理已实现；
5. **M2.5 真机验收（延期）**：重启持久化、事务回滚、媒体一致性、返回键和深色模式；2026-07-20 按用户要求暂不执行，后续必须补验，但不阻塞 M3 功能开发。

M2 固定完成门：

- 类型检查；
- 领域、迁移、Repository 和 CRUD 测试；
- H5 内存实现 smoke；
- App 资源构建；
- Android 自定义基座 SQLite 和 Photo Picker 核心流程；
- `git diff --check`；
- Android 源码无 iOS/iCloud/跨平台迁移入口；
- iOS 仓库 `git status --short` 与开始时一致，且本次任务对 iOS 零写入。

## 15. Milestone 3 实施切片与完成门

M3 延续 Repository 边界，不允许页面直接读取 SQLite，也不修改 iOS 项目：

1. **M3.1 状态与查询（自动化门已通过）**：正常演出根据当前时间派生“已看/待看”，待开票、已取消、未赴约保持显式状态；Repository 支持生命周期、多分类和任一标签查询；
2. **M3.2 首页筛选（实现门已通过）**：分类、标签、单年份和状态筛选；已失效的分类/标签筛选项自动剔除；状态筛选 H5 交互已验证，组合查询由内存和 SQLite 自动化测试覆盖；
3. **M3.3 展示与持久化（H5 交互门已通过）**：卡片/海报双视图，筛选条件和默认展示方式保存到 Android `app_settings`；H5 使用独立的 `uni` storage 实现；
4. **M3.4 待看闭环（H5 交互门已通过）**：“待观看” Tab 展示未来正常演出和待开票演出，复用详情、编辑、删除和新增流程；内部领域语义仍使用“待看”生命周期；
5. **M3.5 验证（已通过）**：领域/Repository/设置测试、类型检查、H5 构建、App 资源构建、H5 交互回归和边界扫描。

M3 的 H5 与自动化验证不替代 M2.5 Android 真机验收。SQLite 设置持久化、系统返回键和 Android 沙盒媒体仍需在恢复 M2.5 时统一验证。

## 16. Milestone 4 实施切片与完成门

M4 继续把 iOS 项目作为只读的产品行为参照，不读取 SwiftData，不复制 iOS 导航实现，也不对 iOS 源码、资源、配置或测试产生任何写入：

1. **M4.1 月历查询与模型（自动化门已通过）**：查询层分页读取完整演出集合，生成固定 6 行 × 7 列、周一开始的本地时区月历；月外日期保留用于连续展示，日期格提供场次数和海报标记；
2. **M4.2 按日回顾（实现门已通过）**：点击日期只更新所选日期及当天演出列表；演出卡片复用 M2/M3 详情、编辑和删除闭环，返回后继续停留在印记 Tab；
3. **M4.3 年度聚合（自动化门已通过）**：按年份统计总场次、观演日、生命周期、评分、城市、阵容和剧目；城市、阵容和剧目按记录次数稳定排序；
4. **M4.4 消费聚合（自动化门已通过）**：票面价、实付和其他消费使用十进制字符串精确累加；没有汇率数据时按币种分别汇总，禁止生成跨币种总额；
5. **M4.5 验证**：领域测试、类型检查、H5/App 资源构建、H5 月历与详情交互回归、边界扫描和 iOS 仓库零写入检查。

M4 不包含地图、年度海报生成、截图分享、汇率换算、系统日历或 Android 本地备份。Android 本地备份仍在 M5；M4 的自动化和 H5 验证仍不替代延期的 M2.5 Android 真机验收。任何 iOS/Android 数据迁移能力都不在当前或后续架构范围内。

## 17. 功能还原校准期

自 2026-07-20 起，Milestone 5 及之后阶段按用户要求暂停。在收到明确的“继续 Milestone 5”通知前，只处理 M1–M4 已实现功能与 iOS 只读参考之间的行为偏差，不提前开发备份、WebDAV、通知、系统日历、OCR、地图、桌面组件、购买或发布能力。
