// Utility functions for the customer portal

// Currency formatting utility
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

// Date formatting utility
export function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(dateString));
}

// Energy formatting utility
export function formatEnergy(amount: number, unit: string = 'kWh'): string {
  return `${amount.toLocaleString()} ${unit}`;
}

// Percentage formatting utility
export function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
} 