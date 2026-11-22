'use client';

import React from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-2xl p-6 text-center space-y-4 shadow-2xl">
          <div className="w-12 h-12 rounded-xl bg-red-500/20 text-red-400 mx-auto flex items-center justify-center text-xl font-bold">
            !
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white">Something went wrong</h2>
          <p className="text-sm text-slate-400">
            {error?.message || 'An unexpected application error occurred.'}
          </p>
          <button
            onClick={() => reset()}
            className="w-full py-2.5 px-4 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-medium transition-colors"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
