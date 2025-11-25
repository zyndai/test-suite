import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json({
    message: 'Hello from Next.js API!',
    time: new Date().toISOString(),
  })
}
