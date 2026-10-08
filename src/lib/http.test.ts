import { describe, it, expect, vi, beforeEach } from "vitest";
const auth = vi.hoisted(() => ({
  getAdmin: vi.fn(),
  validAdminOrigin: vi.fn(),
}));
vi.mock("@/lib/auth", () => auth);
import { adminWriteGuard } from "./http";
describe("admin authorization", () => {
  beforeEach(() => vi.resetAllMocks());
  it("rejects unauthenticated admin writes", async () => {
    auth.getAdmin.mockResolvedValue(null);
    const response = await adminWriteGuard();
    expect(response?.status).toBe(401);
  });
  it("rejects cross-origin admin writes", async () => {
    auth.getAdmin.mockResolvedValue({ id: "1" });
    auth.validAdminOrigin.mockResolvedValue(false);
    const response = await adminWriteGuard();
    expect(response?.status).toBe(403);
  });
  it("permits signed-in same-origin writes", async () => {
    auth.getAdmin.mockResolvedValue({ id: "1" });
    auth.validAdminOrigin.mockResolvedValue(true);
    expect(await adminWriteGuard()).toBeNull();
  });
});
