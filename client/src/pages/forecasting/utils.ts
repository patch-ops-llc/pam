/**
 * Shared utilities for the Forecasting module
 */

// Authentication constants
export const FORECAST_PASSWORD = "PatchOps77024";
export const AUTH_KEY = "forecast_authenticated";

/**
 * Format currency with proper thousand separators
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Parse date string as local date to avoid UTC timezone shifts
 */
export function parseAsLocalDate(dateStr: string | Date | null | undefined): Date | null {
  if (!dateStr) return null;
  
  if (dateStr instanceof Date) {
    return dateStr;
  }
  
  // Extract just the date part if it's an ISO string (YYYY-MM-DDTHH:mm:ss.sssZ)
  const dateOnly = dateStr.toString().split('T')[0];
  
  // Parse as local date (YYYY-MM-DD)
  const [year, month, day] = dateOnly.split('-').map(Number);
  if (!year || !month || !day) return null;
  
  // Create date at noon local time to avoid edge cases
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

/**
 * Get month string in YYYY-MM format from a date
 */
export function getMonthString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Check if a date falls within a given month
 */
export function isInMonth(date: Date | null, targetMonth: string): boolean {
  if (!date) return false;
  return getMonthString(date) === targetMonth;
}

/**
 * Get a friendly month name from YYYY-MM string
 */
export function getMonthName(monthString: string): string {
  const [year, month] = monthString.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}
