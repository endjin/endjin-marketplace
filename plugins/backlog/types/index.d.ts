export type BacklogCategory = 'decision' | 'defect' | 'issue' | 'task'

export type BacklogPriority = 'critical' | 'high' | 'medium' | 'low'

export type BacklogStatus = 'open' | 'in_progress' | 'done' | 'dismissed'

/** One choice of a decision item; `detail` is '' when the label says it all. */
export type BacklogOption = { label: string; detail: string }

/** Markdown appended to an item after it was recorded, and when. */
export type BacklogNote = { at: number; text: string }

/** One item, as its change records under `<config>/backlog/items/` fold. */
export type BacklogItem = {
  id: string
  title: string
  category: BacklogCategory
  priority: BacklogPriority
  status: BacklogStatus
  /** Markdown, written to stand alone: what, where, why it matters. */
  detail: string
  options: BacklogOption[]
  /** What Claude would do; '' when it recorded none. */
  recommendation: string
  /** What was decided or how it ended; '' until then. */
  resolution: string
  notes: BacklogNote[]
  /** The project root of the session that recorded it, forward slashes. */
  project: string
  /** The session that recorded it. */
  sessionId: string
  /** When its first and its latest change record were written. */
  createdAt: number
  updatedAt: number
}

/** The fields of an item a change record may set. */
export type BacklogFields = Pick<
  BacklogItem,
  | 'title'
  | 'category'
  | 'priority'
  | 'status'
  | 'detail'
  | 'options'
  | 'recommendation'
  | 'resolution'
  | 'project'
>

/**
 * One change to one item: a file `<id>.<time>.<token>.json`, written once and
 * never rewritten, so two sessions changing an item never overwrite each other.
 * An item is its records in `at` order, each setting the fields it names.
 */
export type BacklogChange = {
  id: string
  at: number
  sessionId: string
  set: Partial<BacklogFields>
  /** Appended to the item's notes; '' for none. */
  note: string
}

export type BacklogView = {
  /** The item open in the detail view, or null for the list. */
  selected: string | null
  scope: 'project' | 'all'
  showClosed: boolean
}

declare module 'claude-code' {
  interface PluginState {
    backlog: {
      items: BacklogItem[]
      view: BacklogView
      project: string
    }
  }
}
