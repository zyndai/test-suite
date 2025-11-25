import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useEffect, useState } from 'react';
import { createThirdwebClient } from "thirdweb";
import { createWallet } from "thirdweb/wallets";
import { wrapFetchWithPayment } from "thirdweb/x402";

export default function Index() {
    const { ready, authenticated, login, logout } = usePrivy();
    const { wallets } = useWallets();
    const [response, setResponse] = useState<string>("");
    const [wallet, setWallet] = useState<any>(null);

    const API_URL = "https://aaea0d0f5c36.ngrok-free.app/webhook-test/51a9b5f4-a180-4b73-877e-99ec31bf56f5/webhook-x402";
    const CLIENT_ID = "580a983d5e6e9807f40b9f18678c02ee";

    useEffect(() => {
        if (authenticated && wallets[0]) {
            const client = createThirdwebClient({ clientId: CLIENT_ID });
            const w = createWallet("io.metamask");
            w.connect({ client }).then(() => setWallet(w));
        }
    }, [authenticated, wallets]);

    const handlePayment = async () => {
        try {
            setResponse("Processing payment...");
            
            const client = createThirdwebClient({ clientId: CLIENT_ID });
            const fetchWithPayment = wrapFetchWithPayment(
                fetch,
                client,
                wallet,
                BigInt(10_000_000) // Max 10 USDC
            );

            const res = await fetchWithPayment(API_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: "Hello" })
            });

            const data = await res.json();
            setResponse(JSON.stringify(data, null, 2));
        } catch (error: any) {
            setResponse(`Error: ${error.message}`);
        }
    };

    if (!ready) return <div>Loading...</div>;

    return (
        <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-4">
            {!authenticated ? (
                <button 
                    onClick={login}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg"
                >
                    Connect Wallet
                </button>
            ) : (
                <>
                    <div className="text-sm">
                        Wallet: {wallets[0]?.address.slice(0, 6)}...{wallets[0]?.address.slice(-4)}
                    </div>
                    
                    <button
                        onClick={handlePayment}
                        disabled={!wallet}
                        className="px-6 py-3 bg-green-600 text-white rounded-lg disabled:bg-gray-400"
                    >
                        {wallet ? "Pay & Call API" : "Connecting..."}
                    </button>

                    <button 
                        onClick={logout}
                        className="px-4 py-2 bg-gray-500 text-white rounded-lg"
                    >
                        Disconnect
                    </button>

                    {response && (
                        <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-xs max-w-2xl overflow-auto">
                            {response}
                        </pre>
                    )}
                </>
            )}
        </div>
    );
}