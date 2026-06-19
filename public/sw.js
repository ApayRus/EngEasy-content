const clearCaches = async () => {
  const cacheNames = await caches.keys()
  await Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)))
}

self.addEventListener('install', event => {
  self.skipWaiting()
  event.waitUntil(clearCaches())
})

self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      await clearCaches()
      await self.registration.unregister()

      const clientsList = await self.clients.matchAll({
        includeUncontrolled: true,
        type: 'window'
      })

      for (const client of clientsList) {
        client.navigate(client.url)
      }
    })()
  )
})
