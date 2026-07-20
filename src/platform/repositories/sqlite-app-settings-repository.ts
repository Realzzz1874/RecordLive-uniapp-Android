import type { AppSettingsRepository } from '@/features/preferences/repository'
import type { DatabaseDriver, DatabaseRow } from '@/platform/database/driver'
import { sqlInteger, sqlText } from '@/platform/database/sql-values'

interface SettingRow extends DatabaseRow {
  value_json: string
}

export class SQLiteAppSettingsRepository implements AppSettingsRepository {
  constructor(
    private readonly driver: DatabaseDriver,
    private readonly now: () => number = Date.now,
  ) {}

  async get<T>(key: string): Promise<T | null> {
    const rows = await this.driver.query<SettingRow>(
      `SELECT value_json FROM app_settings WHERE key = ${sqlText(key)} LIMIT 1`,
    )
    if (!rows[0]) return null
    try {
      return JSON.parse(String(rows[0].value_json)) as T
    } catch {
      return null
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    const json = JSON.stringify(value)
    await this.driver.execute(`
      INSERT INTO app_settings(key, value_json, updated_at_ms)
      VALUES (${sqlText(key)}, ${sqlText(json)}, ${sqlInteger(this.now())})
      ON CONFLICT(key) DO UPDATE SET
        value_json = excluded.value_json,
        updated_at_ms = excluded.updated_at_ms
    `.trim())
  }
}
