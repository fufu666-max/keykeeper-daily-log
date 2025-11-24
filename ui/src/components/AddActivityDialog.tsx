import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus } from 'lucide-react';

interface AddActivityDialogProps {
  onAddActivity: (category: 'sleep' | 'exercise' | 'tasks', label: string) => void;
}

export const AddActivityDialog = ({ onAddActivity }: AddActivityDialogProps) => {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (label.trim()) {
      onAddActivity('tasks', label.trim());
      setLabel('');
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Add Todo
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Todo</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="todo-label">Todo Text</Label>
            <Input
              id="todo-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g., Buy medicine, Interview preparation"
              maxLength={100}
            />
          </div>
          <Button type="submit" className="w-full" disabled={!label.trim()}>
            Create Todo
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
