/**
 * Shared types for the ai-chatui package
 */

export interface ModelUsageData {
  totalSpend: number;
  maxBudget: number;
  isLoadingSpend: boolean;
  weeklySpend?: Array<{date: string; spend: number}>;
  isLoadingWeeklySpend?: boolean;
}
