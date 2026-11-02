import { useRef, useState, type ReactNode } from 'react'
import { ImagePlus } from 'lucide-react'
import { ACCEPT_ATTRIBUTE } from '../lib/images'
import { hasFiles } from '../lib/ui'

interface UploadDropzoneProps {
  onFiles: (files: File[]) => void
  compact?: boolean
  title?: string
  multiple?: boolean
  children?: ReactNode
}

export function UploadDropzone({ onFiles, compact = false, title = 'Add photos', multiple = true, children }: UploadDropzoneProps) {
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)

  return (
    <div
      onDragOver={(event) => {
        if (!hasFiles(event)) return
        event.preventDefault()
        event.stopPropagation()
        event.dataTransfer.dropEffect = 'copy'
        setOver(true)
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) setOver(false)
      }}
      onDrop={(event) => {
        if (!hasFiles(event)) return
        event.preventDefault()
        event.stopPropagation()
        setOver(false)
        onFiles(Array.from(event.dataTransfer.files))
      }}
    >
      <button
        type="button"
        onClick={() => input.current?.click()}
        className={`group flex w-full flex-col items-center justify-center rounded-xl border border-dashed text-center transition-colors ${
          over ? 'border-accent bg-accent-soft' : 'border-line-strong hover:border-accent hover:bg-subtle/60'
        } ${compact ? 'gap-1.5 px-4 py-5' : 'gap-3 px-6 py-10'}`}
      >
        <span
          className={`flex items-center justify-center rounded-full bg-subtle text-fg transition-colors group-hover:bg-accent-soft group-hover:text-accent ${compact ? 'size-9' : 'size-12'}`}
        >
          <ImagePlus className={compact ? 'size-4.5' : 'size-5.5'} aria-hidden />
        </span>
        <span className={`font-medium ${compact ? 'text-sm' : 'text-[15px]'}`}>{over ? 'Drop to add' : title}</span>
        <span className="text-xs text-muted">{children ?? `Drag ${multiple ? 'photos' : 'a photo'} here or click to browse · JPG, PNG, WebP`}</span>
      </button>
      <input
        ref={input}
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        multiple={multiple}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          const files = Array.from(event.target.files ?? [])
          event.target.value = ''
          if (files.length) onFiles(files)
        }}
      />
    </div>
  )
}
