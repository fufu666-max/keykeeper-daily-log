import { Progress } from '@/components/ui/progress';

interface ProgressBarProps {
  value: number;
  total: number;
}

export const ProgressBar = ({ value, total }: ProgressBarProps) => {
  const percentage = total > 0 ? Math.round((value / total) * 100) : 0;

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Daily Progress</span>
        <span className="font-semibold text-primary">
          {value} of {total} completed
        </span>
      </div>
      <Progress 
        value={percentage} 
        className="h-3 bg-secondary"
      />
      <p className="text-xs text-center text-muted-foreground">
        {percentage}% of your daily goals achieved
      </p>
    </div>
  );
};
