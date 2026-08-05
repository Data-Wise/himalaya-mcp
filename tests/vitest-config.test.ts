import { describe, it, expect } from "vitest";
import config from "../vitest.config";

describe("vitest.config", () => {
  it("uses the threads pool so pool workers cannot be orphaned by a parent kill", () => {
    expect(config.test?.pool).toBe("threads");
  });
});
