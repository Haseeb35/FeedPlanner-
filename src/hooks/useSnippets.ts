import { useSyncExternalStore } from 'react'
import { loadSnippets, subscribeSnippets, type Snippet } from '../lib/snippets'

/** The saved hashtag sets and snippets, kept in sync across components and tabs. */
export function useSnippets(): Snippet[] {
  return useSyncExternalStore(subscribeSnippets, loadSnippets, loadSnippets)
}
