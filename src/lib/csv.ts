/** UTF-8 BOM。Windows の Excel が UTF-8 と判定するために先頭に付ける */
export const CSV_BOM = '﻿'

/**
 * RFC 4180 の引用。カンマ・引用符・改行を含む値は二重引用符で囲み、引用符は 2 つに重ねる。
 * 空文字はそのまま空（引用しない）。
 */
export function csvEscape(value: string): string {
  if (value === '') return ''
  if (/[",\r\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`
  return value
}

/** 行の配列を CSV 文字列にする（BOM 付き・CRLF・末尾改行あり） */
export function toCsv(rows: ReadonlyArray<ReadonlyArray<string>>): string {
  return CSV_BOM + rows.map((row) => row.map(csvEscape).join(',')).join('\r\n') + '\r\n'
}

/** CSV の値表現: null/undefined は空文字、数値は桁区切りなし */
export function csvValue(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return ''
  return typeof v === 'number' ? String(v) : v
}
