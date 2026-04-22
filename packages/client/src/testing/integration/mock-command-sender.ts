/**
 * Domain-agnostic mock command sender for integration tests.
 *
 * The default `send` resolves `Ok({})` after a configurable delay. Domain
 * tests that need specific server responses should construct their own
 * {@link ICommandSender} implementation instead.
 */

import type { ServiceLink } from '@meticoeus/ddd-es'
import { Ok } from '@meticoeus/ddd-es'
import { vi } from 'vitest'
import type { ICommandSender } from '../../core/command-queue/types.js'
import type { EnqueueCommand } from '../../types/commands.js'

export interface MockCommandSender extends ICommandSender<ServiceLink, EnqueueCommand> {
  readonly sent: Array<{ type: string; data: unknown }>
}

export function createMockCommandSender(delayMs = 10): MockCommandSender {
  const sent: Array<{ type: string; data: unknown }> = []
  const sender: MockCommandSender = {
    sent,
    send: vi.fn(async (command) => {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
      sent.push({ type: command.type, data: command.data })
      return Ok({})
    }) as MockCommandSender['send'],
  }
  return sender
}
