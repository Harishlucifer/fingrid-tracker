/**
 * The authorization model, as pure functions so it can be unit-tested and
 * reasoned about in one place.
 *
 * Two roles apply to any project action: the org role on `user.role` and the
 * project role on `project_member.role`. **The narrower of the two always
 * wins.** An org VIEWER who is a project LEAD is still read-only; an org MEMBER
 * who is a project VIEWER is read-only on that project.
 *
 * The one asymmetry: an org ADMIN has MANAGE on every project without needing a
 * membership row, because an admin who cannot unstick a project they were never
 * added to is not an admin.
 *
 * Everything default-denies: an unrecognized role string yields NONE rather
 * than falling through to a permissive branch (`cosmos-gateway`'s rule —
 * reject rather than fall through).
 */

import type { OrgRole, ProjectRole } from "./constants";

/** Ordered least to most capable; compare with `atLeast`. */
export const ACCESS_LEVELS = ["NONE", "VIEW", "EDIT", "MANAGE"] as const;
export type AccessLevel = (typeof ACCESS_LEVELS)[number];

const LEVEL_RANK: Record<AccessLevel, number> = {
  NONE: 0,
  VIEW: 1,
  EDIT: 2,
  MANAGE: 3,
};

export function atLeast(actual: AccessLevel, required: AccessLevel): boolean {
  return LEVEL_RANK[actual] >= LEVEL_RANK[required];
}

/** The most any user with this org role can ever do, anywhere. */
export function orgRoleCeiling(role: string): AccessLevel {
  switch (role as OrgRole) {
    case "ADMIN":
      return "MANAGE";
    case "MEMBER":
      return "EDIT";
    case "VIEWER":
      return "VIEW";
    default:
      return "NONE";
  }
}

/** What this project role grants, before intersecting with the org ceiling. */
export function projectRoleLevel(role: string | null | undefined): AccessLevel {
  switch (role as ProjectRole) {
    case "LEAD":
      return "MANAGE";
    case "MEMBER":
      return "EDIT";
    case "VIEWER":
      return "VIEW";
    default:
      return "NONE";
  }
}

/**
 * Effective access to one project.
 *
 * @param orgRole      `user.role`
 * @param projectRole  `project_member.role`, or null when there is no membership
 */
export function effectiveProjectAccess(
  orgRole: string,
  projectRole: string | null | undefined,
): AccessLevel {
  const ceiling = orgRoleCeiling(orgRole);
  if (ceiling === "NONE") return "NONE";

  // Admins reach every project without a membership row.
  if ((orgRole as OrgRole) === "ADMIN") return "MANAGE";

  const granted = projectRoleLevel(projectRole);
  if (granted === "NONE") return "NONE";

  // Narrower of the two wins.
  return LEVEL_RANK[granted] <= LEVEL_RANK[ceiling] ? granted : ceiling;
}

/** Org-level capabilities that are not project-scoped. */
export function canManageOrgSettings(orgRole: string): boolean {
  return (orgRole as OrgRole) === "ADMIN";
}

export function canCreateProject(orgRole: string): boolean {
  return atLeast(orgRoleCeiling(orgRole), "EDIT");
}
