import { NextResponse } from 'next/server'
import { getRecentBrainActivity } from '@/lib/brain'

export async function GET() {
  try {
    const activity = await getRecentBrainActivity(8)
    return NextResponse.json(activity)
  } catch {
    return NextResponse.json([], { status: 200 })
  }
}
