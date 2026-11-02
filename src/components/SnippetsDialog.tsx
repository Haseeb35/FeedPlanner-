import { useState } from 'react'
import { Hash, PenLine, Plus, Trash2, Type } from 'lucide-react'
import { Dialog } from './Dialog'
import { useSnippets } from '../hooks/useSnippets'
import { useToast } from '../providers/contexts'
import { CAPTION_LIMIT, HASHTAG_LIMIT, countHashtags } from '../lib/posts'
import { SNIPPET_LIMIT, SNIPPET_NAME_LIMIT, normalizeHashtagText, saveSnippets, type Snippet, type SnippetKind } from '../lib/snippets'
import { createId } from '../lib/id'
import { pluralize } from '../lib/format'

interface SnippetsDialogProps {
  open: boolean
  /** Pre-fills a new hashtag set, e.g. with the hashtags of the current caption. */
  draft?: { kind: SnippetKind; text: string } | null
  onClose: () => void
}

type Draft = Omit<Snippet, 'id'> & { id: string | null }

const blank = (kind: SnippetKind = 'hashtags', text = ''): Draft => ({ id: null, kind, name: '', text })

export function SnippetsDialog({ open, draft, onClose }: SnippetsDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="md"
      title="Hashtag sets & snippets"
      description="Save hashtags and lines you use often, then add them to any caption with one click. They’re shared by all your projects."
    >
      <SnippetsEditor key={draft ? `${draft.kind}:${draft.text}` : 'new'} initial={draft ? blank(draft.kind, draft.text) : null} />
    </Dialog>
  )
}

function SnippetsEditor({ initial }: { initial: Draft | null }) {
  const toast = useToast()
  const snippets = useSnippets()
  const [editing, setEditing] = useState<Draft | null>(initial)

  const persist = (list: Snippet[]) => {
    if (!saveSnippets(list)) toast('Couldn’t save', { tone: 'error', description: 'This browser is blocking storage for FeedPlanner.' })
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!editing) return
    const text = editing.kind === 'hashtags' ? normalizeHashtagText(editing.text) : editing.text.trim()
    if (!text) return
    const name = editing.name.trim() || (editing.kind === 'hashtags' ? 'Hashtag set' : text.slice(0, SNIPPET_NAME_LIMIT))
    const saved: Snippet = { id: editing.id ?? createId(), kind: editing.kind, name, text }
    persist(editing.id ? snippets.map((s) => (s.id === editing.id ? saved : s)) : [...snippets, saved])
    toast(editing.id ? 'Saved' : `“${name}” saved`, editing.id ? undefined : { description: 'Find it under any caption.' })
    setEditing(null)
  }

  const remove = (snippet: Snippet) => {
    const before = snippets
    persist(snippets.filter((s) => s.id !== snippet.id))
    toast(`“${snippet.name}” deleted`, { action: { label: 'Undo', onClick: () => persist(before) } })
  }

  const tags = editing?.kind === 'hashtags' ? countHashtags(normalizeHashtagText(editing.text)) : 0

  return (
    <div className="space-y-4">
      {snippets.length > 0 ? (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line" aria-label="Saved snippets">
          {snippets.map((s) => (
            <li key={s.id} className="flex items-start gap-3 px-3 py-2.5">
              <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-subtle text-muted">
                {s.kind === 'hashtags' ? <Hash className="size-3.5" aria-hidden /> : <Type className="size-3.5" aria-hidden />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{s.name}</p>
                <p className="line-clamp-2 text-xs break-words text-muted">{s.text}</p>
              </div>
              <button type="button" className="btn btn-ghost btn-icon h-8 w-8" onClick={() => setEditing({ ...s })} aria-label={`Edit ${s.name}`} title="Edit">
                <PenLine className="size-3.5" aria-hidden />
              </button>
              <button type="button" className="btn btn-ghost btn-icon h-8 w-8 text-danger" onClick={() => remove(s)} aria-label={`Delete ${s.name}`} title="Delete">
                <Trash2 className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        !editing && (
          <div className="rounded-xl bg-subtle px-4 py-5 text-center">
            <Hash className="mx-auto size-6 text-accent" aria-hidden />
            <p className="mt-2 text-sm font-medium">No saved sets yet</p>
            <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-muted">
              For example a “Ceramics” set with your go-to hashtags, or a sign-off like “New pieces every Friday — link in bio”.
            </p>
          </div>
        )
      )}

      {editing ? (
        <form onSubmit={submit} className="animate-fade-up space-y-3 rounded-xl border border-line p-3.5" aria-label={editing.id ? 'Edit snippet' : 'New snippet'}>
          <div className="flex gap-1 rounded-lg bg-subtle p-1 text-sm" role="radiogroup" aria-label="Kind">
            {(
              [
                ['hashtags', 'Hashtag set', Hash],
                ['text', 'Text snippet', Type],
              ] as const
            ).map(([kind, label, Icon]) => (
              <button
                key={kind}
                type="button"
                role="radio"
                aria-checked={editing.kind === kind}
                onClick={() => setEditing({ ...editing, kind })}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 ${editing.kind === kind ? 'bg-surface font-medium shadow-sm' : 'text-muted hover:text-fg'}`}
              >
                <Icon className="size-3.5" aria-hidden /> {label}
              </button>
            ))}
          </div>
          <div>
            <label htmlFor="snippet-name" className="label">
              Name
            </label>
            <input
              id="snippet-name"
              className="field"
              maxLength={SNIPPET_NAME_LIMIT}
              value={editing.name}
              placeholder={editing.kind === 'hashtags' ? 'e.g. Ceramics' : 'e.g. Shop sign-off'}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
            />
          </div>
          <div>
            <div className="flex items-baseline justify-between">
              <label htmlFor="snippet-text" className="label">
                {editing.kind === 'hashtags' ? 'Hashtags' : 'Text'}
              </label>
              {editing.kind === 'hashtags' && <span className={`text-[11px] tabular-nums ${tags > HASHTAG_LIMIT ? 'text-danger' : 'text-muted'}`}>{pluralize(tags, 'hashtag')}</span>}
            </div>
            <textarea
              id="snippet-text"
              className="field min-h-20 resize-y leading-relaxed"
              maxLength={CAPTION_LIMIT}
              value={editing.text}
              autoFocus
              placeholder={editing.kind === 'hashtags' ? '#ceramics #handmade #pottery — the # is optional' : 'New pieces every Friday — link in bio'}
              onChange={(e) => setEditing({ ...editing, text: e.target.value })}
            />
            {editing.kind === 'hashtags' && <p className="mt-1 text-[11px] text-muted">Separate with spaces or commas. Duplicates are removed.</p>}
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={!editing.text.trim()}>
              {editing.id ? 'Save changes' : 'Save'}
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className="btn btn-secondary w-full" onClick={() => setEditing(blank())} disabled={snippets.length >= SNIPPET_LIMIT}>
          <Plus className="size-4" aria-hidden /> New hashtag set or snippet
        </button>
      )}
    </div>
  )
}
