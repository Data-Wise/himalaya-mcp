/**
 * Provider-agnostic trash folder name resolution.
 *
 * Different email providers use different folder names for trash.
 * This utility maps account names (or guessed providers) to the
 * correct trash folder name used by that provider.
 */

/**
 * Return the trash folder name for a given account name or guessed provider.
 *
 * Defaults to "Trash" for unknown providers.
 * Gmail:     "[Gmail]/Trash"
 * Exchange:  "Deleted Items"
 * Everyone else: "Trash"
 */
export function getTrashFolder(account?: string): string {
  if (!account) return "Trash";

  const lower = account.toLowerCase();

  // Gmail accounts often have "gmail" in the name
  if (lower.includes("gmail")) return "[Gmail]/Trash";

  // Exchange / Office 365 accounts
  if (lower.includes("exchange") || lower.includes("outlook") || lower.includes("office")) {
    return "Deleted Items";
  }

  return "Trash";
}
