/**
 * Date formatting and calculation utilities for MoneyUndo.
 */

/**
 * Returns the current month name dynamically (e.g. "October").
 */
export function getCurrentMonthName(): string {
  return new Intl.DateTimeFormat('en-IN', { month: 'long' }).format(new Date());
}

/**
 * Returns the current year dynamically (e.g. 2026).
 */
export function getCurrentYear(): number {
  return new Date().getFullYear();
}

/**
 * Returns formatted monthly overview heading, e.g., "October 2026 overview" or "October overview".
 */
export function getMonthlyOverviewTitle(): string {
  const month = getCurrentMonthName();
  return `${month} overview`;
}

/**
 * Returns current date formatted as YYYY-MM-DD for standard date input fields.
 */
export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formats a YYYY-MM-DD date string into a user-friendly format, e.g., "11 Oct 2026".
 */
export function formatTransactionDate(dateStr: string): string {
  if (!dateStr) return '';
  
  // Parse date safely without timezone offset shift
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const date = new Date(year, month, day);
    
    // Check if it's today
    const today = new Date();
    if (
      today.getFullYear() === year &&
      today.getMonth() === month &&
      today.getDate() === day
    ) {
      return `Today, ${new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(date)}`;
    }
    
    return new Intl.DateTimeFormat('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date);
  }

  // Fallback to Date parser
  const parsed = new Date(dateStr);
  if (isNaN(parsed.getTime())) return dateStr;
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
}
