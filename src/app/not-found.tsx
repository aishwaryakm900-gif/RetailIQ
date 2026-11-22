import Link from 'next/link';

export default function RootNotFound() {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-slate-700 bg-slate-800 p-6 text-center shadow-2xl space-y-4">
          <h2 className="text-2xl font-bold tracking-tight text-white">404 - Not Found</h2>
          <p className="text-sm text-slate-400">
            The page you are looking for does not exist.
          </p>
          <Link
            href="/en/inventory"
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-primary-600 text-white font-medium hover:bg-primary-500 transition-colors"
          >
            Go to Inventory
          </Link>
        </div>
      </body>
    </html>
  );
}
