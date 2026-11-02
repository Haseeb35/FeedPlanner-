import type { ReactNode } from 'react'
import { BadgeCheck, Contact, Grid3x3, House, Link2, Menu, Plus, Search, SquarePlay, SquarePlus } from 'lucide-react'
import type { Project } from '../types'
import { initials } from '../lib/ui'

interface InstagramProfilePreviewProps {
  project: Project
  avatarUrl: string | undefined
  resolveUrl: (id: string | null) => string | undefined
  onEditProfile: () => void
  children: ReactNode
}

export function VerifiedBadge({ className = 'size-4.5' }: { className?: string }) {
  return <BadgeCheck className={`${className} shrink-0 fill-[#0095f6] text-white`} aria-label="Verified" />
}

/**
 * A local mock of a profile page. All text comes from the user's own placeholder
 * fields; nothing here is connected to Instagram.
 */
export function InstagramProfilePreview({ project, avatarUrl, resolveUrl, onEditProfile, children }: InstagramProfilePreviewProps) {
  const { profile } = project
  const stats: [string, string][] = [
    [String(project.order.length), project.order.length === 1 ? 'post' : 'posts'],
    [profile.followers || '0', 'followers'],
    [profile.following || '0', 'following'],
  ]
  const link = profile.link.trim().replace(/^https?:\/\//, '')

  return (
    <section aria-label="Profile preview" className="overflow-hidden rounded-[22px] border border-line bg-white text-[#0f0f0f] shadow-soft dark:bg-black dark:text-[#f5f5f5]">
      <div className="group relative px-4 pt-5 pb-4 transition-colors hover:bg-black/[0.02] sm:px-5 dark:hover:bg-white/[0.03]">
        {/* Stretched button: the whole header opens the profile editor. */}
        <button type="button" onClick={onEditProfile} className="absolute inset-0 z-10 rounded-t-[22px] focus-visible:outline-offset-[-2px]" aria-label="Edit profile details" />
        <span aria-hidden className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-black/5 px-2 py-1 text-[11px] font-medium text-[#555] opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 dark:bg-white/10 dark:text-[#ccc]">
          Edit
        </span>
        <div className="flex items-center gap-5 sm:gap-6">
          <div className="size-[72px] shrink-0 overflow-hidden rounded-full border border-[#dbdbdb] bg-[#efefef] sm:size-[86px] dark:border-[#262626] dark:bg-[#1c1c1c]">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="size-full object-cover" />
            ) : (
              <span className="flex size-full items-center justify-center text-xl font-semibold text-[#737373] dark:text-[#a8a8a8]">
                {initials(profile.displayName || profile.username)}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="flex min-w-0 items-center gap-1.5 text-[17px] font-semibold sm:text-lg">
              <span className="truncate">{profile.username || 'username'}</span>
              {profile.verified && <VerifiedBadge />}
            </p>
            <dl className="mt-2 grid grid-cols-3 gap-1">
              {stats.map(([value, label]) => (
                <div key={label} className="min-w-0">
                  <dt className="sr-only">{label}</dt>
                  <dd className="truncate text-[15px] leading-tight font-semibold tabular-nums">{value}</dd>
                  <dd aria-hidden className="text-[13px] text-[#737373] dark:text-[#a8a8a8]">
                    {label}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
        {profile.displayName.trim() && <p className="mt-3.5 text-sm font-semibold">{profile.displayName}</p>}
        {profile.category.trim() && <p className="text-sm text-[#737373] dark:text-[#a8a8a8]">{profile.category}</p>}
        {profile.bio.trim() && <p className="mt-0.5 line-clamp-6 text-sm leading-[1.35] break-words whitespace-pre-line">{profile.bio}</p>}
        {link && (
          <p className="mt-0.5 flex items-center gap-1 text-sm font-semibold text-[#00376b] dark:text-[#e0f1ff]">
            <Link2 className="size-3.5 shrink-0 -rotate-45" aria-hidden />
            <span className="truncate">{link}</span>
          </p>
        )}

        {profile.highlights.length > 0 && (
          <ul className="relative z-20 mt-4 -mr-4 flex gap-4 overflow-x-auto pr-4 pb-1 [scrollbar-width:none] sm:-mr-5" aria-label="Story highlights">
            {profile.highlights.map((h) => {
              const url = resolveUrl(h.coverId)
              return (
                <li key={h.id} className="flex w-16 shrink-0 flex-col items-center gap-1.5">
                  <span className="flex size-16 items-center justify-center rounded-full border border-[#dbdbdb] p-[3px] dark:border-[#363636]">
                    <span className="size-full overflow-hidden rounded-full bg-[#efefef] dark:bg-[#1c1c1c]">{url && <img src={url} alt="" className="size-full object-cover" />}</span>
                  </span>
                  <span className="w-full truncate text-center text-xs font-medium">{h.title || ' '}</span>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="grid grid-cols-3 border-t border-[#dbdbdb] dark:border-[#262626]" aria-hidden>
        <span className="flex h-11 items-center justify-center border-b-2 border-current">
          <Grid3x3 className="size-5.5" />
        </span>
        <span className="flex h-11 items-center justify-center text-[#a8a8a8] dark:text-[#737373]">
          <SquarePlay className="size-5.5" />
        </span>
        <span className="flex h-11 items-center justify-center text-[#a8a8a8] dark:text-[#737373]">
          <Contact className="size-5.5" />
        </span>
      </div>

      {children}
    </section>
  )
}

/** Wraps the preview in a phone outline with Instagram-style top and bottom bars. */
export function PhoneFrame({ username, verified, avatarUrl, children }: { username: string; verified: boolean; avatarUrl: string | undefined; children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[400px] rounded-[48px] bg-[#1b1b1d] p-[11px] shadow-2xl ring-1 ring-black/40 dark:ring-white/10">
      <div className="relative overflow-hidden rounded-[38px] bg-white text-[#0f0f0f] dark:bg-black dark:text-[#f5f5f5]">
        <div className="flex h-11 items-center justify-between px-7 pt-1 text-[13px] font-semibold" aria-hidden>
          <span>9:41</span>
          <span className="absolute top-2.5 left-1/2 h-[26px] w-[92px] -translate-x-1/2 rounded-full bg-black" />
          <span className="flex items-center gap-1">
            <span className="flex h-2.5 items-end gap-px">
              {[4, 6, 8, 10].map((h) => (
                <span key={h} className="w-[3px] rounded-[1px] bg-current" style={{ height: h }} />
              ))}
            </span>
            <span className="ml-1 h-[11px] w-[22px] rounded-[3px] border border-current p-px">
              <span className="block h-full w-3/4 rounded-[1px] bg-current" />
            </span>
          </span>
        </div>
        <div className="flex h-11 items-center gap-2 px-4" aria-hidden>
          <span className="flex min-w-0 items-center gap-1 text-lg font-bold">
            <span className="truncate">{username || 'username'}</span>
            {verified && <VerifiedBadge className="size-4" />}
          </span>
          <span className="ml-auto flex items-center gap-5">
            <SquarePlus className="size-6" />
            <Menu className="size-6" />
          </span>
        </div>
        <div className="max-h-[680px] overflow-y-auto [scrollbar-width:none] [&>section]:rounded-none [&>section]:border-0 [&>section]:shadow-none">{children}</div>
        <div className="flex h-14 items-center justify-around border-t border-[#dbdbdb] pb-1 dark:border-[#262626]" aria-hidden>
          <House className="size-6" />
          <Search className="size-6" />
          <Plus className="size-6 rounded-md border-2 border-current p-0.5" />
          <SquarePlay className="size-6" />
          <span className="size-6 overflow-hidden rounded-full border-2 border-current bg-[#efefef] dark:bg-[#1c1c1c]">{avatarUrl && <img src={avatarUrl} alt="" className="size-full object-cover" />}</span>
        </div>
        <div className="flex justify-center pb-2" aria-hidden>
          <span className="h-1 w-32 rounded-full bg-current opacity-80" />
        </div>
      </div>
    </div>
  )
}
