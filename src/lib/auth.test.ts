import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const fixture = vi.hoisted(() => ({
  headers: new Headers(),
  get: vi.fn(),
  set: vi.fn(),
  find: vi.fn(),
  remove: vi.fn(),
  create: vi.fn(),
  user: vi.fn(),
  compare: vi.fn(),
  limited: vi.fn(),
}));
vi.mock("next/headers", () => ({
  headers: async () => fixture.headers,
  cookies: async () => ({ get: fixture.get, set: fixture.set }),
}));
vi.mock("@/lib/db", () => ({
  db: {
    adminUser: { findUnique: fixture.user },
    adminSession: {
      findUnique: fixture.find,
      deleteMany: fixture.remove,
      create: fixture.create,
    },
  },
}));
vi.mock("bcryptjs", () => ({ default: { compare: fixture.compare } }));
vi.mock("@/lib/rate-limit", () => ({ rateLimited: fixture.limited }));
import {
  createSession,
  deleteSession,
  getAdmin,
  validAdminOrigin,
  validOrigin,
} from "./auth";
import { adminWriteGuard, publicWriteGuard } from "./http";
import { POST as login } from "@/app/api/admin/login/route";
import { POST as logout } from "@/app/api/admin/logout/route";
const publicOrigin = "https://maqamstay-staging.169-58-95-12.sslip.io";
const crmOrigin = "https://maqamstay-crm.169-58-95-12.sslip.io";
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", publicOrigin);
  vi.stubEnv("CUSTOMER_CRM_ORIGIN", crmOrigin);
  fixture.headers = new Headers({
    host: new URL(crmOrigin).host,
    origin: crmOrigin,
  });
  fixture.get.mockReturnValue({ value: "a".repeat(64) });
  fixture.find.mockResolvedValue({
    expiresAt: new Date(Date.now() + 60000),
    admin: {
      id: "fixture",
      name: "QA",
      email: "qa@example.test",
      active: true,
    },
  });
  fixture.limited.mockResolvedValue(false);
  fixture.compare.mockResolvedValue(true);
  fixture.user.mockResolvedValue({
    id: "fixture",
    active: true,
    passwordHash: "fixture-hash",
  });
});
afterEach(() => vi.unstubAllEnvs());
describe("CRM authentication, cookie and Origin boundary", () => {
  const loginRequest = () =>
    new Request(crmOrigin + "/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "QA@example.test",
        password: "generated-test-only",
      }),
    });
  it("authenticates CRM login and retains the existing login rate limit", async () => {
    expect((await login(loginRequest())).status).toBe(200);
    expect(fixture.limited).toHaveBeenCalledWith("login", 10, 15);
    expect(fixture.user).toHaveBeenCalledWith({
      where: { email: "qa@example.test" },
    });
    expect(fixture.create).toHaveBeenCalled();
    expect(fixture.set.mock.calls[0][2]).not.toHaveProperty("domain");
  });
  it("rejects public-origin login before credential lookup or cookie creation", async () => {
    fixture.headers.set("origin", publicOrigin);
    expect((await login(loginRequest())).status).toBe(403);
    expect(fixture.limited).not.toHaveBeenCalled();
    expect(fixture.user).not.toHaveBeenCalled();
    expect(fixture.set).not.toHaveBeenCalled();
  });
  it("rejects rate-limited login without credential lookup", async () => {
    fixture.limited.mockResolvedValue(true);
    expect((await login(loginRequest())).status).toBe(429);
    expect(fixture.user).not.toHaveBeenCalled();
  });
  it("logs out through the CRM route without a cross-host redirect", async () => {
    const response = await logout();
    expect(response.status).toBe(200);
    expect(response.headers.has("location")).toBe(false);
    expect(fixture.set.mock.calls[0][2]).toMatchObject({
      maxAge: 0,
      secure: true,
    });
  });
  it("accepts a valid persisted session and exact CRM origin", async () => {
    expect(await getAdmin()).toMatchObject({ id: "fixture" });
    expect(await validAdminOrigin()).toBe(true);
    expect(await adminWriteGuard()).toBeNull();
  });
  it.each([
    publicOrigin,
    "https://arbitrary.example.test",
    "http://maqamstay-crm.169-58-95-12.sslip.io",
    crmOrigin + "/",
    "null",
    "invalid",
  ])("rejects mutation Origin %s with a valid session", async (origin) => {
    fixture.headers.set("origin", origin);
    expect(await validAdminOrigin()).toBe(false);
    expect((await adminWriteGuard())?.status).toBe(403);
  });
  it("rejects absent Origin", async () => {
    fixture.headers.delete("origin");
    expect(await validAdminOrigin()).toBe(false);
  });
  it("rejects unauthenticated admin writes", async () => {
    fixture.get.mockReturnValue(undefined);
    expect((await adminWriteGuard())?.status).toBe(401);
  });
  it("does not recognize sessions or create cookies on the public host", async () => {
    fixture.headers.set("host", new URL(publicOrigin).host);
    expect(await getAdmin()).toBeNull();
    expect(fixture.find).not.toHaveBeenCalled();
    await expect(createSession("fixture")).rejects.toThrow("CRM host required");
    expect(fixture.create).not.toHaveBeenCalled();
    expect(fixture.set).not.toHaveBeenCalled();
    expect(await validAdminOrigin()).toBe(false);
  });
  it("issues a secure HttpOnly Lax host-only cookie on CRM", async () => {
    await createSession("fixture");
    const [name, token, options] = fixture.set.mock.calls[0];
    expect(name).toBe("maqamstay_admin");
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(options).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 86400,
    });
    expect(options).not.toHaveProperty("domain");
    expect(fixture.create.mock.calls[0][0].data.tokenHash).not.toBe(token);
  });
  it("logout revokes the session and expires only the CRM-host cookie", async () => {
    await deleteSession();
    expect(fixture.remove).toHaveBeenCalled();
    expect(fixture.set.mock.calls[0][2]).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  });
  it("preserves public request/quote-interest origin without allowing CRM to submit them", async () => {
    fixture.headers = new Headers({
      host: new URL(publicOrigin).host,
      origin: publicOrigin,
    });
    expect(await validOrigin()).toBe(true);
    expect(await publicWriteGuard()).toBeNull();
    fixture.headers.set("origin", crmOrigin);
    expect((await publicWriteGuard())?.status).toBe(403);
  });
  it("rejects expired or disabled persisted sessions", async () => {
    fixture.find.mockResolvedValue({
      expiresAt: new Date(0),
      admin: { active: true },
    });
    expect(await getAdmin()).toBeNull();
    fixture.find.mockResolvedValue({
      expiresAt: new Date(Date.now() + 60000),
      admin: { active: false },
    });
    expect(await getAdmin()).toBeNull();
  });
});
