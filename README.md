# RecordLive Android

RecordLive 的 Android 版本，使用 uni-app、Vue 3 和 TypeScript 开发。

当前进度：Milestone 0（架构、本地备份契约和工程基础）。可见产品界面将在 Milestone 1 根据确认后的设计实现。

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
