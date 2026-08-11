"use server";

/**
 * Server actions for auth transitions.
 *
 * Sign-out goes through Auth.js's `signOut` rather than a hand-rolled POST to
 * /api/auth/signout: that endpoint requires a CSRF token, and `signOut` supplies
 * it. It also deletes the `session` row, which is what actually ends the
 * session under the database strategy — clearing the cookie alone would leave a
 * valid row behind.
 */

import { signOut } from "./config";

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}
