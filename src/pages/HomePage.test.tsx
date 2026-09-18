import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import HomePage from './HomePage'

describe('HomePage', () => {
  it('見出しとインストール手順を表示する', () => {
    render(<HomePage />)
    expect(screen.getByRole('heading', { level: 1, name: '筋トレ記録' })).toBeInTheDocument()
    expect(screen.getByText('iPhone へのインストール')).toBeInTheDocument()
  })
})
