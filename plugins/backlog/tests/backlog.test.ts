import { expect, mock, test } from 'claude-code/testing'
import type { ElementQuery, Engine, FoundElement } from 'claude-code/testing'
import type { On, UiPane } from 'claude-code'

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
const BAND = {
  plugin: 'backlog',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 10,
    bodyColumns: 80,
    scroll: { offset: 0, bodyRows: 10 },
    view: {},
  },
} as const

// The host hands a hook the path as this machine spells it (`C:\home\t` on
// Windows): the folder in memory is keyed by the POSIX spelling.
const posix = (path: string) =>
  path.replace(/\\/g, '/').replace(/^[A-Za-z]:/, '')

// What a world is like beyond its defaults: the environment the session sees
// (HOME alone unless given), whether the folder is there before anything is
// written to it, why the host does not place the pane, when it does not, and
// why a hook refuses to close it, when one does.
type Setting = {
  env?: Record<string, string>
  hasFolder?: boolean
  notPlaced?: string
  closeRefused?: string
}

// The world beneath the mod: a folder in memory, a session rooted at `root`,
// the prompts the mod submits, the toasts and status lines it shows. `submit`
// says what becomes of a prompt: it enters, a hook drops it, or the call
// rejects.
const world = (
  on: On,
  root = '/work/app',
  submit: 'enter' | 'drop' | 'reject' = 'enter',
  setting: Setting = {},
) => {
  const files = new Map<string, string>()
  // Directories inside the folder, which the listing reports beside files.
  const dirs = new Set<string>()
  // When each file was last written, as the listing reports it.
  const written = new Map<string, number>()
  const overwritten: string[] = []
  const reads: string[] = []
  const prompts: string[] = []
  const toasts: string[] = []
  const statuses: (string | undefined)[] = []
  const logs: string[] = []
  const opened: { id: string; focus?: boolean }[] = []
  const closed: string[] = []
  // The pane as the host holds it, undefined while it is not open.
  let pane: UiPane | undefined
  const clock = mock.clock(on, { now: 1_700_000_000_000 })
  mock.env(on, setting.env ?? { HOME: '/home/t' })
  // The session's root as the host answers it now: `/cd` moves it.
  let here = root
  // How many of the next listings fail.
  let failing = 0

  on('fs.exists', ($, e) => ({
    value:
      (posix(e.path) === DIR && setting.hasFolder !== false) ||
      files.has(posix(e.path)) ||
      [...files.keys()].some(path => path.startsWith(`${posix(e.path)}/`)),
  }))
  on('fs.list', ($, e) => {
    if (failing > 0) {
      failing -= 1
      throw new Error('EIO: the disk is unavailable')
    }

    const inside = (path: string) => path.startsWith(`${posix(e.path)}/`)

    return {
      value: [
        ...[...dirs].filter(inside).map(path => ({
          name: path.slice(posix(e.path).length + 1),
          kind: 'dir' as const,
          size: 0,
          mtimeMs: 0,
          isLink: false,
        })),
        ...[...files.keys()].filter(inside).map(path => ({
          name: path.slice(posix(e.path).length + 1),
          kind: 'file' as const,
          size: files.get(path)?.length ?? 0,
          mtimeMs: written.get(path) ?? 0,
          isLink: false,
        })),
      ],
    }
  })
  on('fs.read', ($, e) => {
    reads.push(posix(e.path))
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
    written.set(posix(e.path), clock.now())

    return { value: undefined }
  })
  on('session.root', () => ({ value: here }))
  on('session.id', () => ({ value: 'session-1' }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('tool.register', ($, e) => ({
    value: { tool: `mcp__backlog__${e.name}` },
  }))
  on('ui.open', ($, e) => {
    opened.push({ id: e.id, focus: e.focus })
    // An open raises the pane in front of any other.
    pane = {
      id: e.id,
      title: e.title ?? e.id,
      isShown: true,
      isFocused: e.focus === true,
      isPlaced: setting.notPlaced === undefined,
    }

    return {
      value:
        setting.notPlaced === undefined
          ? { isPlaced: true as const }
          : { isPlaced: false as const, reason: setting.notPlaced },
    }
  })
  on('ui.panes', () => ({ value: pane === undefined ? [] : [pane] }))
  on('ui.close', ($, e) => {
    if (setting.closeRefused !== undefined) {
      return { deny: setting.closeRefused }
    }

    closed.push(e.id)
    pane = undefined

    return { value: undefined }
  })
  // What the band shows when the mod draws nothing of its own there.
  on('ui.render', { component: 'AbovePrompt' }, ($, e) =>
    $.ui.resolve(e).Box({ key: 'beneath' }),
  )
  on('ui.log', ($, e) => {
    logs.push(e.text)

    return { value: undefined }
  })
  on('ui.status', ($, e) => {
    statuses.push(e.text)

    return { value: undefined }
  })
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

  // A change record another session wrote, which this one has not read yet:
  // written now, and dated now unless `at` says otherwise.
  const elsewhere = (change: {
    id: string
    set?: Record<string, unknown>
    note?: string
    at?: number
  }) => {
    const at = change.at ?? clock.now()
    const path = `${DIR}/${change.id}.${at.toString(36)}.other${files.size}.json`
    files.set(
      path,
      JSON.stringify({ sessionId: 'session-2', set: {}, note: '', at, ...change }),
    )
    written.set(path, clock.now())
  }

  // A file of the folder as it stands now, written by hand or by a session.
  const put = (name: string, text: string) => {
    files.set(`${DIR}/${name}`, text)
    written.set(`${DIR}/${name}`, clock.now())
  }

  // The folder's files that name `id`, in the order first written.
  const filesOf = (id: string) =>
    [...files.keys()].filter(path => path.startsWith(`${DIR}/${id}.`))

  return {
    files,
    dirs,
    overwritten,
    reads,
    prompts,
    toasts,
    statuses,
    logs,
    opened,
    closed,
    clock,
    ids,
    elsewhere,
    put,
    filesOf,
    // The pane as the host holds it now, and how the person then moves it:
    // behind another pane's tab, or waiting unplaced.
    pane: () => pane,
    seat: (state: Partial<UiPane>) => {
      pane = pane === undefined ? undefined : { ...pane, ...state }
    },
    cd: (path: string) => {
      here = path
    },
    failListing: (times: number) => {
      failing = times
    },
  }
}

const start = { cwd: '/work/app', surface: 'terminal', isInteractive: true } as const

let calls = 0
const call = ($: Engine, tool: string, args: Record<string, unknown>) =>
  $.tool.call({
    tool: `mcp__backlog__${tool}`,
    tool_use_id: `call-${(calls += 1)}`,
    ...args,
  })

// The pane header's counts, as drawn.
const counts = async (ui: Drawing) => (await ui.find({ key: 'counts' }))?.text

// The band's counts, as drawn; undefined when the mod draws none there.
const band = async (ui: Drawing) => (await ui.find({ key: 'band' }))?.text

// Whether the band shows what is beneath the mod, the mod drawing nothing.
const yields = async (ui: Drawing) =>
  (await ui.find({ key: 'beneath' })) !== undefined &&
  (await ui.find({ key: 'toggle' })) === undefined

type Drawing = {
  find: (query: ElementQuery) => Promise<FoundElement | undefined>
  findAll: (query: ElementQuery) => Promise<FoundElement[]>
}

// The list's rows, as drawn, in order.
const rows = async (ui: Drawing) =>
  (await ui.findAll({ type: 'Button' }))
    .filter(button => button.key?.startsWith('open:'))
    .map(button => button.text)

// The keys of the buttons a drawing offers, in order.
const actions = async (ui: Drawing) =>
  (await ui.findAll({ type: 'Button' })).map(button => button.key)

// The mark an item's row carries: in progress, new, or none.
const markOf = async (ui: Drawing, id: string) => {
  if ((await ui.find({ key: `working:${id}` })) !== undefined) {
    return 'working'
  }

  return (await ui.find({ key: `new:${id}` })) === undefined ? 'none' : 'new'
}

const MINUTE = 60 * 1000

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
    expect(await counts(ui)).toBe('2 open, ● 2 new, 1 to decide')

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

test('a session that loses the state it wrote while it started still shows its items', async ($, on) => {
  const { clock, elsewhere } = world(on)
  // A session that is resumed: the host holds none of what the mod wrote to
  // state in session.start.
  let isStarting = true
  on('state.set', ($, e, next) =>
    isStarting ? { value: { isSet: true, version: 0 } } : next(e),
  )
  elsewhere({
    id: 'aa11aa11',
    set: {
      title: 'Recorded before the restart',
      category: 'task',
      priority: 'medium',
      status: 'open',
      project: '/work/app',
    },
  })
  await $.session.start(start)
  isStarting = false

  expect(String((await call($, 'list', {})).result)).toMatch(
    'Recorded before the restart',
  )

  await clock.advance(5000)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ key: 'open:aa11aa11' }))?.text).toMatch(
    'Recorded before the restart',
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
  expect(await counts(ui)).toBe('0 open')
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
  expect(await counts(ui)).toBe('1 open, ● 1 new')
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

test('an item kept as one whole file is read, and changed without rewriting it', async ($, on) => {
  const { files, overwritten } = world(on)
  const whole = JSON.stringify({
    id: 'ab12',
    title: 'Timeouts are not configurable',
    category: 'issue',
    priority: 'medium',
    status: 'open',
    detail: 'The 30 s timeout is a constant in src/client.ts:12.',
    options: [],
    recommendation: '',
    resolution: '',
    project: '/work/app',
    sessionId: 'session-0',
    createdAt: 1_699_000_000_000,
    updatedAt: 1_699_000_000_000,
  })
  files.set(`${DIR}/ab12.json`, whole)
  await $.session.start(start)

  expect(await full($, 'ab12')).toMatch('src/client.ts:12')

  await call($, 'update', { id: 'ab12', status: 'done', resolution: 'Made it an option.' })
  expect(await full($, 'ab12')).toMatch('medium priority, done')
  expect(files.get(`${DIR}/ab12.json`)).toBe(whole)
  expect(overwritten).toEqual([])
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

test('an item sent to Claude is marked in progress, not new, in the list, the header and the band', async ($, on) => {
  const { ids } = world(on)
  await $.session.start(start)
  await call($, 'add', { items: [DEFECT] })
  const id = ids()[0] ?? ''
  const bar = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await band(bar)).toBe('1 open, ● 1 new')

  const sender = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await markOf(sender, id)).toBe('new')
  await sender.press({ key: `open:${id}` })
  await sender.press({ key: 'fix' })
  await sender.press({ key: 'back' })
  await sender.unmount()

  expect(await band(bar)).toBe('1 open, » 1 in progress')
  await bar.unmount()

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await markOf(ui, id)).toBe('working')
    expect((await ui.find({ key: `working:${id}` }))?.text).toBe('» ')
    expect(await counts(ui)).toBe('1 open, » 1 in progress')
    await ui.unmount()
  }
})

test('an item is new for ten minutes from when it was recorded, and the poll that ends them takes the mark away', async ($, on) => {
  const { toasts, clock, elsewhere } = world(on)
  await $.session.start(start)
  const recorded = clock.now()
  elsewhere({
    id: 'nn11nn11',
    set: {
      title: 'Cache is never evicted',
      category: 'defect',
      priority: 'medium',
      status: 'open',
      project: '/work/app',
    },
  })
  await clock.advance(5000)
  expect(toasts).toHaveLength(1)

  const terminal = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const desktop = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const bars = [
    await $.ui.mount({ ...BAND, surface: 'terminal' }),
    await $.ui.mount({ ...BAND, surface: 'desktop' }),
  ]

  // The last poll before the ten minutes are up.
  await clock.advance(recorded + 10 * MINUTE - 5000 - clock.now())

  for (const ui of [terminal, desktop]) {
    expect(await markOf(ui, 'nn11nn11')).toBe('new')
    expect(await counts(ui)).toBe('1 open, ● 1 new')
  }

  for (const bar of bars) {
    expect(await band(bar)).toBe('1 open, ● 1 new')
  }

  // The poll at ten minutes to the millisecond: no longer new.
  await clock.advance(5000)
  expect(clock.now() - recorded).toBe(10 * MINUTE)

  for (const ui of [terminal, desktop]) {
    expect(await markOf(ui, 'nn11nn11')).toBe('none')
    expect(await counts(ui)).toBe('1 open')
    await ui.unmount()
  }

  for (const bar of bars) {
    expect(await band(bar)).toBe('1 open')
    await bar.unmount()
  }

  // Aging is not an arrival.
  expect(toasts).toHaveLength(1)
})

test('a poll that finds nothing changed writes nothing to state', async ($, on) => {
  const { clock } = world(on)
  const writes: string[] = []
  on('state.set', ($, e, next) => {
    writes.push(String(e.key))

    return next(e)
  })
  await $.session.start(start)
  await call($, 'add', { items: [DEFECT] })
  // The first poll reads back the record this session wrote.
  await clock.advance(5000)
  writes.length = 0

  await clock.advance(30000)
  expect(writes).toEqual([])
})

test("another session's item arrives marked new when it was recorded a moment ago, and unmarked when long ago", async ($, on) => {
  const { toasts, clock, elsewhere } = world(on)
  await $.session.start(start)
  const set = {
    category: 'issue',
    priority: 'low',
    status: 'open',
    project: '/work/app',
  }
  elsewhere({ id: 'rr11rr11', set: { ...set, title: 'Recorded a moment ago' } })
  elsewhere({
    id: 'oo11oo11',
    at: clock.now() - 11 * MINUTE,
    set: { ...set, title: 'Recorded eleven minutes ago' },
  })
  await clock.advance(5000)

  expect(toasts.at(-1)).toBe('Backlog: 2 new items from other sessions')

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await markOf(ui, 'rr11rr11')).toBe('new')
    expect(await markOf(ui, 'oo11oo11')).toBe('none')
    expect(await counts(ui)).toBe('2 open, ● 1 new')
    await ui.unmount()
  }
})

test('the detail view says whether this session or another is working on an item', async ($, on) => {
  const { clock, ids, elsewhere } = world(on)
  await $.session.start(start)
  elsewhere({
    id: 'ww11ww11',
    set: {
      title: 'Logs leak tokens',
      category: 'defect',
      priority: 'critical',
      status: 'open',
      project: '/work/app',
    },
  })
  await clock.advance(5000)
  elsewhere({ id: 'ww11ww11', set: { status: 'in_progress' } })
  await clock.advance(5000)
  await call($, 'add', { items: [DEFECT] })
  const id = ids().find(one => one !== 'ww11ww11') ?? ''

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await markOf(ui, 'ww11ww11')).toBe('working')
    expect(await counts(ui)).toBe('2 open, » 1 in progress, ● 1 new')

    await ui.press({ key: 'open:ww11ww11' })
    expect((await ui.find({ key: 'working' }))?.text).toBe(
      '» In progress since 2023-11-14, in another session',
    )
    expect(await ui.find({ key: 'new' })).toBeUndefined()
    await ui.press({ key: 'back' })
    await ui.unmount()
  }

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: `open:${id}` })
  expect((await ui.find({ key: 'new' }))?.text).toMatch('New')
  expect(await ui.find({ key: 'working' })).toBeUndefined()

  await ui.press({ key: 'fix' })
  expect((await ui.find({ key: 'working' }))?.text).toMatch('in this session')
  expect(await ui.find({ key: 'new' })).toBeUndefined()
  await ui.unmount()
})

test('when two sessions take up one item, the later is the one shown working on it', async ($, on) => {
  const { clock, ids, elsewhere } = world(on)
  await $.session.start(start)
  await call($, 'add', { items: [DEFECT] })
  const id = ids()[0] ?? ''

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: `open:${id}` })
  await ui.press({ key: 'fix' })
  expect((await ui.find({ key: 'working' }))?.text).toMatch('in this session')

  await clock.advance(1000)
  elsewhere({ id, set: { status: 'in_progress' } })
  await clock.advance(5000)
  expect((await ui.find({ key: 'working' }))?.text).toMatch('in another session')

  // A note leaves the claim where it was.
  await call($, 'update', { id, note: 'Still reproduces.' })
  expect((await ui.find({ key: 'working' }))?.text).toMatch('in another session')

  await call($, 'update', { id, status: 'in_progress' })
  expect((await ui.find({ key: 'working' }))?.text).toMatch('in this session')
  await ui.unmount()
})

test('a closed item is never new, and reopening one ends its claim without making an old item new', async ($, on) => {
  const { clock, ids } = world(on)
  await $.session.start(start)
  await call($, 'add', { items: [DEFECT] })
  const id = ids()[0] ?? ''

  await call($, 'update', { id, status: 'done', resolution: 'Backed off.' })
  expect(String((await call($, 'list', { includeClosed: true })).result)).toBe(
    `${id} [defect, high, done] Retry loop never backs off`,
  )

  const closed = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await closed.press({ key: 'closed' })
  expect(await markOf(closed, id)).toBe('none')
  expect(await counts(closed)).toBe('0 open')
  await closed.unmount()

  // Newness goes by when the item was recorded, not when it last opened.
  await call($, 'update', { id, status: 'open' })
  expect(String((await call($, 'list', {})).result)).toMatch('[defect, high, open, new]')

  await call($, 'update', { id, status: 'in_progress' })
  await clock.advance(11 * MINUTE)
  await call($, 'update', { id, status: 'open' })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await markOf(ui, id)).toBe('none')
    expect(await counts(ui)).toBe('1 open')

    await ui.press({ key: `open:${id}` })
    expect(await ui.find({ key: 'working' })).toBeUndefined()
    expect(await ui.find({ key: 'new' })).toBeUndefined()
    await ui.press({ key: 'back' })
    await ui.unmount()
  }
})

test('Claude reads which items are new and which are in progress', async ($, on) => {
  const { ids } = world(on)
  await $.session.start(start)
  await call($, 'add', { items: [DEFECT, DECISION] })
  const [defect, decision] = ids()
  await call($, 'update', { id: defect, status: 'in_progress' })

  const listed = String((await call($, 'list', {})).result).split('\n')
  expect(listed).toEqual([
    `${decision} [decision, critical, open, new] Which queue do we standardise on?`,
    `${defect} [defect, high, in progress] Retry loop never backs off`,
  ])
})

test('Claude is told to mark an item in progress when it takes one up', async ($, on) => {
  world(on)
  // No engine prompt beneath: the mod's section is the whole of it.
  on('prompt.compose', () => ({ sections: [] }))
  await $.session.start(start)

  const composed = await $.prompt.compose({
    model: 'claude-test',
    promptModel: 'claude-test',
    surfaces: ['terminal'],
    tools: ['mcp__backlog__add'],
    outputStyle: null,
    traits: [],
  })
  const guidance = composed.sections.find(one => one.id === 'backlog:tracking')
  expect(guidance?.text).toMatch(
    'When you start work on an item that is already on the backlog, call mcp__backlog__update with status "in_progress"',
  )
})

const DAY = 24 * 60 * MINUTE

// `/backlog`, as the person types it.
const slashBacklog = ($: Engine) =>
  $.command.run({
    command: 'backlog',
    args: '',
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 120 },
  })

// An open item another session recorded, in `project`.
const recorded = (title: string, project = '/work/app') => ({
  title,
  category: 'issue',
  priority: 'low',
  status: 'open',
  project,
})

test("/backlog opens and focuses the pane and says how many of this project's items are open", async ($, on) => {
  const { opened, ids, elsewhere } = world(on)
  await $.session.start(start)
  await call($, 'add', {
    items: [DEFECT, DECISION, { ...DEFECT, title: 'Already fixed' }],
  })
  await call($, 'update', { id: ids()[2], status: 'done' })
  elsewhere({ id: 'ot11ot11', set: recorded('Elsewhere', '/work/other') })
  // Recorded since the last poll: the command reads the folder itself.
  elsewhere({ id: 'jj11jj11', set: recorded('Arrived just now') })

  const ran = await slashBacklog($)

  expect(ran.text).toBe('Backlog pane opened: 3 open in app.')
  expect(opened.at(-1)).toEqual({ id: 'backlog', focus: true })
})

test('/backlog says the pane is not shown, and why, when the host does not place it', async ($, on) => {
  const reason = 'the terminal is 100 columns wide, under the 110 a pane needs'
  world(on, '/work/app', 'enter', { notPlaced: reason })
  await $.session.start(start)

  const ran = await slashBacklog($)

  expect(ran.text).toBe(
    `Backlog: 0 open in app. The pane is not shown: ${reason}.`,
  )
})

test('the backlog section comes after the sections beneath it, and only when Claude has the add tool', async ($, on) => {
  world(on)
  const core = {
    id: 'engine:core',
    text: 'You are Claude Code.',
    scope: 'shared',
  } as const
  on('prompt.compose', () => ({ sections: [core] }))
  await $.session.start(start)
  const compose = (tools: string[]) =>
    $.prompt.compose({
      model: 'claude-test',
      promptModel: 'claude-test',
      surfaces: ['terminal'],
      tools,
      outputStyle: null,
      traits: [],
    })

  expect((await compose(['Read', 'Edit'])).sections).toEqual([core])
  expect(
    (await compose(['Read', 'mcp__backlog__add'])).sections.map(one => one.id),
  ).toEqual(['engine:core', 'backlog:tracking'])
})

test('an item with no title is skipped and said so, and the rest of the batch is recorded', async ($, on) => {
  const { toasts, ids } = world(on)
  await $.session.start(start)

  const added = await call($, 'add', {
    items: [
      { ...DEFECT, title: '' },
      { category: 'task', priority: 'low', detail: 'No title at all.' },
      { ...DEFECT, title: ' \t\n\u0007 ' },
      DEFECT,
    ],
  })

  expect(ids()).toHaveLength(1)
  expect(String(added.result)).toBe(
    [
      'Recorded on the backlog:',
      '- skipped an item with no title',
      '- skipped an item with no title',
      '- skipped an item with no title',
      `- ${ids()[0]}: Retry loop never backs off`,
    ].join('\n'),
  )
  expect(toasts).toEqual(['Backlog: 1 item recorded'])
})

test('a batch of items with no title records nothing and shows no toast', async ($, on) => {
  const { files, toasts } = world(on)
  await $.session.start(start)

  const added = await call($, 'add', { items: [{ ...DEFECT, title: '   ' }] })

  expect(String(added.result)).toBe(
    'Recorded on the backlog:\n- skipped an item with no title',
  )
  expect(files.size).toBe(0)
  expect(toasts).toEqual([])
})

test('an item whose detail is over the limit is skipped whole, and one at the limit is kept whole', async ($, on) => {
  const { files, toasts, ids } = world(on)
  await $.session.start(start)
  const atLimit = `${'e'.repeat(19995)} END.`
  expect(atLimit).toHaveLength(20000)
  const longTitle = `Detail too long for ${'x'.repeat(60)}`

  const added = await call($, 'add', {
    items: [
      { ...DEFECT, title: longTitle, detail: 'd'.repeat(20001) },
      { ...DEFECT, title: 'Detail at the limit', detail: atLimit },
    ],
  })

  const id = ids()[0] ?? ''
  expect(ids()).toHaveLength(1)
  expect(String(added.result)).toBe(
    [
      'Recorded on the backlog:',
      `- skipped "${longTitle.slice(0, 59)}…": its detail is 20001 characters and the limit is 20000`,
      `- ${id}: Detail at the limit`,
    ].join('\n'),
  )
  expect([...files.values()].some(text => text.includes('ddd'))).toBe(false)
  expect(await full($, id)).toMatch(atLimit)
  expect(toasts).toEqual(['Backlog: 1 item recorded'])
})

test('an add with no items, or items that are not a list, records nothing', async ($, on) => {
  const { files, toasts } = world(on)
  await $.session.start(start)

  for (const [args, said] of [
    [{ items: [] }, 'Nothing recorded: `items` was empty.'],
    [
      { items: 'Retry loop never backs off' },
      'Nothing recorded: `items` must be a list of items.',
    ],
    [{}, 'Nothing recorded: `items` must be a list of items.'],
  ] as const) {
    expect(String((await call($, 'add', args)).result)).toBe(said)
  }

  expect(files.size).toBe(0)
  expect(toasts).toEqual([])
})

test('recording the title of an open item again refreshes what the draft gives and keeps the rest', async ($, on) => {
  const { overwritten, ids } = world(on)
  await $.session.start(start)
  await call($, 'add', { items: [DECISION] })
  const id = ids()[0] ?? ''
  await call($, 'update', {
    id,
    status: 'in_progress',
    note: 'Looked at the volumes.',
    resolution: 'Leaning to SQS.',
  })

  // Case and whitespace aside, the same title; empty fields keep what is held.
  const again = await call($, 'add', {
    items: [
      {
        title: '  which QUEUE do   we\tstandardise on?  ',
        category: 'decision',
        priority: 'low',
        detail: 'Three queues are in use now.',
        options: [],
        recommendation: '',
      },
    ],
  })

  expect(String(again.result)).toBe(
    `Recorded on the backlog:\n- ${id}: already on the backlog, refreshed`,
  )
  expect(ids()).toEqual([id])
  expect(await full($, id)).toBe(
    [
      `Backlog item ${id} (decision, low priority, in progress): Which queue do we standardise on?`,
      'Recorded in /work/app.',
      'Three queues are in use now.',
      'Options:\n- Keep SQS: No migration.\n- Move to Kafka',
      'Recommendation: Keep SQS until volume demands more.',
      'Resolution: Leaning to SQS.',
      'Note, 2023-11-14: Looked at the volumes.',
    ].join('\n\n'),
  )

  // Options and a recommendation given replace the held ones; a blank detail
  // and an unknown priority do not.
  await call($, 'add', {
    items: [
      {
        title: DECISION.title,
        category: 'decision',
        priority: 'urgent',
        detail: '   ',
        options: [{ label: 'Move to NATS' }],
        recommendation: 'Move to NATS.',
      },
    ],
  })

  const item = await full($, id)
  expect(item).toMatch('(decision, low priority, in progress)')
  expect(item).toMatch('Three queues are in use now.')
  expect(item).toMatch('Options:\n- Move to NATS\n\n')
  expect(item).toMatch('Recommendation: Move to NATS.')
  expect(overwritten).toEqual([])
})

test('the same title is a separate item in another project, and one item when twice in a batch', async ($, on) => {
  const { toasts, clock, ids, elsewhere } = world(on)
  await $.session.start(start)
  elsewhere({
    id: 'ot11ot11',
    set: { ...recorded(DEFECT.title, '/work/other') },
  })
  await clock.advance(5000)

  await call($, 'add', { items: [DEFECT] })
  expect(ids()).toHaveLength(2)

  const batch = await call($, 'add', {
    items: [
      { ...DEFECT, title: 'Cache grows without bound', priority: 'high' },
      { ...DEFECT, title: 'cache grows without bound', priority: 'low' },
    ],
  })

  const id = ids()[2] ?? ''
  expect(ids()).toHaveLength(3)
  expect(String(batch.result)).toBe(
    [
      'Recorded on the backlog:',
      `- ${id}: Cache grows without bound`,
      `- ${id}: already on the backlog, refreshed`,
    ].join('\n'),
  )
  expect(await full($, id)).toMatch('(defect, low priority, open)')
  expect(toasts.at(-1)).toBe('Backlog: 2 items recorded')
})

test('two adds of one title made at once end as one item', async ($, on) => {
  const { ids } = world(on)
  await $.session.start(start)

  const results = await Promise.all([
    call($, 'add', { items: [DEFECT] }),
    call($, 'add', { items: [{ ...DEFECT, priority: 'low' }] }),
  ])

  const id = ids()[0] ?? ''
  expect(ids()).toEqual([id])
  expect(results.map(one => String(one.result)).sort()).toEqual([
    `Recorded on the backlog:\n- ${id}: Retry loop never backs off`,
    `Recorded on the backlog:\n- ${id}: already on the backlog, refreshed`,
  ])
})

test('what Claude sends is held to shape: one clean title line, options as labels, and known categories and priorities', async ($, on) => {
  const { ids } = world(on)
  await $.session.start(start)

  const added = await call($, 'add', {
    items: [
      {
        title: '  Line one\n\tline\u0007 two\r\n   three  ',
        category: 'chore',
        priority: 'urgent',
        detail: 'Shaped.',
        options: [
          'Plain choice',
          { label: '' },
          { label: ' \t ', detail: 'A blank label.' },
          { detail: 'No label.' },
          { label: 'With detail', detail: 'Why.' },
        ],
      },
    ],
  })

  const id = ids()[0] ?? ''
  expect(String(added.result)).toBe(
    `Recorded on the backlog:\n- ${id}: Line one line two three`,
  )
  expect(await full($, id)).toBe(
    [
      `Backlog item ${id} (task, medium priority, open): Line one line two three`,
      'Recorded in /work/app.',
      'Shaped.',
      'Options:\n- Plain choice\n- With detail: Why.',
    ].join('\n\n'),
  )
})

test('an update of an id no item has is said so, and nothing is written', async ($, on) => {
  const { files } = world(on)
  await $.session.start(start)
  await call($, 'add', { items: [DEFECT] })
  const written = files.size

  const updated = await call($, 'update', { id: 'zz00zz00', status: 'done' })

  expect(String(updated.result)).toBe(
    'No backlog item has the id "zz00zz00". mcp__backlog__list gives the ids.',
  )
  expect(files.size).toBe(written)
})

test('an update that gives nothing valid to change is said so, and nothing is written', async ($, on) => {
  const { files, ids } = world(on)
  await $.session.start(start)
  await call($, 'add', { items: [DEFECT] })
  const id = ids()[0] ?? ''
  const written = files.size

  for (const args of [
    { id },
    {
      id,
      status: 'finished',
      priority: 'urgent',
      category: 'bug',
      title: ' \n ',
      resolution: '\t',
      note: '  ',
    },
  ]) {
    expect(String((await call($, 'update', args)).result)).toBe(
      'Nothing to change: give a status, priority, category, title, resolution or note.',
    )
  }

  expect(files.size).toBe(written)
})

test('an update can retitle an item and move it to another category', async ($, on) => {
  const { ids } = world(on)
  await $.session.start(start)
  await call($, 'add', { items: [DEFECT] })
  const id = ids()[0] ?? ''
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: 'Defects' })).toBeDefined()

  const updated = await call($, 'update', {
    id,
    title: '  Retry loop\nspins the CPU ',
    category: 'issue',
  })

  expect(String(updated.result)).toBe(`Updated ${id}: open, high priority.`)
  expect(await ui.find({ type: 'Text', text: 'Defects' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: 'Issues' })).toBeDefined()
  expect(await rows(ui)).toEqual(['Retry loop spins the CPU'])
  await ui.unmount()
})

test('an update finds an id given with whitespace around it, and records no blank resolution', async ($, on) => {
  const { files, ids, filesOf } = world(on)
  await $.session.start(start)
  await call($, 'add', { items: [DEFECT] })
  const id = ids()[0] ?? ''

  const updated = await call($, 'update', {
    id: `  ${id}\n`,
    status: 'done',
    resolution: ' \n\t ',
  })

  expect(String(updated.result)).toBe(`Updated ${id}: done, high priority.`)
  expect(JSON.parse(files.get(filesOf(id).at(-1) ?? '') ?? '').set).toEqual({
    status: 'done',
  })
  expect(await full($, id)).not.toMatch('Resolution')
})

test("an update folds after another session's change even when that session's clock runs ahead", async ($, on) => {
  const { files, clock, ids, elsewhere, filesOf } = world(on)
  await $.session.start(start)
  await call($, 'add', { items: [DEFECT] })
  const id = ids()[0] ?? ''
  const ahead = clock.now() + 60 * MINUTE
  elsewhere({ id, at: ahead, set: { priority: 'low' } })

  const updated = await call($, 'update', { id, priority: 'critical' })

  expect(String(updated.result)).toBe(`Updated ${id}: open, critical priority.`)
  expect(JSON.parse(files.get(filesOf(id).at(-1) ?? '') ?? '').at).toBe(
    ahead + 1,
  )
  await clock.advance(5000)
  expect(await full($, id)).toMatch('(defect, critical priority, open)')
})

test('Claude reading an id no item has, or an empty backlog, is told so', async ($, on) => {
  world(on)
  await $.session.start(start)

  expect(String((await call($, 'list', {})).result)).toBe(
    'The backlog has no matching items.',
  )
  expect(String((await call($, 'list', { id: 'zz00zz00' })).result)).toBe(
    'No backlog item has the id "zz00zz00".',
  )
})

test("Claude lists other projects' items, with their project, only when it asks for all", async ($, on) => {
  const { ids, elsewhere } = world(on)
  await $.session.start(start)
  elsewhere({
    id: 'zz99zz99',
    set: recorded('Flaky login test', '/work/other'),
  })
  await call($, 'add', { items: [DEFECT] })
  const id = ids().find(one => one !== 'zz99zz99') ?? ''

  expect(String((await call($, 'list', {})).result)).toBe(
    `${id} [defect, high, open, new] Retry loop never backs off`,
  )
  expect(String((await call($, 'list', { scope: 'all' })).result)).toBe(
    [
      `${id} [defect, high, open, new] Retry loop never backs off (app)`,
      'zz99zz99 [issue, low, open, new] Flaky login test (other)',
    ].join('\n'),
  )
})

test('Claude reads open items before closed ones, the most urgent first, and the latest changed first within a priority', async ($, on) => {
  const { clock, ids } = world(on)
  await $.session.start(start)
  const drafts = [
    ['Low', 'low'],
    ['Critical', 'critical'],
    ['Medium, changed last', 'medium'],
    ['Medium', 'medium'],
    ['High, done', 'high'],
    ['Critical, dismissed', 'critical'],
  ] as const

  for (const [title, priority] of drafts) {
    await call($, 'add', {
      items: [{ title, priority, category: 'task', detail: '' }],
    })
    await clock.advance(1000)
  }

  const [low, critical, touched, medium, done, dismissed] = ids()
  await call($, 'update', { id: done, status: 'done' })
  await call($, 'update', { id: dismissed, status: 'dismissed' })
  await call($, 'update', { id: touched, note: 'Seen again.' })

  const open = [
    `${critical} [task, critical, open, new] Critical`,
    `${touched} [task, medium, open, new] Medium, changed last`,
    `${medium} [task, medium, open, new] Medium`,
    `${low} [task, low, open, new] Low`,
  ]
  expect(String((await call($, 'list', {})).result)).toBe(open.join('\n'))
  expect(String((await call($, 'list', { includeClosed: true })).result)).toBe(
    [
      ...open,
      `${dismissed} [task, critical, dismissed] Critical, dismissed`,
      `${done} [task, high, done] High, done`,
    ].join('\n'),
  )
})

test('one item in full carries its options, recommendation, resolution and dated notes', async ($, on) => {
  const { clock, ids, elsewhere } = world(on)
  await $.session.start(start)
  await call($, 'add', { items: [DECISION] })
  const id = ids()[0] ?? ''
  await call($, 'update', { id, status: 'done', resolution: 'Kept SQS.' })
  await call($, 'update', { id, note: 'Checked the volumes.' })
  // A note another session wrote the next day.
  elsewhere({ id, note: 'Volumes are flat.', at: clock.now() + DAY })

  expect(await full($, id)).toBe(
    [
      `Backlog item ${id} (decision, critical priority, done): Which queue do we standardise on?`,
      'Recorded in /work/app.',
      'Two queues are in use.',
      'Options:\n- Keep SQS: No migration.\n- Move to Kafka',
      'Recommendation: Keep SQS until volume demands more.',
      'Resolution: Kept SQS.',
      'Note, 2023-11-14: Checked the volumes.',
      'Note, 2023-11-15: Volumes are flat.',
    ].join('\n\n'),
  )
})

test('Accept recommendation hands a decision to Claude and records that it was accepted', async ($, on) => {
  const { prompts, ids } = world(on)
  await $.session.start(start)
  await call($, 'add', { items: [DECISION] })
  const id = ids()[0] ?? ''

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: `open:${id}` })
  expect(await actions(ui)).toEqual([
    'back',
    'option:0',
    'option:1',
    'accept',
    'done',
    'dismiss',
    'lower',
  ])
  expect((await ui.find({ key: 'accept' }))?.text).toBe('Accept recommendation')

  await ui.press({ key: 'accept' })

  expect(prompts).toHaveLength(1)
  expect(prompts[0]).toMatch(
    /^I accept your recommendation for this backlog item\. Carry it out\.\n\nBacklog item /,
  )
  const item = await full($, id)
  expect(item).toMatch('(decision, critical priority, in progress)')
  expect(item).toMatch(
    'Resolution: Accepted the recommendation: Keep SQS until volume demands more.',
  )
  await ui.unmount()
})

test('a decision with no recommendation offers no Accept, and only a decision offers no Fix now', async ($, on) => {
  const { ids } = world(on)
  await $.session.start(start)
  await call($, 'add', {
    items: [
      { ...DECISION, recommendation: '' },
      { ...DEFECT, recommendation: 'Back off.' },
    ],
  })
  const [decision, defect] = ids()

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: `open:${decision}` })
  expect(await actions(ui)).toEqual([
    'back',
    'option:0',
    'option:1',
    'done',
    'dismiss',
    'lower',
  ])

  await ui.press({ key: 'back' })
  await ui.press({ key: `open:${defect}` })
  expect(await actions(ui)).toEqual([
    'back',
    'fix',
    'done',
    'dismiss',
    'raise',
    'lower',
  ])
  await ui.unmount()
})

test('a direction typed on a decision is sent to Claude and recorded as how it was settled', async ($, on) => {
  const { prompts, ids } = world(on)
  await $.session.start(start)
  await call($, 'add', { items: [DECISION] })
  const id = ids()[0] ?? ''

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: `open:${id}` })
  await ui.input({ key: 'direct', text: '  Keep SQS, and revisit in Q3.  ' })

  expect(prompts).toHaveLength(1)
  expect(prompts[0]).toMatch(
    /^My direction for this backlog item: Keep SQS, and revisit in Q3\.\n\nBacklog item /,
  )
  const item = await full($, id)
  expect(item).toMatch('(decision, critical priority, in progress)')
  expect(item).toMatch('Resolution: Directed: Keep SQS, and revisit in Q3.')
  await ui.unmount()
})

test('a direction typed on a defect is sent to Claude and records no resolution', async ($, on) => {
  const { prompts, ids } = world(on)
  await $.session.start(start)
  await call($, 'add', { items: [DEFECT] })
  const id = ids()[0] ?? ''

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: `open:${id}` })
  await ui.input({
    key: 'direct',
    text: 'Use the jittered backoff from lib/retry.',
  })

  expect(prompts[0]).toMatch(
    /^My direction for this backlog item: Use the jittered backoff from lib\/retry\.\n\n/,
  )
  const item = await full($, id)
  expect(item).toMatch('(defect, high priority, in progress)')
  expect(item).not.toMatch('Resolution')
  await ui.unmount()
})

test('a blank direction sends nothing and changes nothing', async ($, on) => {
  const { files, prompts, toasts, ids } = world(on)
  await $.session.start(start)
  await call($, 'add', { items: [DECISION] })
  const id = ids()[0] ?? ''
  const written = files.size

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: `open:${id}` })
  await ui.input({ key: 'direct', text: ' \n\t ' })

  expect(prompts).toEqual([])
  expect(files.size).toBe(written)
  expect(toasts).toEqual(['Backlog: 1 item recorded'])
  expect(await full($, id)).toMatch('(decision, critical priority, open)')
  await ui.unmount()
})

test('Mark done and Dismiss close an item and go back to the list, and Show closed lists closed items after the open ones', async ($, on) => {
  const { ids } = world(on)
  await $.session.start(start)
  await call($, 'add', {
    items: [
      { ...DEFECT, title: 'A, high', priority: 'high' },
      { ...DEFECT, title: 'B, medium', priority: 'medium' },
      { ...DEFECT, title: 'C, low', priority: 'low' },
    ],
  })
  const [a, b] = ids()
  const bar = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await band(bar)).toBe('3 open, ● 3 new')

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: `open:${a}` })
  await ui.press({ key: 'done' })
  expect(await ui.find({ key: 'back' })).toBeUndefined()
  expect(await rows(ui)).toEqual(['B, medium', 'C, low'])
  expect(await band(bar)).toBe('2 open, ● 2 new')

  await ui.press({ key: `open:${b}` })
  await ui.press({ key: 'dismiss' })
  expect(await rows(ui)).toEqual(['C, low'])
  expect(await band(bar)).toBe('1 open, ● 1 new')
  await bar.unmount()
  expect(await full($, a ?? '')).toMatch('(defect, high priority, done)')
  expect(await full($, b ?? '')).toMatch('(defect, medium priority, dismissed)')
  await ui.unmount()

  for (const surface of ['terminal', 'desktop'] as const) {
    const shown = await $.ui.mount({ ...PANE, surface })
    expect((await shown.find({ key: 'closed' }))?.text).toBe('Show closed')

    await shown.press({ key: 'closed' })
    expect((await shown.find({ key: 'closed' }))?.text).toBe('Hide closed')
    expect(await rows(shown)).toEqual(['C, low', '✓ A, high', 'x B, medium'])
    expect(await counts(shown)).toBe('1 open, ● 1 new')

    await shown.press({ key: 'closed' })
    expect((await shown.find({ key: 'closed' }))?.text).toBe('Show closed')
    expect(await rows(shown)).toEqual(['C, low'])
    await shown.unmount()
  }
})

test('a closed item offers only Reopen and priority, and reopening brings its actions back', async ($, on) => {
  const { ids } = world(on)
  await $.session.start(start)
  await call($, 'add', { items: [DECISION] })
  const id = ids()[0] ?? ''
  await call($, 'update', { id, status: 'done', resolution: 'Kept SQS.' })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'closed' })
  await ui.press({ key: `open:${id}` })
  expect(await actions(ui)).toEqual(['back', 'reopen', 'lower'])
  expect(await ui.find({ key: 'direct' })).toBeUndefined()

  await ui.press({ key: 'reopen' })

  expect(await full($, id)).toMatch('(decision, critical priority, open)')
  expect(await actions(ui)).toEqual([
    'back',
    'option:0',
    'option:1',
    'accept',
    'done',
    'dismiss',
    'lower',
  ])
  expect(await ui.find({ key: 'direct' })).toBeDefined()
  await ui.unmount()
})

test('Priority + and - move an item one step, stop at critical and low, and re-sort the list', async ($, on) => {
  const { ids } = world(on)
  await $.session.start(start)
  await call($, 'add', {
    items: [
      { ...DEFECT, title: 'Rising', priority: 'medium' },
      { ...DEFECT, title: 'Steady', priority: 'high' },
    ],
  })
  const [rising] = ids()

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await rows(ui)).toEqual(['Steady', 'Rising'])
  await ui.press({ key: `open:${rising}` })
  expect((await ui.find({ key: 'raise' }))?.text).toBe('Priority +')
  expect((await ui.find({ key: 'lower' }))?.text).toBe('Priority -')

  await ui.press({ key: 'raise' })
  expect(await full($, rising ?? '')).toMatch('(defect, high priority, open)')
  await ui.press({ key: 'raise' })
  expect(await full($, rising ?? '')).toMatch(
    '(defect, critical priority, open)',
  )
  expect(await ui.find({ key: 'raise' })).toBeUndefined()

  await ui.press({ key: 'back' })
  expect(await rows(ui)).toEqual(['Rising', 'Steady'])

  await ui.press({ key: `open:${rising}` })
  for (let step = 0; step < 3; step += 1) {
    await ui.press({ key: 'lower' })
  }

  expect(await full($, rising ?? '')).toMatch('(defect, low priority, open)')
  expect(await ui.find({ key: 'lower' })).toBeUndefined()
  expect(await ui.find({ key: 'raise' })).toBeDefined()
  await ui.unmount()
})

test("under All projects each row names its project, and another project's item warns where it is from", async ($, on) => {
  const { ids, elsewhere } = world(on)
  await $.session.start(start)
  elsewhere({
    id: 'zz99zz99',
    set: recorded('Flaky login test', '/work/other'),
  })
  await call($, 'add', { items: [DEFECT] })
  const id = ids().find(one => one !== 'zz99zz99') ?? ''
  const warning = { type: 'Text', text: /^From another project/ }

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ key: 'scope' }))?.text).toBe('All projects')
    await ui.press({ key: 'scope' })
    expect((await ui.find({ key: 'scope' }))?.text).toBe('This project')
    expect(await ui.find({ type: 'Text', text: 'All projects' })).toBeDefined()
    expect(await rows(ui)).toEqual([
      'Retry loop never backs off · app',
      'Flaky login test · other',
    ])

    await ui.press({ key: 'open:zz99zz99' })
    expect((await ui.find(warning))?.text).toBe(
      'From another project: /work/other',
    )
    await ui.press({ key: 'back' })
    await ui.press({ key: `open:${id}` })
    expect(await ui.find(warning)).toBeUndefined()
    await ui.press({ key: 'back' })

    await ui.press({ key: 'scope' })
    expect(await ui.find({ type: 'Text', text: 'app' })).toBeDefined()
    expect(await rows(ui)).toEqual(['Retry loop never backs off'])
    await ui.unmount()
  }
})

test('Back returns to the list, and an item open in detail that leaves the folder falls back to the list', async ($, on) => {
  const { files, toasts, clock, ids, filesOf } = world(on)
  await $.session.start(start)
  await call($, 'add', { items: [DEFECT, DECISION] })
  const [defect] = ids()

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: `open:${defect}` })
  await ui.press({ key: 'back' })
  expect(await ui.find({ key: 'back' })).toBeUndefined()
  expect(await rows(ui)).toHaveLength(2)

  await ui.press({ key: `open:${defect}` })
  for (const path of filesOf(defect ?? '')) {
    files.delete(path)
  }
  await clock.advance(5000)

  expect(await ui.find({ key: 'back' })).toBeUndefined()
  expect(await rows(ui)).toEqual(['Which queue do we standardise on?'])
  expect(toasts).toEqual(['Backlog: 2 items recorded'])
  await ui.unmount()
})

test('on a surface with no text field the detail view offers its buttons and no Direct', async ($, on) => {
  const { ids } = world(on)
  await $.session.start(start)
  await call($, 'add', { items: [DEFECT] })
  const id = ids()[0] ?? ''

  const ui = await $.ui.mount({ ...PANE, surface: 'mobile' })
  await ui.press({ key: `open:${id}` })

  expect(await actions(ui)).toEqual([
    'back',
    'fix',
    'done',
    'dismiss',
    'raise',
    'lower',
  ])
  expect(await ui.find({ key: 'direct' })).toBeUndefined()
  expect(await ui.find({ type: 'Markdown' })).toBeDefined()
  await ui.unmount()
})

test('the detail view shows each note under the day it was written, in order', async ($, on) => {
  const { clock, ids, elsewhere } = world(on)
  await $.session.start(start)
  await call($, 'add', { items: [DECISION] })
  const id = ids()[0] ?? ''
  await call($, 'update', { id, note: 'Checked the volumes.' })
  elsewhere({ id, note: 'Volumes are flat.', at: clock.now() + DAY })
  await clock.advance(5000)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: `open:${id}` })

  expect(
    (await ui.findAll({ type: 'Text', text: /^Note, / })).map(one => one.text),
  ).toEqual(['Note, 2023-11-14', 'Note, 2023-11-15'])
  expect(
    (await ui.findAll({ type: 'Markdown' })).map(one => String(one.props.text)),
  ).toEqual([
    'Two queues are in use.',
    'Checked the volumes.',
    'Volumes are flat.',
    'Keep SQS until volume demands more.',
  ])
  await ui.unmount()
})

test('with CLAUDE_CONFIG_DIR set the backlog is kept under it, and nothing under HOME', async ($, on) => {
  const { files } = world(on, '/work/app', 'enter', {
    env: { HOME: '/home/t', CLAUDE_CONFIG_DIR: '/etc/claude/' },
  })
  files.set(
    '/etc/claude/backlog/items/cf11cf11.json',
    JSON.stringify({
      id: 'cf11cf11',
      at: 1_699_000_000_000,
      sessionId: 'session-0',
      set: recorded('Kept under the config folder'),
      note: '',
    }),
  )
  await $.session.start(start)

  expect(await full($, 'cf11cf11')).toMatch('Kept under the config folder')

  await call($, 'add', { items: [DEFECT] })
  const paths = [...files.keys()]
  expect(paths).toHaveLength(2)
  expect(
    paths.every(path => path.startsWith('/etc/claude/backlog/items/')),
  ).toBe(true)
})

test('with no HOME the backlog is kept under USERPROFILE, spelt with forward slashes', async ($, on) => {
  const { files } = world(on, '/work/app', 'enter', {
    env: { USERPROFILE: '\\Users\\t\\' },
  })
  await $.session.start(start)

  await call($, 'add', { items: [DEFECT] })

  const paths = [...files.keys()]
  expect(paths).toHaveLength(1)
  expect(paths[0]).toMatch(
    /^\/Users\/t\/\.claude\/backlog\/items\/[a-z0-9]{8}\.[a-z0-9]+\.[a-z0-9]{8}\.json$/,
  )
})

for (const env of [
  { USERPROFILE: '', HOME: '/home/t' },
  { CLAUDE_CONFIG_DIR: '', HOME: '/home/t' },
  { CLAUDE_CONFIG_DIR: '', USERPROFILE: '', HOME: '/home/t' },
] as Record<string, string>[]) {
  test(`an empty variable counts as unset, and HOME holds the backlog (${Object.keys(env).join(', ')})`, async ($, on) => {
    const { files } = world(on, '/work/app', 'enter', { env })
    await $.session.start(start)

    await call($, 'add', { items: [DEFECT] })

    expect(files.size).toBe(1)
    expect([...files.keys()].every(path => path.startsWith(`${DIR}/`))).toBe(
      true,
    )
  })
}

test('with no home directory the session starts and says why once, and Claude is told nothing is kept', async ($, on) => {
  const { files, logs, toasts, opened, clock } = world(
    on,
    '/work/app',
    'enter',
    { env: { CLAUDE_CONFIG_DIR: '', USERPROFILE: '', HOME: '' } },
  )
  const why =
    'no home directory was found: CLAUDE_CONFIG_DIR, USERPROFILE and HOME are all unset or empty'
  await $.session.start(start)

  expect(logs).toEqual([`backlog: could not read the backlog folder: ${why}`])
  expect(opened).toEqual([{ id: 'backlog', focus: undefined }])

  const refused = `The backlog could not be read or written: ${why}. Nothing was recorded or changed.`
  expect(await call($, 'add', { items: [DEFECT] })).toEqual({ deny: refused })
  expect(
    await call($, 'update', { id: 'ab12ab12', status: 'done' }),
  ).toEqual({ deny: refused })
  expect(await call($, 'list', {})).toEqual({ deny: refused })
  expect((await slashBacklog($)).text).toBe(
    `Backlog pane opened: could not read the backlog folder: ${why}.`,
  )

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await counts(ui)).toBe('0 open')
  await ui.unmount()

  // The polls fail as the start did, and say nothing more.
  await clock.advance(15000)
  expect(logs).toHaveLength(1)
  // Nowhere, `/.claude` included.
  expect([...files.keys()]).toEqual([])
  expect(toasts).toEqual([])
})

test('a session starts with no backlog folder yet, and the first add makes it', async ($, on) => {
  const { files } = world(on, '/work/app', 'enter', {
    hasFolder: false,
  })
  await $.session.start(start)

  const bar = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await yields(bar)).toBe(true)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await counts(ui)).toBe('0 open')
  expect(await ui.find({ type: 'Text', text: /^Nothing open\./ })).toBeDefined()

  await call($, 'add', { items: [DEFECT] })

  expect([...files.keys()].every(path => path.startsWith(`${DIR}/`))).toBe(true)
  expect(files.size).toBe(1)
  expect(await rows(ui)).toEqual(['Retry loop never backs off'])
  expect(await band(bar)).toBe('1 open, ● 1 new')
  await ui.unmount()
  await bar.unmount()
})

test('entries of the folder that are not change records are passed over, and read once only', async ($, on) => {
  const { dirs, reads, toasts, logs, clock, put } = world(on)
  const change = (id: string, at: unknown = clock.now()) =>
    JSON.stringify({
      id,
      at,
      sessionId: 'session-2',
      set: recorded(`Item ${id}`),
      note: '',
    })
  put('notes.txt', change('tx11tx11'))
  put('broken.json', '{"id": "br11br11", "at": ')
  put('list.json', '[]')
  put('null.json', 'null')
  put('text.json', '"x"')
  put('short.json', change('ab1'))
  put('upper.json', change('AB12CD34'))
  put('path.json', change('../x1234'))
  put('when.json', change('wh11wh11', 'yesterday'))
  // Number() would read each of these as a time, and 0 or 1 sorts first.
  put('nulltime.json', change('nt11nt11', null))
  put('emptytime.json', change('et11et11', ''))
  put('texttime.json', change('tt11tt11', String(clock.now())))
  put('listtime.json', change('lt11lt11', []))
  put('truetime.json', change('bt11bt11', true))
  put('zerotime.json', change('zt11zt11', 0))
  put('pasttime.json', change('pt11pt11', -5))
  // JSON reads a number too large for a double as Infinity.
  put('hugetime.json', change('ht11ht11', 0).replace('"at":0', '"at":1e400'))
  put('ok11ok11.0.json', change('ok11ok11'))
  dirs.add(`${DIR}/sub.json`)
  await $.session.start(start)

  expect(
    String(
      (await call($, 'list', { scope: 'all', includeClosed: true })).result,
    ),
  ).toBe('ok11ok11 [issue, low, open, new] Item ok11ok11 (app)')
  await clock.advance(10000)

  const unreadable = [
    'broken',
    'list',
    'null',
    'text',
    'short',
    'upper',
    'path',
    'when',
    'nulltime',
    'emptytime',
    'texttime',
    'listtime',
    'truetime',
    'zerotime',
    'pasttime',
    'hugetime',
  ]
  expect(
    reads.filter(path => !path.endsWith('ok11ok11.0.json')).sort(),
  ).toEqual(unreadable.map(name => `${DIR}/${name}.json`).sort())
  expect(toasts).toEqual([])
  expect(logs).toEqual([])
})

test('a half-written record is passed over until it is complete, then read', async ($, on) => {
  const { reads, toasts, clock, put } = world(on)
  const name = 'hw11hw11.0.json'
  const whole = JSON.stringify({
    id: 'hw11hw11',
    at: clock.now(),
    sessionId: 'session-2',
    set: recorded('Written in two goes'),
    note: '',
  })
  put(name, whole.slice(0, 40))
  await $.session.start(start)
  await clock.advance(10000)

  expect(String((await call($, 'list', {})).result)).toBe(
    'The backlog has no matching items.',
  )
  expect(reads.filter(path => path.endsWith(name))).toHaveLength(1)

  put(name, whole)
  await clock.advance(5000)

  expect(reads.filter(path => path.endsWith(name))).toHaveLength(2)
  expect(toasts).toEqual(['Backlog: Written in two goes (app)'])
  expect(await full($, 'hw11hw11')).toMatch('(issue, low priority, open)')
})

test('a record deleted from the folder by hand is gone on the next poll, without a toast', async ($, on) => {
  const { files, toasts, clock, ids, filesOf } = world(on)
  await $.session.start(start)
  await call($, 'add', { items: [DEFECT] })
  const id = ids()[0] ?? ''
  await call($, 'update', { id, priority: 'low' })
  await clock.advance(5000)
  const bar = await $.ui.mount({ ...BAND, surface: 'terminal' })

  files.delete(filesOf(id)[1] ?? '')
  await clock.advance(5000)
  expect(await full($, id)).toMatch('(defect, high priority, open)')
  expect(await band(bar)).toBe('1 open, ● 1 new')

  files.delete(filesOf(id)[0] ?? '')
  await clock.advance(5000)
  expect(await yields(bar)).toBe(true)
  await bar.unmount()
  expect(String((await call($, 'list', { includeClosed: true })).result)).toBe(
    'The backlog has no matching items.',
  )
  expect(toasts).toEqual(['Backlog: 1 item recorded'])
})

test('records for an id that was never given a title make no item', async ($, on) => {
  const { toasts, clock, elsewhere } = world(on)
  await $.session.start(start)
  elsewhere({ id: 'gh11gh11', note: 'A note for an item never recorded.' })
  elsewhere({ id: 'gh11gh11', set: { priority: 'high', project: '/work/app' } })
  await clock.advance(5000)

  expect(
    String(
      (await call($, 'list', { scope: 'all', includeClosed: true })).result,
    ),
  ).toBe('The backlog has no matching items.')
  expect(String((await call($, 'list', { id: 'gh11gh11' })).result)).toBe(
    'No backlog item has the id "gh11gh11".',
  )
  expect(
    String(
      (await call($, 'update', { id: 'gh11gh11', status: 'done' })).result,
    ),
  ).toMatch('No backlog item has the id "gh11gh11"')
  expect(toasts).toEqual([])
})

for (const [first, second] of [
  ['high', 'low'],
  ['low', 'high'],
] as const) {
  test(`two records of one item written in the same millisecond fold in file-name order (${first}, then ${second})`, async ($, on) => {
    const { clock, put } = world(on)
    const at = clock.now()
    const change = (set: Record<string, unknown>, when = at) =>
      JSON.stringify({
        id: 'tt11tt11',
        at: when,
        sessionId: 'session-2',
        set,
        note: '',
      })
    put('tt11tt11.0.json', change(recorded('Same moment'), at - 1))
    put('tt11tt11.1.aaaaaaaa.json', change({ priority: first }))
    put('tt11tt11.1.bbbbbbbb.json', change({ priority: second }))
    await $.session.start(start)

    expect(await full($, 'tt11tt11')).toMatch(
      `(issue, ${second} priority, open)`,
    )
  })
}

test('an item kept as one whole file is read by when it was created, and newer change records fold over it', async ($, on) => {
  const { put } = world(on)
  const whole = (id: string, title: string, times: Record<string, number>) =>
    JSON.stringify({
      id,
      title,
      category: 'issue',
      priority: 'low',
      status: 'open',
      detail: '',
      options: [],
      recommendation: '',
      resolution: '',
      project: '/work/app',
      sessionId: 'session-0',
      ...times,
    })
  const then = 1_699_000_000_000
  put('cr12.json', whole('cr12', 'Created, never updated', { createdAt: then }))
  put('nt12.json', whole('nt12', 'Never dated', {}))
  put(
    'wc12.json',
    whole('wc12', 'Changed since', { createdAt: then, updatedAt: then }),
  )
  put(
    'wc12.lmn.aaaaaaaa.json',
    JSON.stringify({
      id: 'wc12',
      at: then + 1,
      sessionId: 'session-1',
      set: { status: 'done', resolution: 'Fixed.' },
      note: 'Fixed in the client.',
    }),
  )
  await $.session.start(start)

  expect(String((await call($, 'list', { includeClosed: true })).result)).toBe(
    [
      'cr12 [issue, low, open] Created, never updated',
      'wc12 [issue, low, done] Changed since',
    ].join('\n'),
  )
  expect(await full($, 'wc12')).toBe(
    [
      'Backlog item wc12 (issue, low priority, done): Changed since',
      'Recorded in /work/app.',
      'Resolution: Fixed.',
      'Note, 2023-11-03: Fixed in the client.',
    ].join('\n\n'),
  )
})

test('an item kept as one whole file with no good time of its last change is read by when it was created, and with neither is passed over', async ($, on) => {
  const { reads, clock, put } = world(on)
  const whole = (id: string, times: Record<string, unknown>) =>
    JSON.stringify({
      id,
      title: `Item ${id}`,
      category: 'issue',
      priority: 'low',
      status: 'open',
      project: '/work/app',
      sessionId: 'session-0',
      ...times,
    })
  const then = 1_699_000_000_000
  put('un12.json', whole('un12', { updatedAt: null, createdAt: then }))
  put('ue12.json', whole('ue12', { updatedAt: '', createdAt: then + 1 }))
  put('uz12.json', whole('uz12', { updatedAt: 0, createdAt: then + 2 }))
  put('cz12.json', whole('cz12', { updatedAt: then + 3, createdAt: 0 }))
  put('bt12.json', whole('bt12', { updatedAt: true, createdAt: String(then) }))
  put('np12.json', whole('np12', { updatedAt: 0, createdAt: -5 }))
  put('cl12.json', whole('cl12', { createdAt: [] }))
  await $.session.start(start)

  expect(String((await call($, 'list', {})).result)).toBe(
    [
      'cz12 [issue, low, open] Item cz12',
      'uz12 [issue, low, open] Item uz12',
      'ue12 [issue, low, open] Item ue12',
      'un12 [issue, low, open] Item un12',
    ].join('\n'),
  )

  await clock.advance(10000)
  expect(reads.filter(path => /\/(bt12|np12|cl12)\.json$/.test(path))).toHaveLength(3)
})

test("another session's new items are announced in a toast, and nothing else is", async ($, on) => {
  const { toasts, clock, elsewhere } = world(on)
  elsewhere({
    id: 'pr11pr11',
    set: recorded('There before the session started'),
  })
  await $.session.start(start)
  await clock.advance(5000)
  expect(toasts).toEqual([])

  const long = `Login fails when the password holds a quote ${'q'.repeat(40)}`
  elsewhere({ id: 'lo11lo11', set: recorded(long, '/work/other') })
  await clock.advance(5000)
  expect(toasts).toEqual([`Backlog: ${long.slice(0, 59)}… (other)`])

  elsewhere({ id: 'pr11pr11', set: { priority: 'critical' } })
  await clock.advance(5000)
  await call($, 'add', { items: [DEFECT] })
  await clock.advance(5000)
  expect(toasts).toEqual([
    `Backlog: ${long.slice(0, 59)}… (other)`,
    'Backlog: 1 item recorded',
  ])

  for (const id of ['aa22aa22', 'bb22bb22', 'cc22cc22']) {
    elsewhere({ id, set: recorded(`Item ${id}`) })
  }
  await clock.advance(5000)
  expect(toasts.at(-1)).toBe('Backlog: 3 new items from other sessions')
  expect(toasts).toHaveLength(3)
})

test('when the session moves to another project root, the pane, the band and new items follow it', async ($, on) => {
  const { clock, ids, elsewhere, cd } = world(on)
  await $.session.start(start)
  await call($, 'add', { items: [DEFECT] })
  elsewhere({
    id: 'ap11ap11',
    set: {
      ...recorded('Rate limit is undocumented', '/work/api'),
      status: 'in_progress',
      priority: 'high',
    },
  })
  await clock.advance(5000)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: 'app' })).toBeDefined()
  expect(await rows(ui)).toEqual(['Retry loop never backs off'])
  // The item in progress in api is not counted in app.
  const bar = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await band(bar)).toBe('1 open, ● 1 new')

  cd('/work/api')
  await clock.advance(5000)

  expect(await ui.find({ type: 'Text', text: 'api' })).toBeDefined()
  expect(await rows(ui)).toEqual(['Rate limit is undocumented'])
  expect(await band(bar)).toBe('1 open, » 1 in progress')
  await bar.unmount()

  await call($, 'add', {
    items: [{ ...DEFECT, title: 'Document the rate limit' }],
  })
  const id = ids().at(-1) ?? ''
  expect(await full($, id)).toMatch('Recorded in /work/api.')
  expect(await rows(ui)).toEqual([
    'Document the rate limit',
    'Rate limit is undocumented',
  ])
  await ui.unmount()
})

test('a project root given with backslashes and a trailing slash is the same project', async ($, on) => {
  const { ids, elsewhere } = world(on, '\\work\\app\\')
  elsewhere({ id: 'fs11fs11', set: recorded('Recorded with forward slashes') })
  await $.session.start(start)
  await call($, 'add', { items: [DEFECT] })
  const id = ids().at(-1) ?? ''

  expect(await full($, id)).toMatch('Recorded in /work/app.')
  expect((await slashBacklog($)).text).toBe(
    'Backlog pane opened: 2 open in app.',
  )
})

test('a folder that cannot be listed is logged at start, and the polls after a failure catch up', async ($, on) => {
  const { toasts, logs, clock, elsewhere, failListing } = world(on)
  elsewhere({ id: 'bf11bf11', set: recorded('Recorded before the failure') })
  failListing(1)
  await $.session.start(start)

  expect(logs).toHaveLength(1)
  // The engine answers a listing its hook failed as one with no answer.
  expect(logs[0]).toMatch(
    /^backlog: could not read the backlog folder: .*fs\.list/,
  )
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await counts(ui)).toBe('0 open')

  await clock.advance(5000)
  expect(await rows(ui)).toEqual(['Recorded before the failure'])
  // Read for the first time, not arrived.
  expect(toasts).toEqual([])

  failListing(1)
  elsewhere({ id: 'af11af11', set: recorded('Recorded during the failure') })
  await clock.advance(5000)
  expect(await rows(ui)).toEqual(['Recorded before the failure'])

  await clock.advance(5000)
  expect(await rows(ui)).toEqual([
    'Recorded during the failure',
    'Recorded before the failure',
  ])
  expect(toasts).toEqual(['Backlog: Recorded during the failure (app)'])
  expect(logs).toHaveLength(1)
  await ui.unmount()
})

test('changes made in the same millisecond each stand, in the order made', async ($, on) => {
  const { files, clock, ids, filesOf } = world(on)
  await $.session.start(start)
  const now = clock.now()
  await call($, 'add', { items: [DEFECT] })
  const id = ids()[0] ?? ''
  await call($, 'update', { id, note: 'First.' })
  await call($, 'update', { id, note: 'Second.' })

  expect(filesOf(id).map(path => JSON.parse(files.get(path) ?? '').at)).toEqual(
    [now, now + 1, now + 2],
  )
  expect(await full($, id)).toMatch(
    /Note, 2023-11-14: First\.\n\nNote, 2023-11-14: Second\.$/,
  )
})

test('a detail is cut at a blank line outside a code fence, never one inside it', async ($, on) => {
  const { ids } = world(on)
  await $.session.start(start)
  const before = 'a'.repeat(3000)
  const code = (count: number) =>
    Array.from({ length: count }, () => 'x'.repeat(99))
  const fence = ['```ts', ...code(30), '', ...code(40), '```'].join('\n')
  const detail = [before, fence, 'After the fence.'].join('\n\n')
  await call($, 'add', { items: [{ ...DEFECT, detail }] })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: `open:${ids()[0] ?? ''}` })

  const drawn = (await ui.findAll({ type: 'Markdown' })).map(one =>
    String(one.props.text),
  )
  expect(drawn).toEqual([before, `${fence}\n\nAfter the fence.`])
  await ui.unmount()
})

test('what is left too long after the cut at a blank line is cut again between lines', async ($, on) => {
  const { ids } = world(on)
  await $.session.start(start)
  const first = 'a'.repeat(8000)
  const second = 'b'.repeat(8000)
  const detail = `Intro.\n\n${first}\n${second}`
  await call($, 'add', { items: [{ ...DEFECT, detail }] })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: `open:${ids()[0] ?? ''}` })

  // The two lines after the blank line are too long for one piece together.
  expect(
    (await ui.findAll({ type: 'Markdown' })).map(one => String(one.props.text)),
  ).toEqual(['Intro.', first, second])
  await ui.unmount()
})

test('a line longer than one piece is drawn whole across pieces', async ($, on) => {
  const { ids } = world(on)
  await $.session.start(start)
  const detail = Array.from({ length: 19 }, (_, index) =>
    String(index % 10).repeat(1000),
  ).join('')
  await call($, 'add', { items: [{ ...DEFECT, detail }] })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: `open:${ids()[0] ?? ''}` })

  const drawn = (await ui.findAll({ type: 'Markdown' })).map(one =>
    String(one.props.text),
  )
  expect(drawn.map(text => text.length)).toEqual([9000, 9000, 1000])
  expect(drawn.join('')).toBe(detail)
  await ui.unmount()
})

test('a long note is drawn whole, in pieces cut at its paragraph break', async ($, on) => {
  const { ids } = world(on)
  await $.session.start(start)
  await call($, 'add', { items: [DEFECT] })
  const id = ids()[0] ?? ''
  const first = 'p'.repeat(5000)
  const second = 'q'.repeat(4980)
  await call($, 'update', { id, note: `${first}\n\n${second}` })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: `open:${id}` })

  expect(
    (await ui.findAll({ type: 'Markdown' })).map(one => String(one.props.text)),
  ).toEqual([DEFECT.detail, first, second])
  await ui.unmount()
})

// Whether each code block `piece` opens it also closes, by CommonMark's rule,
// written apart from the mod's own: a run of three or more ` or ~ opens a
// block (a ` run only with no ` after it), and only a run of the same
// character, as long or longer, with nothing after it but whitespace, closes
// it.
const isBalanced = (piece: string) => {
  let open = ''

  for (const line of piece.split('\n')) {
    const match = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line)
    const run = match?.[1] ?? ''
    const rest = match?.[2] ?? ''

    if (run === '') {
      continue
    }

    if (open === '') {
      open = run.startsWith('`') && rest.includes('`') ? '' : run
    } else if (
      run[0] === open[0] &&
      run.length >= open.length &&
      rest.trim() === ''
    ) {
      open = ''
    }
  }

  return open === ''
}

// The detail view's Markdown, as drawn, in order.
const drawnText = async (ui: Drawing) =>
  (await ui.findAll({ type: 'Markdown' })).map(one => String(one.props.text))

// Pieces cut from one code block: each well-formed and short enough to draw,
// each but the first opened again with `opener` and each but the last closed
// with `closer`, and with those lines taken out, `whole` again.
const expectCut = (
  pieces: string[],
  opener: string,
  closer: string,
  whole: string,
) => {
  expect(pieces.length).toBeGreaterThan(1)

  for (const [index, piece] of pieces.entries()) {
    expect(piece.length).toBeLessThanOrEqual(10000)
    expect(isBalanced(piece)).toBe(true)

    if (index > 0) {
      expect(piece.startsWith(`${opener}\n`)).toBe(true)
    }

    if (index < pieces.length - 1) {
      expect(piece.endsWith(`\n${closer}`)).toBe(true)
    }
  }

  expect(
    pieces
      .map((piece, index) =>
        piece.slice(
          index === 0 ? 0 : opener.length + 1,
          index === pieces.length - 1
            ? piece.length
            : piece.length - closer.length - 1,
        ),
      )
      .join('\n'),
  ).toBe(whole)
}

// Lines of code a block holds, each its own.
const codeLines = (count: number, line = 'const') =>
  Array.from(
    { length: count },
    (_, index) => `${line} n${index} = '${'x'.repeat(80)}'`,
  )

test('a code block longer than one piece is closed at each cut and opened again in the next piece', async ($, on) => {
  const { ids } = world(on)
  await $.session.start(start)
  const code = codeLines(180)
  const detail = ['```ts', ...code, '```'].join('\n')
  await call($, 'add', { items: [{ ...DEFECT, detail }] })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: `open:${ids()[0] ?? ''}` })

  const drawn = await drawnText(ui)
  expectCut(drawn, '```ts', '```', detail)
  expect(drawn.every(piece => piece.startsWith('```ts\n'))).toBe(true)
  expect(drawn.every(piece => piece.endsWith('\n```'))).toBe(true)
  // Every line of code once, in order.
  expect(
    drawn
      .flatMap(piece => piece.split('\n'))
      .filter(line => line.startsWith('const ')),
  ).toEqual(code)
  await ui.unmount()
})

test('a ~~~ block keeps its info string when opened again, and ``` lines inside it stay code', async ($, on) => {
  const { ids } = world(on)
  await $.session.start(start)
  const opener = '~~~ python title="retry.py"'
  const code = codeLines(170, 'retry').flatMap((line, index) =>
    index % 20 === 0 ? ['```', line] : [line],
  )
  const detail = [opener, ...code, '~~~'].join('\n')
  await call($, 'add', { items: [{ ...DEFECT, detail }] })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: `open:${ids()[0] ?? ''}` })

  const drawn = await drawnText(ui)
  expectCut(drawn, opener, '~~~', detail)
  expect(
    drawn
      .flatMap(piece => piece.split('\n'))
      .filter(line => line !== opener && line !== '~~~'),
  ).toEqual(code)
  await ui.unmount()
})

test('a ```` block that holds ``` lines is one block, closed and opened again with four', async ($, on) => {
  const { ids } = world(on)
  await $.session.start(start)
  const code = codeLines(150).flatMap((line, index) =>
    index % 10 === 0 ? ['```ts', line, '```'] : [line],
  )
  const detail = ['````md', ...code, '````'].join('\n')
  await call($, 'add', { items: [{ ...DEFECT, detail }] })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: `open:${ids()[0] ?? ''}` })

  const drawn = await drawnText(ui)
  expectCut(drawn, '````md', '````', detail)
  expect(drawn.every(piece => piece.startsWith('````md\n'))).toBe(true)
  expect(drawn.every(piece => piece.endsWith('\n````'))).toBe(true)
  await ui.unmount()
})

test('prose around a long code block stays outside it', async ($, on) => {
  const { ids } = world(on)
  await $.session.start(start)
  const block = ['```ts', ...codeLines(150), '```'].join('\n')
  const detail = ['Before the block.', block, 'After the block.'].join('\n\n')
  await call($, 'add', { items: [{ ...DEFECT, detail }] })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: `open:${ids()[0] ?? ''}` })

  const drawn = await drawnText(ui)
  expect(drawn[0]).toBe('Before the block.')
  expect(drawn.at(-1)?.endsWith('\n```\n\nAfter the block.')).toBe(true)
  expectCut(drawn.slice(1), '```ts', '```', `${block}\n\nAfter the block.`)
  await ui.unmount()
})

test('a code block in a long note is cut as one in a detail is', async ($, on) => {
  const { ids } = world(on)
  await $.session.start(start)
  await call($, 'add', { items: [DEFECT] })
  const id = ids()[0] ?? ''
  const note = ['```sh', ...codeLines(100, 'export'), '```'].join('\n')
  expect(note.length).toBeLessThanOrEqual(10000)
  await call($, 'update', { id, note })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: `open:${id}` })

  const drawn = await drawnText(ui)
  expect(drawn[0]).toBe(DEFECT.detail)
  expectCut(drawn.slice(1), '```sh', '```', note)
  await ui.unmount()
})

test('a cut that would leave a code block opened and empty at the end of a piece is made before the block', async ($, on) => {
  const { ids } = world(on)
  await $.session.start(start)
  const prose = 'p'.repeat(8990)
  const block = ['```ts', ...codeLines(20), '```'].join('\n')
  // No blank line between them to cut at.
  await call($, 'add', { items: [{ ...DEFECT, detail: `${prose}\n${block}` }] })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: `open:${ids()[0] ?? ''}` })

  expect(await drawnText(ui)).toEqual([prose, block])
  await ui.unmount()
})

test('a line of code longer than one piece is drawn whole across pieces, each a code block', async ($, on) => {
  const { ids } = world(on)
  await $.session.start(start)
  const detail = ['```', 'y'.repeat(12000), '```'].join('\n')
  await call($, 'add', { items: [{ ...DEFECT, detail }] })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: `open:${ids()[0] ?? ''}` })

  expect(await drawnText(ui)).toEqual([
    `\`\`\`\n${'y'.repeat(9000)}\n\`\`\``,
    `\`\`\`\n${'y'.repeat(3000)}\n\`\`\``,
  ])
  await ui.unmount()
})

test('a block opened again repeats at most 200 characters of its opening line, and one whose fence alone is longer is cut unmarked', async ($, on) => {
  const { ids } = world(on)
  await $.session.start(start)
  const opener = `\`\`\`ts ${'i'.repeat(5000)}`
  const long = [opener, ...codeLines(140), '```'].join('\n')
  const run = '`'.repeat(300)
  const wide = [run, ...codeLines(150), run].join('\n')
  await call($, 'add', {
    items: [
      { ...DEFECT, detail: long },
      { ...DEFECT, title: 'Wide fence', detail: wide },
    ],
  })
  const [longId = '', wideId = ''] = ids()

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: `open:${longId}` })
  const drawn = await drawnText(ui)
  const reopen = opener.slice(0, 200)
  expect(drawn[0]?.startsWith(`${opener}\n`)).toBe(true)
  expect(drawn.slice(1).every(piece => piece.startsWith(`${reopen}\n`))).toBe(
    true,
  )
  expect(drawn.every(isBalanced)).toBe(true)
  expect(drawn.every(piece => piece.length <= 10000)).toBe(true)

  await ui.press({ key: 'back' })
  await ui.press({ key: `open:${wideId}` })
  const plain = await drawnText(ui)
  expect(plain.length).toBeGreaterThan(1)
  expect(plain.every(piece => piece.length <= 10000)).toBe(true)
  expect(plain.join('\n')).toBe(wide)
  await ui.unmount()
})

test('a title too long for its row is cut to fit with an ellipsis, and shown whole in the detail view', async ($, on) => {
  const { ids } = world(on)
  await $.session.start(start)
  const title = `Long ${'t'.repeat(95)}`
  await call($, 'add', { items: [{ ...DEFECT, title }] })
  const id = ids()[0] ?? ''
  const cut = (text: string, room: number) => `${text.slice(0, room - 1)}…`

  for (const surface of ['terminal', 'desktop'] as const) {
    // Room is the columns less the priority tag, and less the new mark when
    // drawn; 24 columns at the least.
    for (const [bodyColumns, room] of [
      [60, 52],
      [24, 16],
      [10, 16],
    ] as const) {
      const ui = await $.ui.mount({
        ...PANE,
        surface,
        props: { ...PANE.props, bodyColumns },
      })
      expect(await markOf(ui, id)).toBe('new')
      expect(await rows(ui)).toEqual([cut(title, room)])
      await ui.unmount()
    }

    const ui = await $.ui.mount({ ...PANE, surface })
    await ui.press({ key: `open:${id}` })
    expect(await ui.find({ type: 'Text', text: title })).toBeDefined()
    await ui.press({ key: 'back' })
    await ui.unmount()
  }

  await call($, 'update', { id, status: 'done' })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    await ui.press({ key: 'closed' })
    expect(await markOf(ui, id)).toBe('none')
    expect(await rows(ui)).toEqual([cut(`✓ ${title}`, 54)])
    await ui.press({ key: 'closed' })
    await ui.unmount()
  }
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`the band on the ${surface} shows backlog: and this project's counts, and follows them`, async ($, on) => {
    const { clock, ids } = world(on)
    await $.session.start({ ...start, surface })
    await call($, 'add', { items: [DEFECT, DECISION] })
    const [defect, decision] = ids()
    const bar = await $.ui.mount({ ...BAND, surface })
    expect((await bar.find({ key: 'toggle' }))?.text).toBe('backlog:')
    expect(await band(bar)).toBe('2 open, ● 2 new, 1 to decide')

    const ui = await $.ui.mount({ ...PANE, surface })
    await ui.press({ key: `open:${defect}` })
    await ui.press({ key: 'fix' })
    await ui.unmount()
    expect(await band(bar)).toBe('2 open, » 1 in progress, ● 1 new, 1 to decide')

    // The first poll past ten minutes ends the new mark.
    await clock.advance(10 * MINUTE + 5000)
    expect(await band(bar)).toBe('2 open, » 1 in progress, 1 to decide')

    await call($, 'update', { id: defect, status: 'done', resolution: 'Fixed.' })
    await call($, 'update', { id: decision, status: 'dismissed' })
    expect(await yields(bar)).toBe(true)
    await bar.unmount()
  })
}

for (const surface of ['terminal', 'desktop'] as const) {
  test(`on the ${surface}, where the band is drawn, the status line is never set to the counts`, async ($, on) => {
    const { statuses, ids } = world(on)
    await $.session.start({ ...start, surface })
    await call($, 'add', { items: [DEFECT] })
    await call($, 'update', { id: ids()[0], status: 'in_progress' })

    // Cleared on each change, and never set.
    expect(statuses.length).toBeGreaterThan(2)
    expect(statuses.filter(text => text !== undefined)).toEqual([])
  })
}

test('with no band the status line shows the counts, unprefixed, and clears when nothing is open', async ($, on) => {
  const { statuses, ids } = world(on)
  await $.session.start({ ...start, surface: 'vscode' })
  expect(statuses).toEqual([undefined])

  await call($, 'add', { items: [DEFECT, DECISION] })
  expect(statuses.at(-1)).toBe('2 open, 2 new, 1 to decide')

  const [defect, decision] = ids()
  await call($, 'update', { id: defect, status: 'in_progress' })
  expect(statuses.at(-1)).toBe('2 open, 1 in progress, 1 new, 1 to decide')

  await call($, 'update', { id: defect, status: 'done', resolution: 'Fixed.' })
  await call($, 'update', { id: decision, status: 'dismissed' })
  expect(statuses.at(-1)).toBeUndefined()
})

test('the band draws nothing of its own with nothing open in this project', async ($, on) => {
  const { clock, elsewhere } = world(on)
  await $.session.start(start)
  const bar = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await yields(bar)).toBe(true)

  elsewhere({ id: 'ap11ap11', set: recorded('Rate limit is undocumented', '/work/api') })
  await clock.advance(5000)
  expect(await yields(bar)).toBe(true)
  await bar.unmount()
})

test('the band draws nothing of its own while a survey holds it', async ($, on) => {
  world(on)
  await $.session.start(start)
  await call($, 'add', { items: [DEFECT] })

  const bar = await $.ui.mount({
    ...BAND,
    surface: 'terminal',
    props: { ...BAND.props, hasSurvey: true },
  })
  expect(await yields(bar)).toBe(true)
  await bar.unmount()
})

test('counts too wide for the band are cut to one row', async ($, on) => {
  world(on)
  await $.session.start(start)
  await call($, 'add', { items: [DEFECT, DECISION] })

  const bar = await $.ui.mount({
    ...BAND,
    surface: 'terminal',
    props: { ...BAND.props, bodyColumns: 30 },
  })
  expect(await band(bar)).toBe('2 open, ● 2 new, 1 t…')
  await bar.unmount()
})

test('pressing backlog: closes the pane when it is shown, and opens it with focus when it is not', async ($, on) => {
  const { opened, closed, pane } = world(on)
  await $.session.start(start)
  await call($, 'add', { items: [DEFECT] })
  const bar = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(pane()?.isShown).toBe(true)

  await bar.press({ key: 'toggle' })
  expect(closed).toEqual(['backlog'])
  expect(pane()).toBeUndefined()

  await bar.press({ key: 'toggle' })
  expect(opened.at(-1)).toEqual({ id: 'backlog', focus: true })
  expect(pane()?.isShown).toBe(true)

  await bar.press({ key: 'toggle' })
  expect(closed).toEqual(['backlog', 'backlog'])
  await bar.unmount()
})

test('pressing backlog: raises the pane when it is a tab behind another, or waits unplaced', async ($, on) => {
  const { opened, closed, seat } = world(on)
  await $.session.start(start)
  await call($, 'add', { items: [DEFECT] })
  const bar = await $.ui.mount({ ...BAND, surface: 'terminal' })

  for (const state of [{ isShown: false }, { isPlaced: false }]) {
    seat(state)
    const before = opened.length
    await bar.press({ key: 'toggle' })
    expect(opened.slice(before)).toEqual([{ id: 'backlog', focus: true }])
  }

  expect(closed).toEqual([])
  await bar.unmount()
})

test('pressing backlog: says why when the host does not place the pane', async ($, on) => {
  const { toasts, opened } = world(on, '/work/app', 'enter', {
    notPlaced: 'the terminal is too narrow',
  })
  await $.session.start(start)
  await call($, 'add', { items: [DEFECT] })
  const bar = await $.ui.mount({ ...BAND, surface: 'terminal' })

  await bar.press({ key: 'toggle' })
  expect(opened.at(-1)).toEqual({ id: 'backlog', focus: true })
  expect(toasts.at(-1)).toBe(
    'Backlog: the pane is not shown: the terminal is too narrow',
  )
  await bar.unmount()
})

test('pressing backlog: when a hook keeps the pane open says so, and the press settles', async ($, on) => {
  const { toasts, closed, pane } = world(on, '/work/app', 'enter', {
    closeRefused: 'a review is open in it',
  })
  await $.session.start(start)
  await call($, 'add', { items: [DEFECT] })
  const bar = await $.ui.mount({ ...BAND, surface: 'terminal' })

  await bar.press({ key: 'toggle' })
  expect(closed).toEqual([])
  expect(pane()?.isShown).toBe(true)
  expect(toasts.at(-1)).toBe('Backlog: the pane stays open: a review is open in it')
  await bar.unmount()
})

test('pressing backlog: opens the pane while the folder cannot be read', async ($, on) => {
  const { opened, toasts, ids, failListing } = world(on)
  await $.session.start(start)
  await call($, 'add', { items: [DEFECT] })
  await call($, 'update', { id: ids()[0], status: 'in_progress' })
  const bar = await $.ui.mount({ ...BAND, surface: 'terminal' })
  await bar.press({ key: 'toggle' })
  const toastsBefore = toasts.length

  failListing(1)
  await bar.press({ key: 'toggle' })
  expect(opened.at(-1)).toEqual({ id: 'backlog', focus: true })
  expect(toasts).toHaveLength(toastsBefore)
  await bar.unmount()
})
