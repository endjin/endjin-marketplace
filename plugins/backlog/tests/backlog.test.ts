import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

const DIR = '/home/t/.claude/backlog/items'
const PANE = {
  plugin: 'backlog',
  component: 'Pane',
  requestId: 'backlog',
  props: {
    title: 'Backlog',
    isFocused: true,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

// The host hands a hook the path as this machine spells it (`C:\home\t` on
// Windows): the folder in memory is keyed by the POSIX spelling.
const posix = (path: string) =>
  path.replace(/\\/g, '/').replace(/^[A-Za-z]:/, '')

// The world beneath the mod: a folder in memory, a session rooted at `root`,
// the prompts the mod submits and the toasts it shows. `submit` says what
// becomes of a prompt: it enters, a hook drops it, or the call rejects.
const world = (
  on: On,
  root = '/work/app',
  submit: 'enter' | 'drop' | 'reject' = 'enter',
) => {
  const files = new Map<string, string>()
  const overwritten: string[] = []
  const prompts: string[] = []
  const toasts: string[] = []
  const clock = mock.clock(on, { now: 1_700_000_000_000 })
  mock.env(on, { HOME: '/home/t' })

  on('fs.exists', ($, e) => ({
    value: posix(e.path) === DIR || files.has(posix(e.path)),
  }))
  on('fs.list', ($, e) => ({
    value: [...files.keys()]
      .filter(path => path.startsWith(`${posix(e.path)}/`))
      .map(path => ({
        name: path.slice(posix(e.path).length + 1),
        kind: 'file' as const,
        size: files.get(path)?.length ?? 0,
        mtimeMs: clock.now(),
        isLink: false,
      })),
  }))
  on('fs.read', ($, e) => {
    const text = files.get(posix(e.path))

    if (text === undefined) {
      throw new Error(`ENOENT: ${e.path}`)
    }

    return { value: text }
  })
  on('fs.write', ($, e) => {
    if (files.has(posix(e.path))) {
      overwritten.push(posix(e.path))
    }

    files.set(posix(e.path), e.text)

    return { value: undefined }
  })
  on('session.root', () => ({ value: root }))
  on('session.id', () => ({ value: 'session-1' }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('tool.register', ($, e) => ({
    value: { tool: `mcp__backlog__${e.name}` },
  }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', ($, e) => {
    toasts.push(e.text)

    return { value: undefined }
  })
  on('prompt.submit', ($, e) => {
    if (submit === 'reject') {
      throw new Error('the prompt queue is closed')
    }

    if (submit === 'drop') {
      return { drop: 'blocked by a hook' }
    }

    prompts.push(e.text)

    return { text: e.text }
  })

  // The ids of the items the folder holds, in the order first written.
  const ids = () => [
    ...new Set(
      [...files.keys()].map(
        path => path.slice(DIR.length + 1).split('.')[0] ?? '',
      ),
    ),
  ]

  // A change record another session wrote, which this one has not read yet.
  const elsewhere = (change: {
    id: string
    set?: Record<string, unknown>
    note?: string
  }) => {
    const at = clock.now()
    files.set(
      `${DIR}/${change.id}.${at.toString(36)}.other${files.size}.json`,
      JSON.stringify({ sessionId: 'session-2', set: {}, note: '', at, ...change }),
    )
  }

  return { files, overwritten, prompts, toasts, clock, ids, elsewhere }
}

const start = { cwd: '/work/app', surface: 'terminal', isInteractive: true } as const

let calls = 0
const call = ($: Engine, tool: string, args: Record<string, unknown>) =>
  $.tool.call({
    tool: `mcp__backlog__${tool}`,
    tool_use_id: `call-${(calls += 1)}`,
    ...args,
  })

// One item in full, as Claude reads it.
const full = async ($: Engine, id: string) =>
  String((await call($, 'list', { id })).result)

const DEFECT = {
  title: 'Retry loop never backs off',
  category: 'defect',
  priority: 'high',
  detail: 'src/retry.ts:40 retries at once, forever.',
}
const DECISION = {
  title: 'Which queue do we standardise on?',
  category: 'decision',
  priority: 'critical',
  detail: 'Two queues are in use.',
  options: [
    { label: 'Keep SQS', detail: 'No migration.' },
    { label: 'Move to Kafka' },
  ],
  recommendation: 'Keep SQS until volume demands more.',
}

test('what Claude records is listed by category and priority, on each surface', async ($, on) => {
  const { ids } = world(on)
  await $.session.start(start)

  const added = await call($, 'add', { items: [DEFECT, DECISION] })
  expect(String(added.result)).toMatch('Retry loop never backs off')
  expect(ids()).toHaveLength(2)

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(
      await ui.find({ type: 'Text', text: '2 open, 1 to decide' }),
    ).toBeDefined()

    const rows = (await ui.findAll({ type: 'Button' }))
      .filter(button => button.key?.startsWith('open:'))
      .map(button => button.text)
    expect(rows).toEqual([
      'Which queue do we standardise on?',
      'Retry loop never backs off',
    ])
    await ui.unmount()
  }
})

test('an item opens in detail, and Fix now hands it to Claude', async ($, on) => {
  const { prompts, toasts, ids } = world(on)
  await $.session.start(start)
  await call($, 'add', { items: [DEFECT] })
  const id = ids()[0] ?? ''

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: `open:${id}` })
  expect(await ui.find({ type: 'Markdown' })).toBeDefined()

  await ui.press({ key: 'fix' })
  expect(prompts).toHaveLength(1)
  expect(prompts[0]).toMatch('src/retry.ts:40')
  expect(prompts[0]).toMatch(`mcp__backlog__update for ${id}`)
  expect(await full($, id)).toMatch('in progress')
  expect(toasts.at(-1)).toMatch('Sent to Claude')
  await ui.unmount()
})

test('choosing an option records the decision and tells Claude', async ($, on) => {
  const { prompts, ids } = world(on)
  await $.session.start(start)
  await call($, 'add', { items: [DECISION] })
  const id = ids()[0] ?? ''

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: `open:${id}` })
  await ui.press({ key: 'option:1' })

  expect(prompts[0]).toMatch('I have decided this backlog item: "Move to Kafka"')
  expect(await full($, id)).toMatch('Resolution: Decided: Move to Kafka')
  await ui.unmount()
})

test("another session's items arrive on the poll, under All projects", async ($, on) => {
  const { clock, elsewhere } = world(on)
  await $.session.start(start)
  elsewhere({
    id: 'zz99zz99',
    set: {
      title: 'Flaky login test',
      category: 'issue',
      priority: 'low',
      status: 'open',
      project: '/work/other',
    },
  })
  await clock.advance(5000)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ key: 'open:zz99zz99' })).toBeUndefined()

  await ui.press({ key: 'scope' })
  expect((await ui.find({ key: 'open:zz99zz99' }))?.text).toMatch(
    'Flaky login test',
  )
  await ui.unmount()
})

test('marking an item done takes it off the list', async ($, on) => {
  const { ids } = world(on)
  await $.session.start(start)
  await call($, 'add', { items: [DEFECT] })
  const id = ids()[0] ?? ''

  const updated = await call($, 'update', {
    id,
    status: 'done',
    resolution: 'Added exponential backoff.',
  })
  expect(String(updated.result)).toMatch('done')

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ key: `open:${id}` })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: '0 open' })).toBeDefined()
  await ui.unmount()
})

test('edits two sessions make to one item both stand, and no file is rewritten', async ($, on) => {
  const { overwritten, clock, ids, elsewhere } = world(on)
  await $.session.start(start)
  await call($, 'add', { items: [DEFECT] })
  const id = ids()[0] ?? ''

  // The other session closes the item; this one, not having polled, adds a
  // note and raises the priority.
  await clock.advance(10)
  elsewhere({ id, set: { status: 'done', resolution: 'Fixed over there.' } })
  await call($, 'update', { id, priority: 'critical', note: 'Seen again in CI.' })

  const item = await full($, id)
  expect(item).toMatch('critical priority, done')
  expect(item).toMatch('Resolution: Fixed over there.')
  expect(item).toMatch('Seen again in CI.')
  expect(overwritten).toEqual([])
})

test('each new item has an id of its own: 8 random characters', async ($, on) => {
  const { overwritten, ids } = world(on)
  await $.session.start(start)
  await call($, 'add', {
    items: Array.from({ length: 50 }, (_, index) => ({
      ...DEFECT,
      title: `Defect ${index}`,
    })),
  })

  expect(ids()).toHaveLength(50)
  expect(ids().every(id => /^[a-z0-9]{8}$/.test(id))).toBe(true)
  expect(overwritten).toEqual([])
})

test('recording a title again does not reopen an item another session closed', async ($, on) => {
  const { clock, ids, elsewhere } = world(on)
  await $.session.start(start)
  await call($, 'add', { items: [DEFECT] })
  const first = ids()[0] ?? ''

  await clock.advance(10)
  elsewhere({ id: first, set: { status: 'done', resolution: 'Fixed over there.' } })
  const again = await call($, 'add', { items: [DEFECT] })

  expect(String(again.result)).not.toMatch('already on the backlog')
  expect(ids()).toHaveLength(2)
  expect(await full($, first)).toMatch('high priority, done')
  expect(await full($, first)).toMatch('Resolution: Fixed over there.')
})

test('a project path keeps its whitespace when its items are read back', async ($, on) => {
  const { clock, ids } = world(on, '/work/my  app')
  await $.session.start({ ...start, cwd: '/work/my  app' })
  await call($, 'add', { items: [DEFECT] })
  const id = ids()[0] ?? ''

  // The poll reads back the record this session wrote.
  await clock.advance(5000)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ key: `open:${id}` })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '1 open' })).toBeDefined()
  expect(await full($, id)).toMatch('Recorded in /work/my  app.')
  await ui.unmount()
})

for (const refusal of ['drop', 'reject'] as const) {
  test(`a prompt that does not enter (${refusal}) is said so, and the item is unchanged`, async ($, on) => {
    const { toasts, ids } = world(on, '/work/app', refusal)
    await $.session.start(start)
    await call($, 'add', { items: [DEFECT] })
    const id = ids()[0] ?? ''

    const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
    await ui.press({ key: `open:${id}` })
    await ui.press({ key: 'fix' })

    expect(toasts.at(-1)).toMatch(`${id} was not sent to Claude`)
    expect(toasts.some(toast => toast.startsWith('Sent to Claude'))).toBe(false)
    expect(await full($, id)).toMatch('high priority, open')
    expect(await ui.find({ key: 'fix' })).toBeDefined()
    await ui.unmount()
  })
}

test('a batch over the limit is refused whole, not cut short', async ($, on) => {
  const { files, toasts } = world(on)
  await $.session.start(start)

  const refused = await call($, 'add', {
    items: Array.from({ length: 51 }, (_, index) => ({
      ...DEFECT,
      title: `Defect ${index}`,
    })),
  })

  expect(refused.deny).toMatch('at most 50 items in one call and got 51')
  expect(files.size).toBe(0)
  expect(toasts).toEqual([])
})

test('a note is kept whole or refused, never cut', async ($, on) => {
  const { files, clock, ids } = world(on)
  await $.session.start(start)
  await call($, 'add', { items: [DEFECT] })
  const id = ids()[0] ?? ''
  const written = files.size

  const refused = await call($, 'update', { id, note: 'n'.repeat(10001) })
  expect(refused.deny).toMatch('10001 characters and the limit is 10000')
  expect(files.size).toBe(written)

  const longest = `${'n'.repeat(9990)} THE-END`
  await call($, 'update', { id, note: longest })
  await call($, 'update', { id, note: 'A second note.' })
  await clock.advance(5000)

  const item = await full($, id)
  expect(item).toMatch(longest)
  expect(item).toMatch('A second note.')
})

test('the detail view draws the whole of a long detail', async ($, on) => {
  const { ids } = world(on)
  await $.session.start(start)
  const paragraphs = Array.from(
    { length: 190 },
    (_, index) => `para-${index} ${'x'.repeat(88)}`,
  )
  const detail = paragraphs.join('\n\n')
  expect(detail.length).toBeGreaterThan(18000)
  await call($, 'add', { items: [{ ...DEFECT, detail }] })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: `open:${ids()[0] ?? ''}` })

  const drawn = (await ui.findAll({ type: 'Markdown' })).map(element =>
    String(element.props.text),
  )
  expect(drawn.length).toBeGreaterThan(1)
  expect(drawn.every(text => text.length <= 10000)).toBe(true)
  expect(drawn.join('\n\n')).toBe(detail)
  await ui.unmount()
})
