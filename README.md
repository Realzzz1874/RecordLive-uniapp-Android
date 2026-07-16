# RecordLive Android

RecordLive 的 Android 版本，使用 uni-app、Vue 3 和 TypeScript 开发。

当前进度：Milestone 1 应用骨架已实现；Milestone 2 的 M2.1 数据基础、M2.2 分类/标签管理、M2.3 演出编辑闭环和 M2.4 浏览闭环已通过自动化与 H5 交互验证，下一步进入 M2.5 Android 真机验收。Android 本地备份与恢复已调整到 Milestone 5。

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
