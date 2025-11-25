import { paymentMiddleware } from 'x402-next'

export const middleware = paymentMiddleware(
  "0xd5148b96d3f6f3234721c72ec8a57a4b07a45ca7",
  {  
    '/api/pay': {
      price: '$0.01',         
      network: "base-sepolia",  
      config: {
        description: 'Access to protected content',
      },
    },
  },
  {
    url: "https://x402.org/facilitator",
  }
)

export const config = {
  matcher: ['/api/:path*'],
}
