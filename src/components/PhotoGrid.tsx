import { useCallback, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import type { FeedFilter, LoadedImage, PostDetails, TileAspect } from '../types'
import type { ColorInfo } from '../lib/colors'
import { GridPhotoTile, TileImage, type GridView } from './GridPhotoTile'
import { getPost } from '../lib/posts'
import { aspectClass } from '../lib/ui'
import { gridPosition, moveItem } from '../lib/grid'

interface PhotoGridProps {
  order: string[]
  images: ReadonlyMap<string, LoadedImage>
  aspect: TileAspect
  selectedIds: ReadonlySet<string>
  view: GridView
  posts: Record<string, PostDetails>
  filter: FeedFilter
  nextId: string | null
  conflicts: ReadonlySet<string>
  colors: ReadonlyMap<string, ColorInfo>
  similar: ReadonlySet<string>
  onSelect: (id: string, additive: boolean) => void
  onReorder: (order: string[]) => void
}

function describe(order: string[], id: string | number) {
  const index = order.indexOf(String(id))
  const { row, column } = gridPosition(index)
  return `row ${row}, column ${column}`
}

export function PhotoGrid({ order, images, aspect, selectedIds, view, posts, filter, nextId, conflicts, colors, similar, onSelect, onReorder }: PhotoGridProps) {
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    // A small distance lets a simple click select a photo instead of starting a drag.
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Press-and-hold on touch so the page can still scroll.
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space', 'Enter'] },
    }),
  )

  const handleStart = useCallback((event: DragStartEvent) => setActiveId(String(event.active.id)), [])
  const handleEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null)
      const { active, over } = event
      if (!over || active.id === over.id) return
      const from = order.indexOf(String(active.id))
      const to = order.indexOf(String(over.id))
      if (from !== -1 && to !== -1) onReorder(moveItem(order, from, to))
    },
    [order, onReorder],
  )

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up photo at ${describe(order, active.id)}. Use arrow keys to move, space to drop, escape to cancel.`,
    onDragOver: ({ over }) => (over ? `Photo is over ${describe(order, over.id)}.` : 'Photo is not over a grid position.'),
    onDragEnd: ({ over }) => (over ? `Photo dropped at ${describe(order, over.id)}.` : 'Photo dropped.'),
    onDragCancel: () => 'Moving cancelled. The photo returned to its original position.',
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleStart}
      onDragEnd={handleEnd}
      onDragCancel={() => setActiveId(null)}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable: 'To select this photo press Enter. To move it, press Space, use the arrow keys, then press Space again to drop.',
        },
      }}
    >
      <SortableContext items={order} strategy={rectSortingStrategy}>
        <ul className="grid grid-cols-3 gap-[2px]" aria-label="Planned grid">
          {order.map((id, index) => (
            <GridPhotoTile
              key={id}
              id={id}
              index={index}
              total={order.length}
              image={images.get(id)}
              aspect={aspect}
              selected={selectedIds.has(id)}
              view={view}
              post={getPost(posts, id)}
              filter={filter}
              isNext={nextId === id}
              conflict={conflicts.has(id)}
              colors={colors.get(id)}
              similar={similar.has(id)}
              onSelect={onSelect}
            />
          ))}
        </ul>
      </SortableContext>
      <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)' }}>
        {activeId ? (
          <div className={`${aspectClass[aspect]} scale-[1.04] overflow-hidden rounded-sm shadow-2xl ring-2 ring-accent`}>
            <TileImage image={images.get(activeId)} crop={getPost(posts, activeId).crop} filter={filter} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
