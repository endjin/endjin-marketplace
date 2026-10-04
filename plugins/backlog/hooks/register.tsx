import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type {
  BacklogCategory,
  BacklogItem,
  BacklogOption,
  BacklogPriority,
  BacklogStatus,
  BacklogView,
} from '../types'

const PANE = 'backlog'
const POLL_MS = 5000

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

// File name to what was last read from it; `stamp` is the listing's time and
// size, '' for a file this session just wrote, so the next poll reads it back.
const known = new Map<string, { stamp: string; item: BacklogItem }>()
const unreadable = new Map<string, string>()
let hasLoaded = false
let queue: Promise<unknown> = Promise.resolve()

// Reads and writes of the folder run one at a time: a poll never loads a file
// a save is halfway through.
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

const oneOf = <T extends string>(
  allowed: readonly T[],
  value: unknown,
  fallback: T,
): T => allowed.find(one => one === value) ?? fallback

const record = (raw: unknown): Record<string, unknown> =>
  typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}

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

const ID = /^[a-z0-9]{4,12}$/

const toItem = (raw: unknown): BacklogItem | undefined => {
  const fields = record(raw)
  const id = typeof fields.id === 'string' && ID.test(fields.id) ? fields.id : ''
  const title = oneLine(fields.title, 200)

  if (id === '' || title === '') {
    return undefined
  }

  return {
    id,
    title,
    category: oneOf(CATEGORIES, fields.category, 'task'),
    priority: oneOf(PRIORITIES, fields.priority, 'medium'),
    status: oneOf(STATUSES, fields.status, 'open'),
    detail: clean(fields.detail, 20000),
    options: toOptions(fields.options),
    recommendation: clean(fields.recommendation, 2000),
    resolution: clean(fields.resolution, 2000),
    project: oneLine(fields.project, 500),
    sessionId: oneLine(fields.sessionId, 100),
    createdAt: Number(fields.createdAt) || 0,
    updatedAt: Number(fields.updatedAt) || 0,
  }
}

const slash = (path: string): string =>
  path.replace(/\\/g, '/').replace(/\/+$/, '')

const nameOf = (path: string): string =>
  path.split('/').filter(part => part !== '').at(-1) ?? path

const isOpen = (item: BacklogItem): boolean =>
  item.status === 'open' || item.status === 'in_progress'

const fit = (text: string, width: number): string =>
  text.length > width ? `${text.slice(0, Math.max(1, width - 1))}…` : text

const byUrgency = (a: BacklogItem, b: BacklogItem): number =>
  Number(isOpen(b)) - Number(isOpen(a)) ||
  PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority) ||
  b.updatedAt - a.updatedAt

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
): Promise<BacklogItem | undefined> => {
  try {
    return toItem(JSON.parse(await $.fs.read(path)))
  } catch {
    return undefined
  }
}

const publish = async ($: EngineInterface): Promise<void> => {
  const all = [...known.values()].map(held => held.item)
  await update($, items, () => all)

  const here = await read($, project)
  const open = all.filter(one => isOpen(one) && one.project === here)
  const decisions = open.filter(one => one.category === 'decision').length
  const toDecide = decisions > 0 ? `, ${decisions} to decide` : ''

  $.ui.status(
    open.length === 0 ? undefined : `backlog: ${open.length} open${toDecide}`,
  )
}

const write = async ($: EngineInterface, item: BacklogItem): Promise<void> => {
  const name = `${item.id}.json`
  await $.fs.write(
    `${await folder($)}/${name}`,
    `${JSON.stringify(item, null, 2)}\n`,
  )
  known.set(name, { stamp: '', item })
}

// Brings `known` level with the folder, which every session writes to.
const sync = ($: EngineInterface): Promise<void> =>
  inTurn(async () => {
    const dir = await folder($)
    const entries = (await $.fs.exists(dir)) ? await $.fs.list(dir) : []
    const names = new Set<string>()
    const arrived: BacklogItem[] = []
    let hasChanged = !hasLoaded

    for (const entry of entries) {
      if (entry.kind !== 'file' || !entry.name.endsWith('.json')) {
        continue
      }

      names.add(entry.name)
      const stamp = `${entry.mtimeMs}:${entry.size}`
      const held = known.get(entry.name)

      if (held?.stamp === stamp || unreadable.get(entry.name) === stamp) {
        continue
      }

      const item = await load($, `${dir}/${entry.name}`)

      if (item === undefined) {
        unreadable.set(entry.name, stamp)
        continue
      }

      if (held === undefined) {
        arrived.push(item)
      }

      unreadable.delete(entry.name)
      known.set(entry.name, { stamp, item })
      hasChanged = true
    }

    for (const name of [...known.keys()]) {
      if (!names.has(name)) {
        known.delete(name)
        hasChanged = true
      }
    }

    if (hasChanged) {
      await publish($)
    }

    const first = arrived[0]

    if (hasLoaded && first !== undefined) {
      $.ui.toast(
        arrived.length === 1
          ? `Backlog: ${fit(first.title, 60)} (${nameOf(first.project)})`
          : `Backlog: ${arrived.length} new items from other sessions`,
      )
    }

    hasLoaded = true
  })

// Edits one item from its file as it stands now, another session's writes
// included, and resolves the item as written; undefined when there is none.
const change = (
  $: EngineInterface,
  id: string,
  edit: (item: BacklogItem) => BacklogItem,
): Promise<BacklogItem | undefined> =>
  inTurn(async () => {
    const current = ID.test(id)
      ? await load($, `${await folder($)}/${id}.json`)
      : undefined

    if (current === undefined) {
      return undefined
    }

    const edited: BacklogItem = {
      ...edit(current),
      id: current.id,
      updatedAt: await $.clock.now(),
    }
    await write($, edited)
    await publish($)

    return edited
  })

const mint = (): string => {
  for (;;) {
    const id = Math.random().toString(36).slice(2, 6).padEnd(4, '0')

    if (!known.has(`${id}.json`)) {
      return id
    }
  }
}

const add = ($: EngineInterface, drafts: readonly unknown[]): Promise<string> =>
  inTurn(async () => {
    const here = await read($, project)
    const sessionId = await $.session.id()
    const now = await $.clock.now()
    const lines: string[] = []

    for (const draft of drafts.slice(0, 50)) {
      const fields = record(draft)
      const title = oneLine(fields.title, 200)

      if (title === '') {
        lines.push('- skipped an item with no title')
        continue
      }

      const twin = [...known.values()]
        .map(held => held.item)
        .find(
          one =>
            isOpen(one) &&
            one.project === here &&
            one.title.toLowerCase() === title.toLowerCase(),
        )
      const options = toOptions(fields.options)

      if (twin !== undefined) {
        await write($, {
          ...twin,
          priority: oneOf(PRIORITIES, fields.priority, twin.priority),
          detail: clean(fields.detail, 20000) || twin.detail,
          options: options.length > 0 ? options : twin.options,
          recommendation:
            clean(fields.recommendation, 2000) || twin.recommendation,
          updatedAt: now,
        })
        lines.push(`- ${twin.id}: already on the backlog, refreshed`)
        continue
      }

      const item: BacklogItem = {
        id: mint(),
        title,
        category: oneOf(CATEGORIES, fields.category, 'task'),
        priority: oneOf(PRIORITIES, fields.priority, 'medium'),
        status: 'open',
        detail: clean(fields.detail, 20000),
        options,
        recommendation: clean(fields.recommendation, 2000),
        resolution: '',
        project: here,
        sessionId,
        createdAt: now,
        updatedAt: now,
      }
      await write($, item)
      lines.push(`- ${item.id}: ${item.title}`)
    }

    await publish($)

    return lines.length === 0
      ? 'Nothing recorded: `items` was empty.'
      : `Recorded on the backlog:\n${lines.join('\n')}`
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
  ]
    .filter(part => part !== '')
    .join('\n\n')

const closing = (item: BacklogItem): string =>
  `When this is finished, call mcp__backlog__update for ${item.id} with status "done" and a one-line resolution. If it cannot be finished, add a note to the item saying what is in the way.`

// Hands an item to this session's Claude as the person's own prompt; it runs
// as a turn of its own once the session is idle.
const send = async (
  $: EngineInterface,
  item: BacklogItem,
  lead: string,
  resolution?: string,
): Promise<void> => {
  const sent = await change($, item.id, one => ({
    ...one,
    status: 'in_progress',
    resolution: resolution ?? one.resolution,
  }))

  if (sent === undefined) {
    $.ui.toast(`Backlog: ${item.id} is no longer there`)

    return
  }

  void $.prompt
    .submit({
      text: `${lead}\n\n${describe(sent)}\n\n${closing(sent)}`,
      asUser: true,
    })
    .catch(() => undefined)
  $.ui.toast(`Sent to Claude: ${fit(sent.title, 60)}`)
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
      description:
        'Markdown that stands alone for a reader who has not seen this session: what you observed, where (file:line), why it matters, what fixing it involves.',
    },
    options: {
      type: 'array',
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
    const root = slash(await $.session.root())
    await update($, project, () => root)

    await $.command.register({
      name: 'backlog',
      description:
        'Open the backlog pane: defects, issues, tasks and decisions from your sessions',
    })
    await $.tool.register({
      name: 'add',
      description:
        "Records items on the person's backlog pane: defects found, issues noticed, follow-up tasks, and decisions that need the person. Call it when a piece of work ends and leaves any of these, as well as mentioning them in the reply, and when you reach a choice that is the person's to make. One call takes several items. An open item with the same title in this project is refreshed, not duplicated.",
      inputSchema: {
        type: 'object',
        properties: {
          items: { type: 'array', minItems: 1, items: ITEM_SCHEMA },
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
            description: "Markdown appended to the item's detail.",
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
    const result = await add($, drafts)

    if (drafts.length > 0) {
      $.ui.toast(
        `Backlog: ${drafts.length} ${drafts.length === 1 ? 'item' : 'items'} recorded`,
      )
    }

    return { result }
  })

  on('tool.call', { tool: 'mcp__backlog__update' }, async ($, e) => {
    const id = oneLine(e.id, 12)
    const note = clean(e.note, 10000)
    const title = oneLine(e.title, 200)
    const stamp = new Date(await $.clock.now()).toISOString().slice(0, 10)
    const edited = await change($, id, one => ({
      ...one,
      title: title === '' ? one.title : title,
      status: oneOf(STATUSES, e.status, one.status),
      priority: oneOf(PRIORITIES, e.priority, one.priority),
      category: oneOf(CATEGORIES, e.category, one.category),
      detail:
        note === ''
          ? one.detail
          : `${one.detail}\n\n**Note, ${stamp}:** ${note}`.trim(),
      resolution: clean(e.resolution, 2000) || one.resolution,
    }))

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
      const recorded =
        selected.createdAt > 0
          ? new Date(selected.createdAt).toISOString().slice(0, 10)
          : ''
      const facts = [
        selected.category,
        `${selected.priority} priority`,
        STATUS[selected.status],
        nameOf(selected.project),
        recorded,
      ].filter(fact => fact !== '')
      const close = async (status: BacklogStatus) => {
        await change($, selected.id, one => ({ ...one, status }))
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
            <Box marginTop={1}>
              <Markdown text={selected.detail.slice(0, 9000)} />
            </Box>
          )}
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
                onPress={() =>
                  change($, selected.id, one => ({ ...one, status: 'open' }))
                }
              />
            )}
            {raised !== undefined && (
              <Button
                key="raise"
                label="Priority +"
                onPress={() =>
                  change($, selected.id, one => ({ ...one, priority: raised }))
                }
              />
            )}
            {lowered !== undefined && (
              <Button
                key="lower"
                label="Priority -"
                onPress={() =>
                  change($, selected.id, one => ({ ...one, priority: lowered }))
                }
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
