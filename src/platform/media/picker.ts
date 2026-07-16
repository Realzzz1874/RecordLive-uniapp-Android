import { DomainValidationError } from '@/domain/errors'
import type { SelectedImage } from './types'

const MAX_IMAGE_BYTES = 5 * 1024 * 1024

export async function choosePerformanceImage(): Promise<SelectedImage | null> {
  return new Promise<SelectedImage | null>((resolve, reject) => {
    uni.chooseImage({
      count: 1,
      sourceType: ['album'],
      sizeType: ['compressed'],
      success: (result) => {
        const paths = Array.isArray(result.tempFilePaths)
          ? result.tempFilePaths
          : [result.tempFilePaths]
        const files = Array.isArray(result.tempFiles) ? result.tempFiles : [result.tempFiles]
        const path = paths[0]
        const file = files[0]
        if (!path) {
          reject(new DomainValidationError('没有读取到所选图片'))
          return
        }

        const byteSize = Number(file && 'size' in file ? file.size : 0)
        if (byteSize > MAX_IMAGE_BYTES) {
          reject(new DomainValidationError('图片不能超过 5 MB'))
          return
        }
        const fileType = file && 'type' in file ? String(file.type) : ''
        resolve({
          sourcePath: path,
          previewPath: path,
          byteSize: Number.isSafeInteger(byteSize) && byteSize >= 0 ? byteSize : 0,
          mimeType: fileType || inferMimeType(path),
        })
      },
      fail: (error) => {
        const message = 'errMsg' in error ? String(error.errMsg) : ''
        if (/cancel/i.test(message)) resolve(null)
        else reject(new Error(message || '选择图片失败'))
      },
    })
  })
}

function inferMimeType(path: string): string {
  const normalized = path.toLocaleLowerCase()
  if (normalized.includes('.png')) return 'image/png'
  if (normalized.includes('.webp')) return 'image/webp'
  return 'image/jpeg'
}
