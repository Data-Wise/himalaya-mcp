/**
 * Thread/conversation grouping for email envelopes.
 *
 * Groups envelopes into conversation threads using normalized
 * subject-line matching. This is the fast path that works with
 * data available from `envelope list` (no per-message fetches).
 */

import type { Address, Envelope, Thread } from "./types.js";

/**
 * Strip Re:/Fwd:/RE:/FW: prefixes from a subject line.
 * Handles nested prefixes (Re: Re: Fwd:) and variations.
 */
export function normalizeSubject(subject: string): string {
  // Pattern: optional Re:/Fwd:/FW:/RE: (case-insensitive) with optional [N]
  // Repeat until no more prefixes remain
  let normalized = subject.trim();
  const prefixPattern = /^(?:re|fwd|fw)\s*(?:\[\d+\])?\s*:\s*/i;
  while (prefixPattern.test(normalized)) {
    normalized = normalized.replace(prefixPattern, "").trim();
  }
  return normalized;
}

/**
 * Group envelopes into conversation threads by normalized subject.
 * Returns threads sorted by latest_date descending (newest first).
 */
export function groupIntoThreads(envelopes: Envelope[]): Thread[] {
  if (envelopes.length === 0) return [];

  // Group by normalized subject
  const groups = new Map<string, Envelope[]>();

  for (const env of envelopes) {
    const key = normalizeSubject(env.subject).toLowerCase();
    const group = groups.get(key);
    if (group) {
      group.push(env);
    } else {
      groups.set(key, [env]);
    }
  }

  // Convert groups to Thread objects
  const threads: Thread[] = [];

  for (const [, messages] of groups) {
    // Sort messages chronologically (oldest first)
    const sorted = [...messages].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Collect unique participants by address
    const seenAddrs = new Set<string>();
    const participants: Address[] = [];
    for (const msg of sorted) {
      const addr = msg.from.addr.toLowerCase();
      if (!seenAddrs.has(addr)) {
        seenAddrs.add(addr);
        participants.push(msg.from);
      }
    }

    const hasUnread = sorted.some((m) => !m.flags.includes("Seen"));

    threads.push({
      thread_id: sorted[0].id,
      subject: normalizeSubject(sorted[0].subject),
      message_count: sorted.length,
      participants,
      latest_date: sorted[sorted.length - 1].date,
      earliest_date: sorted[0].date,
      messages: sorted,
      has_unread: hasUnread,
    });
  }

  // Sort threads by latest_date descending (newest first)
  threads.sort(
    (a, b) => new Date(b.latest_date).getTime() - new Date(a.latest_date).getTime()
  );

  return threads;
}

/**
 * Format a thread as a summary line for LLM consumption.
 */
export function formatThread(t: Thread): string {
  const unread = t.has_unread ? " [unread]" : "";
  const count = t.message_count > 1 ? ` (${t.message_count} messages)` : "";
  const people = t.participants
    .map((p) => p.name || p.addr)
    .join(", ");
  return `${t.thread_id} | ${t.latest_date} | ${people} | ${t.subject}${count}${unread}`;
}
