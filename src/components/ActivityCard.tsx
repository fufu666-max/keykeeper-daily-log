import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Lock } from 'lucide-react';

interface Activity {
  id: string;
  label: string;
  completed: boolean;
  encrypted?: boolean;
}

interface ActivityCardProps {
  title: string;
  icon: React.ReactNode;
  activities: Activity[];
  onActivityToggle: (id: string) => void;
  addActivityButton?: React.ReactNode;
}

export const ActivityCard = ({ title, icon, activities, onActivityToggle, addActivityButton }: ActivityCardProps) => {
  return (
    <Card className="p-6 shadow-medium hover:shadow-glow transition-smooth border-primary/10">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-gradient-primary text-primary-foreground">
          {icon}
        </div>
        <h3 className="text-lg font-semibold">{title}</h3>
      </div>
      
      <div className="space-y-3">
        {activities.map((activity) => (
          <div key={activity.id} className="flex items-center gap-3 group">
            <Checkbox
              id={activity.id}
              checked={activity.completed}
              onCheckedChange={() => onActivityToggle(activity.id)}
              className="data-[state=checked]:bg-success data-[state=checked]:border-success"
            />
            <Label
              htmlFor={activity.id}
              className={`flex-1 cursor-pointer transition-smooth ${
                activity.completed ? 'line-through text-muted-foreground' : ''
              }`}
            >
              {activity.label}
            </Label>
            {activity.encrypted && (
              <Lock className="w-4 h-4 text-accent opacity-60" />
            )}
          </div>
        ))}
      </div>
      
      {addActivityButton && (
        <div className="mt-4 pt-4 border-t border-border/50">
          {addActivityButton}
        </div>
      )}
    </Card>
  );
};
