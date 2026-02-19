'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { createWalletClient, custom } from 'viem';
import { baseSepolia } from 'viem/chains';
import { wrapFetchWithPayment } from 'x402-fetch';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { config } from './config';

declare global {
  interface Window {
    ethereum?: any;
  }
}

// ── Types ──────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'error';
  content: string;
  timestamp: number;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  apiUrl: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const loadConversations = (): Conversation[] => {
  try {
    const raw = localStorage.getItem(config.storage.conversations);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveConversations = (convos: Conversation[]) => {
  localStorage.setItem(config.storage.conversations, JSON.stringify(convos));
};

const loadActiveId = (): string | null => {
  try {
    return localStorage.getItem(config.storage.activeConversation);
  } catch {
    return null;
  }
};

const saveActiveId = (id: string | null) => {
  if (id) localStorage.setItem(config.storage.activeConversation, id);
  else localStorage.removeItem(config.storage.activeConversation);
};

const loadSavedApiUrl = (): string => {
  try {
    return localStorage.getItem(config.storage.apiUrl) || config.apiUrl;
  } catch {
    return config.apiUrl;
  }
};

const saveApiUrl = (url: string) => {
  localStorage.setItem(config.storage.apiUrl, url);
};

/**
 * Extract a short title from the first user message (first ~40 chars).
 */
const deriveTitle = (text: string): string => {
  const clean = text.replace(/\n/g, ' ').trim();
  return clean.length > 40 ? `${clean.slice(0, 40)}...` : clean;
};

/**
 * Try to extract readable text from an API response object.
 */
const extractContent = (data: any): string => {
  if (typeof data === 'string') return data;

  // Common LLM response shapes
  if (data?.choices?.[0]?.message?.content) return data.choices[0].message.content;
  if (data?.choices?.[0]?.text) return data.choices[0].text;
  if (data?.result) return typeof data.result === 'string' ? data.result : JSON.stringify(data.result, null, 2);
  if (data?.response) return typeof data.response === 'string' ? data.response : JSON.stringify(data.response, null, 2);
  if (data?.message) return typeof data.message === 'string' ? data.message : JSON.stringify(data.message, null, 2);
  if (data?.content) return typeof data.content === 'string' ? data.content : JSON.stringify(data.content, null, 2);
  if (data?.output) return typeof data.output === 'string' ? data.output : JSON.stringify(data.output, null, 2);
  if (data?.text) return typeof data.text === 'string' ? data.text : JSON.stringify(data.text, null, 2);
  if (data?.answer) return typeof data.answer === 'string' ? data.answer : JSON.stringify(data.answer, null, 2);
  if (data?.data) {
    if (typeof data.data === 'string') return data.data;
    // Recurse one level for wrapped responses
    return extractContent(data.data);
  }

  return '```json\n' + JSON.stringify(data, null, 2) + '\n```';
};

// ── Markdown renderer components ───────────────────────────────────────────

const markdownComponents: Record<string, React.FC<any>> = {
  p: ({ children }: any) => <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>,
  h1: ({ children }: any) => <h1 className="text-xl font-bold mb-3 mt-4 first:mt-0">{children}</h1>,
  h2: ({ children }: any) => <h2 className="text-lg font-bold mb-2 mt-3 first:mt-0">{children}</h2>,
  h3: ({ children }: any) => <h3 className="text-base font-semibold mb-2 mt-3 first:mt-0">{children}</h3>,
  ul: ({ children }: any) => <ul className="list-disc list-inside mb-3 space-y-1">{children}</ul>,
  ol: ({ children }: any) => <ol className="list-decimal list-inside mb-3 space-y-1">{children}</ol>,
  li: ({ children }: any) => <li className="leading-relaxed">{children}</li>,
  code: ({ className, children, ...props }: any) => {
    const isInline = !className;
    if (isInline) {
      return (
        <code className="bg-white/10 rounded px-1.5 py-0.5 text-sm font-mono text-emerald-300" {...props}>
          {children}
        </code>
      );
    }
    return (
      <div className="my-3 rounded-lg overflow-hidden border border-white/10">
        <div className="bg-white/5 px-4 py-2 text-xs text-gray-400 font-mono border-b border-white/10">
          {className?.replace('language-', '') || 'code'}
        </div>
        <pre className="bg-black/40 p-4 overflow-x-auto">
          <code className="text-sm font-mono text-gray-200" {...props}>{children}</code>
        </pre>
      </div>
    );
  },
  blockquote: ({ children }: any) => (
    <blockquote className="border-l-2 border-violet-500 pl-4 my-3 text-gray-300 italic">{children}</blockquote>
  ),
  table: ({ children }: any) => (
    <div className="overflow-x-auto my-3">
      <table className="min-w-full border-collapse border border-white/10">{children}</table>
    </div>
  ),
  th: ({ children }: any) => (
    <th className="border border-white/10 px-3 py-2 bg-white/5 text-left text-sm font-semibold">{children}</th>
  ),
  td: ({ children }: any) => (
    <td className="border border-white/10 px-3 py-2 text-sm">{children}</td>
  ),
  a: ({ href, children }: any) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-violet-300 underline">
      {children}
    </a>
  ),
  hr: () => <hr className="my-4 border-white/10" />,
  strong: ({ children }: any) => <strong className="font-semibold text-white">{children}</strong>,
};

// ── Main Component ─────────────────────────────────────────────────────────

const ZyndTester: React.FC = () => {
  // Wallet
  const [walletAddress, setWalletAddress] = useState('');
  const [isConnected, setIsConnected] = useState(false);

  // Conversations
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvoId, setActiveConvoId] = useState<string | null>(null);

  // Input
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  // Sidebar
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Settings
  const [apiUrl, setApiUrl] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ── Derived state ──────────────────────────────────────────────────────

  const activeConvo = conversations.find((c) => c.id === activeConvoId) || null;
  const messages = activeConvo?.messages || [];

  // ── Persistence: load on mount ─────────────────────────────────────────

  useEffect(() => {
    const convos = loadConversations();
    setConversations(convos);
    const savedId = loadActiveId();
    if (savedId && convos.some((c) => c.id === savedId)) {
      setActiveConvoId(savedId);
    }
    setApiUrl(loadSavedApiUrl());
  }, []);

  // ── Persistence: save on change ────────────────────────────────────────

  useEffect(() => {
    if (conversations.length > 0) saveConversations(conversations);
  }, [conversations]);

  useEffect(() => {
    saveActiveId(activeConvoId);
  }, [activeConvoId]);

  // ── Auto-scroll ────────────────────────────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Wallet ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (typeof window.ethereum !== 'undefined') {
      window.ethereum.request({ method: 'eth_accounts' }).then((accounts: string[]) => {
        if (accounts.length > 0) {
          setWalletAddress(accounts[0]);
          setIsConnected(true);
        }
      });
    }
  }, []);

  const connectWallet = async () => {
    if (typeof window.ethereum === 'undefined') return;
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      if (accounts.length > 0) {
        setWalletAddress(accounts[0]);
        setIsConnected(true);
      }
    } catch { /* user rejected */ }
  };

  const disconnectWallet = () => {
    setWalletAddress('');
    setIsConnected(false);
  };

  // ── Conversation management ────────────────────────────────────────────

  const updateConversation = useCallback(
    (id: string, updater: (c: Conversation) => Conversation) => {
      setConversations((prev) => prev.map((c) => (c.id === id ? updater(c) : c)));
    },
    [],
  );

  const newConversation = useCallback(() => {
    const convo: Conversation = {
      id: generateId(),
      title: 'New chat',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      apiUrl: apiUrl,
    };
    setConversations((prev) => [convo, ...prev]);
    setActiveConvoId(convo.id);
    setInput('');
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [apiUrl]);

  const deleteConversation = useCallback(
    (id: string) => {
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConvoId === id) {
        setActiveConvoId(null);
      }
    },
    [activeConvoId],
  );

  const clearAllConversations = useCallback(() => {
    setConversations([]);
    setActiveConvoId(null);
    localStorage.removeItem(config.storage.conversations);
    localStorage.removeItem(config.storage.activeConversation);
  }, []);

  // ── Send message ───────────────────────────────────────────────────────

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    if (!isConnected) {
      return;
    }

    const currentUrl = apiUrl.trim();
    if (!currentUrl) {
      setShowSettings(true);
      return;
    }

    // Save apiUrl to localStorage whenever user sends
    saveApiUrl(currentUrl);

    let convoId = activeConvoId;

    // Auto-create a conversation if none is active
    if (!convoId) {
      const convo: Conversation = {
        id: generateId(),
        title: deriveTitle(trimmed),
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        apiUrl: currentUrl,
      };
      setConversations((prev) => [convo, ...prev]);
      setActiveConvoId(convo.id);
      convoId = convo.id;
    }

    const userMsg: Message = { id: generateId(), role: 'user', content: trimmed, timestamp: Date.now() };

    // Append user message & set title if first message
    updateConversation(convoId, (c) => ({
      ...c,
      messages: [...c.messages, userMsg],
      title: c.messages.length === 0 ? deriveTitle(trimmed) : c.title,
      updatedAt: Date.now(),
    }));

    setInput('');
    setLoading(true);

    try {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      if (!accounts?.length) throw new Error('No accounts found. Please connect your wallet.');

      // Switch to Base Sepolia
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: config.chain.idHex }],
        });
      } catch (switchError: any) {
        if (switchError.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: config.chain.idHex,
              chainName: config.chain.name,
              nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
              rpcUrls: [config.chain.rpcUrl],
              blockExplorerUrls: [config.chain.explorerUrl],
            }],
          });
        } else {
          throw new Error('Please switch to Base Sepolia network in your wallet');
        }
      }

      const walletClient = createWalletClient({
        account: accounts[0],
        chain: baseSepolia,
        transport: custom(window.ethereum),
      });

      const fetchWithPay = wrapFetchWithPayment(fetch, walletClient as any);

      const apiResponse = await fetchWithPay(currentUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: trimmed }),
      });

      const data = await apiResponse.json();
      const content = extractContent(data);

      const assistantMsg: Message = { id: generateId(), role: 'assistant', content, timestamp: Date.now() };

      updateConversation(convoId, (c) => ({
        ...c,
        messages: [...c.messages, assistantMsg],
        updatedAt: Date.now(),
      }));
    } catch (err: any) {
      const errMsg: Message = {
        id: generateId(),
        role: 'error',
        content: err.message || 'Something went wrong',
        timestamp: Date.now(),
      };
      updateConversation(convoId, (c) => ({
        ...c,
        messages: [...c.messages, errMsg],
        updatedAt: Date.now(),
      }));
    } finally {
      setLoading(false);
    }
  };

  // ── Key handler ────────────────────────────────────────────────────────

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  };

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="h-screen flex bg-[#171717] text-gray-100">
      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <div
        className={`${sidebarOpen ? 'w-64' : 'w-0'} flex-shrink-0 bg-[#0f0f0f] border-r border-white/5 flex flex-col transition-all duration-200 overflow-hidden`}
      >
        {/* New chat button */}
        <div className="p-3">
          <button
            onClick={newConversation}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-white/10 hover:bg-white/5 transition-colors text-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New chat
          </button>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto px-2 space-y-0.5 scrollbar-thin">
          {conversations.map((c) => (
            <div
              key={c.id}
              className={`group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer text-sm transition-colors
                         ${c.id === activeConvoId ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'}`}
              onClick={() => {
                setActiveConvoId(c.id);
                setApiUrl(c.apiUrl || apiUrl);
              }}
            >
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              <span className="truncate flex-1">{c.title}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteConversation(c.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-400 transition-all"
                title="Delete conversation"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
        </div>

        {/* Sidebar footer */}
        <div className="p-3 border-t border-white/5 space-y-1">
          <Link
            href="/faucet"
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-blue-400 hover:bg-white/5 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Claim Tokens
          </Link>
          {conversations.length > 0 && (
            <button
              onClick={clearAllConversations}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-gray-500 hover:text-red-400 hover:bg-white/5 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Clear all conversations
            </button>
          )}
        </div>
      </div>

      {/* ── Main area ───────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="h-12 flex items-center justify-between px-4 border-b border-white/5 bg-[#171717] shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1 hover:bg-white/5 rounded transition-colors">
              <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <span className="text-sm font-medium text-gray-300">{config.app.name}</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Settings button */}
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-1.5 rounded transition-colors ${showSettings ? 'bg-white/10 text-white' : 'hover:bg-white/5 text-gray-400'}`}
              title="Settings"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>

            {/* Wallet */}
            {isConnected ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
                  <span className="text-xs text-emerald-400 font-mono">
                    {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                  </span>
                </div>
                <button onClick={disconnectWallet} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
                  Disconnect
                </button>
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

        {/* Settings panel */}
        {showSettings && (
          <div className="border-b border-white/5 bg-[#1a1a1a] px-4 py-3">
            <div className="max-w-3xl mx-auto">
              <label className="block text-xs text-gray-400 mb-1.5">API Endpoint URL</label>
              <input
                type="url"
                value={apiUrl}
                onChange={(e) => {
                  setApiUrl(e.target.value);
                  saveApiUrl(e.target.value);
                }}
                placeholder="https://api.example.com/endpoint"
                className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white placeholder-gray-600 font-mono text-sm
                         focus:outline-none focus:ring-1 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all"
              />
              <p className="text-xs text-gray-600 mt-1">The x402 payment-enabled API endpoint to send prompts to</p>
            </div>
          </div>
        )}

        {/* ── Messages area ─────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {messages.length === 0 ? (
            /* Empty state */
            <div className="h-full flex flex-col items-center justify-center px-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center mb-6">
                <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h2 className="text-xl font-medium text-white mb-2">How can I help you today?</h2>
              <p className="text-sm text-gray-500 mb-8 text-center max-w-md">
                Send a message to any x402 payment-enabled API. Payments are handled automatically via your connected wallet.
              </p>
              {!apiUrl.trim() && (
                <button
                  onClick={() => setShowSettings(true)}
                  className="px-4 py-2 rounded-lg border border-white/10 text-sm text-gray-400 hover:bg-white/5 hover:text-gray-200 transition-colors"
                >
                  Set up API endpoint to get started
                </button>
              )}
            </div>
          ) : (
            <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                  {/* Avatar for assistant / error */}
                  {msg.role !== 'user' && (
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                        msg.role === 'error'
                          ? 'bg-red-500/20'
                          : 'bg-gradient-to-br from-violet-600 to-fuchsia-600'
                      }`}
                    >
                      {msg.role === 'error' ? (
                        <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      )}
                    </div>
                  )}

                  {/* Message bubble */}
                  <div
                    className={`max-w-[85%] ${
                      msg.role === 'user'
                        ? 'bg-[#2f2f2f] rounded-2xl rounded-tr-sm px-4 py-3'
                        : msg.role === 'error'
                          ? 'bg-red-500/5 border border-red-500/20 rounded-2xl rounded-tl-sm px-4 py-3 text-red-300'
                          : 'flex-1 min-w-0'
                    }`}
                  >
                    {msg.role === 'user' ? (
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    ) : msg.role === 'error' ? (
                      <p className="text-sm">{msg.content}</p>
                    ) : (
                      <div className="prose-chat text-sm text-gray-200">
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>

                  {/* Avatar for user */}
                  {msg.role === 'user' && (
                    <div className="w-8 h-8 rounded-lg bg-[#2f2f2f] border border-white/10 flex items-center justify-center shrink-0 mt-0.5">
                      <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                  )}
                </div>
              ))}

              {/* Typing indicator */}
              {loading && (
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center shrink-0 mt-0.5">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div className="flex items-center gap-1.5 py-3">
                    <div className="w-2 h-2 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* ── Input area ────────────────────────────────────────────────── */}
        <div className="shrink-0 border-t border-white/5 bg-[#171717] px-4 py-3">
          <div className="max-w-3xl mx-auto">
            <div className="relative flex items-end bg-[#2f2f2f] rounded-xl border border-white/10 focus-within:border-white/20 transition-colors">
              <textarea
                ref={inputRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={
                  !isConnected
                    ? 'Connect your wallet to start...'
                    : !apiUrl.trim()
                      ? 'Set an API endpoint in settings first...'
                      : 'Message...'
                }
                disabled={!isConnected || loading}
                rows={1}
                className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 px-4 py-3 resize-none
                         focus:outline-none disabled:opacity-50 max-h-[200px] scrollbar-thin"
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || !isConnected || loading || !apiUrl.trim()}
                className={`m-1.5 p-2 rounded-lg transition-all ${
                  input.trim() && isConnected && !loading && apiUrl.trim()
                    ? 'bg-white text-black hover:bg-gray-200'
                    : 'bg-white/10 text-gray-600 cursor-not-allowed'
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            <p className="text-center text-xs text-gray-600 mt-2">
              Powered by x402 Protocol &middot; {config.chain.name}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ZyndTester;
