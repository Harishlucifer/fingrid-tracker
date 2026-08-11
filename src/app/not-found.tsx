import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-full flex-1 items-center justify-center px-4 py-16">
      <div className="text-center">
        <p className="text-muted-foreground font-mono text-sm">404</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Page not found
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          The page you were looking for does not exist, or you do not have access
          to it.
        </p>
        <Link
          href="/dashboard"
          className="text-accent mt-6 inline-block text-sm hover:underline"
        >
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
