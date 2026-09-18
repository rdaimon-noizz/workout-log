// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import HomePage from './HomePage'

describe('HomePage', () => {
  it('見出しと「新しいトレーニング」への導線を表示する', async () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { level: 1, name: '筋トレ記録' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '新しいトレーニング' })).toHaveAttribute('href', '/workouts/new')
    expect(await screen.findByText('進行中のトレーニングはありません')).toBeInTheDocument()
  })
})
