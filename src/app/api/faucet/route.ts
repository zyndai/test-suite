import { NextResponse, NextRequest } from 'next/server'
import { createWalletClient, createPublicClient, http, parseEther, formatEther } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { baseSepolia } from 'viem/chains'

// Store addresses that have received funds (in production, use Redis or a database)
const fundedAddresses = new Set<string>()

// Setup account from private key
const privateKey = process.env.PRIVATE_KEY
if (!privateKey) {
  console.error('ERROR: PRIVATE_KEY environment variable is required')
}

const account = privateKey ? privateKeyToAccount(privateKey as `0x${string}`) : null

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(process.env.RPC_URL || 'https://sepolia.base.org'),
})

const walletClient = account ? createWalletClient({
  account,
  chain: baseSepolia,
  transport: http(process.env.RPC_URL || 'https://sepolia.base.org'),
}) : null

export async function POST(request: NextRequest) {
  try {
    if (!account || !walletClient) {
      return NextResponse.json(
        { success: false, error: 'Faucet not configured. Missing PRIVATE_KEY.' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const { walletAddress } = body

    // Validate wallet address is provided
    if (!walletAddress) {
      return NextResponse.json(
        { success: false, error: 'Wallet address is required' },
        { status: 400 }
      )
    }

    // Validate wallet address format
    const addressRegex = /^0x[a-fA-F0-9]{40}$/
    if (!addressRegex.test(walletAddress)) {
      return NextResponse.json(
        { success: false, error: 'Invalid wallet address format' },
        { status: 400 }
      )
    }

    // Normalize address to lowercase for comparison
    const normalizedAddress = walletAddress.toLowerCase()

    // Check if address has already received funds
    if (fundedAddresses.has(normalizedAddress)) {
      return NextResponse.json(
        { success: false, error: 'This address has already received funds from the faucet' },
        { status: 400 }
      )
    }

    // Check faucet balance
    const faucetBalance = await publicClient.getBalance({
      address: account.address,
    })

    const amountToSend = parseEther('0.01')

    if (faucetBalance < amountToSend) {
      return NextResponse.json(
        { success: false, error: 'Faucet has insufficient balance. Please contact the administrator.' },
        { status: 500 }
      )
    }

    // Send transaction
    const hash = await walletClient.sendTransaction({
      to: walletAddress as `0x${string}`,
      value: amountToSend,
    })

    // Wait for transaction confirmation
    await publicClient.waitForTransactionReceipt({
      hash,
      confirmations: 1,
    })

    // Add address to funded list
    fundedAddresses.add(normalizedAddress)

    console.log(`Sent 0.01 ETH to ${walletAddress} - TX: ${hash}`)

    // Return success response
    return NextResponse.json({
      success: true,
      message: 'Successfully sent 0.01 ETH to your wallet',
      transactionHash: hash,
      amount: '0.01',
      recipient: walletAddress,
      explorerUrl: `https://sepolia.basescan.org/tx/${hash}`,
    })
  } catch (error: unknown) {
    console.error('Error sending funds:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    return NextResponse.json(
      { success: false, error: `Failed to send transaction: ${errorMessage}` },
      { status: 500 }
    )
  }
}

// Health check endpoint
export async function GET() {
  try {
    if (!account) {
      return NextResponse.json(
        { status: 'unhealthy', error: 'Faucet not configured' },
        { status: 500 }
      )
    }

    const balance = await publicClient.getBalance({
      address: account.address,
    })

    return NextResponse.json({
      status: 'healthy',
      faucetAddress: account.address,
      balance: formatEther(balance),
      network: 'Base Sepolia',
      fundedAddresses: fundedAddresses.size,
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { status: 'unhealthy', error: errorMessage },
      { status: 500 }
    )
  }
}
