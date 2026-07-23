# RecordLive Android

RecordLive 的 Android 版本，使用 uni-app、Vue 3 和 TypeScript 开发。

当前进度：Milestone 1 已实现；Milestone 2 的 M2.1–M2.4 已通过自动化与 H5 交互验证，M2.5 Android 真机验收按用户要求延期；Milestone 3、Milestone 4 已完成自动化、构建与 H5 交互验证；Milestone 5 本机备份与“全部覆盖 / 本机优先合并”双模式恢复的 M5.1–M5.5 已实现，并完成写锁范围、失败媒体回收、启动期孤儿目录清理和文件选择监听解绑闭环。

M2.5 与 M5.6 Android 自定义基座/真机验收仍按用户要求延期；Milestone 6 发布准备以及 WebDAV、通知、系统日历、OCR、地图、桌面组件和购买等其它高级能力继续暂停。

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
