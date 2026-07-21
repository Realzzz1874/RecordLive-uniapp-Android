# RecordLive Android Local Backup Contract v1

状态：Milestone 0 未来契约，运行时实现已调整到 Milestone 5；Milestone 2 不接入备份或恢复功能。

本契约只用于 RecordLive Android 应用自身的本地备份和恢复，不用于 iOS 与 Android 之间的数据迁移、导入、导出或同步。

## 1. 容器

文件名建议：`RecordLive-Android-YYYYMMDD-HHmmss.backup.zip`

```text
manifest.json
data.json
media/
  <asset-id>.<extension>
```

`manifest.json`：

```json
{
  "schemaVersion": 1,
  "backupKind": "android-local",
  "appVersion": "1.0.0",
  "exportedAtMs": 1784201400000,
  "dataFile": "data.json",
  "files": [
    {
      "path": "data.json",
      "byteSize": 12345,
      "sha256": "64位十六进制SHA-256"
    }
  ]
}
```

要求：

- JSON 使用 UTF-8；
- 所有时间戳都是 Unix 毫秒；
- 所有金额使用十进制字符串，货币使用 ISO 4217 三字母代码；
- `files` 包含 `data.json` 和全部媒体文件；
- 每个文件记录字节大小和 SHA-256；
- 导入前拒绝绝对路径、反斜线、空路径和 `..` 路径穿越；
- v1 默认不加密；
- 备份不得包含 WebDAV 密码、系统密钥或购买凭证。

## 2. data.json

```json
{
  "performances": [],
  "categories": [],
  "tags": [],
  "performanceTags": [],
  "performanceFacets": [],
  "songs": [],
  "mediaAssets": [],
  "settings": []
}
```

### performances

| 字段 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `id` | string | 是 | 稳定 UUID |
| `name` | string | 是 | trim 后非空 |
| `startedAtMs` | integer | 是 | Unix 毫秒 |
| `city` | string | 是 | 可为空字符串 |
| `venue` | string | 是 | 演出场地 |
| `remark` | string | 是 | 备注 |
| `ticketPriceAmount` | string | 是 | 票面价 |
| `ticketPriceCurrency` | string | 是 | 默认 CNY |
| `paidPriceAmount` | string | 是 | 实付价 |
| `paidPriceCurrency` | string | 是 | 默认 CNY |
| `otherCostAmount` | string | 是 | 其它花费 |
| `otherCostCurrency` | string | 是 | 默认 CNY |
| `seat` | string | 是 | 座位 |
| `rating` | number | 是 | 0...5 |
| `status` | integer | 是 | 0、1、2、3 |
| `categoryId` | string/null | 是 | 分类 ID |
| `latitude` | number/null | 是 | 坐标 |
| `longitude` | number/null | 是 | 坐标 |
| `createdAtMs` | integer | 是 | 创建时间 |
| `updatedAtMs` | integer | 是 | 修改时间 |

### performanceFacets

阵容、嘉宾、剧目、渠道、朋友和厂牌使用统一多值结构（厂牌内部类型仍为 `company`）：

```json
{
  "performanceId": "...",
  "kind": "artist",
  "value": "艺术家名称",
  "sortOrder": 0
}
```

`kind` 只能是：`artist`、`guest`、`play`、`channel`、`friend`、`company`。

### mediaAssets

```json
{
  "id": "...",
  "performanceId": "...",
  "kind": "poster",
  "relativePath": "media/<asset-id>.jpg",
  "mimeType": "image/jpeg",
  "byteSize": 123456,
  "sha256": "...",
  "width": 1200,
  "height": 1600,
  "createdAtMs": 1784201400000
}
```

媒体类型：`poster`、`poster_thumb`、`ticket_original`、`ticket_thumb`。

## 3. 恢复流程

```text
选择 Android 本地备份
  -> 校验 ZIP 路径和总大小
  -> 解压到应用临时目录
  -> 校验 manifest 版本和 backupKind
  -> 校验全部文件大小和 SHA-256
  -> 校验 data.json 结构及引用关系
  -> 自动生成当前数据恢复点
  -> 媒体写入临时目录
  -> SQLite 事务恢复
  -> 原子切换媒体目录
  -> 清理临时文件
```

恢复前必须显示记录数量、媒体数量、备份时间和应用版本。任一校验、媒体写入或数据库写入失败时，不改变当前数据。

## 4. 版本策略

- `schemaVersion` 只允许整数递增；
- 旧版本通过独立的 Android 本地备份升级器转换；
- 不支持的更高版本只显示“需要更新应用”，不得尝试降级解析；
- 每次契约升级必须增加旧版恢复测试和损坏文件测试。
