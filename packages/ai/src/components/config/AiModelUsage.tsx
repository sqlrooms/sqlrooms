import {FC, useState} from 'react';
import {CreditCard, BarChart3, DollarSign, Plus} from 'lucide-react';
import {SkeletonPane, Button, Input} from '@sqlrooms/ui';
import {ChartContainer, ChartTooltip} from '@sqlrooms/recharts';
import {
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  BarChart,
} from 'recharts';

export interface ModelUsageData {
  totalSpend: number;
  maxBudget: number;
  isLoadingSpend: boolean;
  weeklySpend?: Array<{date: string; spend: number}>;
  isLoadingWeeklySpend?: boolean;
}

type AiModelUsageProps = {
  className?: string;
  modelUsage?: ModelUsageData;
  onIncreaseBudget?: (amount: number) => Promise<void>;
};

const fillMissingDays = (weeklySpend: Array<{date: string; spend: number}>) => {
  const today = new Date();
  const pastWeek: Array<{date: string; spend: number}> = [];

  // Generate the past 7 days
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateString = date.toISOString().split('T')[0]; // YYYY-MM-DD format

    // Find existing data for this date
    const existingData = weeklySpend.find((day) => day.date === dateString);

    if (existingData) {
      pastWeek.push(existingData);
    } else {
      // Fill missing day with 0 spend
      pastWeek.push({
        date: dateString || '',
        spend: 0,
      });
    }
  }

  return pastWeek;
};

export const AiModelUsage: FC<AiModelUsageProps> = ({
  className = '',
  modelUsage,
  onIncreaseBudget,
}) => {
  const [increaseAmount, setIncreaseAmount] = useState<string>('10');
  const [isIncreasing, setIsIncreasing] = useState(false);

  if (!modelUsage) return null;

  const {
    totalSpend,
    maxBudget,
    isLoadingSpend,
    weeklySpend,
    isLoadingWeeklySpend,
  } = modelUsage;

  const handleIncreaseBudget = async () => {
    if (!onIncreaseBudget) return;

    const amount = parseFloat(increaseAmount);
    if (isNaN(amount) || amount <= 0) return;

    setIsIncreasing(true);
    try {
      await onIncreaseBudget(amount);
      setIncreaseAmount('10'); // Reset to default
    } catch (error) {
      console.error('Failed to increase budget:', error);
    } finally {
      setIsIncreasing(false);
    }
  };

  const getCurrentMonthRange = () => {
    const now = new Date();
    const month = now.toLocaleDateString('en-US', {month: 'long'});
    const lastDay = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
    ).getDate();
    return `${month} 1-${lastDay}`;
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <h3 className="text-md flex items-center gap-2 pb-6 font-medium">
        <CreditCard className="h-4 w-4" />
        Billing & Usage
      </h3>
      <div className="flex flex-col gap-4">
        <p className="text-muted-foreground flex items-center gap-2 text-xs">
          <DollarSign className="h-4 w-4" />
          Spend {getCurrentMonthRange()}
        </p>

        {/* Spending Overview */}
        <div className="bg-muted rounded-lg p-4">
          {isLoadingSpend ? (
            <SkeletonPane n={2} rowHeight="32px" className="space-y-4" />
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <p className="text-muted-foreground text-sm">Total Spend</p>
                <p className="text-2xl font-bold">${totalSpend.toFixed(3)}</p>
              </div>
              <div className="text-center">
                <p className="text-muted-foreground text-sm">Max Budget</p>
                <p className="text-2xl font-bold">${maxBudget.toFixed(2)}</p>
              </div>
            </div>
          )}
        </div>

        {/* Increase Budget Section */}
        {onIncreaseBudget && (
          <div className="bg-muted rounded-lg p-4">
            <div className="mb-3 flex items-center gap-2">
              <Plus className="h-4 w-4" />
              <p className="text-sm font-medium">Increase Budget</p>
            </div>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Amount"
                value={increaseAmount}
                onChange={(e) => setIncreaseAmount(e.target.value)}
                className="flex-1"
                min="0.01"
                step="0.01"
              />
              <Button
                onClick={handleIncreaseBudget}
                disabled={isIncreasing || isLoadingSpend}
                size="sm"
              >
                {isIncreasing ? 'Increasing...' : 'Increase'}
              </Button>
            </div>
            <p className="text-muted-foreground mt-2 text-xs">
              Enter the amount you want to add to your current budget
            </p>
          </div>
        )}

        {/* Daily Spending Chart */}
        <div className="space-y-2">
          <label className="text-muted-foreground flex items-center gap-2 text-xs">
            <BarChart3 className="h-4 w-4" />
            Daily Spending Trend
          </label>
          <div
            className="bg-muted h-32 rounded-lg p-4"
            style={{position: 'relative'}}
          >
            {isLoadingWeeklySpend ? (
              <SkeletonPane n={7} rowHeight="100%" className="w-full" />
            ) : (
              <ChartContainer
                config={{
                  spend: {
                    label: 'Daily Spend',
                    color: 'hsl(var(--primary))',
                  },
                }}
                className="h-full w-full"
                style={{
                  // Remove any default hover backgrounds
                  backgroundColor: 'transparent',
                }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={fillMissingDays(weeklySpend || []).map((day) => ({
                      ...day,
                      dayLabel: new Date(day.date).toLocaleDateString('en-US', {
                        weekday: 'short',
                      }),
                    }))}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--muted-foreground))"
                      opacity={0.3}
                    />
                    <XAxis
                      dataKey="dayLabel"
                      tick={{fontSize: 10}}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{fontSize: 10}}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `$${value.toFixed(3)}`}
                    />
                    <ChartTooltip
                      content={({active, payload}: any) => {
                        if (active && payload && payload.length && payload[0]) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-background border-border rounded-lg border p-2 shadow-lg">
                              <p className="text-sm font-medium">{data.date}</p>
                              <p className="text-sm font-medium">
                                {data.dayLabel}
                              </p>
                              <p className="text-muted-foreground text-sm">
                                ${data.spend.toFixed(3)}
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                      cursor={false}
                    />
                    <Bar
                      dataKey="spend"
                      fill="hsl(var(--primary))"
                      radius={[2, 2, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            )}
          </div>
          <p className="text-muted-foreground text-center text-xs">
            Last 7 days spending
          </p>
        </div>
      </div>
    </div>
  );
};
