import { describe, expect, it } from 'vitest'

import { validateAndroidBackupManifest } from '@/domain/backup'

const sha256 = 'a'.repeat(64)

describe('Android local backup manifest', () => {
  it('accepts the Android-only v1 contract', () => {
    const manifest = validateAndroidBackupManifest({
      schemaVersion: 1,
      backupKind: 'android-local',
      appVersion: '0.1.0',
      exportedAtMs: 1_784_201_400_000,
      dataFile: 'data.json',
      files: [
        { path: 'data.json', byteSize: 128, sha256 },
        { path: 'media/poster.jpg', byteSize: 1024, sha256: sha256.toUpperCase() },
      ],
    })

    expect(manifest.backupKind).toBe('android-local')
    expect(manifest.files[1].sha256).toBe(sha256)
  })

  it('rejects non-Android backup kinds', () => {
    expect(() =>
      validateAndroidBackupManifest({
        schemaVersion: 1,
        backupKind: 'unsupported',
        appVersion: '0.1.0',
        exportedAtMs: 1_784_201_400_000,
        dataFile: 'data.json',
        files: [{ path: 'data.json', byteSize: 128, sha256 }],
      }),
    ).toThrow('Invalid backup kind')
  })

  it('rejects unsafe archive paths before extraction', () => {
    expect(() =>
      validateAndroidBackupManifest({
        schemaVersion: 1,
        backupKind: 'android-local',
        appVersion: '0.1.0',
        exportedAtMs: 1_784_201_400_000,
        dataFile: '../data.json',
        files: [{ path: '../data.json', byteSize: 128, sha256 }],
      }),
    ).toThrow('Invalid backup data file path')
  })
})
