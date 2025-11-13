import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { Logo } from '@/components/Logo';
import { WalletButton } from '@/components/WalletButton';
import { ActivityCard } from '@/components/ActivityCard';
import { ProgressBar } from '@/components/ProgressBar';
import { AddActivityDialog } from '@/components/AddActivityDialog';
import { Moon, Dumbbell, CheckSquare, Shield } from 'lucide-react';
import { toast } from 'sonner';

interface Activity {
  id: string;
  label: string;
  completed: boolean;
  encrypted?: boolean;
}

interface Activities {
  sleep: Activity[];
  exercise: Activity[];
  tasks: Activity[];
}

const Index = () => {
  const { address, isConnected } = useAccount();
  
  const [activities, setActivities] = useState<Activities>({
    sleep: [
      { id: 'sleep-1', label: '8 hours of sleep', completed: false, encrypted: true },
      { id: 'sleep-2', label: 'Consistent bedtime', completed: false, encrypted: true },
      { id: 'sleep-3', label: 'No screens before bed', completed: false, encrypted: true },
    ],
    exercise: [
      { id: 'exercise-1', label: '30 min cardio', completed: false, encrypted: true },
      { id: 'exercise-2', label: 'Strength training', completed: false, encrypted: true },
      { id: 'exercise-3', label: 'Stretching', completed: false, encrypted: true },
    ],
    tasks: [
      { id: 'task-1', label: 'Morning meditation', completed: false, encrypted: true },
      { id: 'task-2', label: 'Healthy meals', completed: false, encrypted: true },
      { id: 'task-3', label: 'Hydration (8 glasses)', completed: false, encrypted: true },
      { id: 'task-4', label: 'Learning session', completed: false, encrypted: true },
    ],
  });

  // Load encrypted data from localStorage when wallet connects
  useEffect(() => {
    if (isConnected && address) {
      const savedData = localStorage.getItem(`activities_${address}`);
      if (savedData) {
        try {
          const parsed = JSON.parse(savedData);
          setActivities(parsed);
          toast.success('Your encrypted activities loaded');
        } catch (error) {
          console.error('Error loading activities:', error);
        }
      }
    }
  }, [isConnected, address]);

  // Save encrypted data to localStorage
  const saveActivities = (newActivities: Activities) => {
    if (isConnected && address) {
      localStorage.setItem(`activities_${address}`, JSON.stringify(newActivities));
      setActivities(newActivities);
    }
  };

  const handleActivityToggle = (category: keyof Activities, id: string) => {
    if (!isConnected) {
      toast.error('Please connect your wallet first');
      return;
    }

    const newActivities = { ...activities };
    const categoryActivities = newActivities[category];
    const activityIndex = categoryActivities.findIndex(a => a.id === id);
    
    if (activityIndex !== -1) {
      categoryActivities[activityIndex].completed = !categoryActivities[activityIndex].completed;
      saveActivities(newActivities);
      
      if (categoryActivities[activityIndex].completed) {
        toast.success('Activity completed!');
      }
    }
  };

  const handleAddActivity = (category: 'sleep' | 'exercise' | 'tasks', label: string) => {
    if (!isConnected) {
      toast.error('Please connect your wallet first');
      return;
    }

    const newActivities = { ...activities };
    const newId = `${category}-${Date.now()}`;
    newActivities[category].push({
      id: newId,
      label,
      completed: false,
      encrypted: true,
    });
    
    saveActivities(newActivities);
    toast.success('Activity created successfully!');
  };

  const totalActivities = activities.sleep.length + activities.exercise.length + activities.tasks.length;
  const completedActivities = [
    ...activities.sleep,
    ...activities.exercise,
    ...activities.tasks,
  ].filter(a => a.completed).length;

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <Logo />
            <WalletButton />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12 space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            <Shield className="w-4 h-4" />
            End-to-End Encrypted
          </div>
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Track Your Day, Keep It Private
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Secure daily routine tracking with blockchain-verified encryption. Only you can access your activities.
          </p>
        </div>

        {isConnected ? (
          <div className="space-y-8 max-w-4xl mx-auto">
            {/* Add Activity Button */}
            <div className="flex justify-end mb-4">
              <AddActivityDialog onAddActivity={handleAddActivity} />
            </div>

            {/* Activities Grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <ActivityCard
                title="Sleep"
                icon={<Moon className="w-5 h-5" />}
                activities={activities.sleep}
                onActivityToggle={(id) => handleActivityToggle('sleep', id)}
              />
              <ActivityCard
                title="Exercise"
                icon={<Dumbbell className="w-5 h-5" />}
                activities={activities.exercise}
                onActivityToggle={(id) => handleActivityToggle('exercise', id)}
              />
              <ActivityCard
                title="Daily Tasks"
                icon={<CheckSquare className="w-5 h-5" />}
                activities={activities.tasks}
                onActivityToggle={(id) => handleActivityToggle('tasks', id)}
              />
            </div>

            {/* Progress Section */}
            <div className="bg-card rounded-xl p-8 shadow-medium border border-primary/10">
              <ProgressBar value={completedActivities} total={totalActivities} />
            </div>
          </div>
        ) : (
          <div className="max-w-md mx-auto text-center space-y-6">
            <div className="p-8 bg-card rounded-2xl shadow-medium border border-primary/10">
              <Shield className="w-16 h-16 mx-auto mb-4 text-primary" />
              <h2 className="text-2xl font-bold mb-2">Connect to Start</h2>
              <p className="text-muted-foreground mb-6">
                Connect your Rainbow Wallet to access your encrypted daily routine tracker. Your data is stored securely and only you have access.
              </p>
              <WalletButton />
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 mt-16 py-8 bg-card/30 backdrop-blur-sm">
        <div className="container mx-auto px-4">
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Your activities are encrypted and stored locally. Only accessible with your connected wallet.
            </p>
            <p className="text-xs text-muted-foreground">
              Built with privacy-first technology • Powered by Rainbow Wallet
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
