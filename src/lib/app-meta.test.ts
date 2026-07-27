import { describe, expect, it } from "vitest";
import { APP_NAME } from "./app-meta";

describe("application metadata", () => {
  it("uses the locked product name", () => {
    expect(APP_NAME).toBe("SmartSpace");
  });
});
