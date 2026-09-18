import { describe, expect, it } from 'vitest'
import { CSV_BOM, csvEscape, csvValue, toCsv } from './csv'

describe('csvEscape', () => {
  it('カンマ・引用符・改行を含む値だけ引用し、引用符は重ねる', () => {
    expect(csvEscape('plain')).toBe('plain')
    expect(csvEscape('')).toBe('')
    expect(csvEscape('a,b')).toBe('"a,b"')
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""')
    expect(csvEscape('line1\nline2')).toBe('"line1\nline2"')
    expect(csvEscape('日本語, 全角')).toBe('"日本語, 全角"')
  })
})

describe('toCsv', () => {
  it('BOM で始まり、CRLF 区切りで、末尾にも改行が付く', () => {
    const csv = toCsv([
      ['a', 'b'],
      ['1', 'x,y'],
    ])
    expect(csv.startsWith(CSV_BOM)).toBe(true)
    expect(csv.slice(1)).toBe('a,b\r\n1,"x,y"\r\n')
  })
})

describe('csvValue', () => {
  it('null/undefined は空、数値はそのまま', () => {
    expect(csvValue(null)).toBe('')
    expect(csvValue(undefined)).toBe('')
    expect(csvValue(0)).toBe('0')
    expect(csvValue(22.5)).toBe('22.5')
    expect(csvValue('memo')).toBe('memo')
  })
})
