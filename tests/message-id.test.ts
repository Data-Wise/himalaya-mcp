import { describe, it, expect } from "vitest";
import { z } from "zod";
import { messageId } from "../src/tools/_id.js";

describe("messageId schema", () => {
  const schema = z.object({ id: messageId() });

  it("accepts strings and non-negative integers, always yielding a string", () => {
    expect(schema.parse({ id: "42" }).id).toBe("42");
    expect(schema.parse({ id: 42 }).id).toBe("42");
    expect(schema.parse({ id: 0 }).id).toBe("0");
  });

  it("rejects values z.coerce.string() would have turned into bogus IDs", () => {
    for (const bad of [null, undefined, {}, [], true, 1.5, -3, NaN, Infinity]) {
      expect(schema.safeParse({ id: bad }).success).toBe(false);
    }
  });

  it("carries the description", () => {
    expect(messageId("Email message ID to snooze").description).toBe("Email message ID to snooze");
  });
});
