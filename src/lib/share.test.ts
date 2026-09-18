// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { saveOrShareFile } from './share'

type NavPatch = { share?: unknown; canShare?: unknown }

afterEach(() => {
  vi.restoreAllMocks()
  const nav = navigator as unknown as NavPatch
  delete nav.share
  delete nav.canShare
})

describe('saveOrShareFile', () => {
  it('Web Share API が使えればファイルを共有する', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { share, canShare: () => true })
    const outcome = await saveOrShareFile('a,b\r\n', 'x.csv', 'text/csv;charset=utf-8')
    expect(outcome).toBe('shared')
    const arg = share.mock.calls[0][0] as { files: File[]; title: string }
    expect(arg.title).toBe('x.csv')
    expect(arg.files[0].name).toBe('x.csv')
    expect(arg.files[0].type).toBe('text/csv;charset=utf-8')
  })

  it('共有シートを閉じたら cancelled', async () => {
    const abort = new Error('cancelled')
    abort.name = 'AbortError'
    Object.assign(navigator, { share: vi.fn().mockRejectedValue(abort), canShare: () => true })
    expect(await saveOrShareFile('{}', 'b.json', 'application/json')).toBe('cancelled')
  })

  it('Web Share API が無ければ download リンクで保存する', async () => {
    Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:mock'), revokeObjectURL: vi.fn() })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    expect(await saveOrShareFile('{}', 'b.json', 'application/json')).toBe('downloaded')
    expect(click).toHaveBeenCalledTimes(1)
  })
})
