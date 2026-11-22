import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-2xl border border-border bg-card p-6 text-center shadow-lg space-y-4">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Page Not Found</h2>
        <p className="text-sm text-muted-foreground">
          The requested page or resource could not be found.
        </p>
        <Link
          href="/en/inventory"
          className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity"
        >
          Go to Inventory
        </Link>
      </div>
    </div>
  );
}
