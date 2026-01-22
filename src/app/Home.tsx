import React, { useState, useEffect } from 'react';
import { createWalletClient, custom } from 'viem';
import { baseSepolia } from 'viem/chains';
import { wrapFetchWithPayment } from 'x402-fetch';

declare global {
  interface Window {
    ethereum?: any;
  }
}

type TabType = 'tester' | 'faucet';

const ZyndTester: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('tester');
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [response, setResponse] = useState<any>(null);
  const [error, setError] = useState<string>('');
  const [paymentInfo, setPaymentInfo] = useState<string>('');

  // API Tester form inputs
  const [apiUrl, setApiUrl] = useState<string>('');
  const [amount, setAmount] = useState<string>('0.01');
  const [prompt, setPrompt] = useState<string>('');

  // Faucet form inputs
  const [faucetAddress, setFaucetAddress] = useState<string>('');
  const [faucetLoading, setFaucetLoading] = useState<boolean>(false);
  const [faucetResponse, setFaucetResponse] = useState<any>(null);
  const [faucetError, setFaucetError] = useState<string>('');

  useEffect(() => {
    if (typeof window.ethereum !== 'undefined') {
      window.ethereum
        .request({ method: 'eth_accounts' })
        .then((accounts: string[]) => {
          if (accounts.length > 0) {
            setWalletAddress(accounts[0]);
            setIsConnected(true);
            setFaucetAddress(accounts[0]);
          }
        });
    }
  }, []);

  const connectWallet = async () => {
    try {
      if (typeof window.ethereum === 'undefined') {
        setError('MetaMask is not installed. Please install MetaMask to continue.');
        return;
      }

      setLoading(true);
      setError('');

      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });

      if (accounts.length > 0) {
        setWalletAddress(accounts[0]);
        setIsConnected(true);
        setFaucetAddress(accounts[0]);
      }
    } catch (err: any) {
      setError(`Failed to connect wallet: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const disconnectWallet = () => {
    setWalletAddress('');
    setIsConnected(false);
    setResponse(null);
    setError('');
    setPaymentInfo('');
    setFaucetAddress('');
    setFaucetResponse(null);
    setFaucetError('');
  };

  const callApiWithPayment = async () => {
    try {
      if (!isConnected) {
        setError('Please connect your wallet first');
        return;
      }

      if (!apiUrl.trim()) {
        setError('Please enter an API URL');
        return;
      }

      if (!prompt.trim()) {
        setError('Please enter a prompt');
        return;
      }

      setLoading(true);
      setError('');
      setResponse(null);
      setPaymentInfo('');

      const accounts = await window.ethereum.request({
        method: 'eth_accounts',
      });

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found. Please connect MetaMask.');
      }

      const walletClient = createWalletClient({
        account: accounts[0],
        chain: baseSepolia,
        transport: custom(window.ethereum),
      });

      const amountInBaseUnits = BigInt(Math.floor(parseFloat(amount) * 1000000));

      const fetchWithPay = wrapFetchWithPayment(
        fetch,
        walletClient as any,
        amountInBaseUnits
      );

      setPaymentInfo('Initiating request...');

      const apiResponse = await fetchWithPay(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
      });

      if (apiResponse.status === 402) {
        setPaymentInfo('Payment required - processing...');
        throw new Error('Payment required but not automatically handled');
      }

      setPaymentInfo('Request completed successfully!');

      const data = await apiResponse.json();
      setResponse({
        status: apiResponse.status,
        statusText: apiResponse.statusText,
        data: data,
      });

      console.log('API Response:', data);
    } catch (err: any) {
      console.error('Error calling API:', err);
      setError(`Request failed: ${err.message}`);
      setPaymentInfo('');
    } finally {
      setLoading(false);
    }
  };

  const claimFaucet = async () => {
    try {
      if (!faucetAddress.trim()) {
        setFaucetError('Please enter a wallet address');
        return;
      }

      const addressRegex = /^0x[a-fA-F0-9]{40}$/;
      if (!addressRegex.test(faucetAddress)) {
        setFaucetError('Invalid wallet address format');
        return;
      }

      setFaucetLoading(true);
      setFaucetError('');
      setFaucetResponse(null);

      const response = await fetch('/api/faucet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ walletAddress: faucetAddress }),
      });

      const data = await response.json();

      if (data.success) {
        setFaucetResponse(data);
      } else {
        setFaucetError(data.error || 'Failed to claim tokens');
      }
    } catch (err: any) {
      console.error('Error claiming faucet:', err);
      setFaucetError(`Failed to claim: ${err.message}`);
    } finally {
      setFaucetLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <div className="border-b border-white/10 backdrop-blur-sm bg-black/20 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <span className="text-2xl font-bold bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                Zynd Tester
              </span>
            </div>

            {/* Wallet Status */}
            {isConnected ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/30">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                  <span className="text-sm text-emerald-400 font-mono">
                    {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                  </span>
                </div>
                <button
                  onClick={disconnectWallet}
                  className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={connectWallet}
                disabled={loading}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500
                         text-white font-medium text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
                         shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40"
              >
                {loading ? 'Connecting...' : 'Connect Wallet'}
              </button>
            )}
          </div>

          {/* Navigation Tabs */}
          <div className="flex gap-1 mt-4 p-1 bg-white/5 rounded-xl w-fit">
            <button
              onClick={() => setActiveTab('tester')}
              className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2
                        ${activeTab === 'tester'
                          ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg'
                          : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Test Agent
            </button>
            <button
              onClick={() => setActiveTab('faucet')}
              className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2
                        ${activeTab === 'faucet'
                          ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg'
                          : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Claim Tokens
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* API Tester Tab */}
        {activeTab === 'tester' && (
          <>
            {/* Main Card */}
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
              <div className="px-6 py-4 border-b border-white/10 bg-white/5">
                <h2 className="text-lg font-semibold text-white">API Request Configuration</h2>
                <p className="text-sm text-gray-400 mt-1">Configure your x402 payment-enabled API request</p>
              </div>

              <div className="p-6 space-y-6">
                {/* URL Input */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-300">
                    API Endpoint URL
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                    </div>
                    <input
                      type="url"
                      value={apiUrl}
                      onChange={(e) => setApiUrl(e.target.value)}
                      placeholder="https://api.example.com/endpoint"
                      className="w-full pl-12 pr-4 py-3 rounded-xl bg-black/30 border border-white/10 text-white placeholder-gray-500
                               focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all
                               font-mono text-sm"
                    />
                  </div>
                </div>

                {/* Amount Input */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-300">
                    Maximum Payment Amount
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.01"
                      className="w-full pl-12 pr-20 py-3 rounded-xl bg-black/30 border border-white/10 text-white placeholder-gray-500
                               focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all
                               font-mono text-sm"
                    />
                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                      <span className="text-sm font-medium text-violet-400">USDC</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">This is the maximum amount you&apos;re willing to pay for this API call</p>
                </div>

                {/* Prompt Input */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-300">
                    Prompt
                  </label>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Enter your prompt here..."
                    rows={4}
                    className="w-full px-4 py-3 rounded-xl bg-black/30 border border-white/10 text-white placeholder-gray-500
                             focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all
                             resize-none text-sm"
                  />
                </div>

                {/* Submit Button */}
                <button
                  onClick={callApiWithPayment}
                  disabled={!isConnected || loading || !apiUrl.trim() || !prompt.trim()}
                  className={`w-full py-4 rounded-xl font-semibold text-white transition-all duration-300
                            flex items-center justify-center gap-2 text-base
                            ${isConnected && !loading && apiUrl.trim() && prompt.trim()
                              ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:scale-[1.02]'
                              : 'bg-gray-700/50 cursor-not-allowed'}`}
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing Request...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Send Request
                    </>
                  )}
                </button>

                {/* Payment Info */}
                {paymentInfo && (
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-violet-500/10 border border-violet-500/20">
                    <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center shrink-0">
                      <svg className="w-4 h-4 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-violet-300 text-sm">{paymentInfo}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div className="mt-6 flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <div>
                  <p className="text-red-400 font-medium text-sm">Error</p>
                  <p className="text-red-300/80 text-sm mt-0.5">{error}</p>
                </div>
              </div>
            )}

            {/* Response Display */}
            {response && (
              <div className="mt-6 bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
                <div className="px-6 py-4 border-b border-white/10 bg-white/5 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">Response</h3>
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium
                                ${response.status >= 200 && response.status < 300
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${response.status >= 200 && response.status < 300 ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                    {response.status} {response.statusText}
                  </span>
                </div>
                <div className="p-6">
                  <pre className="bg-black/40 text-gray-100 p-4 rounded-xl overflow-auto text-sm font-mono max-h-96 border border-white/5">
                    {JSON.stringify(response.data, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {/* Info Box */}
            <div className="mt-6 p-5 rounded-xl bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 border border-violet-500/20">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-violet-300 mb-2">How it works</h4>
                  <ul className="text-sm text-gray-400 space-y-1.5">
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-400"></span>
                      Connect your MetaMask wallet (Base Sepolia testnet)
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-400"></span>
                      Enter the API endpoint URL and your prompt
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-400"></span>
                      Set the maximum USDC amount you&apos;re willing to pay
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-400"></span>
                      x402 automatically handles payment if required (402 response)
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Faucet Tab */}
        {activeTab === 'faucet' && (
          <>
            {/* Hero Section */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 mb-4 shadow-lg shadow-blue-500/25">
                <span className="text-4xl">🚰</span>
              </div>
              <div className="inline-block px-4 py-1.5 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-400 text-sm font-medium mb-3">
                Base Sepolia Testnet
              </div>
              <h2 className="text-3xl font-bold text-white mb-2">Claim Testnet ETH</h2>
              <p className="text-gray-400">Get free testnet ETH for development and testing</p>
            </div>

            {/* Info Cards */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="bg-white/5 backdrop-blur-xl rounded-xl border border-white/10 p-5 text-center hover:bg-white/10 transition-colors">
                <div className="text-2xl mb-2">💰</div>
                <div className="text-2xl font-bold text-blue-400 mb-1">0.01</div>
                <div className="text-xs text-gray-500 uppercase tracking-wide">ETH Amount</div>
              </div>
              <div className="bg-white/5 backdrop-blur-xl rounded-xl border border-white/10 p-5 text-center hover:bg-white/10 transition-colors">
                <div className="text-2xl mb-2">⚡</div>
                <div className="text-2xl font-bold text-blue-400 mb-1">Fast</div>
                <div className="text-xs text-gray-500 uppercase tracking-wide">Instant</div>
              </div>
              <div className="bg-white/5 backdrop-blur-xl rounded-xl border border-white/10 p-5 text-center hover:bg-white/10 transition-colors">
                <div className="text-2xl mb-2">🔒</div>
                <div className="text-2xl font-bold text-blue-400 mb-1">1x</div>
                <div className="text-xs text-gray-500 uppercase tracking-wide">Per Wallet</div>
              </div>
            </div>

            {/* Main Card */}
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
              <div className="px-6 py-4 border-b border-white/10 bg-white/5">
                <h3 className="text-lg font-semibold text-white">Claim Your Tokens</h3>
                <p className="text-sm text-gray-400 mt-1">Enter your wallet address to receive 0.01 ETH</p>
              </div>

              <div className="p-6 space-y-6">
                {/* Wallet Address Input */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-300">
                    Wallet Address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      value={faucetAddress}
                      onChange={(e) => setFaucetAddress(e.target.value)}
                      placeholder="0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
                      className="w-full pl-12 pr-4 py-3 rounded-xl bg-black/30 border border-white/10 text-white placeholder-gray-500
                               focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all
                               font-mono text-sm"
                    />
                  </div>
                  {isConnected && (
                    <button
                      onClick={() => setFaucetAddress(walletAddress)}
                      className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      Use connected wallet address
                    </button>
                  )}
                </div>

                {/* Submit Button */}
                <button
                  onClick={claimFaucet}
                  disabled={faucetLoading || !faucetAddress.trim()}
                  className={`w-full py-4 rounded-xl font-semibold text-white transition-all duration-300
                            flex items-center justify-center gap-2 text-base
                            ${!faucetLoading && faucetAddress.trim()
                              ? 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-[1.02]'
                              : 'bg-gray-700/50 cursor-not-allowed'}`}
                >
                  {faucetLoading ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </>
                  ) : (
                    <>
                      <span className="text-lg">🎁</span>
                      Claim Testnet ETH
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Faucet Error Display */}
            {faucetError && (
              <div className="mt-6 flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <div>
                  <p className="text-red-400 font-medium text-sm">Error</p>
                  <p className="text-red-300/80 text-sm mt-0.5">{faucetError}</p>
                </div>
              </div>
            )}

            {/* Faucet Success Display */}
            {faucetResponse && (
              <div className="mt-6 bg-white/5 backdrop-blur-xl rounded-2xl border border-emerald-500/30 overflow-hidden">
                <div className="px-6 py-4 border-b border-white/10 bg-emerald-500/10 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-emerald-400">Success!</h3>
                    <p className="text-sm text-emerald-300/80">{faucetResponse.amount} ETH has been sent to your wallet</p>
                  </div>
                </div>
                <div className="p-6">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-black/20">
                      <span className="text-sm text-gray-400">Recipient</span>
                      <span className="text-sm text-white font-mono">{faucetResponse.recipient?.slice(0, 10)}...{faucetResponse.recipient?.slice(-8)}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-black/20">
                      <span className="text-sm text-gray-400">Amount</span>
                      <span className="text-sm text-white font-medium">{faucetResponse.amount} ETH</span>
                    </div>
                    <a
                      href={faucetResponse.explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      View Transaction
                    </a>
                  </div>
                </div>
              </div>
            )}

            {/* Info Box */}
            <div className="mt-6 p-5 rounded-xl bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/20">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-blue-300 mb-2">About this faucet</h4>
                  <ul className="text-sm text-gray-400 space-y-1.5">
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                      Each wallet can only claim once
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                      You&apos;ll receive 0.01 Base Sepolia ETH
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                      Network: Base Sepolia (Chain ID: 84532)
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                      Use testnet ETH for development and testing only
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-white/5 mt-auto">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <p className="text-center text-xs text-gray-500">
            Powered by x402 Protocol | Base Sepolia Testnet
          </p>
        </div>
      </div>
    </div>
  );
};

export default ZyndTester;
