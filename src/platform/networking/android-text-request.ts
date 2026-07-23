export interface AndroidTextResponse {
  statusCode: number
  text: string
}

export function requestAndroidText(
  url: string,
  headers: Record<string, string>,
  timeoutMs: number,
): Promise<AndroidTextResponse> {
  return new Promise((resolve, reject) => {
    const newAndroidObject = plus.android.newObject as unknown as (
      className: string,
      ...arguments_: unknown[]
    ) => PlusAndroidInstanceObject
    const invokeAndroid = plus.android.invoke as unknown as (
      object: PlusAndroidInstanceObject,
      methodName: string,
      ...arguments_: unknown[]
    ) => unknown
    const runnable = plus.android.implements('java.lang.Runnable', {
      run: () => {
        let connection: PlusAndroidInstanceObject | null = null
        let reader: PlusAndroidInstanceObject | null = null

        try {
          const nativeUrl = newAndroidObject('java.net.URL', url)
          connection = invokeAndroid(nativeUrl, 'openConnection') as PlusAndroidInstanceObject
          invokeAndroid(connection, 'setInstanceFollowRedirects', false)
          invokeAndroid(connection, 'setConnectTimeout', timeoutMs)
          invokeAndroid(connection, 'setReadTimeout', timeoutMs)

          for (const [name, value] of Object.entries(headers)) {
            invokeAndroid(connection, 'setRequestProperty', name, value)
          }

          const statusCode = Number(invokeAndroid(connection, 'getResponseCode'))
          let text = ''
          if (statusCode >= 200 && statusCode < 300) {
            const inputStream = invokeAndroid(connection, 'getInputStream') as PlusAndroidInstanceObject
            const inputStreamReader = newAndroidObject(
              'java.io.InputStreamReader',
              inputStream,
              'UTF-8',
            )
            reader = newAndroidObject('java.io.BufferedReader', inputStreamReader)

            const lines: string[] = []
            while (true) {
              const line = invokeAndroid(reader, 'readLine')
              if (line === null) break
              lines.push(String(line))
            }
            text = lines.join('\n')
          }

          resolve({ statusCode, text })
        } catch (error) {
          reject(error)
        } finally {
          if (reader) {
            try {
              invokeAndroid(reader, 'close')
            } catch {
              // The original request result is more useful than a cleanup error.
            }
          }
          if (connection) {
            try {
              invokeAndroid(connection, 'disconnect')
            } catch {
              // The original request result is more useful than a cleanup error.
            }
          }
        }
      },
    })

    const thread = newAndroidObject('java.lang.Thread', runnable)
    invokeAndroid(thread, 'start')
  })
}
