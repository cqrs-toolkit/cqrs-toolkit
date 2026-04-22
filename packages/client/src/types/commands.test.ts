import { describe, expect, it } from 'vitest'
import { type CommandStatus, isConfirmedStatus, isTerminalStatus } from './commands.js'

describe('isTerminalStatus', () => {
  it('treats succeeded, applied, failed, cancelled as terminal', () => {
    expect(isTerminalStatus('succeeded')).toBe(true)
    expect(isTerminalStatus('applied')).toBe(true)
    expect(isTerminalStatus('failed')).toBe(true)
    expect(isTerminalStatus('cancelled')).toBe(true)
  })

  it('does not treat non-terminal statuses as terminal', () => {
    const nonTerminal: CommandStatus[] = ['pending', 'blocked', 'sending']
    for (const status of nonTerminal) {
      expect(isTerminalStatus(status)).toBe(false)
    }
  })
})

describe('isConfirmedStatus', () => {
  it('treats succeeded and applied as confirmed', () => {
    expect(isConfirmedStatus('succeeded')).toBe(true)
    expect(isConfirmedStatus('applied')).toBe(true)
  })

  it('does not treat other statuses as confirmed', () => {
    const unconfirmed: CommandStatus[] = ['pending', 'blocked', 'sending', 'failed', 'cancelled']
    for (const status of unconfirmed) {
      expect(isConfirmedStatus(status)).toBe(false)
    }
  })
})
