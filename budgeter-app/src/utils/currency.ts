/**
 * Indian Rupee (INR) currency formatting utilities.
 * Uses the Indian numbering system (lakhs and crores: ₹1,50,000).
 */

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/**
 * Formats a numeric value into INR representation.
 * Example: 50000 -> "₹50,000", 12000 -> "₹12,000"
 */
export function formatINR(
  amount: number,
  options?: {
    showNegativeSign?: boolean;
    hideCurrencySymbol?: boolean;
  }
): string {
  if (isNaN(amount) || !isFinite(amount)) {
    return '₹0';
  }

  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  
  // Format the absolute number
  let formatted = inrFormatter.format(absAmount);
  
  if (options?.hideCurrencySymbol) {
    formatted = formatted.replace(/^₹\s?/, '');
  }

  if (options?.showNegativeSign) {
    return `- ${formatted}`;
  }

  if (isNegative) {
    return `- ${formatted}`;
  }

  return formatted;
}

/**
 * Formats an expense amount for transaction lists: "- ₹2,500"
 */
export function formatExpenseAmount(amount: number): string {
  const absAmount = Math.abs(amount);
  return `- ${inrFormatter.format(absAmount)}`;
}

/**
 * Safely parses string input into a positive number.
 * Returns null if invalid or <= 0.
 */
export function parseValidAmount(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  
  const parsed = Number(trimmed);
  if (isNaN(parsed) || !isFinite(parsed) || parsed <= 0) {
    return null;
  }
  
  // Round to 2 decimal places for financial safety
  return Math.round(parsed * 100) / 100;
}

