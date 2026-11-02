import { useState } from 'react'
import { ArrowRight, Check, CircleCheck, ClipboardCopy, Clapperboard, Copy, Download, ExternalLink, ImagePlus, LoaderCircle, PartyPopper, Send, TriangleAlert } from 'lucide-react'
import type { FeedFilter, LoadedImage, PostDetails, TileAspect } from '../types'
import { Dialog } from './Dialog'
import { TileImage } from './GridPhotoTile'
import { useToast } from '../providers/contexts'
import { getImage } from '../lib/db'
import { HASHTAG_LIMIT, countHashtags, formatPlanned, isNeutralFilter } from '../lib/posts'
import { canShareFiles, copyText, shareFile } from '../lib/share'
import { aspectClass } from '../lib/ui'

export interface PostNowTarget {
  id: string
  number: number
  total: number
  image: LoadedImage | undefined
  post: PostDetails
}

interface PostNowDialogProps {
  target: PostNowTarget | null
  /** The post that should go up first, when it isn't this one. */
  next: { id: string; number: number } | null
  /** What comes after this post, for the "done" screen. */
  after: { id: string; number: number; post: PostDetails } | null
  postedCount: number
  aspect: TileAspect
  filter: FeedFilter
  onMarkPosted: (id: string) => void
  onOpen: (id: string) => void
  onAddPhoto: (id: string) => void
  onClose: () => void
}

const isPhone = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)

/**
 * Guides publishing one post: copy the caption, hand the photo to Instagram (through the share
 * sheet on phones, or as a download on computers), then tick it off. FeedPlanner never posts by
 * itself; that needs Instagram’s official API and a server.
 */
export function PostNowDialog(props: PostNowDialogProps) {
  const { target, onClose } = props
  return (
    <Dialog
      open={target !== null}
      onClose={onClose}
      size="md"
      title={target ? `Post now · post ${target.number} of ${target.total}` : 'Post now'}
      description="Three quick steps. FeedPlanner doesn’t post for you — you publish in the Instagram app."
    >
      {target && <PostNowContent key={target.id} {...props} target={target} />}
    </Dialog>
  )
}

type Phase = 'steps' | 'done'

function Step({ n, done, title, children }: { n: number; done: boolean; title: string; children?: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums ${done ? 'bg-success text-white dark:text-[#06210f]' : 'bg-subtle text-fg'}`}
        aria-hidden
      >
        {done ? <Check className="size-3.5" strokeWidth={3} /> : n}
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-sm font-medium">
          {title}
          {done && <span className="sr-only"> (done)</span>}
        </p>
        {children}
      </div>
    </li>
  )
}

function PostNowContent({ target, next, after, postedCount, aspect, filter, onMarkPosted, onOpen, onAddPhoto, onClose }: PostNowDialogProps & { target: PostNowTarget }) {
  const toast = useToast()
  const { id, number, total, image, post } = target
  const [phase, setPhase] = useState<Phase>(post.posted ? 'done' : 'steps')
  const [copied, setCopied] = useState(false)
  const [sent, setSent] = useState<'shared' | 'downloaded' | null>(null)
  const [busy, setBusy] = useState(false)
  const empty = !!image?.slot
  const caption = post.caption.trim()
  const fileShare = canShareFiles([new File([''], 'photo.jpg', { type: 'image/jpeg' })])
  const typeLabel = post.type === 'reel' ? 'Reel' : post.type === 'carousel' ? 'Carousel' : 'Photo'

  const copy = async () => {
    const ok = await copyText(caption)
    setCopied(ok)
    if (!ok) toast('Couldn’t copy the caption', { tone: 'error', description: 'Select the text and copy it manually.' })
    return ok
  }

  const sendPhoto = async () => {
    setBusy(true)
    try {
      // Copy first: the caption is ready to paste by the time Instagram opens.
      if (caption && !copied) await copy()
      const stored = await getImage(id)
      if (!stored) throw new Error('missing')
      const ext = stored.type === 'image/png' ? 'png' : stored.type === 'image/webp' ? 'webp' : 'jpg'
      const name = /\.[a-z0-9]+$/i.test(stored.name) ? stored.name : `${stored.name}.${ext}`
      const outcome = await shareFile(new File([stored.blob], name, { type: stored.type }), `Post ${number}`, caption || undefined)
      if (outcome !== 'cancelled') setSent(outcome)
    } catch {
      toast('Couldn’t open this photo', { tone: 'error', description: 'It may have been removed. Try replacing it.' })
    } finally {
      setBusy(false)
    }
  }

  const markPosted = () => {
    onMarkPosted(id)
    setPhase('done')
  }

  if (phase === 'done') {
    const remaining = total - postedCount
    return (
      <div className="animate-fade-up py-2 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-success/15 text-success">
          {remaining === 0 ? <PartyPopper className="size-6" aria-hidden /> : <CircleCheck className="size-6" aria-hidden />}
        </span>
        <p className="mt-3 text-base font-semibold">{remaining === 0 ? 'Your whole plan is posted!' : `Post ${number} is ticked off`}</p>
        <p className="mt-1 text-sm text-muted">
          {postedCount} of {total} posted
          {remaining > 0 && after ? ` · next up is post ${after.number}${after.post.date ? `, planned for ${formatPlanned(after.post)}` : ''}.` : '.'}
        </p>
        <div className="mx-auto mt-3 h-1.5 max-w-60 overflow-hidden rounded-full bg-subtle" aria-hidden>
          <div className="h-full rounded-full bg-success transition-[width]" style={{ width: `${(postedCount / Math.max(1, total)) * 100}%` }} />
        </div>
        <div className="mt-6 flex justify-center gap-2">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Done
          </button>
          {after && remaining > 0 && (
            <button type="button" className="btn btn-primary" onClick={() => onOpen(after.id)}>
              Get post {after.number} ready <ArrowRight className="size-4" aria-hidden />
            </button>
          )}
        </div>
      </div>
    )
  }

  const warnings: { key: string; text: React.ReactNode }[] = []
  if (next && next.id !== id)
    warnings.push({
      key: 'order',
      text: (
        <>
          Post {next.number} should go up before this one, or your grid will end up in a different order.{' '}
          <button type="button" className="font-medium underline" onClick={() => onOpen(next.id)}>
            Post {next.number} instead
          </button>
        </>
      ),
    })
  if (countHashtags(caption) > HASHTAG_LIMIT) warnings.push({ key: 'tags', text: `This caption has more than ${HASHTAG_LIMIT} hashtags. Instagram will refuse it.` })

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-[6.5rem_1fr] gap-4">
        <div className={`${aspectClass[aspect]} overflow-hidden rounded-lg border border-line bg-subtle`}>
          <TileImage image={image} crop={post.crop} filter={filter} />
        </div>
        <div className="min-w-0 space-y-1.5 text-sm">
          <p className="flex items-center gap-1.5 font-medium">
            {post.type === 'reel' ? <Clapperboard className="size-4" aria-hidden /> : post.type === 'carousel' ? <Copy className="size-4" aria-hidden /> : null}
            {typeLabel}
            {formatPlanned(post) && <span className="font-normal text-muted">· {formatPlanned(post)}</span>}
          </p>
          <p className={`line-clamp-4 text-xs leading-relaxed break-words whitespace-pre-line ${caption ? 'text-muted' : 'text-muted italic'}`}>{caption || 'No caption planned.'}</p>
        </div>
      </div>

      {warnings.map((w) => (
        <p key={w.key} className="flex gap-2 rounded-lg bg-amber-400/15 px-3 py-2.5 text-xs leading-relaxed text-amber-800 dark:text-amber-300">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>{w.text}</span>
        </p>
      ))}

      {empty ? (
        <div className="rounded-xl border border-dashed border-line-strong p-4 text-center">
          <p className="text-sm font-medium">This spot doesn’t have a photo yet</p>
          <p className="mt-1 text-xs text-muted">{image?.slot?.note ? `The plan says: “${image.slot.note}”.` : 'Add the photo you want to post here.'}</p>
          <button type="button" className="btn btn-primary mt-3" onClick={() => onAddPhoto(id)}>
            <ImagePlus className="size-4" aria-hidden /> Add photo here
          </button>
        </div>
      ) : (
        <ol className="space-y-4" aria-label="Steps">
          <Step n={1} done={copied || !caption} title={caption ? 'Copy the caption' : 'No caption to copy'}>
            {caption && (
              <button type="button" className="btn btn-secondary mt-2 h-8 text-xs" onClick={() => void copy()}>
                {copied ? <Check className="size-3.5 text-success" aria-hidden /> : <ClipboardCopy className="size-3.5" aria-hidden />}
                {copied ? 'Copied — paste it in Instagram' : 'Copy caption'}
              </button>
            )}
          </Step>
          <Step n={2} done={sent !== null} title={fileShare ? 'Send the photo to Instagram' : 'Save the photo, then open Instagram'}>
            <p className="mt-0.5 text-xs leading-relaxed text-muted">
              {fileShare
                ? 'Opens your share menu — pick Instagram, then Feed. Paste the caption when asked.'
                : isPhone
                  ? 'Your browser can’t open the share menu, so the photo is saved to your downloads. Open it from Instagram.'
                  : 'The photo is downloaded. Upload it at instagram.com with “Create”, or send it to your phone.'}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" className="btn btn-primary h-9" onClick={() => void sendPhoto()} disabled={busy}>
                {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : fileShare ? <Send className="size-4" aria-hidden /> : <Download className="size-4" aria-hidden />}
                {fileShare ? (caption && !copied ? 'Copy caption & share photo' : 'Share photo') : caption && !copied ? 'Copy caption & download photo' : 'Download photo'}
              </button>
              {!fileShare && !isPhone && (
                <a className="btn btn-secondary h-9" href="https://www.instagram.com/" target="_blank" rel="noreferrer">
                  Open Instagram <ExternalLink className="size-3.5" aria-hidden />
                </a>
              )}
            </div>
            {post.type === 'carousel' && <p className="mt-2 text-xs text-muted">It’s a carousel: add the other slides in Instagram before posting.</p>}
            {post.type === 'reel' && <p className="mt-2 text-xs text-muted">It’s a Reel: pick your video in Instagram and use this photo as its cover.</p>}
            {!isNeutralFilter(filter) && <p className="mt-2 text-xs text-muted">The Feed look is only a preview here — recreate it with Instagram’s edit tools.</p>}
          </Step>
          <Step n={3} done={false} title="Publish, then tick it off">
            <p className="mt-0.5 text-xs leading-relaxed text-muted">Marking it as posted moves your plan on to the next post.</p>
            <button type="button" className="btn btn-secondary mt-2 h-9 border-success/50 text-success hover:border-success hover:bg-success/10" onClick={markPosted}>
              <CircleCheck className="size-4" aria-hidden /> Mark as posted
            </button>
          </Step>
        </ol>
      )}
    </div>
  )
}
