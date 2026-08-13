/**
 * The authorization model. These tests encode the two rules that matter:
 * the narrower of (org role, project role) wins, and everything default-denies.
 */

import { describe, expect, it } from "vitest";

import {
  atLeast,
  canCreateProject,
  canEditTasks,
  canManageOrgSettings,
  effectiveProjectAccess,
  orgRoleCeiling,
  projectRoleLevel,
} from "@/lib/permissions";

describe("orgRoleCeiling", () => {
  it("maps known roles", () => {
    expect(orgRoleCeiling("ADMIN")).toBe("MANAGE");
    expect(orgRoleCeiling("MEMBER")).toBe("EDIT");
    expect(orgRoleCeiling("VIEWER")).toBe("VIEW");
  });

  it("default-denies an unknown role rather than falling through", () => {
    for (const bad of ["", "admin", "SUPERUSER", "OWNER", "null"]) {
      expect(orgRoleCeiling(bad), `expected NONE for ${bad}`).toBe("NONE");
    }
  });
});

describe("projectRoleLevel", () => {
  it("maps known roles and denies the rest", () => {
    expect(projectRoleLevel("LEAD")).toBe("MANAGE");
    expect(projectRoleLevel("MEMBER")).toBe("EDIT");
    expect(projectRoleLevel("VIEWER")).toBe("VIEW");
    expect(projectRoleLevel(null)).toBe("NONE");
    expect(projectRoleLevel(undefined)).toBe("NONE");
    expect(projectRoleLevel("OWNER")).toBe("NONE");
  });
});

describe("effectiveProjectAccess", () => {
  it("gives admins MANAGE without a membership row", () => {
    expect(effectiveProjectAccess("ADMIN", null)).toBe("MANAGE");
    expect(effectiveProjectAccess("ADMIN", "VIEWER")).toBe("MANAGE");
  });

  it("denies a non-admin with no membership", () => {
    expect(effectiveProjectAccess("MEMBER", null)).toBe("NONE");
    expect(effectiveProjectAccess("VIEWER", null)).toBe("NONE");
  });

  it("takes the NARROWER of org and project role", () => {
    // Org ceiling is lower than the project grant.
    expect(effectiveProjectAccess("VIEWER", "LEAD")).toBe("VIEW");
    expect(effectiveProjectAccess("MEMBER", "LEAD")).toBe("EDIT");
    // Project grant is lower than the org ceiling.
    expect(effectiveProjectAccess("MEMBER", "VIEWER")).toBe("VIEW");
    // Equal.
    expect(effectiveProjectAccess("MEMBER", "MEMBER")).toBe("EDIT");
  });

  it("denies entirely when the org role is unrecognized", () => {
    expect(effectiveProjectAccess("GHOST", "LEAD")).toBe("NONE");
  });
});

describe("atLeast", () => {
  it("orders levels correctly", () => {
    expect(atLeast("MANAGE", "EDIT")).toBe(true);
    expect(atLeast("EDIT", "EDIT")).toBe(true);
    expect(atLeast("VIEW", "EDIT")).toBe(false);
    expect(atLeast("NONE", "VIEW")).toBe(false);
  });
});

describe("org-level capabilities", () => {
  it("restricts settings to admins", () => {
    expect(canManageOrgSettings("ADMIN")).toBe(true);
    expect(canManageOrgSettings("MEMBER")).toBe(false);
    expect(canManageOrgSettings("VIEWER")).toBe(false);
    expect(canManageOrgSettings("nonsense")).toBe(false);
  });

  it("restricts creating projects to admins", () => {
    expect(canCreateProject("ADMIN")).toBe(true);
    expect(canCreateProject("MEMBER")).toBe(false);
    expect(canCreateProject("VIEWER")).toBe(false);
    expect(canCreateProject("nonsense")).toBe(false);
  });

  /**
   * Distinct from creating a project on purpose: a MEMBER still works inside
   * the projects they belong to, so the board stays draggable for them.
   */
  it("lets members and admins edit tasks, but not viewers", () => {
    expect(canEditTasks("ADMIN")).toBe(true);
    expect(canEditTasks("MEMBER")).toBe(true);
    expect(canEditTasks("VIEWER")).toBe(false);
    expect(canEditTasks("nonsense")).toBe(false);
  });
});
