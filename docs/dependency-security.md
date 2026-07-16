# Dependency security baseline

检查日期：2026-07-16

## 已处理

- 关闭默认开启的 uni 统计；
- 关闭 OAID；
- Android 额外权限列表为空；
- Vitest 升级到无已知任意文件读取漏洞的 3.2.6；
- Vue I18n 升级到 9.14.5；
- 本地 Vite 开发服务器固定监听 `127.0.0.1`，不向局域网暴露。

## 上游工具链风险

`npm audit` 仍会报告 DCloud 当前 Vue 3 编译器链锁定的 Babel、esbuild、Intlify 和 PostCSS 间接依赖。它们主要位于 CLI 编译/开发服务器路径，并非 RecordLive 业务运行时主动引入的功能。

不能执行 `npm audit fix --force`：npm 提议把 `@dcloudio/uni-cli-shared` 降级到不兼容的旧版本，会破坏当前 uni-app 编译链。

处理策略：

1. DCloud 包只做整组升级；
2. 每次升级后执行类型检查、测试、H5 构建、App 构建和 Android 自定义基座验证；
3. 开发服务器只监听回环地址，不处理不可信项目或文件；
4. 发布前重新执行 `npm audit` 并核对 DCloud 当前稳定编译器；
5. 生产包不部署 Vite/Vitest 开发服务器。

