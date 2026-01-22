import { NextResponse, NextRequest } from 'next/server'
// @ts-expect-error - x402-next types misconfigured (points to non-existent dist/index.d.ts)
import { withX402 } from 'x402-next'

async function handler(_request: NextRequest) {
  return NextResponse.json({
    message: 'Hello from Next.js API!',
    time: new Date().toISOString(),
  })
}

export const POST = withX402(
  handler,
  "0xd5148b96d3f6f3234721c72ec8a57a4b07a45ca7",
  {
    price: '$0.01',
    network: "base-sepolia",
    config: {
      description: 'Access to protected content',
    },
  },
  {
    url: "https://x402.org/facilitator",
  }
)
