/**
 * Apple Reminders adapter.
 *
 * Uses osascript to create reminders in Apple Reminders.app.
 * macOS only — check process.platform before calling.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface Reminder {
  title: string;
  notes?: string;
  dueDate?: string;
  priority?: number; // 1-5, 1=highest
}

/** Escape special characters for AppleScript strings. */
function escapeAppleScript(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/[\r\n\t]/g, " ")
    .replace(/[^\x20-\x7E]/g, "");
}

/** Format Date for AppleScript date string. Uses en-US locale. */
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

/**
 * Create a reminder in Apple Reminders.
 * macOS only.
 */
export async function createReminder(reminder: Reminder): Promise<void> {
  if (process.platform !== "darwin") {
    throw new Error("Apple Reminders integration is only available on macOS");
  }

  const props = [
    `name:"${escapeAppleScript(reminder.title)}"`,
  ];
  if (reminder.notes) {
    props.push(`body:"${escapeAppleScript(reminder.notes)}"`);
  }
  if (reminder.dueDate) {
    props.push(`due date:date "${formatAppleScriptDate(new Date(reminder.dueDate))}"`);
  }
  if (reminder.priority !== undefined) {
    props.push(`priority:${reminder.priority}`);
  }

  const script = `
    tell application "Reminders"
      make new reminder with properties {${props.join(", ")}}
    end tell
  `;

  try {
    await execFileAsync("osascript", ["-e", script], { timeout: 10_000 });
  } catch (err) {
    throw new Error(`Failed to create reminder: ${err instanceof Error ? err.message : String(err)}`);
  }
}
