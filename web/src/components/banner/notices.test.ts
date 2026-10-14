import { describe, expect, it } from 'bun:test'
import { resolveNotices } from './notices'

describe('resolveNotices', () => {
  it('shows nothing extra while connected', () => {
    expect(resolveNotices({ setup: false, connection: 'online' }))
      .toEqual({ chip: 'online', chatNote: false, streamPill: 0, chatPill: 0, composer: 'hint' })
  })

  it('pairs the chip with the chat note and blocks the composer while offline', () => {
    const n = resolveNotices({ setup: false, connection: 'offline', unseenArtifacts: 2, unseenMessages: 1 })
    expect(n).toEqual({ chip: 'offline', chatNote: true, streamPill: 0, chatPill: 0, composer: 'offline' })
  })

  it('folds the note at once when restored and leaves only the chip', () => {
    const n = resolveNotices({ setup: false, connection: 'restored' })
    expect(n.chip).toBe('restored')
    expect(n.chatNote).toBe(false)
    expect(n.composer).toBe('hint')
  })

  it('lets the setup guide silence every other notice', () => {
    expect(resolveNotices({ setup: true, connection: 'offline', unseenArtifacts: 3 }))
      .toEqual({ chip: 'online', chatNote: false, streamPill: 0, chatPill: 0, composer: 'hint' })
  })

  it('drops an area\'s pill under its state view and keeps the real count otherwise', () => {
    const n = resolveNotices({ setup: false, connection: 'online', streamEmpty: true, unseenArtifacts: 4, unseenMessages: 128 })
    expect(n.streamPill).toBe(0)
    expect(n.chatPill).toBe(128)
  })
})
