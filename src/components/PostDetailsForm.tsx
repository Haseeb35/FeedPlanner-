import { useId, useState } from 'react'
import { CalendarX2, Check, ClipboardCopy, Hash, Plus, Settings2, TriangleAlert, Type } from 'lucide-react'
import type { PostDetails } from '../types'
import { CAPTION_LIMIT, HASHTAG_LIMIT, POST_TYPES, countHashtags } from '../lib/posts'
import { useToast } from '../providers/contexts'
import { copyText } from '../lib/share'
import { duplicateHashtags, extractHashtags, insertSnippet, type Snippet, type SnippetKind } from '../lib/snippets'
import { useSnippets } from '../hooks/useSnippets'
import { pluralize } from '../lib/format'
import { SnippetsDialog } from './SnippetsDialog'

interface PostDetailsFormProps {
  post: PostDetails
  conflict: boolean
  onChange: (patch: Partial<PostDetails>) => void
}

/** Caption, schedule, post type and posted status for one photo. */
export function PostDetailsForm({ post, conflict, onChange }: PostDetailsFormProps) {
  const id = useId()
  const toast = useToast()
  const hashtags = countHashtags(post.caption)
  const duplicates = duplicateHashtags(post.caption)
  const snippets = useSnippets()
  const [library, setLibrary] = useState<{ draft: { kind: SnippetKind; text: string } | null } | null>(null)

  const insert = (snippet: Snippet) => {
    const result = insertSnippet(post.caption, snippet)
    if (result.caption === post.caption) {
      toast('Already in this caption', { description: snippet.kind === 'hashtags' ? 'Every hashtag in this set is already there.' : undefined })
      return
    }
    onChange({ caption: result.caption })
    const notes = [result.skipped && `${pluralize(result.skipped, 'hashtag')} already there, skipped`, result.truncated && 'cut to fit Instagram’s 2,200-character limit'].filter(Boolean)
    toast(`“${snippet.name}” added`, { description: notes.length ? `${notes.join('; ')}.` : undefined, tone: result.truncated ? 'error' : undefined })
  }
  const captionTags = extractHashtags(post.caption)

  const copy = async () => {
    const ok = await copyText(post.caption)
    toast(ok ? 'Caption copied' : 'Couldn’t copy the caption', ok ? undefined : { tone: 'error', description: 'Select the text and copy it manually.' })
  }

  return (
    <div className="space-y-4">
      <label className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${post.posted ? 'border-success/40 bg-success/10' : 'border-line hover:border-line-strong'}`}>
        <input type="checkbox" className="peer sr-only" checked={post.posted} onChange={(e) => onChange({ posted: e.target.checked })} />
        <span
          className={`flex size-5 shrink-0 items-center justify-center rounded-md border peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring ${
            post.posted ? 'border-success bg-success text-white' : 'border-line-strong bg-surface'
          }`}
          aria-hidden
        >
          {post.posted && <Check className="size-3.5" strokeWidth={3} />}
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-medium">{post.posted ? 'Posted' : 'Mark as posted'}</span>
          <span className="block text-xs text-muted">{post.posted ? 'Ticked off in your posting plan.' : 'Tick this once it’s live on Instagram.'}</span>
        </span>
      </label>

      <fieldset>
        <legend className="label">Post type</legend>
        <div className="flex gap-1 rounded-lg bg-subtle p-1">
          {POST_TYPES.map((option) => (
            <label
              key={option.value}
              className={`flex-1 cursor-pointer rounded-md px-2 py-1.5 text-center text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring ${
                post.type === option.value ? 'bg-surface font-medium shadow-sm' : 'text-muted hover:text-fg'
              }`}
            >
              <input type="radio" className="sr-only" name={`${id}-type`} checked={post.type === option.value} onChange={() => onChange({ type: option.value })} />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <div className="flex items-baseline justify-between">
          <label htmlFor={`${id}-caption`} className="label">
            Caption
          </label>
          <span className={`text-[11px] tabular-nums ${hashtags > HASHTAG_LIMIT ? 'font-medium text-danger' : 'text-muted'}`}>
            {hashtags}/{HASHTAG_LIMIT} # · {post.caption.length}/{CAPTION_LIMIT}
          </span>
        </div>
        <textarea
          id={`${id}-caption`}
          className="field min-h-28 resize-y leading-relaxed"
          value={post.caption}
          maxLength={CAPTION_LIMIT}
          rows={5}
          placeholder="Write a caption… #hashtags work too"
          onChange={(e) => onChange({ caption: e.target.value })}
        />
        {hashtags > HASHTAG_LIMIT && <p className="mt-1 text-xs text-danger">Instagram allows up to {HASHTAG_LIMIT} hashtags per post.</p>}
        {duplicates.length > 0 && (
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
            Used twice: {duplicates.join(' ')}. Instagram only counts each hashtag once.
          </p>
        )}

        <div className="mt-2 rounded-lg border border-dashed border-line p-2" role="group" aria-label="Hashtag sets and snippets">
          {snippets.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {snippets.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="inline-flex max-w-full items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-1 text-xs hover:border-accent hover:text-accent"
                  onClick={() => insert(s)}
                  title={s.text}
                  aria-label={`Add ${s.name}`}
                >
                  {s.kind === 'hashtags' ? <Hash className="size-3 shrink-0" aria-hidden /> : <Type className="size-3 shrink-0" aria-hidden />}
                  <span className="truncate">{s.name}</span>
                </button>
              ))}
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-muted hover:bg-subtle hover:text-fg"
                onClick={() => setLibrary({ draft: null })}
              >
                <Settings2 className="size-3" aria-hidden /> Manage
              </button>
            </div>
          ) : (
            <p className="px-1 text-xs leading-relaxed text-muted">
              <span className="font-medium text-fg">Tip:</span> save hashtags you reuse as a set, then add them to any caption in one click.
            </p>
          )}
          <button
            type="button"
            className="mt-1.5 inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-xs font-medium text-accent hover:underline"
            onClick={() => setLibrary({ draft: captionTags.length ? { kind: 'hashtags', text: captionTags.join(' ') } : null })}
          >
            <Plus className="size-3" aria-hidden /> {captionTags.length > 1 ? `Save these ${captionTags.length} hashtags as a set` : captionTags.length ? 'Save this hashtag as a set' : 'New hashtag set'}
          </button>
        </div>
        <SnippetsDialog open={library !== null} draft={library?.draft} onClose={() => setLibrary(null)} />
        <button type="button" className="btn btn-secondary mt-2 h-8 w-full text-xs" onClick={() => void copy()} disabled={!post.caption.trim()}>
          <ClipboardCopy className="size-3.5" aria-hidden /> Copy caption
        </button>
      </div>

      <div>
        <p className="label" id={`${id}-when`}>
          Planned for
        </p>
        <div className="flex flex-wrap gap-2" role="group" aria-labelledby={`${id}-when`}>
          <input
            type="date"
            aria-label="Planned date"
            className="field min-w-[9.5rem] flex-[3]"
            value={post.date ?? ''}
            onChange={(e) => onChange({ date: e.target.value || null, time: e.target.value ? post.time : null })}
          />
          <input
            type="time"
            aria-label="Planned time"
            className="field min-w-[8.5rem] flex-[2]"
            value={post.time ?? ''}
            disabled={!post.date}
            onChange={(e) => onChange({ time: e.target.value || null })}
          />
          {post.date && (
            <button type="button" className="btn btn-ghost btn-icon shrink-0" aria-label="Clear planned date" title="Clear date" onClick={() => onChange({ date: null, time: null })}>
              <CalendarX2 className="size-4" aria-hidden />
            </button>
          )}
        </div>
        {conflict && (
          <p className="mt-2 flex gap-1.5 rounded-lg bg-amber-400/15 px-2.5 py-2 text-xs leading-relaxed text-amber-800 dark:text-amber-300">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            This date is out of order with the posting plan. Publishing it early would shuffle your grid.
          </p>
        )}
      </div>
    </div>
  )
}
