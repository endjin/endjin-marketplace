import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type {
  BacklogCategory,
  BacklogChange,
  BacklogFields,
  BacklogItem,
  BacklogOption,
  BacklogPriority,
  BacklogStatus,
  BacklogView,
} from '../types'

const PANE = 'backlog'
const POLL_MS = 5000
const BATCH_MAX = 50
const DETAIL_MAX = 20000
const NOTE_MAX = 10000
// A Markdown element draws at most 10,000 characters: longer text is drawn as
// several, cut at paragraph breaks.
const CHUNK = 9000

const CATEGORIES = ['decision', 'defect', 'issue', 'task'] as const
const PRIORITIES = ['critical', 'high', 'medium', 'low'] as const
const STATUSES = ['open', 'in_progress', 'done', 'dismissed'] as const

const HEADING: Record<BacklogCategory, string> = {
  decision: 'Decisions',
  defect: 'Defects',
  issue: 'Issues',
  task: 'Tasks',
}
const TAG: Record<BacklogPriority, string> = {
  critical: 'CRIT',
  high: 'HIGH',
  medium: 'MED ',
  low: 'LOW ',
}
const STATUS: Record<BacklogStatus, string> = {
  open: 'open',
  in_progress: 'in progress',
  done: 'done',
  dismissed: 'dismissed',
}
const MARK: Record<BacklogStatus, string> = {
  open: '',
  in_progress: '> ',
  done: '✓ ',
  dismissed: 'x ',
}

const GUIDANCE = `# Backlog

The person keeps a backlog in a side pane, shared by all their Claude Code sessions. When a piece of work ends and leaves defects, issues, follow-up tasks or decisions only the person can make, record each with mcp__backlog__add as well as mentioning it in your reply; do the same when you reach a choice that is theirs to make. Do not record what you are about to do in this same turn.

The person reads an item later, away from this conversation, and may act on it from another session. Write its detail to stand alone: what you observed, where (file and line), why it matters. A decision carries its options with their trade-offs and your recommendation.

When you fix or settle an item, call mcp__backlog__update with status "done" and a one-line resolution.`

const items = atom({ plugin: 'backlog', key: 'items' } as const, [])
const view = atom({ plugin: 'backlog', key: 'view' } as const, {
  selected: null,
  scope: 'project',
  showClosed: false,
})
const project = atom({ plugin: 'backlog', key: 'project' } as const, '')

// File name to the change record last read from it; `stamp` is the listing's
// time and size, '' for a file this session just wrote.
const records = new Map<string, { stamp: string; change: BacklogChange }>()
const unreadable = new Map<string, string>()
let hasLoaded = false
let lastAt = 0
let queue: Promise<unknown> = Promise.resolve()

// Reads and writes of the folder run one at a time within this session.
// Across sessions nothing needs a lock: every write is a new file.
const inTurn = <T,>(work: () => Promise<T>): Promise<T> => {
  const run = queue.then(work, work)
  queue = run.catch(() => undefined)

  return run
}

const clean = (text: unknown, limit: number): string =>
  typeof text === 'string'
    ? text
        .replace(/\r\n?/g, '\n')
        .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '')
        .trim()
        .slice(0, limit)
    : ''

const oneLine = (text: unknown, limit: number): string =>
  clean(text, limit * 2)
    .replace(/\s+/g, ' ')
    .slice(0, limit)

const record = (raw: unknown): Record<string, unknown> =>
  typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}

const slash = (path: string): string =>
  path.replace(/\\/g, '/').replace(/\/+$/, '')

// A project root as items are compared by it. A path keeps its inner
// whitespace: `/work/my  app` and `/work/my app` are two projects.
const toPath = (path: string): string => slash(clean(path, 1000))

const toOptions = (raw: unknown): BacklogOption[] =>
  (Array.isArray(raw) ? raw : [])
    .map(one => {
      const fields = typeof one === 'string' ? { label: one } : record(one)

      return {
        label: oneLine(fields.label, 120),
        detail: clean(fields.detail, 1000),
      }
    })
    .filter(option => option.label !== '')
    .slice(0, 9)

// The fields `raw` names, each held to its shape; one it leaves out, or names
// with a value of the wrong kind, is left out.
const toFields = (raw: Record<string, unknown>): Partial<BacklogFields> => {
  const set: Partial<BacklogFields> = {}
  const title = oneLine(raw.title, 200)
  const category = CATEGORIES.find(one => one === raw.category)
  const priority = PRIORITIES.find(one => one === raw.priority)
  const status = STATUSES.find(one => one === raw.status)

  if (title !== '') {
    set.title = title
  }

  if (category !== undefined) {
    set.category = category
  }

  if (priority !== undefined) {
    set.priority = priority
  }

  if (status !== undefined) {
    set.status = status
  }

  if (typeof raw.detail === 'string') {
    set.detail = clean(raw.detail, DETAIL_MAX)
  }

  if (Array.isArray(raw.options)) {
    set.options = toOptions(raw.options)
  }

  if (typeof raw.recommendation === 'string') {
    set.recommendation = clean(raw.recommendation, 2000)
  }

  if (typeof raw.resolution === 'string') {
    set.resolution = clean(raw.resolution, 2000)
  }

  if (typeof raw.project === 'string') {
    set.project = toPath(raw.project)
  }

  return set
}

const ID = /^[a-z0-9]{4,12}$/

const toChange = (raw: unknown): BacklogChange | undefined => {
  const fields = record(raw)
  const id = typeof fields.id === 'string' && ID.test(fields.id) ? fields.id : ''
  // The first version of this mod kept an item as one whole file, `<id>.json`,
  // rewritten on every change. Such a file reads as one record that sets every
  // field, as of its last rewrite; changes made since are records beside it.
  const isWhole = fields.set === undefined && typeof fields.title === 'string'
  const at = Number(isWhole ? (fields.updatedAt ?? fields.createdAt) : fields.at)

  if (id === '' || !Number.isFinite(at)) {
    return undefined
  }

  return {
    id,
    at,
    sessionId: oneLine(fields.sessionId, 100),
    set: toFields(isWhole ? fields : record(fields.set)),
    note: isWhole ? '' : clean(fields.note, NOTE_MAX),
  }
}

// Every item, each the fold of its records in `at` order. Records set only
// the fields they name, so a note from one session and a status from another
// both stand, whichever was written first.
const fold = (): BacklogItem[] => {
  const ordered = [...records.entries()].sort(
    ([nameA, a], [nameB, b]) =>
      a.change.at - b.change.at || (nameA < nameB ? -1 : 1),
  )
  const byId = new Map<string, BacklogItem>()

  for (const [, { change }] of ordered) {
    const held: BacklogItem = byId.get(change.id) ?? {
      id: change.id,
      title: '',
      category: 'task',
      priority: 'medium',
      status: 'open',
      detail: '',
      options: [],
      recommendation: '',
      resolution: '',
      notes: [],
      project: '',
      sessionId: change.sessionId,
      createdAt: change.at,
      updatedAt: change.at,
    }

    byId.set(change.id, {
      ...held,
      ...change.set,
      notes:
        change.note === ''
          ? held.notes
          : [...held.notes, { at: change.at, text: change.note }],
      updatedAt: change.at,
    })
  }

  return [...byId.values()].filter(item => item.title !== '')
}

const nameOf = (path: string): string =>
  path.split('/').filter(part => part !== '').at(-1) ?? path

const isOpen = (item: BacklogItem): boolean =>
  item.status === 'open' || item.status === 'in_progress'

const fit = (text: string, width: number): string =>
  text.length > width ? `${text.slice(0, Math.max(1, width - 1))}…` : text

const day = (at: number): string =>
  at > 0 ? new Date(at).toISOString().slice(0, 10) : ''

const byUrgency = (a: BacklogItem, b: BacklogItem): number =>
  Number(isOpen(b)) - Number(isOpen(a)) ||
  PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority) ||
  b.updatedAt - a.updatedAt

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz'

const token = (length: number): string =>
  [...crypto.getRandomValues(new Uint8Array(length))]
    .map(byte => ALPHABET.charAt(byte % ALPHABET.length))
    .join('')

// `text` whole, in pieces a Markdown element can draw: cut at the last blank
// line outside a code fence, or between lines when a piece has none.
const chunks = (text: string, limit = CHUNK): string[] => {
  const parts: string[] = []
  let current = ''
  let safe = 0
  let isFenced = false
  const flush = (upTo: number) => {
    parts.push(current.slice(0, upTo).trimEnd())
    current = current.slice(upTo)
    safe = 0
  }

  for (const whole of text.split('\n')) {
    for (let from = 0; from === 0 || from < whole.length; from += limit) {
      const line = whole.slice(from, from + limit)

      if (current !== '' && current.length + line.length > limit) {
        flush(safe > 0 ? safe : current.length)
      }

      if (current !== '' && current.length + line.length > limit) {
        flush(current.length)
      }

      current += `${line}\n`
    }

    if (/^\s*(```|~~~)/.test(whole)) {
      isFenced = !isFenced
    }

    if (!isFenced && whole.trim() === '') {
      safe = current.length
    }
  }

  parts.push(current.trimEnd())

  return parts.filter(part => part.trim() !== '')
}

const folder = async ($: EngineInterface): Promise<string> => {
  const config = await $.env.get('CLAUDE_CONFIG_DIR')

  if (config !== undefined && config !== '') {
    return `${slash(config)}/backlog/items`
  }

  const home =
    (await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME')) ?? ''

  return `${slash(home)}/.claude/backlog/items`
}

const load = async (
  $: EngineInterface,
  path: string,
): Promise<BacklogChange | undefined> => {
  try {
    return toChange(JSON.parse(await $.fs.read(path)))
  } catch {
    return undefined
  }
}

const publish = async ($: EngineInterface): Promise<BacklogItem[]> => {
  const all = fold()
  await update($, items, () => all)

  const here = await read($, project)
  const open = all.filter(one => isOpen(one) && one.project === here)
  const decisions = open.filter(one => one.category === 'decision').length
  const toDecide = decisions > 0 ? `, ${decisions} to decide` : ''

  $.ui.status(
    open.length === 0 ? undefined : `backlog: ${open.length} open${toDecide}`,
  )

  return all
}

// Writes one change as a file of its own. Its name carries 8 random
// characters, so no session's write lands on another's, and its time is past
// every record of the item this session has read, so it folds after them.
const append = async (
  $: EngineInterface,
  id: string,
  set: Partial<BacklogFields>,
  note = '',
): Promise<void> => {
  const seen = [...records.values()]
    .filter(held => held.change.id === id)
    .map(held => held.change.at + 1)
  const at = Math.max(await $.clock.now(), lastAt + 1, ...seen)
  lastAt = at

  const name = `${id}.${at.toString(36)}.${token(8)}.json`
  const change: BacklogChange = {
    id,
    at,
    sessionId: await $.session.id(),
    set,
    note,
  }
  await $.fs.write(
    `${await folder($)}/${name}`,
    `${JSON.stringify(change, null, 2)}\n`,
  )
  records.set(name, { stamp: '', change })
}

// Brings `records` level with the folder, which every session writes to.
// Runs inside the queue.
const level = async ($: EngineInterface): Promise<void> => {
  const dir = await folder($)
  const entries = (await $.fs.exists(dir)) ? await $.fs.list(dir) : []
  const names = new Set<string>()
  const before = new Set(fold().map(one => one.id))
  let hasChanged = !hasLoaded

  for (const entry of entries) {
    if (entry.kind !== 'file' || !entry.name.endsWith('.json')) {
      continue
    }

    names.add(entry.name)
    const stamp = `${entry.mtimeMs}:${entry.size}`

    if (
      records.get(entry.name)?.stamp === stamp ||
      unreadable.get(entry.name) === stamp
    ) {
      continue
    }

    const change = await load($, `${dir}/${entry.name}`)

    if (change === undefined) {
      // Half-written, or not a record: read again once the file changes.
      unreadable.set(entry.name, stamp)
      continue
    }

    unreadable.delete(entry.name)
    records.set(entry.name, { stamp, change })
    hasChanged = true
  }

  for (const name of [...records.keys()]) {
    if (!names.has(name)) {
      records.delete(name)
      hasChanged = true
    }
  }

  if (hasChanged) {
    const arrived = (await publish($)).filter(one => !before.has(one.id))
    const first = arrived[0]

    if (hasLoaded && first !== undefined) {
      $.ui.toast(
        arrived.length === 1
          ? `Backlog: ${fit(first.title, 60)} (${nameOf(first.project)})`
          : `Backlog: ${arrived.length} new items from other sessions`,
      )
    }
  }

  hasLoaded = true
}

const sync = ($: EngineInterface): Promise<void> => inTurn(() => level($))

// Changes one item as the folder holds it now, and resolves the item as it
// then stands; undefined when no item has the id.
const edit = (
  $: EngineInterface,
  id: string,
  set: Partial<BacklogFields>,
  note = '',
): Promise<BacklogItem | undefined> =>
  inTurn(async () => {
    await level($)

    if (!fold().some(one => one.id === id)) {
      return undefined
    }

    await append($, id, set, note)

    return (await publish($)).find(one => one.id === id)
  })

const add = (
  $: EngineInterface,
  drafts: readonly unknown[],
): Promise<{ text: string; recorded: number }> =>
  inTurn(async () => {
    // Level first: an item another session closed since the last poll is no
    // twin, and one it opened is.
    await level($)
    const here = await read($, project)
    const lines: string[] = []
    let recorded = 0

    for (const draft of drafts) {
      const fields = record(draft)
      const title = oneLine(fields.title, 200)

      if (title === '') {
        lines.push('- skipped an item with no title')
        continue
      }

      if (
        typeof fields.detail === 'string' &&
        fields.detail.length > DETAIL_MAX
      ) {
        lines.push(
          `- skipped "${fit(title, 60)}": its detail is ${fields.detail.length} characters and the limit is ${DETAIL_MAX}`,
        )
        continue
      }

      const given = toFields({
        category: fields.category,
        priority: fields.priority,
        detail: fields.detail,
        options: fields.options,
        recommendation: fields.recommendation,
      })
      const current = fold()
      const twin = current.find(
        one =>
          isOpen(one) &&
          one.project === here &&
          one.title.toLowerCase() === title.toLowerCase(),
      )

      if (twin !== undefined) {
        // Only what the draft gives: the twin's status, resolution and notes
        // are not this call's to set.
        const refreshed: Partial<BacklogFields> = {}

        if (given.priority !== undefined) {
          refreshed.priority = given.priority
        }

        if (given.detail !== undefined && given.detail !== '') {
          refreshed.detail = given.detail
        }

        if (given.options !== undefined && given.options.length > 0) {
          refreshed.options = given.options
        }

        if (given.recommendation !== undefined && given.recommendation !== '') {
          refreshed.recommendation = given.recommendation
        }

        await append($, twin.id, refreshed)
        lines.push(`- ${twin.id}: already on the backlog, refreshed`)
        recorded += 1
        continue
      }

      let id = token(8)

      while (current.some(one => one.id === id)) {
        id = token(8)
      }

      await append($, id, {
        category: 'task',
        priority: 'medium',
        detail: '',
        options: [],
        recommendation: '',
        ...given,
        title,
        status: 'open',
        resolution: '',
        project: here,
      })
      lines.push(`- ${id}: ${title}`)
      recorded += 1
    }

    await publish($)

    return {
      text:
        lines.length === 0
          ? 'Nothing recorded: `items` was empty.'
          : `Recorded on the backlog:\n${lines.join('\n')}`,
      recorded,
    }
  })

const describe = (item: BacklogItem): string =>
  [
    `Backlog item ${item.id} (${item.category}, ${item.priority} priority, ${STATUS[item.status]}): ${item.title}`,
    `Recorded in ${item.project}.`,
    item.detail,
    item.options.length > 0
      ? `Options:\n${item.options
          .map(option =>
            option.detail === ''
              ? `- ${option.label}`
              : `- ${option.label}: ${option.detail}`,
          )
          .join('\n')}`
      : '',
    item.recommendation === '' ? '' : `Recommendation: ${item.recommendation}`,
    item.resolution === '' ? '' : `Resolution: ${item.resolution}`,
    ...item.notes.map(note => `Note, ${day(note.at)}: ${note.text}`),
  ]
    .filter(part => part !== '')
    .join('\n\n')

const closing = (item: BacklogItem): string =>
  `When this is finished, call mcp__backlog__update for ${item.id} with status "done" and a one-line resolution. If it cannot be finished, add a note to the item saying what is in the way.`

// Hands an item to this session's Claude as the person's own prompt. The
// item changes only once the prompt has entered: one that did not is said so,
// and the item is left as it was, its actions still there to press again.
const send = async (
  $: EngineInterface,
  item: BacklogItem,
  lead: string,
  resolution?: string,
): Promise<void> => {
  let refusal = ''

  try {
    const entered = await $.prompt.submit({
      text: `${lead}\n\n${describe(item)}\n\n${closing(item)}`,
      asUser: true,
    })
    refusal = entered.drop ?? ''
  } catch (error) {
    refusal = String(error)
  }

  if (refusal !== '') {
    $.ui.toast(
      `Backlog: ${item.id} was not sent to Claude (${fit(refusal, 80)}). It is unchanged: open it and press the action again.`,
      { timeoutMs: 10000 },
    )

    return
  }

  await edit(
    $,
    item.id,
    resolution === undefined
      ? { status: 'in_progress' }
      : { status: 'in_progress', resolution },
  )
  $.ui.toast(`Sent to Claude: ${fit(item.title, 60)}`)
}

const show = ($: EngineInterface, id: string | null) =>
  update($, view, held => ({ ...held, selected: id }))

const tone = (
  priority: BacklogPriority,
): { color?: string; bold?: boolean; dimColor?: boolean } => {
  if (priority === 'critical') {
    return { color: 'error', bold: true }
  }

  if (priority === 'high') {
    return { color: 'warning' }
  }

  return priority === 'low' ? { dimColor: true } : {}
}

const ITEM_SCHEMA = {
  type: 'object',
  properties: {
    title: {
      type: 'string',
      description:
        'One line naming the item, specific enough to tell it from its neighbours in a list.',
    },
    category: {
      type: 'string',
      enum: CATEGORIES,
      description:
        'decision: needs the person to choose. defect: something is wrong. issue: a risk, gap or smell that is not a failure yet. task: follow-up work.',
    },
    priority: { type: 'string', enum: PRIORITIES },
    detail: {
      type: 'string',
      maxLength: DETAIL_MAX,
      description:
        'Markdown that stands alone for a reader who has not seen this session: what you observed, where (file:line), why it matters, what fixing it involves.',
    },
    options: {
      type: 'array',
      maxItems: 9,
      description:
        'For a decision: the choices the person picks from, at most nine.',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string', description: 'The choice, in a few words.' },
          detail: {
            type: 'string',
            description: 'What choosing it means: cost, risk, consequence.',
          },
        },
        required: ['label'],
      },
    },
    recommendation: {
      type: 'string',
      description: 'What you would do and why, in a sentence or two.',
    },
  },
  required: ['title', 'category', 'priority', 'detail'],
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const root = toPath(await $.session.root())
    await update($, project, () => root)

    await $.command.register({
      name: 'backlog',
      description:
        'Open the backlog pane: defects, issues, tasks and decisions from your sessions',
    })
    await $.tool.register({
      name: 'add',
      description: `Records items on the person's backlog pane: defects found, issues noticed, follow-up tasks, and decisions that need the person. Call it when a piece of work ends and leaves any of these, as well as mentioning them in the reply, and when you reach a choice that is the person's to make. One call takes up to ${BATCH_MAX} items. An open item with the same title in this project is refreshed, not duplicated.`,
      inputSchema: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            minItems: 1,
            maxItems: BATCH_MAX,
            items: ITEM_SCHEMA,
          },
        },
        required: ['items'],
      },
    })
    await $.tool.register({
      name: 'update',
      description:
        'Updates one backlog item by id: mark it done with a resolution once fixed or settled, change its priority or category, or append a note with what you learned. Ids come from mcp__backlog__add and mcp__backlog__list.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          status: { type: 'string', enum: STATUSES },
          priority: { type: 'string', enum: PRIORITIES },
          category: { type: 'string', enum: CATEGORIES },
          title: { type: 'string' },
          note: {
            type: 'string',
            maxLength: NOTE_MAX,
            description: "Markdown appended to the item's notes.",
          },
          resolution: {
            type: 'string',
            description: 'One line: what was decided, or how it was fixed.',
          },
        },
        required: ['id'],
      },
    })
    await $.tool.register({
      name: 'list',
      description:
        "Lists the backlog: each item's id, category, priority, status and title; with `id`, that one item in full. Open items of this project unless asked otherwise.",
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Return this item in full.' },
          scope: {
            type: 'string',
            enum: ['project', 'all'],
            description: 'all: every project, not this one alone.',
          },
          includeClosed: {
            type: 'boolean',
            description: 'Also list done and dismissed items.',
          },
        },
      },
    })

    try {
      await sync($)
    } catch (error) {
      $.ui.log(`backlog: could not read the backlog folder: ${String(error)}`)
    }

    $.clock.every(POLL_MS, () => {
      void sync($).catch(() => undefined)
    })
    void $.ui.open({ id: PANE, title: 'Backlog' })

    return next(e)
  })

  on('prompt.compose', async ($, e, next) => {
    const composed = await next(e)

    if (!e.tools.includes('mcp__backlog__add')) {
      return composed
    }

    return {
      sections: [
        ...composed.sections,
        { id: 'backlog:tracking', text: GUIDANCE, scope: 'session' },
      ],
    }
  })

  on('command.run', { command: 'backlog' }, async $ => {
    await sync($)
    const opened = await $.ui.open({ id: PANE, title: 'Backlog', focus: true })
    const here = await read($, project)
    const open = (await read($, items)).filter(
      one => isOpen(one) && one.project === here,
    )
    const count = `${open.length} open in ${nameOf(here)}`

    return {
      text: opened.isPlaced
        ? `Backlog pane opened: ${count}.`
        : `Backlog: ${count}. The pane is not shown: ${opened.reason}.`,
    }
  })

  on('tool.call', { tool: 'mcp__backlog__add' }, async ($, e) => {
    const drafts = Array.isArray(e.items) ? e.items : []

    if (drafts.length > BATCH_MAX) {
      return {
        deny: `mcp__backlog__add takes at most ${BATCH_MAX} items in one call and got ${drafts.length}. Nothing was recorded: send them in batches.`,
      }
    }

    const { text, recorded } = await add($, drafts)

    if (recorded > 0) {
      $.ui.toast(
        `Backlog: ${recorded} ${recorded === 1 ? 'item' : 'items'} recorded`,
      )
    }

    return { result: text }
  })

  on('tool.call', { tool: 'mcp__backlog__update' }, async ($, e) => {
    const id = oneLine(e.id, 12)

    if (typeof e.note === 'string' && e.note.length > NOTE_MAX) {
      return {
        deny: `The note is ${e.note.length} characters and the limit is ${NOTE_MAX}. Nothing was changed: shorten it, or send it as several notes.`,
      }
    }

    const note = clean(e.note, NOTE_MAX)
    const resolution = clean(e.resolution, 2000)
    const set = toFields({
      title: e.title,
      status: e.status,
      priority: e.priority,
      category: e.category,
      ...(resolution === '' ? {} : { resolution }),
    })

    if (note === '' && Object.keys(set).length === 0) {
      return {
        result:
          'Nothing to change: give a status, priority, category, title, resolution or note.',
      }
    }

    const edited = await edit($, id, set, note)

    return {
      result:
        edited === undefined
          ? `No backlog item has the id "${id}". mcp__backlog__list gives the ids.`
          : `Updated ${edited.id}: ${STATUS[edited.status]}, ${edited.priority} priority.`,
    }
  })

  on('tool.call', { tool: 'mcp__backlog__list' }, async ($, e) => {
    await sync($)
    const all = await read($, items)
    const here = await read($, project)
    const id = oneLine(e.id, 12)

    if (id !== '') {
      const one = all.find(item => item.id === id)

      return {
        result:
          one === undefined ? `No backlog item has the id "${id}".` : describe(one),
      }
    }

    const listed = all
      .filter(
        one =>
          (e.scope === 'all' || one.project === here) &&
          (e.includeClosed === true || isOpen(one)),
      )
      .sort(byUrgency)

    return {
      result:
        listed.length === 0
          ? 'The backlog has no matching items.'
          : listed
              .map(
                one =>
                  `${one.id} [${one.category}, ${one.priority}, ${STATUS[one.status]}] ${one.title}` +
                  (e.scope === 'all' ? ` (${nameOf(one.project)})` : ''),
              )
              .join('\n'),
    }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const table = $.ui.resolve(e)
    const { Box, Text, Button, Markdown } = table
    const Input = 'Input' in table ? table.Input : undefined
    const all = await read($, items)
    const held = await read($, view)
    const here = await read($, project)
    const columns = Math.max(24, e.props.bodyColumns)
    const selected =
      held.selected === null
        ? undefined
        : all.find(one => one.id === held.selected)

    if (selected !== undefined) {
      const isLive = isOpen(selected)
      const rank = PRIORITIES.indexOf(selected.priority)
      const raised = PRIORITIES[rank - 1]
      const lowered = PRIORITIES[rank + 1]
      const isDecision = selected.category === 'decision'
      const facts = [
        selected.category,
        `${selected.priority} priority`,
        STATUS[selected.status],
        nameOf(selected.project),
        day(selected.createdAt),
      ].filter(fact => fact !== '')
      const close = async (status: BacklogStatus) => {
        await edit($, selected.id, { status })
        await show($, null)
      }

      return (
        <Box flexDirection="column">
          <Box flexDirection="row" gap={1}>
            <Button key="back" label="Back" onPress={() => show($, null)} />
            <Text dimColor>{selected.id}</Text>
          </Box>
          <Box marginTop={1} flexDirection="column">
            <Text bold wrap="wrap">
              {selected.title}
            </Text>
            <Text dimColor wrap="wrap">
              {facts.join(' · ')}
            </Text>
            {selected.project !== here && (
              <Text color="warning" wrap="wrap">
                {`From another project: ${selected.project}`}
              </Text>
            )}
          </Box>
          {selected.detail !== '' && (
            <Box marginTop={1} flexDirection="column">
              {chunks(selected.detail).map(part => (
                <Markdown text={part} />
              ))}
            </Box>
          )}
          {selected.notes.map(note => (
            <Box marginTop={1} flexDirection="column">
              <Text bold>{`Note, ${day(note.at)}`}</Text>
              {chunks(note.text).map(part => (
                <Markdown text={part} />
              ))}
            </Box>
          ))}
          {selected.recommendation !== '' && (
            <Box marginTop={1} flexDirection="column">
              <Text bold>Claude recommends</Text>
              <Markdown text={selected.recommendation} />
            </Box>
          )}
          {selected.resolution !== '' && (
            <Box marginTop={1} flexDirection="column">
              <Text bold>Resolution</Text>
              <Text wrap="wrap">{selected.resolution}</Text>
            </Box>
          )}
          {isLive && selected.options.length > 0 && (
            <Box marginTop={1} flexDirection="column">
              <Text bold>Decide</Text>
              {selected.options.map((option, index) => (
                <Box flexDirection="column">
                  <Box flexDirection="row">
                    <Button
                      key={`option:${index}`}
                      label={fit(option.label, columns - 4)}
                      onPress={() =>
                        send(
                          $,
                          selected,
                          `I have decided this backlog item: "${option.label}". Carry the decision out.`,
                          `Decided: ${option.label}`,
                        )
                      }
                    />
                  </Box>
                  {option.detail !== '' && (
                    <Box marginLeft={2}>
                      <Text dimColor wrap="wrap">
                        {option.detail}
                      </Text>
                    </Box>
                  )}
                </Box>
              ))}
            </Box>
          )}
          {isLive && Input !== undefined && (
            <Box marginTop={1}>
              <Input
                key="direct"
                label="Direct"
                placeholder="tell Claude what to do about this"
                submitLabel="send"
                value=""
                onSubmit={text => {
                  const direction = clean(text, 4000)

                  if (direction !== '') {
                    void send(
                      $,
                      selected,
                      `My direction for this backlog item: ${direction}`,
                      isDecision ? `Directed: ${fit(direction, 200)}` : undefined,
                    )
                  }
                }}
              />
            </Box>
          )}
          <Box marginTop={1} flexDirection="row" flexWrap="wrap" columnGap={1}>
            {isLive && !isDecision && (
              <Button
                key="fix"
                variant="primary"
                label="Fix now"
                onPress={() =>
                  send($, selected, 'Please work on this backlog item now.')
                }
              />
            )}
            {isLive && isDecision && selected.recommendation !== '' && (
              <Button
                key="accept"
                variant="primary"
                label="Accept recommendation"
                onPress={() =>
                  send(
                    $,
                    selected,
                    'I accept your recommendation for this backlog item. Carry it out.',
                    `Accepted the recommendation: ${fit(selected.recommendation, 200)}`,
                  )
                }
              />
            )}
            {isLive && (
              <Button key="done" label="Mark done" onPress={() => close('done')} />
            )}
            {isLive && (
              <Button
                key="dismiss"
                label="Dismiss"
                onPress={() => close('dismissed')}
              />
            )}
            {!isLive && (
              <Button
                key="reopen"
                label="Reopen"
                onPress={() => edit($, selected.id, { status: 'open' })}
              />
            )}
            {raised !== undefined && (
              <Button
                key="raise"
                label="Priority +"
                onPress={() => edit($, selected.id, { priority: raised })}
              />
            )}
            {lowered !== undefined && (
              <Button
                key="lower"
                label="Priority -"
                onPress={() => edit($, selected.id, { priority: lowered })}
              />
            )}
          </Box>
        </Box>
      )
    }

    const isAll = held.scope === 'all'
    const shown = all.filter(
      one =>
        (isAll || one.project === here) && (held.showClosed || isOpen(one)),
    )
    const open = shown.filter(isOpen)
    const decisions = open.filter(one => one.category === 'decision').length
    const groups = CATEGORIES.map(category => ({
      category,
      members: shown.filter(one => one.category === category).sort(byUrgency),
    })).filter(group => group.members.length > 0)

    return (
      <Box flexDirection="column">
        <Box flexDirection="row" justifyContent="space-between">
          <Text bold>{isAll ? 'All projects' : fit(nameOf(here), 30)}</Text>
          <Text dimColor>
            {`${open.length} open${decisions > 0 ? `, ${decisions} to decide` : ''}`}
          </Text>
        </Box>
        <Box flexDirection="row" columnGap={1}>
          <Button
            key="scope"
            label={isAll ? 'This project' : 'All projects'}
            onPress={() =>
              update($, view, (one): BacklogView => ({
                ...one,
                scope: one.scope === 'all' ? 'project' : 'all',
              }))
            }
          />
          <Button
            key="closed"
            label={held.showClosed ? 'Hide closed' : 'Show closed'}
            onPress={() =>
              update($, view, one => ({ ...one, showClosed: !one.showClosed }))
            }
          />
        </Box>
        {groups.length === 0 && (
          <Box marginTop={1}>
            <Text dimColor wrap="wrap">
              Nothing open. Claude records defects, issues, tasks and decisions
              here as work turns them up.
            </Text>
          </Box>
        )}
        {groups.map(group => (
          <Box marginTop={1} flexDirection="column">
            <Box flexDirection="row" columnGap={1}>
              <Text bold>{HEADING[group.category]}</Text>
              <Text dimColor>{String(group.members.length)}</Text>
            </Box>
            {group.members.map(one => {
              const origin = isAll ? ` · ${nameOf(one.project)}` : ''
              const label = `${MARK[one.status]}${one.title}${origin}`

              return (
                <Box flexDirection="row">
                  <Text {...tone(one.priority)}>{`${TAG[one.priority]} `}</Text>
                  <Button
                    plain
                    key={`open:${one.id}`}
                    label={fit(label, columns - 6)}
                    dimColor={!isOpen(one)}
                    onPress={() => show($, one.id)}
                  />
                </Box>
              )
            })}
          </Box>
        ))}
      </Box>
    )
  })
}
