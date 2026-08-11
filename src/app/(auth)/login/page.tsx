import { CheckCircle2, KanbanSquare, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";

import { auth, signIn } from "@/server/auth/config";

import { LoginDenialNotice } from "./login-denial-notice";

export const metadata = { title: "Sign in · Inforvio PM" };

/**
 * Sign-in screen. Google is the only credential channel.
 *
 * Two panes: the form, and a brand panel that is hidden below `lg` so small
 * screens get the form immediately rather than scrolling past decoration.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;

  const session = await auth();
  if (session?.user?.isActive) {
    redirect(next && next.startsWith("/") ? next : "/dashboard");
  }

  async function signInWithGoogle() {
    "use server";
    // Only same-origin relative paths are accepted as a return target, so
    // ?next= cannot be used as an open redirect.
    const target = next && next.startsWith("/") ? next : "/dashboard";
    await signIn("google", { redirectTo: target });
  }

  return (
    <main className="flex min-h-full flex-1">
      {/* Form pane */}
      <div className="flex flex-1 items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <span className="bg-primary text-primary-foreground mb-5 flex size-11 items-center justify-center rounded-xl text-sm font-bold">
              PM
            </span>
            <h1 className="text-2xl font-semibold tracking-tight">
              Sign in to Inforvio PM
            </h1>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              Use your work Google account. Access is limited to approved email
              domains.
            </p>
          </div>

          <LoginDenialNotice error={error} />

          <form action={signInWithGoogle}>
            <button
              type="submit"
              className="border-input bg-card hover:bg-secondary shadow-card flex w-full items-center justify-center gap-3 rounded-lg border px-4 py-3 text-sm font-medium transition-colors focus-visible:outline-none"
            >
              <GoogleMark />
              Continue with Google
            </button>
          </form>

          <p className="text-muted-foreground mt-8 text-xs leading-relaxed">
            If your account is refused, your email domain has not been approved
            yet — ask an administrator to add it.
          </p>
        </div>
      </div>

      {/* Brand pane — decorative, so it is hidden from assistive tech and small screens. */}
      <aside
        aria-hidden="true"
        className="bg-primary text-primary-foreground relative hidden w-1/2 max-w-2xl flex-col justify-center overflow-hidden px-14 lg:flex"
      >
        {/* Soft radial wash; pure CSS, no asset to load. */}
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(60rem 40rem at 15% 20%, rgb(49 133 255 / 0.45), transparent 60%), radial-gradient(40rem 30rem at 85% 85%, rgb(91 155 255 / 0.28), transparent 60%)",
          }}
        />

        <div className="relative">
          <p className="text-sm font-medium tracking-wide text-white/70 uppercase">
            Inforvio
          </p>
          <p className="mt-3 max-w-md text-3xl leading-tight font-semibold">
            Plan the work, track the work, see where it stands.
          </p>

          <ul className="mt-10 space-y-4 text-sm text-white/85">
            <Feature icon={KanbanSquare}>
              Kanban boards, sprints and a groomed backlog
            </Feature>
            <Feature icon={CheckCircle2}>
              Comments, mentions, attachments and time tracking
            </Feature>
            <Feature icon={ShieldCheck}>
              Google sign-in restricted to domains you approve
            </Feature>
          </ul>
        </div>
      </aside>
    </main>
  );
}

function Feature({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3">
      <Icon className="mt-0.5 size-4.5 shrink-0 text-white/60" />
      <span className="leading-relaxed">{children}</span>
    </li>
  );
}

function GoogleMark() {
  return (
    <svg className="size-5 shrink-0" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.89 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.34A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.94H.96a9 9 0 0 0 0 8.12l3.01-2.34Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.94l3.01 2.34C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}
