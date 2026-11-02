import { useId, useRef } from 'react'
import { ImagePlus, Plus, Trash2, Upload } from 'lucide-react'
import type { Highlight, ProfileInfo } from '../types'
import { ACCEPT_ATTRIBUTE } from '../lib/images'
import { createId } from '../lib/id'
import { BIO_LIMIT, HIGHLIGHT_LIMIT, HIGHLIGHT_TITLE_LIMIT, cleanUsername, initials } from '../lib/ui'

interface ProfileFormProps {
  profile: ProfileInfo
  avatarUrl: string | undefined
  resolveUrl: (id: string | null) => string | undefined
  onChange: (patch: Partial<ProfileInfo>) => void
  onAvatarFile: (file: File) => void
  onRemoveAvatar: () => void
  onHighlightCover: (highlightId: string, file: File) => void
}

function FilePicker({ onFile, children, className, label }: { onFile: (file: File) => void; children: React.ReactNode; className: string; label?: string }) {
  const input = useRef<HTMLInputElement>(null)
  return (
    <>
      <button type="button" className={className} onClick={() => input.current?.click()} aria-label={label}>
        {children}
      </button>
      <input
        ref={input}
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) onFile(file)
        }}
      />
    </>
  )
}

export function ProfileForm({ profile, avatarUrl, resolveUrl, onChange, onAvatarFile, onRemoveAvatar, onHighlightCover }: ProfileFormProps) {
  const id = useId()
  const updateHighlight = (hid: string, patch: Partial<Highlight>) => onChange({ highlights: profile.highlights.map((h) => (h.id === hid ? { ...h, ...patch } : h)) })

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="size-14 shrink-0 overflow-hidden rounded-full border border-line bg-subtle">
          {avatarUrl ? (
            <img src={avatarUrl} alt="Profile photo" className="size-full object-cover" />
          ) : (
            <span className="flex size-full items-center justify-center text-sm font-semibold text-muted">{initials(profile.displayName || profile.username)}</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <FilePicker onFile={onAvatarFile} className="btn btn-secondary h-8 px-3 text-xs">
            <Upload className="size-3.5" aria-hidden />
            {avatarUrl ? 'Change photo' : 'Upload photo'}
          </FilePicker>
          {avatarUrl && (
            <button type="button" className="btn btn-ghost h-8 px-3 text-xs text-muted" onClick={onRemoveAvatar}>
              Remove
            </button>
          )}
        </div>
      </div>

      <div>
        <label htmlFor={`${id}-username`} className="label">
          Username
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted">@</span>
          <input
            id={`${id}-username`}
            className="field pl-7"
            value={profile.username}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => onChange({ username: cleanUsername(e.target.value) })}
          />
        </div>
        <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-muted">
          <input type="checkbox" className="size-3.5 accent-[var(--app-accent)]" checked={profile.verified} onChange={(e) => onChange({ verified: e.target.checked })} />
          Show verified badge
        </label>
      </div>

      <div>
        <label htmlFor={`${id}-name`} className="label">
          Display name
        </label>
        <input id={`${id}-name`} className="field" value={profile.displayName} maxLength={64} onChange={(e) => onChange({ displayName: e.target.value })} />
      </div>

      <div>
        <label htmlFor={`${id}-category`} className="label">
          Category <span className="font-normal">(optional)</span>
        </label>
        <input id={`${id}-category`} className="field" value={profile.category} maxLength={40} placeholder="e.g. Artist, Photographer" onChange={(e) => onChange({ category: e.target.value })} />
      </div>

      <div>
        <div className="flex items-baseline justify-between">
          <label htmlFor={`${id}-bio`} className="label">
            Bio
          </label>
          <span className="text-[11px] text-muted tabular-nums">
            {profile.bio.length}/{BIO_LIMIT}
          </span>
        </div>
        <textarea
          id={`${id}-bio`}
          className="field min-h-24 resize-y leading-relaxed"
          value={profile.bio}
          maxLength={BIO_LIMIT}
          rows={4}
          onChange={(e) => onChange({ bio: e.target.value })}
        />
      </div>

      <div>
        <label htmlFor={`${id}-link`} className="label">
          Link <span className="font-normal">(optional)</span>
        </label>
        <input id={`${id}-link`} className="field" value={profile.link} maxLength={80} placeholder="yourwebsite.com" inputMode="url" spellCheck={false} onChange={(e) => onChange({ link: e.target.value })} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor={`${id}-followers`} className="label">
            Followers
          </label>
          <input id={`${id}-followers`} className="field" value={profile.followers} maxLength={12} onChange={(e) => onChange({ followers: e.target.value })} />
        </div>
        <div>
          <label htmlFor={`${id}-following`} className="label">
            Following
          </label>
          <input id={`${id}-following`} className="field" value={profile.following} maxLength={12} onChange={(e) => onChange({ following: e.target.value })} />
        </div>
      </div>

      <fieldset>
        <legend className="label flex w-full items-baseline justify-between">
          Story highlights
          <span className="text-[11px] font-normal tabular-nums">
            {profile.highlights.length}/{HIGHLIGHT_LIMIT}
          </span>
        </legend>
        <ul className="space-y-2">
          {profile.highlights.map((h, i) => {
            const url = resolveUrl(h.coverId)
            return (
              <li key={h.id} className="flex items-center gap-2">
                <FilePicker
                  onFile={(file) => onHighlightCover(h.id, file)}
                  label={`${url ? 'Change' : 'Choose'} cover for highlight ${i + 1}`}
                  className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-subtle text-muted hover:border-accent"
                >
                  {url ? <img src={url} alt="" className="size-full object-cover" /> : <ImagePlus className="size-4" aria-hidden />}
                </FilePicker>
                <input
                  className="field h-9"
                  aria-label={`Highlight ${i + 1} title`}
                  placeholder="Title"
                  maxLength={HIGHLIGHT_TITLE_LIMIT}
                  value={h.title}
                  onChange={(e) => updateHighlight(h.id, { title: e.target.value })}
                />
                <button
                  type="button"
                  className="btn btn-ghost btn-icon shrink-0 text-muted hover:text-danger"
                  aria-label={`Remove highlight ${h.title || i + 1}`}
                  onClick={() => onChange({ highlights: profile.highlights.filter((x) => x.id !== h.id) })}
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </li>
            )
          })}
        </ul>
        <button
          type="button"
          className="btn btn-secondary mt-2 h-8 w-full text-xs"
          disabled={profile.highlights.length >= HIGHLIGHT_LIMIT}
          onClick={() => onChange({ highlights: [...profile.highlights, { id: createId(), title: '', coverId: null }] })}
        >
          <Plus className="size-3.5" aria-hidden /> Add highlight
        </button>
      </fieldset>

      <p className="text-xs leading-relaxed text-muted">
        These details are placeholders for your preview. FeedPlanner isn’t connected to Instagram and never posts for you.
      </p>
    </div>
  )
}
