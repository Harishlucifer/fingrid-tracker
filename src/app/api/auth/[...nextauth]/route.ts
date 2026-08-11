/**
 * Auth.js route handler. The Google callback URL registered in Google Cloud
 * Console must be exactly:
 *
 *   http://localhost:3000/api/auth/callback/google
 *   https://<prod-host>/api/auth/callback/google
 *
 * Node runtime, because the adapter talks to MySQL through Prisma.
 */

import { handlers } from "@/server/auth/config";

export const runtime = "nodejs";

export const { GET, POST } = handlers;
