import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("senha", () => {
  it("confere a senha certa e recusa a errada; hash não contém a senha", async () => {
    const h = await hashPassword("senha-forte-123");
    expect(h).not.toContain("senha-forte-123");
    expect(await verifyPassword("senha-forte-123", h)).toBe(true);
    expect(await verifyPassword("senha-forte-124", h)).toBe(false);
    expect(await verifyPassword("x", "lixo")).toBe(false);
  });
  it("salt diferente a cada hash", async () => {
    expect(await hashPassword("senha-forte-123")).not.toBe(await hashPassword("senha-forte-123"));
  });
  it("recusa senha curta", async () => {
    await expect(hashPassword("curta")).rejects.toThrow();
  });
});
