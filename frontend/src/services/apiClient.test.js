import { describe, expect, it } from "vitest";

import { parseApiResponse } from "./apiClient";

describe("parseApiResponse", () => {
  it("returns parsed json for successful responses", async () => {
    const response = {
      ok: true,
      json: async () => ({ status: "ok" }),
    };

    await expect(parseApiResponse(response, "fallback")).resolves.toEqual({ status: "ok" });
  });

  it("throws API detail when available", async () => {
    const response = {
      ok: false,
      json: async () => ({ detail: "specific error" }),
    };

    await expect(parseApiResponse(response, "fallback")).rejects.toThrow("specific error");
  });

  it("falls back to supplied message when detail is missing", async () => {
    const response = {
      ok: false,
      json: async () => ({}),
    };

    await expect(parseApiResponse(response, "fallback")).rejects.toThrow("fallback");
  });
});
