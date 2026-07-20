# RecordLive Android

RecordLive 的 Android 版本，使用 uni-app、Vue 3 和 TypeScript 开发。

当前进度：Milestone 1 已实现；Milestone 2 的 M2.1–M2.4 已通过自动化与 H5 交互验证，M2.5 Android 真机验收按用户要求延期；Milestone 3 已完成；Milestone 4 的 42 格月历、按日回顾、年度统计、多币种消费汇总和城市/阵容/剧目排行已通过自动化、构建与 H5 交互验证。Android 本地备份与恢复仍安排在 Milestone 5。

Milestone 5 及之后阶段当前暂停，项目处于 M1–M4 功能还原校准期；只有收到明确通知后才恢复后续里程碑开发。

iOS 工程只作为产品行为和页面信息结构的只读参照。Android 开发不得修改 iOS 源码、资源、项目配置或测试，也不实现 iOS/Android 数据迁移。

## 本地开发

```bash
npm install
npm run type-check
npm test
npm run build:h5
npm run build:app
```

App 真机调试仍由 HBuilderX 完成。SQLite、权限或原生插件配置发生变化后，需要重新生成自定义基座或完整安装包。

## 文档

- [应用架构](docs/architecture.md)
- [Android 本地备份契约](docs/android-backup-contract-v1.md)
- [SQLite v1 Schema](database/schema-v1.sql)
- [依赖安全基线](docs/dependency-security.md)
