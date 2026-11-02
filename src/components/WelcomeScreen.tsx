import { useEffect, useRef, useState } from 'react'
import { ArchiveRestore, ArrowRight, Grid3x3, HardDrive, ImagePlus, Lightbulb, ListOrdered, LoaderCircle, Send } from 'lucide-react'
import { BACKUP_EXTENSION } from '../lib/backup'
import { Logo } from './Logo'
import { ThemeToggle } from './ThemeToggle'
import { DEMO_SPECS, generateDemoImage } from '../lib/demo'
import { useObjectUrls } from '../hooks/useObjectUrls'

interface WelcomeScreenProps {
  busy: 'create' | 'demo' | null
  onCreate: () => void
  onDemo: () => void
  onRestore: (file: File) => void
  onTemplates: () => void
}

const steps = [
  { icon: ImagePlus, title: 'Add your photos', text: 'Drop in the shots you plan to post. They never leave your browser.' },
  { icon: Grid3x3, title: 'Arrange the grid', text: 'Drag photos around and see your profile update instantly.' },
  { icon: ListOrdered, title: 'Plan every post', text: 'Captions, dates and a numbered posting order you can tick off.' },
  { icon: Send, title: 'Post each day', text: 'Today shows what’s due. Post now copies the caption and hands the photo to Instagram.' },
]

function GridPreview() {
  const [blobs, setBlobs] = useState<ReadonlyMap<string, Blob>>(() => new Map())
  const urls = useObjectUrls(blobs)

  useEffect(() => {
    let cancelled = false
    Promise.all(DEMO_SPECS.slice(0, 9).map((spec, i) => generateDemoImage(spec, i + 1, 240, 320)))
      .then((list) => {
        if (!cancelled) setBlobs(new Map(list.map((blob, i) => [String(i), blob])))
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="mx-auto w-full max-w-[340px] overflow-hidden rounded-[22px] border border-line bg-white shadow-soft dark:bg-black" aria-hidden>
      <div className="flex items-center gap-4 px-4 pt-4 pb-3">
        <div className="size-14 rounded-full bg-gradient-to-br from-[#e8a36b] to-[#8a3b22]" />
        <div className="flex-1 space-y-2">
          <div className="h-2.5 w-24 rounded-full bg-[#0f0f0f]/80 dark:bg-white/80" />
          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-1">
                <div className="h-2 w-6 rounded-full bg-[#0f0f0f]/70 dark:bg-white/70" />
                <div className="h-1.5 w-10 rounded-full bg-[#0f0f0f]/20 dark:bg-white/25" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="space-y-1.5 px-4 pb-4">
        <div className="h-2 w-20 rounded-full bg-[#0f0f0f]/70 dark:bg-white/70" />
        <div className="h-1.5 w-44 rounded-full bg-[#0f0f0f]/20 dark:bg-white/25" />
      </div>
      <div className="grid grid-cols-3 gap-[2px] border-t border-[#dbdbdb] pt-[2px] dark:border-[#262626]">
        {Array.from({ length: 9 }, (_, i) => (
          <div key={i} className="aspect-[3/4] bg-[#efefef] dark:bg-[#1c1c1c]">
            {urls.get(String(i)) && <img src={urls.get(String(i))} alt="" className="animate-pop size-full object-cover" style={{ animationDelay: `${i * 40}ms` }} />}
          </div>
        ))}
      </div>
    </div>
  )
}

export function WelcomeScreen({ busy, onCreate, onDemo, onRestore, onTemplates }: WelcomeScreenProps) {
  const restoreInput = useRef<HTMLInputElement>(null)
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <ThemeToggle />
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <section className="grid items-center gap-12 py-10 md:grid-cols-[1.1fr_1fr] md:py-16 lg:gap-16">
          <div className="animate-fade-up">
            <p className="eyebrow text-accent">Instagram grid planner</p>
            <h1 className="mt-3 text-[2.25rem] leading-[1.08] font-semibold tracking-tight text-balance sm:text-5xl">See your profile before you post.</h1>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-muted sm:text-base">
              Upload photos, drag them into a three-column grid and preview exactly how your profile will look. Then follow the posting order to make it real.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button type="button" className="btn btn-primary h-11 px-5 text-[15px]" onClick={onCreate} disabled={busy !== null}>
                {busy === 'create' ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : null}
                Create your first grid
                {busy !== 'create' && <ArrowRight className="size-4" aria-hidden />}
              </button>
              <button type="button" className="btn btn-secondary h-11 px-5 text-[15px]" onClick={onDemo} disabled={busy !== null}>
                {busy === 'demo' && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
                {busy === 'demo' ? 'Preparing demo…' : 'Try a demo'}
              </button>
            </div>
            <p className="mt-3 text-xs text-muted">New here? The demo is a ready-made plan you can explore and change freely.</p>
            <button type="button" className="mt-4 flex items-center gap-2 text-sm font-medium text-accent hover:underline" onClick={onTemplates} disabled={busy !== null}>
              <Lightbulb className="size-4" aria-hidden />
              Or start from a feed idea
            </button>
            <p className="mt-5 flex items-center gap-2 text-xs text-muted">
              <HardDrive className="size-3.5" aria-hidden />
              No account needed. Your photos stay in this browser.
            </p>
            <button type="button" className="mt-2 flex items-center gap-2 text-xs font-medium text-muted underline-offset-2 hover:text-fg hover:underline" onClick={() => restoreInput.current?.click()} disabled={busy !== null}>
              <ArchiveRestore className="size-3.5" aria-hidden />
              Have a backup? Restore it
            </button>
            <input
              ref={restoreInput}
              type="file"
              accept={`${BACKUP_EXTENSION},application/octet-stream`}
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (file) onRestore(file)
              }}
            />
          </div>
          <GridPreview />
        </section>

        <section aria-label="How it works" className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(({ icon: Icon, title, text }, i) => (
            <div key={title} className="bg-surface p-5">
              <div className="flex items-center gap-2.5">
                <span className="flex size-8 items-center justify-center rounded-lg bg-subtle">
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className="text-xs font-medium text-muted tabular-nums">0{i + 1}</span>
              </div>
              <h2 className="mt-3 text-sm font-semibold">{title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted">{text}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  )
}
