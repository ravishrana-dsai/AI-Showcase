/**
 * Scheduled agent runner for ALWAYS-ON and WEEKLY tabs.
 *
 * Tab 04 (Listening)     — ALWAYS-ON  — every Monday 07:00
 * Tab 06 (SEO/GSO)       — WEEKLY     — every Monday 08:00
 * Tab 09 (Court Partner) — WEEKLY     — every Monday 09:00
 *
 * Runs server-side only (called from instrumentation.ts on server start).
 * Bypasses HTTP — calls generateContent + saveOutput directly.
 */

import cron from 'node-cron'
import { generateContent } from './ai'
import { getContextAsString, saveOutput } from './brain'
import { getListeningPrompt } from './prompts/listening'
import { getSEOGSOPrompt } from './prompts/seo-gso-content'
import { getCourtPartnerPrompt } from './prompts/court-partner'

type ScheduledJob = {
  agentTab: string
  cronExpression: string
  autoPrompt: string
  buildPrompt: (context: string) => string
}

const JOBS: ScheduledJob[] = [
  {
    agentTab: 'listening',
    cronExpression: '0 7 * * 1', // Monday 07:00
    autoPrompt: 'Weekly auto-run: community pulse, trending topics, competitor tracker, opportunity queue, Monday brand brief.',
    buildPrompt: getListeningPrompt,
  },
  {
    agentTab: 'seo-gso-content',
    cronExpression: '0 8 * * 1', // Monday 08:00
    autoPrompt: 'Weekly auto-run: refresh SEO content priorities, GSO optimization targets, and keyword opportunities for the week.',
    buildPrompt: getSEOGSOPrompt,
  },
  {
    agentTab: 'court-partner',
    cronExpression: '0 9 * * 1', // Monday 09:00
    autoPrompt: 'Weekly auto-run: generate court partner outreach templates and partnership opportunity briefs for the week.',
    buildPrompt: getCourtPartnerPrompt,
  },
]

async function runJob(job: ScheduledJob): Promise<void> {
  console.log(`[scheduler] Running ${job.agentTab} at ${new Date().toISOString()}`)

  try {
    const context = await getContextAsString()
    const systemPrompt = job.buildPrompt(context)
    const inputPrompt = `[AUTO] ${job.autoPrompt}`

    const result = await generateContent(job.agentTab, systemPrompt, inputPrompt)

    await saveOutput({
      agentTab: job.agentTab,
      inputPrompt,
      outputContent: result.content,
      modelUsed: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      costUsd: result.costUsd,
    })

    console.log(`[scheduler] ${job.agentTab} complete — ${result.outputTokens} tokens, $${result.costUsd.toFixed(4)}`)
  } catch (err) {
    console.error(`[scheduler] ${job.agentTab} failed:`, err)
  }
}

let started = false

export function scheduleAll(): void {
  if (started) return
  started = true

  for (const job of JOBS) {
    cron.schedule(job.cronExpression, () => {
      runJob(job).catch((err) =>
        console.error(`[scheduler] Unhandled error in ${job.agentTab}:`, err)
      )
    })
    console.log(`[scheduler] Registered ${job.agentTab} — "${job.cronExpression}"`)
  }
}
