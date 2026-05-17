import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

const LIMIT = 30
const WINDOW_MS = 60_000

export async function GET() {
  try {
    const contacts = await prisma.relationshipMemory.findMany({
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(contacts)
  } catch {
    return NextResponse.json([], { status: 200 })
  }
}

export async function POST(req: Request) {
  const rl = checkRateLimit(`${getClientIp(req)}:contacts:write`, LIMIT, WINDOW_MS)
  if (!rl.success) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })
  try {
    const body = await req.json()
    const contact = await prisma.relationshipMemory.create({
      data: {
        contactName: body.contactName,
        contactType: body.contactType ?? 'influencer',
        platform: body.platform ?? '',
        followers: body.followers ?? null,
        status: body.status ?? 'prospect',
        notes: body.notes ?? null,
      },
    })
    return NextResponse.json(contact)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to create contact'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  const rl = checkRateLimit(`${getClientIp(req)}:contacts:write`, LIMIT, WINDOW_MS)
  if (!rl.success) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })
  try {
    const body = await req.json()
    const { id, ...data } = body
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const updated = await prisma.relationshipMemory.update({
      where: { id },
      data,
    })
    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  const rl = checkRateLimit(`${getClientIp(req)}:contacts:write`, LIMIT, WINDOW_MS)
  if (!rl.success) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })
  try {
    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    await prisma.relationshipMemory.delete({ where: { id } })
    return NextResponse.json({ deleted: true })
  } catch {
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
}
