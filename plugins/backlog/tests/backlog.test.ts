import { expect, mock, test } from 'claude-code/testing'
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
// and the prompts the mod submits.
const world = (on: On, root: string) => {
  const files = new Map<string, string>()
  const prompts: string[] = []
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
  on('ui.toast', () => ({ value: undefined }))
  on('prompt.submit', ($, e) => {
    prompts.push(e.text)

    return { text: e.text }
  })

  return { files, prompts, clock }
}

const start = { cwd: '/work/app', surface: 'terminal', isInteractive: true } as const

const DRAFTS = [
  {
    title: 'Retry loop never backs off',
    category: 'defect',
    priority: 'high',
    detail: 'src/retry.ts:40 retries at once, forever.',
  },
  {
    title: 'Which queue do we standardise on?',
    category: 'decision',
    priority: 'critical',
    detail: 'Two queues are in use.',
    options: [
      { label: 'Keep SQS', detail: 'No migration.' },
      { label: 'Move to Kafka' },
    ],
    recommendation: 'Keep SQS until volume demands more.',
  },
]

test('what Claude records is listed by category and priority, on each surface', async ($, on) => {
  const { files } = world(on, '/work/app')
  await $.session.start(start)

  const added = await $.tool.call({
    tool: 'mcp__backlog__add',
    tool_use_id: 'call-1',
    items: DRAFTS,
  })
  expect(String(added.result)).toMatch('Retry loop never backs off')
  expect(files.size).toBe(2)

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
  const { files, prompts } = world(on, '/work/app')
  await $.session.start(start)
  await $.tool.call({
    tool: 'mcp__backlog__add',
    tool_use_id: 'call-1',
    items: DRAFTS.slice(0, 1),
  })
  const id = [...files.keys()][0]?.slice(DIR.length + 1, -'.json'.length) ?? ''

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: `open:${id}` })
  expect(await ui.find({ type: 'Markdown' })).toBeDefined()

  await ui.press({ key: 'fix' })
  expect(prompts).toHaveLength(1)
  expect(prompts[0]).toMatch('src/retry.ts:40')
  expect(prompts[0]).toMatch(`mcp__backlog__update for ${id}`)
  expect(JSON.parse(files.get(`${DIR}/${id}.json`) ?? '{}').status).toBe(
    'in_progress',
  )
  await ui.unmount()
})

test('choosing an option records the decision and tells Claude', async ($, on) => {
  const { files, prompts } = world(on, '/work/app')
  await $.session.start(start)
  await $.tool.call({
    tool: 'mcp__backlog__add',
    tool_use_id: 'call-1',
    items: DRAFTS.slice(1),
  })
  const id = [...files.keys()][0]?.slice(DIR.length + 1, -'.json'.length) ?? ''

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: `open:${id}` })
  await ui.press({ key: 'option:1' })

  expect(prompts[0]).toMatch('I have decided this backlog item: "Move to Kafka"')
  expect(JSON.parse(files.get(`${DIR}/${id}.json`) ?? '{}').resolution).toBe(
    'Decided: Move to Kafka',
  )
  await ui.unmount()
})

test("another session's items arrive on the poll, under All projects", async ($, on) => {
  const { files, clock } = world(on, '/work/app')
  await $.session.start(start)
  files.set(
    `${DIR}/zz99.json`,
    JSON.stringify({
      id: 'zz99',
      title: 'Flaky login test',
      category: 'issue',
      priority: 'low',
      status: 'open',
      project: '/work/other',
    }),
  )
  await clock.advance(5000)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ key: 'open:zz99' })).toBeUndefined()

  await ui.press({ key: 'scope' })
  expect((await ui.find({ key: 'open:zz99' }))?.text).toMatch('Flaky login test')
  await ui.unmount()
})

test('marking an item done takes it off the list', async ($, on) => {
  const { files } = world(on, '/work/app')
  await $.session.start(start)
  await $.tool.call({
    tool: 'mcp__backlog__add',
    tool_use_id: 'call-1',
    items: DRAFTS.slice(0, 1),
  })
  const id = [...files.keys()][0]?.slice(DIR.length + 1, -'.json'.length) ?? ''

  const updated = await $.tool.call({
    tool: 'mcp__backlog__update',
    tool_use_id: 'call-2',
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
