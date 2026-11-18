'use client';

import React, { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Bot, X, Send, Sparkles, Database, ShieldCheck } from 'lucide-react';
import { useRetailStore } from '@/components/providers/retail-store-provider';
import { AssistantResponse, runReadOnlyAssistant } from '@/lib/retail-rules';
import { PRIMARY_SHOP_ID } from '@/lib/retail-seed';
import { Button } from '@/components/ui/button';

interface ChatTurn {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  toolResult?: AssistantResponse;
}

export function StoreAssistantWidget() {
  const t = useTranslations('assistant');
  const locale = useLocale();
  const { assistantEnabled, products, batches, sales } = useRetailStore();

  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatTurn[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text:
        locale === 'kn'
          ? 'ನಮಸ್ಕಾರ! ನಿಮ್ಮ ಅಂಗಡಿಯ ಸ್ಟಾಕ್, ಮಾರಾಟ ಅಥವಾ ಅವಧಿ ಮುಕ್ತಾಯದ ಬಗ್ಗೆ ಕೇಳಿ.'
          : locale === 'hi'
          ? 'नमस्ते! अपनी दुकान के स्टॉक, बिक्री या एक्सपायरी के बारे में पूछें।'
          : 'Hello! Ask me about expiring batches, top sellers, stockouts, or what to buy tomorrow.',
    },
  ]);

  if (!assistantEnabled) return null;

  const quickPrompts = [
    'Which batches are close to expiry?',
    'What sold the most this week?',
    'What should I buy tomorrow?',
    'How much stock is at risk?',
    'Which products will run out soon?',
  ];

  const handleSend = (queryText?: string) => {
    const q = (queryText ?? input).trim();
    if (!q) return;

    const userMsg: ChatTurn = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: q,
    };

    const result = runReadOnlyAssistant(
      q,
      locale,
      PRIMARY_SHOP_ID,
      products,
      batches,
      sales
    );

    const botMsg: ChatTurn = {
      id: `a-${Date.now() + 1}`,
      role: 'assistant',
      text: result.summary,
      toolResult: result,
    };

    setMessages((prev) => [...prev, userMsg, botMsg]);
    if (!queryText) setInput('');
  };

  return (
    <>
      {/* Floating Trigger Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 rounded-full shadow-lg shadow-emerald-600/25 transition-all hover:scale-105 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
          aria-label={t('title')}
        >
          <Bot className="w-5 h-5" />
          <span className="text-sm font-semibold hidden sm:inline">{t('title')}</span>
        </button>
      )}

      {/* Assistant Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-5 right-5 z-50 w-[92vw] sm:w-[420px] max-h-[82vh] flex flex-col bg-white dark:bg-neutral-900 rounded-2xl border border-gray-200 dark:border-neutral-800 shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-emerald-600 text-white px-4 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold leading-none">{t('title')}</h3>
                <span className="text-[11px] text-emerald-100 flex items-center gap-1 mt-1">
                  <ShieldCheck className="w-3 h-3" /> Read-only verified DB tools
                </span>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-lg hover:bg-white/15 transition-colors"
              aria-label="Close assistant"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Prompt Pills */}
          <div className="px-3 py-2 bg-gray-50 dark:bg-neutral-800/60 border-b border-gray-100 dark:border-neutral-800 flex gap-1.5 overflow-x-auto no-scrollbar">
            {quickPrompts.map((prompt) => (
              <button
                key={prompt}
                onClick={() => handleSend(prompt)}
                className="shrink-0 text-[11px] font-medium px-2.5 py-1 rounded-full bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-gray-200 hover:border-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[260px] max-h-[420px]">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[90%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-emerald-600 text-white rounded-br-xs'
                      : 'bg-gray-100 dark:bg-neutral-800 text-gray-800 dark:text-gray-200 rounded-bl-xs'
                  }`}
                >
                  <p>{m.text}</p>
                </div>

                {m.toolResult && (
                  <div className="mt-2 w-full bg-white dark:bg-neutral-950 rounded-xl border border-gray-200 dark:border-neutral-800 overflow-hidden shadow-2xs">
                    <div className="px-3 py-1.5 bg-emerald-50/70 dark:bg-emerald-950/40 border-b border-gray-200 dark:border-neutral-800 flex items-center justify-between text-[10px] font-semibold text-emerald-800 dark:text-emerald-300">
                      <span className="flex items-center gap-1">
                        <Database className="w-3 h-3" /> {m.toolResult.tool}()
                      </span>
                      <span className="flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> Verified rows
                      </span>
                    </div>
                    {m.toolResult.rows.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-[11px] text-left">
                          <thead className="bg-gray-50 dark:bg-neutral-900 text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-neutral-800">
                            <tr>
                              {m.toolResult.columns.map((col) => (
                                <th key={col} className="px-2.5 py-1.5 font-semibold">
                                  {col}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                            {m.toolResult.rows.map((row, idx) => (
                              <tr key={idx} className="text-gray-700 dark:text-gray-300">
                                {row.map((cell, cIdx) => (
                                  <td key={cIdx} className="px-2.5 py-1.5 tabular-nums">
                                    {cell}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="p-3 text-[11px] text-gray-500">No matching rows found.</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="p-3 border-t border-gray-200 dark:border-neutral-800 flex items-center gap-2 bg-white dark:bg-neutral-900"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t('placeholder')}
              className="flex-1 text-xs px-3 py-2 rounded-lg bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 text-gray-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            />
            <Button type="submit" size="sm" className="h-8 px-3">
              <Send className="w-3.5 h-3.5" />
            </Button>
          </form>
        </div>
      )}
    </>
  );
}

