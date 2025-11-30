import React, { useState, useEffect } from 'react';
import { createWalletClient, custom } from 'viem';
import { baseSepolia } from 'viem/chains';
import { wrapFetchWithPayment } from 'x402-fetch';

// Define the MetaMask ethereum provider type
declare global {
  interface Window {
    ethereum?: any;
  }
}

const X402WebhookCaller: React.FC = () => {
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [response, setResponse] = useState<any>(null);
  const [error, setError] = useState<string>('');
  const [paymentInfo, setPaymentInfo] = useState<string>('');

  const API_URL = "http://localhost:5678/webhook/6aede939-f3f7-435d-9b70-e00aaa9aa98b/pay";

  // Check if MetaMask is installed
  useEffect(() => {
    if (typeof window.ethereum !== 'undefined') {
      // Check if already connected
      window.ethereum
        .request({ method: 'eth_accounts' })
        .then((accounts: string[]) => {
          if (accounts.length > 0) {
            setWalletAddress(accounts[0]);
            setIsConnected(true);
          }
        });
    }
  }, []);

  // Connect to MetaMask
  const connectWallet = async () => {
    try {
      if (typeof window.ethereum === 'undefined') {
        setError('MetaMask is not installed. Please install MetaMask to continue.');
        return;
      }

      setLoading(true);
      setError('');

      // Request account access
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });

      if (accounts.length > 0) {
        setWalletAddress(accounts[0]);
        setIsConnected(true);
      }
    } catch (err: any) {
      setError(`Failed to connect wallet: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Disconnect wallet
  const disconnectWallet = () => {
    setWalletAddress('');
    setIsConnected(false);
    setResponse(null);
    setError('');
    setPaymentInfo('');
  };

  // Call the API with x402 payment handling
  const callWebhookWithPayment = async () => {
    try {
      if (!isConnected) {
        setError('Please connect your wallet first');
        return;
      }

      setLoading(true);
      setError('');
      setResponse(null);
      setPaymentInfo('');

      // Get the current account from MetaMask
      const accounts = await window.ethereum.request({
        method: 'eth_accounts',
      });

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found. Please connect MetaMask.');
      }

      // Create wallet client with MetaMask and explicitly set the account
      const walletClient = createWalletClient({
        account: accounts[0],
        chain: baseSepolia,
        transport: custom(window.ethereum),
      });

      // Wrap fetch with payment handling
      // Max value set to 0.1 USDC (100000 in base units for 6 decimals)
      const fetchWithPay = wrapFetchWithPayment(
        fetch,
        walletClient,
        1000n // 0.001 USDC max payment
      );

      setPaymentInfo('Making request to API...');

      // Make the request - x402-fetch will automatically handle 402 responses
      const apiResponse = await fetchWithPay(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          "prompt": "Create a beautiful poem"
        })
      });

      if (apiResponse.status === 402) {
        setPaymentInfo('Payment required - processing payment...');
        // The wrapper should handle this automatically, but in case it doesn't
        throw new Error('Payment required but not automatically handled');
      }

      setPaymentInfo('Request successful!');

      // Parse response
      const data = await apiResponse.json();
      setResponse({
        status: apiResponse.status,
        statusText: apiResponse.statusText,
        data: data,
      });

      console.log('API Response:', data);
    } catch (err: any) {
      console.error('Error calling webhook:', err);
      setError(`Failed to call API: ${err.message}`);
      setPaymentInfo('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-8 text-center">
          x402 Webhook Caller
        </h1>

        {/* Wallet Connection Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Wallet Connection
          </h2>
        
          {!isConnected ? (
            <button
              onClick={connectWallet}
              disabled={loading}
              className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg 
                       transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed
                       focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
            >
              {loading ? 'Connecting...' : 'Connect MetaMask'}
            </button>
          ) : (
            <div>
              <p className="text-gray-700 mb-3">
                <span className="font-semibold">Connected:</span>{' '}
                <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                  {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                </span>
              </p>
              <button
                onClick={disconnectWallet}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg 
                         transition-colors duration-200 focus:outline-none focus:ring-2 
                         focus:ring-red-500 focus:ring-offset-2"
              >
                Disconnect
              </button>
            </div>
          )}
        </div>

        {/* API Call Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Call Webhook API
          </h2>
        
          <div className="mb-4">
            <p className="font-semibold text-gray-700 mb-2">Endpoint:</p>
            <div className="bg-gray-50 p-3 rounded-md border border-gray-200 text-xs text-gray-600 
                          break-all font-mono">
              {API_URL}
            </div>
          </div>

          <button
            onClick={callWebhookWithPayment}
            disabled={!isConnected || loading}
            className={`px-6 py-3 font-medium rounded-lg transition-colors duration-200 
                      focus:outline-none focus:ring-2 focus:ring-offset-2
                      ${isConnected && !loading 
                        ? 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500' 
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
          >
            {loading ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </span>
            ) : (
              'Call API with x402'
            )}
          </button>

          {paymentInfo && (
            <div className="mt-4 p-4 bg-blue-50 border-l-4 border-blue-500 rounded-r-lg">
              <p className="text-blue-800">{paymentInfo}</p>
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-r-lg">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-800">
                  <span className="font-semibold">Error:</span> {error}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Response Display */}
        {response && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Response</h2>
          
            <div className="mb-4">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                Status: {response.status} {response.statusText}
              </span>
            </div>

            <div>
              <p className="font-semibold text-gray-700 mb-2">Data:</p>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-auto text-sm 
                           border border-gray-700 max-h-96">
                {JSON.stringify(response.data, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {/* Information Box */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">ℹ️ How it works</h3>
          <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
            <li>Connect your MetaMask wallet to Base Sepolia testnet</li>
            <li>Click "Call API with x402" to make the request</li>
            <li>If payment is required (402 response), x402-fetch handles it automatically</li>
            <li>Maximum payment allowed: 0.1 USDC</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default X402WebhookCaller