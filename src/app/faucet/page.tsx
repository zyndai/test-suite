'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { config } from '../config';

declare global {
  interface Window {
    ethereum?: any;
  }
}

export default function FaucetPage() {
  const [walletAddress, setWalletAddress] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [faucetAddress, setFaucetAddress] = useState('');
  const [faucetLoading, setFaucetLoading] = useState(false);
  const [faucetResponse, setFaucetResponse] = useState<any>(null);
  const [faucetError, setFaucetError] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined' && window.ethereum) {
      window.ethereum.request({ method: 'eth_accounts' }).then((accounts: string[]) => {
        if (accounts.length > 0) {
          setWalletAddress(accounts[0]);
          setIsConnected(true);
          setFaucetAddress(accounts[0]);
        }
      });
    }
  }, []);

  const connectWallet = async () => {
    if (typeof window === 'undefined' || !window.ethereum) return;
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      if (accounts.length > 0) {
        setWalletAddress(accounts[0]);
        setIsConnected(true);
        setFaucetAddress(accounts[0]);
      }
    } catch { /* user rejected */ }
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: faucetAddress }),
      });

      const data = await response.json();

      if (data.success) {
        setFaucetResponse(data);
      } else {
        setFaucetError(data.error || 'Failed to claim tokens');
      }
    } catch (err: any) {
      setFaucetError(`Failed to claim: ${err.message}`);
    } finally {
      setFaucetLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#171717] text-gray-100">
      {/* Header */}
      <div className="border-b border-white/5 bg-[#0f0f0f] sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-1.5 rounded-lg hover:bg-white/5 transition-colors text-gray-400 hover:text-white"
              title="Back to chat"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <span className="text-sm font-medium text-gray-300">{config.app.name}</span>
            <span className="text-gray-600">/</span>
            <span className="text-sm font-medium text-white">Claim Tokens</span>
          </div>

          {isConnected ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
              <span className="text-xs text-emerald-400 font-mono">
                {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
              </span>
            </div>
          ) : (
            <button
              onClick={connectWallet}
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-sm text-white transition-colors"
            >
              Connect Wallet
            </button>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-10">
        {/* Hero */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 mb-4 shadow-lg shadow-blue-500/20">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="inline-block px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium mb-3">
            {config.chain.name}
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Claim Testnet ETH</h1>
          <p className="text-sm text-gray-500">Get free testnet ETH for development and testing</p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="bg-white/5 rounded-xl border border-white/5 p-4 text-center">
            <div className="text-lg font-bold text-blue-400">{config.faucet.amount}</div>
            <div className="text-xs text-gray-500 mt-0.5">{config.faucet.currency} per claim</div>
          </div>
          <div className="bg-white/5 rounded-xl border border-white/5 p-4 text-center">
            <div className="text-lg font-bold text-blue-400">Instant</div>
            <div className="text-xs text-gray-500 mt-0.5">Delivery speed</div>
          </div>
          <div className="bg-white/5 rounded-xl border border-white/5 p-4 text-center">
            <div className="text-lg font-bold text-blue-400">1x</div>
            <div className="text-xs text-gray-500 mt-0.5">Per wallet</div>
          </div>
        </div>

        {/* Claim card */}
        <div className="bg-white/5 rounded-2xl border border-white/5 overflow-hidden">
          <div className="px-6 py-4 border-b border-white/5">
            <h2 className="text-base font-semibold text-white">Claim Your Tokens</h2>
            <p className="text-xs text-gray-500 mt-1">
              Enter your wallet address to receive {config.faucet.amount} {config.faucet.currency}
            </p>
          </div>

          <div className="p-6 space-y-5">
            {/* Address input */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-gray-400">Wallet Address</label>
              <input
                type="text"
                value={faucetAddress}
                onChange={(e) => setFaucetAddress(e.target.value)}
                placeholder="0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
                className="w-full px-4 py-3 rounded-xl bg-black/30 border border-white/10 text-white placeholder-gray-600
                         focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all
                         font-mono text-sm"
              />
              {isConnected && (
                <button
                  onClick={() => setFaucetAddress(walletAddress)}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Use connected wallet address
                </button>
              )}
            </div>

            {/* Claim button */}
            <button
              onClick={claimFaucet}
              disabled={faucetLoading || !faucetAddress.trim()}
              className={`w-full py-3.5 rounded-xl font-semibold text-white transition-all duration-200
                        flex items-center justify-center gap-2 text-sm
                        ${!faucetLoading && faucetAddress.trim()
                          ? 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 shadow-lg shadow-blue-500/20'
                          : 'bg-gray-700/50 cursor-not-allowed'}`}
            >
              {faucetLoading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </>
              ) : (
                'Claim Testnet ETH'
              )}
            </button>
          </div>
        </div>

        {/* Error */}
        {faucetError && (
          <div className="mt-5 flex items-start gap-3 p-4 rounded-xl bg-red-500/5 border border-red-500/20">
            <svg className="w-4 h-4 text-red-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-red-300">{faucetError}</p>
          </div>
        )}

        {/* Success */}
        {faucetResponse && (
          <div className="mt-5 bg-white/5 rounded-2xl border border-emerald-500/20 overflow-hidden">
            <div className="px-6 py-4 border-b border-white/5 bg-emerald-500/5 flex items-center gap-3">
              <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <div>
                <h3 className="text-sm font-semibold text-emerald-400">Success!</h3>
                <p className="text-xs text-emerald-300/70">{faucetResponse.amount} ETH sent to your wallet</p>
              </div>
            </div>
            <div className="p-6 space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-black/20">
                <span className="text-xs text-gray-500">Recipient</span>
                <span className="text-xs text-white font-mono">
                  {faucetResponse.recipient?.slice(0, 10)}...{faucetResponse.recipient?.slice(-8)}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-black/20">
                <span className="text-xs text-gray-500">Amount</span>
                <span className="text-xs text-white font-medium">{faucetResponse.amount} ETH</span>
              </div>
              <a
                href={faucetResponse.explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                View Transaction
              </a>
            </div>
          </div>
        )}

        {/* Info */}
        <div className="mt-6 p-4 rounded-xl bg-white/[0.02] border border-white/5">
          <h4 className="text-xs font-semibold text-gray-400 mb-2">About this faucet</h4>
          <ul className="text-xs text-gray-500 space-y-1.5">
            <li className="flex items-center gap-2">
              <span className="w-1 h-1 rounded-full bg-gray-600"></span>
              Each wallet can only claim once
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1 h-1 rounded-full bg-gray-600"></span>
              You&apos;ll receive {config.faucet.amount} {config.chain.name} {config.faucet.currency}
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1 h-1 rounded-full bg-gray-600"></span>
              Network: {config.chain.name} (Chain ID: {config.chain.id})
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1 h-1 rounded-full bg-gray-600"></span>
              Use testnet ETH for development and testing only
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
