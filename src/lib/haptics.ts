/**
 * セット追加などの「手応え」。できる端末だけ振動させ、できない端末では何もしない（例外を出さない）。
 * - Android（Chrome 等）: navigator.vibrate
 * - iOS Safari / ホーム画面の PWA: Web に振動 API が無い。iOS 17.4 以降はスイッチ型チェックボックス
 *   （<input type="checkbox" switch>）を切り替えると触覚が出るので、ユーザー操作の延長でそれを切り替える。
 *   実機で鳴らない場合もあり得るため、画面側は振動に頼らず確認表示で手応えを出す。
 */
let switchInput: HTMLInputElement | null = null

function iosSwitch(): HTMLInputElement | null {
  if (typeof document === 'undefined') return null
  if (switchInput && switchInput.isConnected) return switchInput
  const el = document.createElement('input')
  el.type = 'checkbox'
  el.setAttribute('switch', '')
  el.setAttribute('aria-hidden', 'true')
  el.tabIndex = -1
  el.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none'
  document.body.appendChild(el)
  switchInput = el
  return el
}

/** 短い 1 回の振動（保存完了など） */
export function hapticTap(): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      if (navigator.vibrate(15)) return
    }
    iosSwitch()?.click()
  } catch {
    // 振動は補助なので失敗しても無視する
  }
}
