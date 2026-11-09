/**
 * Registers the service worker in production builds so FeedPlanner opens offline and
 * can be installed as an app. In development it's skipped to keep hot reloading simple.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .then(async (registration) => {
        await navigator.serviceWorker.ready
        const urls = performance
          .getEntriesByType('resource')
          .map((entry) => entry.name)
          .filter((url) => new URL(url).origin === location.origin)
        ;(registration.active ?? navigator.serviceWorker.controller)?.postMessage({ type: 'cache-urls', urls })
      })
      .catch(() => undefined)
  })
}
