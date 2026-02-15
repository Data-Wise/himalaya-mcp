/**
 * Calendar adapter — parse ICS files and create Apple Calendar events.
 *
 * ICS parsing: Simple line-based parser for VCALENDAR/VEVENT blocks.
 * Apple Calendar: Uses osascript subprocess (same pattern as clipboard adapter).
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import type { CalendarEvent } from "../himalaya/types.js";

const execFileAsync = promisify(execFile);

/**
 * Parse an ICS file content into a CalendarEvent.
 * Handles folded lines (continuation with leading whitespace).
 * Only parses the first VEVENT block.
 */
export function parseICS(content: string): CalendarEvent | null {
  // Unfold lines (RFC 5545: lines starting with space/tab are continuations)
  const unfolded = content.replace(/\r?\n[ \t]/g, "");
  const lines = unfolded.split(/\r?\n/);

  let inEvent = false;
  const props: Record<string, string> = {};

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      inEvent = true;
      continue;
    }
    if (line === "END:VEVENT") {
      break; // Only parse first event
    }
    if (!inEvent) continue;

    // Parse property: NAME;params:value or NAME:value
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;

    let key = line.slice(0, colonIdx);
    const value = line.slice(colonIdx + 1);

    // Strip parameters (e.g., DTSTART;TZID=US/Eastern:20260216T090000)
    const semiIdx = key.indexOf(";");
    if (semiIdx !== -1) {
      key = key.slice(0, semiIdx);
    }

    props[key] = value;
  }

  if (!props.SUMMARY || !props.DTSTART) {
    return null;
  }

  return {
    summary: props.SUMMARY,
    dtstart: formatICSDate(props.DTSTART),
    dtend: props.DTEND ? formatICSDate(props.DTEND) : props.DTSTART,
    location: props.LOCATION || undefined,
    organizer: props.ORGANIZER ? props.ORGANIZER.replace(/^mailto:/i, "") : undefined,
    description: props.DESCRIPTION || undefined,
    uid: props.UID || undefined,
  };
}

/**
 * Convert ICS date format to ISO-like string.
 * Input:  "20260216T090000" or "20260216T090000Z" or "20260216"
 * Output: "2026-02-16T09:00:00" or "2026-02-16"
 */
function formatICSDate(raw: string): string {
  const clean = raw.replace("Z", "");
  if (clean.length === 8) {
    // Date only: YYYYMMDD
    return `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}`;
  }
  if (clean.length >= 15) {
    // DateTime: YYYYMMDDTHHMMSS
    return `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}T${clean.slice(9, 11)}:${clean.slice(11, 13)}:${clean.slice(13, 15)}`;
  }
  return raw; // Fallback
}

/**
 * Read and parse an ICS file from disk.
 */
export async function parseICSFile(filePath: string): Promise<CalendarEvent | null> {
  const content = await readFile(filePath, "utf-8");
  return parseICS(content);
}

/**
 * Create an event in Apple Calendar using osascript.
 * macOS only — check process.platform before calling.
 */
export async function createAppleCalendarEvent(event: CalendarEvent): Promise<void> {
  if (process.platform !== "darwin") {
    throw new Error("Apple Calendar integration is only available on macOS");
  }

  // Format dates for AppleScript: "February 16, 2026 9:00:00 AM"
  const startDate = new Date(event.dtstart);
  const endDate = new Date(event.dtend);

  const script = `
    tell application "Calendar"
      tell calendar "Calendar"
        set newEvent to make new event with properties {summary:"${escapeAppleScript(event.summary)}", start date:date "${formatAppleScriptDate(startDate)}", end date:date "${formatAppleScriptDate(endDate)}"${event.location ? `, location:"${escapeAppleScript(event.location)}"` : ""}${event.description ? `, description:"${escapeAppleScript(event.description)}"` : ""}}
      end tell
    end tell
  `;

  try {
    await execFileAsync("osascript", ["-e", script], { timeout: 10_000 });
  } catch (err) {
    throw new Error(`Failed to create calendar event: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/** Escape special characters for AppleScript strings. */
function escapeAppleScript(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/** Format Date for AppleScript date string. */
function formatAppleScriptDate(date: Date): string {
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}
