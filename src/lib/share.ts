import { downloadBlob } from './export'

/**
 * Hands content to the device's own share sheet (WhatsApp, Messages, Mail, AirDrop…) when
 * the browser supports it, and falls back to a download otherwise. Nothing goes through
 * a FeedPlanner server: the browser passes the file straight to the app you pick.
 */

export type ShareOutcome = 'shared' | 'downloaded' | 'cancelled'

export function canShareFiles(files: File[]): boolean {
  try {
    return typeof navigator.canShare === 'function' && navigator.canShare({ files })
  } catch {
    return false
  }
}

export function canShareLinks(): boolean {
  return typeof navigator.share === 'function'
}

function isAbort(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError'
}

export async function shareFile(file: File, title: string, text?: string): Promise<ShareOutcome> {
  if (canShareFiles([file])) {
    try {
      await navigator.share({ files: [file], title, text })
      return 'shared'
    } catch (error) {
      if (isAbort(error)) return 'cancelled'
      // Some platforms refuse certain files after canShare said yes; fall back to downloading.
    }
  }
  downloadBlob(file, file.name)
  return 'downloaded'
}

export async function shareLink(url: string, title: string, text?: string): Promise<ShareOutcome | 'unsupported'> {
  if (!canShareLinks()) return 'unsupported'
  try {
    await navigator.share({ url, title, text })
    return 'shared'
  } catch (error) {
    return isAbort(error) ? 'cancelled' : 'unsupported'
  }
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Older browsers and insecure contexts: fall back to a hidden textarea.
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    area.remove()
    return ok
  }
}
