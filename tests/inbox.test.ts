import { describe, it, expect } from "vitest";
import { normalizeSearchQuery } from "../src/tools/inbox.js";

describe("normalizeSearchQuery", () => {
  describe("bare single-word queries → wraps with subject", () => {
    it('wraps "toilet" as "subject toilet"', () => {
      expect(normalizeSearchQuery("toilet")).toBe("subject toilet");
    });

    it('wraps "invoice" as "subject invoice"', () => {
      expect(normalizeSearchQuery("invoice")).toBe("subject invoice");
    });

    it('wraps "cat" as "subject cat"', () => {
      expect(normalizeSearchQuery("cat")).toBe("subject cat");
    });

    it("handles leading/trailing whitespace", () => {
      expect(normalizeSearchQuery("  toilet  ")).toBe("subject toilet");
    });
  });

  describe("already-qualified queries → pass through unchanged", () => {
    it('passes through "subject invoice"', () => {
      expect(normalizeSearchQuery("subject invoice")).toBe("subject invoice");
    });

    it('passes through "from bob"', () => {
      expect(normalizeSearchQuery("from bob")).toBe("from bob");
    });

    it('passes through "to alice"', () => {
      expect(normalizeSearchQuery("to alice")).toBe("to alice");
    });

    it('passes through "body meeting"', () => {
      expect(normalizeSearchQuery("body meeting")).toBe("body meeting");
    });

    it('passes through "date 2026-01-01"', () => {
      expect(normalizeSearchQuery("date 2026-01-01")).toBe("date 2026-01-01");
    });

    it('passes through "before 2026-06-01"', () => {
      expect(normalizeSearchQuery("before 2026-06-01")).toBe("before 2026-06-01");
    });

    it('passes through "after 2026-01-01"', () => {
      expect(normalizeSearchQuery("after 2026-01-01")).toBe("after 2026-01-01");
    });

    it('passes through "flag Seen"', () => {
      expect(normalizeSearchQuery("flag Seen")).toBe("flag Seen");
    });
  });

  describe("multi-word queries → pass through unchanged", () => {
    it('passes through "meeting notes"', () => {
      expect(normalizeSearchQuery("meeting notes")).toBe("meeting notes");
    });

    it('passes through "urgent deadline"', () => {
      expect(normalizeSearchQuery("urgent deadline")).toBe("urgent deadline");
    });
  });

  describe("queries with operators → pass through unchanged", () => {
    it('passes through "invoice and paypal"', () => {
      expect(normalizeSearchQuery("invoice and paypal")).toBe("invoice and paypal");
    });

    it('passes through "urgent or important"', () => {
      expect(normalizeSearchQuery("urgent or important")).toBe("urgent or important");
    });

    it('passes through "spam not ham"', () => {
      expect(normalizeSearchQuery("spam not ham")).toBe("spam not ham");
    });

    it('passes through word containing "and" as substring', () => {
      // "branding" contains "and" — should not match the operator
      expect(normalizeSearchQuery("branding")).toBe("subject branding");
    });

    it('passes through word containing "or" as substring', () => {
      // "fork" contains "or" — should not match the operator
      expect(normalizeSearchQuery("fork")).toBe("subject fork");
    });
  });

  describe("qualified multi-word queries → pass through unchanged", () => {
    it('passes through "subject meeting notes"', () => {
      expect(normalizeSearchQuery("subject meeting notes")).toBe("subject meeting notes");
    });

    it('passes through "from alice and subject meeting"', () => {
      expect(normalizeSearchQuery("from alice and subject meeting")).toBe("from alice and subject meeting");
    });
  });

  describe("empty/whitespace queries", () => {
    it("returns empty string for empty query", () => {
      expect(normalizeSearchQuery("")).toBe("");
    });

    it("returns empty string for whitespace-only query", () => {
      expect(normalizeSearchQuery("   ")).toBe("");
    });
  });
});
