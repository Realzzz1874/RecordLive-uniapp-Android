# RecordLive Android 架构

状态：Milestone 0 基线  
目标平台：Android App  
只读产品参照：`/Users/zhangrui/Desktop/realzzz/repos/RecordLive/RecordLive/RecordLive`

## 1. 目标与边界

Android 版本复刻 Swift 版的产品语义和数据能力，不逐文件翻译 SwiftUI 实现。

iOS 工程只作为产品行为的只读参照，Android 项目不实现 iOS 与 Android 之间的数据导入、导出、同步或迁移，也不修改 iOS 工程代码。

首个可上线范围：

- 记录现场、待看、印记、设置四个主入口；
- 演出新增、编辑、删除、列表、详情和搜索；
- 海报、票根、分类、标签；
- 已看、待看、已取消、待开票、未赴约；
- 月历印记；
- Android 本地备份和恢复；
- 主题及必要的显示设置。

首版不包含桌面组件、Google Play Billing、OCR、地图、全部票务链接解析和实时云同步。这些能力必须经过独立的原生边界设计后再进入里程碑。

## 2. 技术基线

- uni-app Vue 3；
- TypeScript 严格模式；
- Composition API；
- Pinia 只保存界面状态；
- `plus.sqlite` 保存业务数据；
- `_doc/recordlive/media/` 保存海报、票根和缩略图；
- Vitest 测试纯领域逻辑和 Android 本地备份契约；
- HBuilderX 自定义基座验证 App 原生能力。

DCloud CLI 依赖必须作为一个整体升级，不能只升级某一个 `@dcloudio/*` 包。`package.json` 当前锁定到与本机 HBuilderX 对应的同一编译器版本。

## 3. 分层

```text
src/
  domain/                 纯业务类型与规则
  features/               按业务能力组织的用例和页面
    performances/
    want-see/
    imprints/
    settings/
    backup/
  platform/               uni-app、SQLite、文件和 Android 原生边界
    database/
    files/
    notifications/
    billing/
    widgets/
  stores/                 Pinia 页面状态
  components/             跨 feature 复用的显示组件
  pages/                  uni-app 页面入口，只负责组合 feature
```

依赖方向固定为：

```text
pages -> features -> domain
              \-> platform interfaces
platform implementations -> domain
```

领域层不能导入 `uni`、`plus`、Vue 或 Pinia。这样时间状态、筛选、本地备份和统计逻辑可以在 Node 环境直接测试。

## 4. 数据所有权

SQLite 是业务数据唯一来源。Pinia 不保存演出实体副本，仅保存：

- 当前 Tab；
- 筛选和排序条件；
- 编辑页面草稿；
- 一次性提示和加载状态。

数据库文件使用 `_doc/recordlive/recordlive.db`。图片不写入 SQLite BLOB；`media_assets` 只保存应用沙盒内的相对路径、类型、尺寸和哈希。

所有业务写入必须通过 Repository：

```ts
interface PerformanceRepository {
  get(id: string): Promise<Performance | null>
  list(query: PerformanceQuery): Promise<PerformancePage>
  save(draft: PerformanceDraft): Promise<Performance>
  remove(id: string): Promise<void>
}
```

保存演出、标签关系和媒体引用必须放在同一个数据库事务中。替换图片时先写新文件并校验，事务成功后再删除旧文件，避免数据库与文件系统互相悬空。

## 5. 状态语义

与 Swift 版保持一致：

| 值 | 状态 | 说明 |
|---:|---|---|
| 0 | 正常 | 根据演出时间派生为已看或待看 |
| 1 | 已取消 | 不参与正常时间派生 |
| 2 | 待开票 | 独立状态 |
| 3 | 未赴约 | 独立状态 |

“已看”和“待看”不是持久化枚举，必须通过 `status === 0` 和 `startedAtMs` 相对当前时间计算。

## 6. SQLite 与迁移

首版 Schema 位于 `database/schema-v1.sql`。启动流程：

1. 打开 `_doc/recordlive/recordlive.db`；
2. 启用 foreign keys；
3. 创建 `schema_migrations`；
4. 在事务中顺序执行未应用迁移；
5. 记录迁移版本和完成时间；
6. Repository 就绪后才渲染业务页面。

禁止通过删除数据库解决版本升级。每次 Schema 变化必须包含：

- 新的迁移文件；
- 从上一版本升级的测试；
- 从空数据库创建的测试；
- 备份恢复测试。

## 7. Android 本地备份与恢复

备份格式以 `docs/android-backup-contract-v1.md` 为准，仅用于当前 Android 应用自身的数据备份和恢复。

- 不读取或生成 iOS 数据格式；
- 不提供“从 iOS 导入”“导出到 iOS”或跨平台同步入口；
- 恢复前校验 Schema、文件路径、大小和哈希；
- 恢复操作必须先生成当前 Android 数据的恢复点；
- 数据库恢复和媒体落盘必须保证失败可回滚；
- 备份文件不得包含 WebDAV 密码、购买凭证或其它系统密钥。

## 8. 原生边界

以下模块必须通过 interface 隔离，页面不能直接调用 `plus.*` 或原生插件：

- SQLite；
- Android 本地备份文件选择、ZIP 和分享；
- 通知与系统日历；
- Android AppWidget；
- Google Play Billing；
- Android Keystore；
- OCR 与地图。

H5 只提供开发预览和纯逻辑验证，不承诺业务数据持久化能力。SQLite 真实流程必须在 Android 自定义基座中验收。

## 9. 权限与隐私

默认不声明额外 Android 敏感权限。只有用户主动进入对应功能时才按需申请，并提供拒绝后的可继续使用路径。

- 图片优先使用系统 Photo Picker；
- 文件导入优先使用系统文档选择器；
- 相机权限只在拍摄票根时申请；
- 定位权限只在用户主动使用地图定位时申请；
- 不申请 `READ_LOGS`、`GET_ACCOUNTS`、`READ_PHONE_STATE` 或 `WRITE_SETTINGS`。

## 10. 里程碑与验收门

### Milestone 0：工程与契约

- Vue 3 + TypeScript CLI 工程可构建；
- 架构和 Android 本地备份契约完成；
- SQLite v1 Schema 可由 SQLite 解析；
- Android 本地备份 manifest 校验通过；
- 类型检查、单元测试、H5 构建和 App 资源构建通过。

### Milestone 1：应用骨架

- 先确认完整主屏设计；
- 实现四个 Tab、主题、安全区和空状态；
- 不提前加入 CRUD；
- Android 真机验证 Tab 切换、返回键和深色模式。

### Milestone 2：核心记录闭环

- SQLite runtime、迁移和 Repository；
- 演出 CRUD、分类、标签、海报、票根；
- 搜索与详情；
- Android 本地备份和恢复。

### Milestone 3：待看与筛选

- 状态派生；
- 分类、标签、年份和状态筛选；
- 卡片、海报展示方式；
- 设置持久化。

### Milestone 4：印记

- 42 格月历；
- 年度统计和排行；
- 消费、城市、阵容等聚合查询。

### Milestone 5：高级与原生功能

- WebDAV、分享、通知、系统日历；
- 票务链接解析；
- OCR、地图、桌面组件、购买。

### Milestone 6：发布

- 隐私政策和权限审计；
- 签名 AAB；
- 升级、备份恢复和数据损坏演练；
- 主流 Android 版本真机验证；
- 应用商店材料。

每个里程碑的固定完成门：类型检查、单元测试、H5 smoke、App 构建、Android 真机核心流程、`git diff --check`。
