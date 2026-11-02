import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { CornerDownLeft, Search } from 'lucide-react'
import type { FeedFilter, LoadedImage } from '../types'
import { TileImage } from './GridPhotoTile'

export interface Command {
  id: string
  label: string
  group: string
  icon: ReactNode
  /** Keyboard shortcut shown on the right, e.g. "Ctrl+Z". */
  hint?: string
  /** Extra words people might type, e.g. "upload" for "Add photos". */
  keywords?: string
  run: () => void
}

export interface SearchablePost {
  id: string
  number: number
  caption: string
  name: string
  image: LoadedImage | undefined
}

interface CommandPaletteProps {
  open: boolean
  commands: Command[]
  posts: SearchablePost[]
  filter: FeedFilter
  onOpenPost: (id: string) => void
  onClose: () => void
}

type Item = { kind: 'command'; command: Command } | { kind: 'post'; post: SearchablePost }

const words = (text: string) => text.toLowerCase().split(/\s+/).filter(Boolean)

function matches(haystack: string, query: string[]) {
  const text = haystack.toLowerCase()
  return query.every((w) => text.includes(w))
}

/** Ctrl+K: type to find any action, project or post. */
export function CommandPalette({ open, commands, posts, filter, onOpenPost, onClose }: CommandPaletteProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal?.()
    else if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-label="Search and actions"
      className="animate-pop mx-auto mt-[12vh] mb-auto max-h-[70dvh] w-[calc(100%-2rem)] max-w-xl overflow-hidden rounded-2xl border border-line bg-surface p-0 text-fg shadow-soft"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      {open && <PaletteBody commands={commands} posts={posts} filter={filter} onOpenPost={onOpenPost} onClose={onClose} />}
    </dialog>
  )
}

function PaletteBody({ commands, posts, filter, onOpenPost, onClose }: Omit<CommandPaletteProps, 'open'>) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLUListElement>(null)
  const id = useId()

  const items = useMemo<Item[]>(() => {
    const q = words(query)
    const cmds = commands.filter((c) => matches(`${c.label} ${c.group} ${c.keywords ?? ''}`, q)).map((command): Item => ({ kind: 'command', command }))
    if (!q.length) return cmds
    const numberQuery = /^(?:post\s*)?(\d+)$/i.exec(query.trim())
    const found = posts
      .filter((p) => (numberQuery ? p.number === Number(numberQuery[1]) : matches(`${p.caption} ${p.name}`, q)))
      .slice(0, 8)
      .map((post): Item => ({ kind: 'post', post }))
    return [...cmds, ...found]
  }, [query, commands, posts])

  const current = Math.min(active, Math.max(0, items.length - 1))

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${current}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [current])

  const run = (item: Item | undefined) => {
    if (!item) return
    onClose()
    // Let the palette close first so dialogs opened by the command can take focus.
    requestAnimationFrame(() => (item.kind === 'command' ? item.command.run() : onOpenPost(item.post.id)))
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') setActive((current + 1) % Math.max(1, items.length))
    else if (event.key === 'ArrowUp') setActive((current - 1 + items.length) % Math.max(1, items.length))
    else if (event.key === 'Home') setActive(0)
    else if (event.key === 'End') setActive(items.length - 1)
    else if (event.key === 'Enter') run(items[current])
    else return
    event.preventDefault()
  }

  const groupOf = (item: Item | undefined) => (item ? (item.kind === 'command' ? item.command.group : 'Posts') : '')
  return (
    <div className="flex max-h-[70dvh] flex-col">
      <div className="flex items-center gap-2.5 border-b border-line px-4">
        <Search className="size-4 shrink-0 text-muted" aria-hidden />
        <input
          autoFocus
          role="combobox"
          aria-expanded
          aria-controls={`${id}-list`}
          aria-activedescendant={items.length ? `${id}-${current}` : undefined}
          aria-label="Search actions, projects and posts"
          className="h-13 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted"
          placeholder="Search actions, projects or captions…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(0)
          }}
          onKeyDown={onKeyDown}
        />
        <kbd className="hidden rounded border border-line px-1.5 py-0.5 text-[11px] text-muted sm:block">Esc</kbd>
      </div>
      <ul ref={listRef} id={`${id}-list`} role="listbox" aria-label="Results" className="min-h-0 flex-1 overflow-y-auto p-2">
        {items.length === 0 && (
          <li className="px-3 py-8 text-center text-sm text-muted" role="presentation">
            Nothing matches “{query}”. Try “calendar”, “share” or words from a caption.
          </li>
        )}
        {items.map((item, index) => {
          const group = groupOf(item)
          const heading = group !== groupOf(items[index - 1])
          const selected = index === current
          return (
            <li key={item.kind === 'command' ? item.command.id : `post-${item.post.id}`} role="presentation">
              {heading && (
                <p className="eyebrow px-3 pt-3 pb-1.5 first:pt-1" role="presentation">
                  {group}
                </p>
              )}
              <div
                id={`${id}-${index}`}
                role="option"
                aria-selected={selected}
                data-index={index}
                onPointerMove={() => active !== index && setActive(index)}
                onClick={() => run(item)}
                className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm ${selected ? 'bg-subtle' : ''}`}
              >
                {item.kind === 'command' ? (
                  <>
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-line bg-surface text-muted">{item.command.icon}</span>
                    <span className="min-w-0 flex-1 truncate">{item.command.label}</span>
                    {item.command.hint && <kbd className="hidden shrink-0 rounded sm:block border border-line px-1.5 py-0.5 text-[11px] text-muted">{item.command.hint}</kbd>}
                  </>
                ) : (
                  <>
                    <span className="size-8 shrink-0 overflow-hidden rounded-md bg-subtle">
                      <TileImage image={item.post.image} filter={filter} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm">Post {item.post.number}</span>
                      <span className="block truncate text-xs text-muted">{item.post.caption.trim() || item.post.name}</span>
                    </span>
                  </>
                )}
                {selected && <CornerDownLeft className="size-3.5 shrink-0 text-muted" aria-hidden />}
              </div>
            </li>
          )
        })}
      </ul>
      <p className="hidden border-t border-line px-4 py-2 text-[11px] text-muted sm:block">
        <kbd className="font-sans">↑</kbd> <kbd className="font-sans">↓</kbd> to move · <kbd className="font-sans">Enter</kbd> to choose · type a post number like “7” to jump to it
      </p>
    </div>
  )
}
