import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useEffect, useState } from 'react';
import { createThirdwebClient, getContract } from "thirdweb";
import { createWallet } from "thirdweb/wallets";
import { baseSepolia } from "thirdweb/chains";
import { balanceOf } from "thirdweb/extensions/erc20";
import type { Wallet } from "thirdweb/wallets";

export default function Index() {
    const { ready, authenticated, login, logout } = usePrivy();
    const { wallets } = useWallets();
    const [response, setResponse] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [usdcBalance, setUsdcBalance] = useState<string | null>(null);
    const [ethBalance, setEthBalance] = useState<string | null>(null);
    const [thirdwebWallet, setThirdwebWallet] = useState<Wallet | null>(null);
    const [thirdwebClient, setThirdwebClient] = useState<any>(null);
    const [paymentInfo, setPaymentInfo] = useState<any>(null);

    const USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
    const MAX_WILLING_TO_PAY = 10.0; // Maximum 10 USDC
    const CLIENT_ID = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || "580a983d5e6e9807f40b9f18678c02ee";
    const API_ENDPOINT = "https://aaea0d0f5c36.ngrok-free.app/webhook-test/51a9b5f4-a180-4b73-877e-99ec31bf56f5/webhook-x402";

    const ensureNetwork = async () => {
        if (!wallets[0]) return false;
        
        try {
            const provider = await wallets[0].getEthereumProvider();
            const chainId = await provider.request({ method: 'eth_chainId' }) as string;
            
            if (parseInt(chainId, 16) !== 84532) {
                console.log("Switching to Base Sepolia (84532)...");
                try {
                    await provider.request({
                        method: 'wallet_switchEthereumChain',
                        params: [{ chainId: '0x14a34' }],
                    });
                } catch (switchError: any) {
                    if (switchError.code === 4902) {
                        await provider.request({
                            method: 'wallet_addEthereumChain',
                            params: [{
                                chainId: '0x14a34',
                                chainName: 'Base Sepolia',
                                nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                                rpcUrls: ['https://sepolia.base.org'],
                                blockExplorerUrls: ['https://sepolia.basescan.org']
                            }],
                        });
                    }
                }
            }
            return true;
        } catch (error) {
            console.error("Network switch error:", error);
            return false;
        }
    };

    const checkBalances = async () => {
        if (!wallets[0]?.address) return;
        
        try {
            await ensureNetwork();
            const provider = await wallets[0].getEthereumProvider();

            // Check ETH
            const ethBal = await provider.request({
                method: 'eth_getBalance',
                params: [wallets[0].address, 'latest']
            }) as string;
            const ethInEther = parseInt(ethBal, 16) / 1e18;
            setEthBalance(ethInEther.toFixed(6));

            // Check USDC
            if (thirdwebClient) {
                const contract = getContract({
                    client: thirdwebClient,
                    chain: baseSepolia,
                    address: USDC_ADDRESS,
                });

                const balance = await balanceOf({
                    contract,
                    address: wallets[0].address,
                });

                const balanceInUsdc = Number(balance) / 1_000_000;
                setUsdcBalance(balanceInUsdc.toFixed(6));
                
                return { usdc: balanceInUsdc, eth: ethInEther };
            }
        } catch (error) {
            console.error("Error checking balances:", error);
            setUsdcBalance("Error");
            setEthBalance("Error");
        }
        return { usdc: 0, eth: 0 };
    };

    const fetchPaymentInfo = async () => {
        try {
            setResponse("🔍 Fetching payment requirements...");
            
            // Initial request to get 402 response
            const response = await fetch(API_ENDPOINT, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    message: "Request payment info",
                })
            });

            console.log("Initial response status:", response.status);

            if (response.status === 402) {
                const x402Response = await response.json();
                console.log("X402 Response:", x402Response);
                
                if (x402Response.accepts && x402Response.accepts.length > 0) {
                    const paymentDetails = x402Response.accepts[0];
                    const requiredAmount = parseInt(paymentDetails.maxAmountRequired) / 1_000_000;
                    
                    console.log("Payment details:", {
                        amount: requiredAmount,
                        amountBase: paymentDetails.maxAmountRequired,
                        token: paymentDetails.asset,
                        recipient: paymentDetails.payTo,
                        network: paymentDetails.network,
                    });
                    
                    setPaymentInfo({
                        amount: requiredAmount,
                        amountBase: paymentDetails.maxAmountRequired,
                        token: paymentDetails.asset,
                        recipient: paymentDetails.payTo,
                        network: paymentDetails.network,
                        description: paymentDetails.description,
                    });
                    
                    setResponse(`💰 Payment Required:\n\nAmount: ${requiredAmount} USDC\nNetwork: Base Sepolia\nRecipient: ${paymentDetails.payTo}\n\nClick "Pay & Call API" to proceed.`);
                    
                    return requiredAmount;
                }
            }
            
            throw new Error(`Unexpected response status: ${response.status}`);
        } catch (error: any) {
            console.error("Error fetching payment info:", error);
            setResponse(`❌ Error fetching payment info:\n\n${error.message}`);
            return null;
        }
    };

    const handleX402Payment = async () => {
        setLoading(true);
        setResponse(null);
        
        try {
            if (!thirdwebWallet || !thirdwebClient) {
                throw new Error("Wallet not properly connected to thirdweb");
            }

            await ensureNetwork();
            const balances = await checkBalances();
            
            if (!paymentInfo) {
                throw new Error("Payment info not loaded. Please refresh.");
            }

            const requiredAmount = paymentInfo.amount;
            
            if (!balances || balances.usdc < requiredAmount) {
                throw new Error(`Insufficient USDC.\n\nYou have: ${balances?.usdc.toFixed(6)} USDC\nRequired: ${requiredAmount} USDC\n\nGet testnet USDC from https://faucet.circle.com/`);
            }

            if (balances.eth < 0.001) {
                throw new Error(`Insufficient ETH for gas.\n\nYou have: ${balances.eth.toFixed(6)} ETH\nRequired: ~0.001 ETH\n\nGet testnet ETH from https://www.alchemy.com/faucets/base-sepolia`);
            }

            setResponse(`💳 Processing payment of ${requiredAmount} USDC...\n\nPlease sign the payment authorization in your wallet.`);

            // Import x402 functions
            const { wrapFetchWithPayment } = await import("thirdweb/x402");

            console.log("X402 Configuration:", {
                client: CLIENT_ID,
                wallet: wallets[0]?.address,
                chain: "Base Sepolia (84532)",
                maxPayment: `${MAX_WILLING_TO_PAY} USDC`,
                requiredPayment: `${requiredAmount} USDC`,
                asset: USDC_ADDRESS,
                recipient: paymentInfo.recipient,
            });

            // Wrap fetch with x402 payment
            // CRITICAL: maxValue must be >= the required payment amount
            const fetchWithPayment = wrapFetchWithPayment(
                fetch,
                thirdwebClient,
                thirdwebWallet,
                BigInt(Math.floor(MAX_WILLING_TO_PAY * 1_000_000)), // 10 USDC max
            );

            setResponse(`⏳ Sending payment authorization...\n\nAmount: ${requiredAmount} USDC\nThis should prompt your wallet for signature.`);

            const apiResponse = await fetchWithPayment(API_ENDPOINT, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    message: "Paid API call via x402",
                    timestamp: new Date().toISOString(),
                    amount: requiredAmount,
                })
            });

            console.log("API Response Status:", apiResponse.status);
            console.log("Response Headers:", Object.fromEntries(apiResponse.headers.entries()));

            setResponse("✅ Payment authorized! Processing response...");

            const body = await apiResponse.json();
            console.log("API Response Body:", body);

            // Check payment response header
            const paymentResponseHeader = apiResponse.headers.get("x-payment-response");
            if (paymentResponseHeader) {
                console.log("Payment receipt:", paymentResponseHeader);
            }

            await checkBalances();
            
            setResponse(`✅ Success!\n\nPaid: ${requiredAmount} USDC\n\nAPI Response:\n${JSON.stringify(body, null, 2)}`);
        } catch (error: any) {
            console.error("Payment Error:", error);
            
            let errorMsg = error.message || 'Unknown error';
            
            // Parse specific x402 errors
            if (errorMsg.includes('payment_simulation_failed')) {
                errorMsg = `❌ Payment Simulation Failed\n\nThis usually means:\n• Backend couldn't verify the payment\n• Network/RPC issues\n• Token contract issues\n\nYour balances look good:\n• USDC: ${usdcBalance}\n• ETH: ${ethBalance}\n\nTry again or contact support.`;
            } else if (errorMsg.includes('user rejected') || errorMsg.includes('User rejected')) {
                errorMsg = '❌ Transaction Rejected\n\nYou declined the signature request in your wallet.';
            } else if (errorMsg.includes('insufficient funds')) {
                errorMsg = '❌ Insufficient ETH\n\nYou need ETH for gas fees.\n\nGet testnet ETH: https://www.alchemy.com/faucets/base-sepolia';
            } else if (errorMsg.includes('exceeds maximum')) {
                errorMsg = `❌ Payment Too High\n\nRequired: ${paymentInfo?.amount} USDC\nYour limit: ${MAX_WILLING_TO_PAY} USDC\n\nIncrease MAX_WILLING_TO_PAY if needed.`;
            }
            
            setResponse(`❌ Error:\n\n${errorMsg}`);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        (async () => {
            if (authenticated && wallets.length > 0) {
                try {
                    console.log("🔧 Setting up thirdweb wallet...");
                    console.log("Client ID:", CLIENT_ID);
                    console.log("Wallet address:", wallets[0].address);
                    
                    const client = createThirdwebClient({ 
                        clientId: CLIENT_ID
                    });
                    setThirdwebClient(client);

                    const privyProvider = await wallets[0].getEthereumProvider();
                    
                    const accounts = await privyProvider.request({ 
                        method: 'eth_requestAccounts' 
                    }) as string[];
                    
                    if (!accounts || accounts.length === 0) {
                        console.error("❌ No accounts found");
                        return;
                    }

                    console.log("✅ Account:", accounts[0]);

                    // Create wallet - try different types if one fails
                    let wallet: Wallet;
                    try {
                        wallet = createWallet("io.metamask");
                    } catch (e) {
                        console.log("MetaMask wallet creation failed, trying generic injected...");
                        wallet = createWallet("walletConnect");
                    }
                    
                    await wallet.connect({ 
                        client,
                    });
                    
                    console.log("✅ Thirdweb wallet connected");
                    setThirdwebWallet(wallet);
                    
                    // Check balances and fetch payment info
                    setTimeout(async () => {
                        await checkBalances();
                        await fetchPaymentInfo();
                    }, 1000);
                } catch (error) {
                    console.error("❌ Error setting up thirdweb:", error);
                    setResponse(`❌ Wallet Setup Error:\n\n${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            } else {
                setThirdwebWallet(null);
                setThirdwebClient(null);
                setUsdcBalance(null);
                setEthBalance(null);
                setPaymentInfo(null);
            }
        })();
    }, [authenticated, wallets]);

    if (!ready) return (
        <div className="flex items-center justify-center h-screen">
            <div className="text-lg animate-pulse">Loading Privy...</div>
        </div>
    );

    return (
        <main className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-br from-blue-50 to-indigo-100">
            {!authenticated ? (
                <div className="text-center space-y-6">
                    <div className="text-6xl mb-4">💰</div>
                    <h1 className="text-4xl font-bold text-gray-800">X402 Payment Protocol</h1>
                    <p className="text-gray-600 max-w-md">
                        Pay-per-request API using EIP-3009<br/>
                        Sign once, pay with USDC
                    </p>
                    <button
                        onClick={login}
                        className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 shadow-lg transition-all transform hover:scale-105 font-semibold"
                    >
                        Connect Wallet
                    </button>
                </div>
            ) : (
                <div className="w-full max-w-2xl space-y-4">
                    <div className="bg-white p-6 rounded-2xl shadow-xl space-y-4 border border-gray-200">
                        <div className="flex justify-between items-center">
                            <h2 className="text-2xl font-bold text-gray-800">💳 X402 Payment API</h2>
                            <div className="flex gap-2">
                                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-semibold">
                                    Base Sepolia
                                </span>
                                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold">
                                    EIP-3009
                                </span>
                            </div>
                        </div>
                        
                        <div className="space-y-3 bg-gray-50 p-4 rounded-xl">
                            <div className="flex justify-between items-center">
                                <span className="text-gray-600">Wallet</span>
                                <span className="font-mono text-xs bg-white px-3 py-1 rounded shadow-sm">
                                    {wallets[0]?.address.slice(0, 6)}...{wallets[0]?.address.slice(-4)}
                                </span>
                            </div>
                            
                            <div className="flex justify-between items-center">
                                <span className="text-gray-600">Status</span>
                                <span className={`px-2 py-1 rounded text-xs font-semibold ${thirdwebWallet ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                    {thirdwebWallet ? '✓ Connected' : '⏳ Connecting...'}
                                </span>
                            </div>
                            
                            <div className="flex justify-between items-center">
                                <span className="text-gray-600">ETH Balance</span>
                                <span className={`font-semibold ${ethBalance && parseFloat(ethBalance) < 0.001 ? 'text-red-600' : 'text-green-600'}`}>
                                    {ethBalance || "..."} ETH
                                </span>
                            </div>
                            
                            <div className="flex justify-between items-center">
                                <span className="text-gray-600">USDC Balance</span>
                                <span className={`font-semibold ${usdcBalance && paymentInfo && parseFloat(usdcBalance) < paymentInfo.amount ? 'text-red-600' : 'text-green-600'}`}>
                                    {usdcBalance || "..."} USDC
                                </span>
                            </div>
                            
                            {paymentInfo && (
                                <div className="flex justify-between items-center pt-2 border-t">
                                    <span className="text-gray-600 font-semibold">Payment Required</span>
                                    <span className="text-lg font-bold text-indigo-600">{paymentInfo.amount} USDC</span>
                                </div>
                            )}
                        </div>

                        {usdcBalance && paymentInfo && parseFloat(usdcBalance) < paymentInfo.amount && (
                            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
                                <p className="text-sm text-yellow-800">
                                    ⚠️ <strong>Insufficient USDC</strong><br/>
                                    Need: {paymentInfo.amount} USDC | Have: {usdcBalance} USDC<br/>
                                    <a 
                                        href="https://faucet.circle.com/" 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:underline font-semibold"
                                    >
                                        Get testnet USDC →
                                    </a>
                                </p>
                            </div>
                        )}

                        {ethBalance && parseFloat(ethBalance) < 0.001 && (
                            <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded">
                                <p className="text-sm text-red-800">
                                    ⛽ <strong>Low ETH for Gas</strong><br/>
                                    <a 
                                        href="https://www.alchemy.com/faucets/base-sepolia" 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:underline font-semibold"
                                    >
                                        Get testnet ETH →
                                    </a>
                                </p>
                            </div>
                        )}

                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={handleX402Payment}
                                className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed shadow-lg transition-all transform hover:scale-105 font-semibold"
                                disabled={loading || !thirdwebWallet || !paymentInfo}
                            >
                                {loading ? "⏳ Processing..." : !thirdwebWallet ? "🔄 Connecting..." : !paymentInfo ? "📡 Loading..." : `💸 Pay ${paymentInfo.amount} USDC & Call API`}
                            </button>
                            <button 
                                onClick={() => {
                                    checkBalances();
                                    fetchPaymentInfo();
                                }} 
                                className="px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow transition-all"
                                disabled={loading}
                                title="Refresh balances and payment info"
                            >
                                🔄
                            </button>
                            <button 
                                onClick={logout} 
                                className="px-4 py-3 bg-gray-500 text-white rounded-xl hover:bg-gray-600 shadow transition-all"
                            >
                                Disconnect
                            </button>
                        </div>
                    </div>

                    {response && (
                        <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-200">
                            <p className="text-sm font-semibold mb-3 text-gray-700">📋 Status:</p>
                            <pre className="text-xs bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed">
                                {response}
                            </pre>
                        </div>
                    )}

                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                        <p className="text-xs text-blue-800">
                            <strong>ℹ️ How X402 works:</strong> First request gets payment requirements (402 response). Client signs EIP-3009 authorization. Second request includes X-PAYMENT header with signed authorization. Backend verifies signature and processes request.
                        </p>
                    </div>
                </div>
            )}
        </main>
    );
}