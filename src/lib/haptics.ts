/**
 * セット追加などの「手応え」の振動。できる端末（Android の navigator.vibrate）だけ鳴らし、できない端末では何もしない。
 * iOS Safari / ホーム画面の PWA には Web から振動を出す手段が無い（2026-09-25 に navigator.vibrate、
 * スイッチ型チェックボックス <input type="checkbox" switch> のプログラム切替・実タップ切替を iPhone 実機で試し、いずれも出なかった）。
 * 画面側は振動に頼らず、確認表示と一時的な無効化で手応えを出す。
 */
export function hapticTap(): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(15)
  } catch {
    // 振動は補助なので失敗しても無視する
  }
}
