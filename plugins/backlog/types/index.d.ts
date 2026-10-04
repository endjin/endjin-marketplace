export type BacklogCategory = 'decision' | 'defect' | 'issue' | 'task'

export type BacklogPriority = 'critical' | 'high' | 'medium' | 'low'

export type BacklogStatus = 'open' | 'in_progress' | 'done' | 'dismissed'

/** One choice of a decision item; `detail` is '' when the label says it all. */
export type BacklogOption = { label: string; detail: string }

/** One item as its file under `<config>/backlog/items/<id>.json` holds it. */
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
  /** The project root of the session that recorded it, forward slashes. */
  project: string
  sessionId: string
  createdAt: number
  updatedAt: number
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
