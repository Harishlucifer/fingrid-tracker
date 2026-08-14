import { AlertTriangle } from "lucide-react";

import { SignInDenial } from "@/server/auth/config";

/**
 * Explains a refused sign-in.
 *
 * The wording is deliberately unhelpful about *why* a domain is not allowed and
 * never reveals which domains are — that would turn the login page into a
 * configuration oracle. It tells the user what to do instead.
 */
export function LoginDenialNotice({ error }: { error?: string }) {
  if (!error) return null;

  const message = resolveMessage(error);

  return (
    <div
      role="alert"
      className="border-danger/30 bg-danger-bg mt-6 flex gap-3 rounded-xl border px-4 py-3.5"
    >
      <span className="bg-danger/10 text-danger flex size-7 shrink-0 items-center justify-center rounded-lg">
        <AlertTriangle className="size-4" aria-hidden="true" />
      </span>
      <div>
        <p className="text-danger text-sm font-semibold">
          We couldn&apos;t sign you in
        </p>
        <p className="text-danger mt-1 text-xs leading-relaxed">{message}</p>
      </div>
    </div>
  );
}

function resolveMessage(error: string): string {
  switch (error) {
    case SignInDenial.DomainNotAllowed:
      return "That account's email domain is not approved for this workspace. Ask an administrator to add it, then try again.";
    case SignInDenial.AccountDisabled:
      return "This account has been deactivated. Contact an administrator if you think that is a mistake.";
    case SignInDenial.VerificationFailed:
      return "Google could not confirm that email address is verified, so sign-in was refused.";
    // Auth.js's own generic codes.
    case "AccessDenied":
      return "Sign-in was refused. Your email domain may not be approved for this workspace.";
    case "OAuthAccountNotLinked":
      return "That email is already registered through a different sign-in method.";
    case "Configuration":
      return "Sign-in is temporarily unavailable. Contact your workspace administrator if the problem continues.";
    default:
      return "Sign-in failed. Please try again, or contact an administrator if it keeps happening.";
  }
}
