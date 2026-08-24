import { describe, expect, it, vi } from 'vitest'

import { simulateWithRetry } from '../src/modules/contract-interaction-utils'

describe('simulateWithRetry', () => {
  it('returns the result after a transient simulation failure', async () => {
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('temporary provider failure'))
      .mockResolvedValueOnce('success')

    await expect(simulateWithRetry(operation, 'test operation', 3, 0)).resolves.toBe('success')
    expect(operation).toHaveBeenCalledTimes(2)
  })

  it('stops after the configured number of attempts and exposes the failure', async () => {
    const operation = vi.fn<() => Promise<string>>().mockRejectedValue(new Error('deterministic revert'))

    await expect(simulateWithRetry(operation, 'test operation', 3, 0)).rejects.toThrow(
      'test operation simulation failed after 3 attempts: deterministic revert'
    )
    expect(operation).toHaveBeenCalledTimes(3)
  })

  it('rejects invalid retry configuration before executing the operation', async () => {
    const operation = vi.fn<() => Promise<string>>()

    await expect(simulateWithRetry(operation, 'test operation', 0, 0)).rejects.toThrow(
      'maxAttempts must be a positive integer'
    )
    expect(operation).not.toHaveBeenCalled()
  })
})
