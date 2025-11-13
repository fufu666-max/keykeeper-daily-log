import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus } from 'lucide-react';

interface AddActivityDialogProps {
  onAddActivity: (category: 'sleep' | 'exercise' | 'tasks', label: string) => void;
}

export const AddActivityDialog = ({ onAddActivity }: AddActivityDialogProps) => {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [category, setCategory] = useState<'sleep' | 'exercise' | 'tasks'>('tasks');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (label.trim()) {
      onAddActivity(category, label.trim());
      setLabel('');
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full">
          <Plus className="w-4 h-4 mr-2" />
          Add Activity
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Activity</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select value={category} onValueChange={(value: 'sleep' | 'exercise' | 'tasks') => setCategory(value)}>
              <SelectTrigger id="category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sleep">Sleep</SelectItem>
                <SelectItem value="exercise">Exercise</SelectItem>
                <SelectItem value="tasks">Daily Tasks</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="activity-label">Activity Name</Label>
            <Input
              id="activity-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Enter activity name"
              maxLength={100}
            />
          </div>
          <Button type="submit" className="w-full" disabled={!label.trim()}>
            Create Activity
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
