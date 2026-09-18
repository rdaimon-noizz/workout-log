export type SaveOutcome = 'shared' | 'downloaded' | 'cancelled'

type ShareCapableNavigator = Navigator & {
  canShare?: (data: ShareData) => boolean
}

/**
 * ファイルを端末に渡す。iPhone のホーム画面アプリでは download リンクが不安定なため、
 * Web Share API（共有シート → 「ファイルに保存」「AirDrop」等）を優先し、使えなければ download にフォールバックする。
 */
export async function saveOrShareFile(content: string, filename: string, mimeType: string): Promise<SaveOutcome> {
  const file = new File([content], filename, { type: mimeType })
  const nav = navigator as ShareCapableNavigator
  if (typeof nav.share === 'function' && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: filename })
      return 'shared'
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return 'cancelled'
      // 共有できない環境（ジェスチャ切れ等）は download に切り替える
    }
  }
  downloadFile(file, filename)
  return 'downloaded'
}

export function downloadFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
