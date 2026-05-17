export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Prevent pg Pool EventEmitter errors from crashing worker processes
    // when the database is temporarily unavailable at startup
    process.on('unhandledRejection', (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[worker] Unhandled rejection (non-fatal):', msg)
    })
    process.on('uncaughtException', (err: Error) => {
      console.error('[worker] Uncaught exception (non-fatal):', err.message)
    })

    const { scheduleAll } = await import('./lib/scheduler')
    scheduleAll()
  }
}
