import { describe, it, expect } from "vitest";
import { normalizeSearchQuery } from "../src/tools/inbox.js";

describe("normalizeSearchQuery", () => {
  describe("bare single-word queries", () => {
    it("wraps a bare word with subject prefix", () => {
      expect(normalizeSearchQuery("toilet")).toBe("subject toilet");
    });

    it("wraps a bare invoice query", () => {
      expect(normalizeSearchQuery("invoice")).toBe("subject invoice");
    });

    it("wraps a bare cat query", () => {
      expect(normalizeSearchQuery("cat")).toBe("subject cat");
    });

    it("trims and wraps a padded bare word", () => {
      expect(normalizeSearchQuery("  toilet  ")).toBe("subject toilet");
    });
  });

  describe("qualified queries", () => {
    it("passes through a subject query", () => {
      expect(normalizeSearchQuery("subject invoice")).toBe("subject invoice");
    });

    it("passes through a from query", () => {
      expect(normalizeSearchQuery("from bob")).toBe("from bob");
    });

    it("passes through a to query", () => {
      expect(normalizeSearchQuery("to alice")).toBe("to alice");
    });

    it("passes through a body query", () => {
      expect(normalizeSearchQuery("body meeting")).toBe("body meeting");
    });

    it("passes through a date query", () => {
      expect(normalizeSearchQuery("date 2026-01-01")).toBe("date 2026-01-01");
    });

    it("passes through a before query", () => {
      expect(normalizeSearchQuery("before 2026-06-01")).toBe("before 2026-06-01");
    });

    it("passes through an after query", () => {
      expect(normalizeSearchQuery("after 2026-01-01")).toBe("after 2026-01-01");
    });

    it("passes through a flag query", () => {
      expect(normalizeSearchQuery("flag Seen")).toBe("flag Seen");
    });
  });

  describe("multi-word queries", () => {
    it("passes through multi-word phrases", () => {
      expect(normalizeSearchQuery("meeting notes")).toBe("meeting notes");
    });

    it("passes through another multi-word phrase", () => {
      expect(normalizeSearchQuery("urgent deadline")).toBe("urgent deadline");
    });
  });

  describe("operator queries", () => {
    it("passes through and queries", () => {
      expect(normalizeSearchQuery("invoice and paypal")).toBe("invoice and paypal");
    });

    it("passes through or queries", () => {
      expect(normalizeSearchQuery("urgent or important")).toBe("urgent or important");
    });

    it("passes through not queries", () => {
      expect(normalizeSearchQuery("spam not ham")).toBe("spam not ham");
    });

    it("wraps words containing operator substrings", () => {
      expect(normalizeSearchQuery("branding")).toBe("subject branding");
    });

    it("wraps words containing 'or' substring", () => {
      expect(normalizeSearchQuery("fork")).toBe("subject fork");
    });
  });

  describe("qualified multi-word queries", () => {
    it("passes through qualified multi-word queries", () => {
      expect(normalizeSearchQuery("subject meeting notes")).toBe("subject meeting notes");
    });

    it("passes through combined qualified queries", () => {
      expect(normalizeSearchQuery("from alice and subject meeting")).toBe(
        "from alice and subject meeting",
      );
    });
  });

  describe("empty and whitespace", () => {
    it("passes through empty string", () => {
      expect(normalizeSearchQuery("")).toBe("");
    });

    it("passes through whitespace-only string", () => {
      expect(normalizeSearchQuery("   ")).toBe("");
    });
  });
});
