import { describe, expect, it } from 'vitest'
import { HISTORY_LIMIT, emptyHistory, gridPosition, insertIds, moveItem, postingNumber, record, redo, removeId, replaceId, rowCount, undo } from './grid'

describe('grid ordering', () => {
  it('moves an item forward and backward', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd'])
    expect(moveItem(['a', 'b', 'c', 'd'], 3, 0)).toEqual(['d', 'a', 'b', 'c'])
  })

  it('clamps out-of-range targets and ignores invalid sources', () => {
    expect(moveItem(['a', 'b', 'c'], 1, 99)).toEqual(['a', 'c', 'b'])
    expect(moveItem(['a', 'b', 'c'], 1, -5)).toEqual(['b', 'a', 'c'])
    expect(moveItem(['a', 'b'], 5, 0)).toEqual(['a', 'b'])
  })

  it('does not mutate the input', () => {
    const list = ['a', 'b', 'c']
    moveItem(list, 0, 2)
    expect(list).toEqual(['a', 'b', 'c'])
  })

  it('inserts new ids at the start or end without duplicates', () => {
    expect(insertIds(['a', 'b'], ['x', 'y'], 'start')).toEqual(['x', 'y', 'a', 'b'])
    expect(insertIds(['a', 'b'], ['x', 'a'], 'end')).toEqual(['a', 'b', 'x'])
  })

  it('removes and replaces ids', () => {
    expect(removeId(['a', 'b', 'c'], 'b')).toEqual(['a', 'c'])
    expect(replaceId(['a', 'b', 'c'], 'b', 'z')).toEqual(['a', 'z', 'c'])
  })

  it('numbers posts so the top-left photo is published last', () => {
    // 5 photos: index 0 (top-left) is post 5, the last index is post 1.
    expect([0, 1, 2, 3, 4].map((i) => postingNumber(i, 5))).toEqual([5, 4, 3, 2, 1])
  })

  it('computes grid positions and rows', () => {
    expect(gridPosition(0)).toEqual({ row: 1, column: 1 })
    expect(gridPosition(5)).toEqual({ row: 2, column: 3 })
    expect(rowCount(0)).toBe(0)
    expect(rowCount(7)).toBe(3)
  })
})

describe('history', () => {
  it('undoes and redoes order changes', () => {
    let present = ['a', 'b', 'c']
    let history = emptyHistory

    history = record(history, present)
    present = ['c', 'a', 'b']
    history = record(history, present)
    present = ['c', 'b']

    const u1 = undo(history, present)!
    expect(u1.present).toEqual(['c', 'a', 'b'])
    const u2 = undo(u1.history, u1.present)!
    expect(u2.present).toEqual(['a', 'b', 'c'])
    expect(undo(u2.history, u2.present)).toBeNull()

    const r1 = redo(u2.history, u2.present)!
    expect(r1.present).toEqual(['c', 'a', 'b'])
    const r2 = redo(r1.history, r1.present)!
    expect(r2.present).toEqual(['c', 'b'])
    expect(redo(r2.history, r2.present)).toBeNull()
  })

  it('clears redo after a new change and caps history length', () => {
    let history = record(emptyHistory, ['a'])
    const undone = undo(history, ['b'])!
    expect(undone.history.future).toHaveLength(1)
    history = record(undone.history, undone.present)
    expect(history.future).toHaveLength(0)

    let long = emptyHistory
    for (let i = 0; i < HISTORY_LIMIT + 20; i++) long = record(long, [String(i)])
    expect(long.past).toHaveLength(HISTORY_LIMIT)
    expect(long.past[long.past.length - 1]).toEqual([String(HISTORY_LIMIT + 19)])
  })
})
