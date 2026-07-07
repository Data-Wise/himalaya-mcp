import { describe, it, expect } from "vitest";
import { getTrashFolder } from "../src/himalaya/trash";

describe("getTrashFolder", () => {
  it('returns "[Gmail]/Trash" for Gmail accounts', () => {
    expect(getTrashFolder("gmail")).toBe("[Gmail]/Trash");
    expect(getTrashFolder("my.gmail")).toBe("[Gmail]/Trash");
    expect(getTrashFolder("personal-gmail")).toBe("[Gmail]/Trash");
  });

  it('returns "Deleted Items" for Exchange / Outlook accounts', () => {
    expect(getTrashFolder("exchange")).toBe("Deleted Items");
    expect(getTrashFolder("outlook")).toBe("Deleted Items");
    expect(getTrashFolder("office-work")).toBe("Deleted Items");
    expect(getTrashFolder("office365")).toBe("Deleted Items");
  });

  it('returns "Trash" for unknown / other providers', () => {
    expect(getTrashFolder("fastmail")).toBe("Trash");
    expect(getTrashFolder("protonmail")).toBe("Trash");
    expect(getTrashFolder("icloud")).toBe("Trash");
    expect(getTrashFolder("unm")).toBe("Trash");
    expect(getTrashFolder("personal")).toBe("Trash");
    expect(getTrashFolder("work")).toBe("Trash");
  });

  it('returns "Trash" when no account name is provided', () => {
    expect(getTrashFolder()).toBe("Trash");
    expect(getTrashFolder("")).toBe("Trash");
  });

  it("is case-insensitive", () => {
    expect(getTrashFolder("GMAIL")).toBe("[Gmail]/Trash");
    expect(getTrashFolder("Outlook")).toBe("Deleted Items");
    expect(getTrashFolder("Exchange")).toBe("Deleted Items");
  });
});
