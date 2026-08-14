import { CheckCircle2, KanbanSquare, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";

import { auth, signIn } from "@/server/auth/config";

import { LoginDenialNotice } from "./login-denial-notice";
import { LoginSubmitButton } from "./login-submit-button";

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
    <main className="bg-background relative flex min-h-full flex-1 overflow-x-clip">
      {/* Form pane */}
      <section className="relative z-10 flex min-w-0 flex-1 items-center justify-center px-4 py-6 sm:px-8 sm:py-10 lg:px-10">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <div className="bg-accent/10 absolute -top-32 -left-28 size-80 rounded-full blur-3xl" />
          <div className="bg-primary/5 absolute -right-28 -bottom-40 size-96 rounded-full blur-3xl" />
        </div>

        <div className="bg-card shadow-raised relative w-full max-w-md rounded-[1.75rem] border p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="bg-primary text-primary-foreground flex size-11 items-center justify-center rounded-xl text-sm font-bold shadow-sm"
            >
              PM
            </span>
            <div>
              <p className="text-sm font-semibold tracking-tight">Inforvio</p>
              <p className="text-muted-foreground text-xs">
                Project management workspace
              </p>
            </div>
          </div>

          <div className="mt-9">
            <p className="text-accent text-xs font-semibold tracking-[0.16em] uppercase">
              Welcome back
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              Sign in to your workspace
            </h1>
            <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
              Continue with your approved work Google account. No separate
              password required.
            </p>
          </div>

          <LoginDenialNotice error={error} />

          <form action={signInWithGoogle} className="mt-7">
            <LoginSubmitButton />
          </form>

          <div className="bg-secondary/70 mt-6 flex items-start gap-3 rounded-xl px-4 py-3.5">
            <ShieldCheck
              className="text-accent mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
            <p className="text-muted-foreground text-xs leading-relaxed">
              <span className="text-foreground font-medium">
                Secure access.
              </span>{" "}
              Google verifies your identity; your workspace administrator
              controls access.
            </p>
          </div>

          {!error && (
            <p className="text-muted-foreground mt-5 text-center text-xs leading-relaxed">
              Need access? Ask your workspace administrator to approve your
              email domain.
            </p>
          )}
        </div>
      </section>

      {/* Brand pane — decorative, so it is hidden from assistive tech and small screens. */}
      <aside
        aria-hidden="true"
        className="relative hidden w-[46%] min-w-[30rem] shrink-0 overflow-hidden bg-[#012756] text-white lg:flex xl:w-[48%]"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-80"
          style={{
            background:
              "radial-gradient(55rem 42rem at 15% 15%, rgb(49 133 255 / 0.5), transparent 58%), radial-gradient(42rem 36rem at 90% 88%, rgb(91 155 255 / 0.3), transparent 62%)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              "linear-gradient(rgb(255 255 255) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage:
              "linear-gradient(to bottom, transparent, black 18%, black 82%, transparent)",
          }}
        />

        <div className="relative flex w-full items-center px-10 py-10 xl:px-16 xl:py-12 2xl:px-20">
          <div className="mx-auto w-full max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-white/80 backdrop-blur-sm">
              <KanbanSquare className="size-3.5" />
              Inforvio project management
            </div>

            <h2 className="mt-7 max-w-xl text-4xl leading-[1.1] font-semibold tracking-tight xl:text-5xl">
              From backlog to done, everyone stays in sync.
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/70 xl:text-base">
              Plan projects, protect focus, and keep the next decision visible
              to the whole team.
            </p>

            <BoardPreview />

            <ul className="mt-6 hidden grid-cols-3 gap-3 text-xs text-white/75 xl:grid">
              <Feature icon={KanbanSquare}>Clear workflows</Feature>
              <Feature icon={CheckCircle2}>Visible progress</Feature>
              <Feature icon={ShieldCheck}>Controlled access</Feature>
            </ul>
          </div>
        </div>
      </aside>
    </main>
  );
}

const BOARD_COLUMNS = [
  {
    label: "TO DO",
    count: 4,
    accent: "bg-[#5b9bff]",
    tasks: ["Finalize sprint scope", "Review API contract"],
  },
  {
    label: "IN PROGRESS",
    count: 2,
    accent: "bg-[#f6b94a]",
    tasks: ["Polish login experience", "Prepare release notes"],
  },
  {
    label: "DONE",
    count: 6,
    accent: "bg-[#45d49a]",
    tasks: ["Confirm domain access", "Triage customer feedback"],
  },
] as const;

function BoardPreview() {
  return (
    <div className="mt-7 rounded-2xl border border-white/15 bg-white/[0.08] p-3.5 shadow-2xl shadow-black/15 backdrop-blur-md xl:mt-8 xl:p-4">
      <div className="flex items-center justify-between gap-4 border-b border-white/10 px-1 pb-3">
        <div>
          <p className="text-xs font-semibold">Website refresh</p>
          <p className="mt-0.5 text-[10px] text-white/50">Release workspace</p>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-2 py-1 text-[10px] font-medium text-white/75">
          <span className="size-1.5 rounded-full bg-[#45d49a]" />
          Live
        </span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2.5">
        {BOARD_COLUMNS.map((column) => (
          <div key={column.label} className="min-w-0">
            <div className="flex items-center gap-1.5 px-1 text-[9px] font-semibold tracking-[0.12em] text-white/55">
              <span className={`size-1.5 rounded-full ${column.accent}`} />
              <span className="truncate">{column.label}</span>
              <span className="ml-auto text-white/35">{column.count}</span>
            </div>

            <div className="mt-2 space-y-2">
              {column.tasks.map((task) => (
                <div
                  key={task}
                  className="rounded-lg border border-white/10 bg-[#092f62]/80 px-2.5 py-2.5 shadow-sm"
                >
                  <p className="line-clamp-2 text-[10px] leading-snug font-medium text-white/85">
                    {task}
                  </p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="h-1 w-8 rounded-full bg-white/15">
                      <span
                        className={`block h-full rounded-full ${column.accent}`}
                        style={{
                          width:
                            column.label === "DONE"
                              ? "100%"
                              : column.label === "IN PROGRESS"
                                ? "62%"
                                : "28%",
                        }}
                      />
                    </span>
                    <span className="flex -space-x-1">
                      <span className="size-4 rounded-full border border-[#17467c] bg-[#5b9bff]" />
                      <span className="size-4 rounded-full border border-[#17467c] bg-[#b9d2ff]" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
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
    <li className="flex items-center gap-2">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/10">
        <Icon className="size-3.5 text-white/70" />
      </span>
      <span className="leading-snug">{children}</span>
    </li>
  );
}
