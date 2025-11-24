import { useState } from 'react';
import { useAccount } from 'wagmi';
import { Logo } from '@/components/Logo';
import { WalletButton } from '@/components/WalletButton';
import { ActivityCard } from '@/components/ActivityCard';
import { ProgressBar } from '@/components/ProgressBar';
import { AddActivityDialog } from '@/components/AddActivityDialog';
import { CheckSquare, Shield, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTodoList } from '@/hooks/useTodoList';

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS;

const Index = () => {
  const { address, isConnected } = useAccount();
  const { todos, isLoading, message, createTodo, toggleTodo, loadTodos } = useTodoList(CONTRACT_ADDRESS);

  const handleAddTodo = async (category: 'sleep' | 'exercise' | 'tasks', text: string) => {
    if (!isConnected) {
      toast.error('Please connect your wallet first');
      return;
    }

    try {
      await createTodo(text);
      toast.success('Todo created successfully!');
    } catch (error: any) {
      toast.error(`Error: ${error.message || 'Failed to create todo'}`);
    }
  };

  const handleToggleTodo = async (index: number) => {
    if (!isConnected) {
      toast.error('Please connect your wallet first');
      return;
    }

    try {
      await toggleTodo(index);
      toast.success('Todo updated!');
    } catch (error: any) {
      toast.error(`Error: ${error.message || 'Failed to toggle todo'}`);
    }
  };

  // Convert todos to Activity format for ActivityCard
  const todosAsActivities = todos.map(todo => ({
    id: todo.id,
    label: todo.text,
    completed: todo.completed,
    encrypted: true,
  }));

  const totalTodos = todos.length;
  const completedTodos = todos.filter(t => t.completed).length;

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
            Private To-do List
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Secure encrypted to-do list with blockchain-verified encryption. Your tasks are encrypted on-chain and only you can decrypt them.
          </p>
        </div>

        {!CONTRACT_ADDRESS && (
          <div className="max-w-md mx-auto text-center space-y-6">
            <div className="p-8 bg-card rounded-2xl shadow-medium border border-destructive/20">
              <Shield className="w-16 h-16 mx-auto mb-4 text-destructive" />
              <h2 className="text-2xl font-bold mb-2">Contract Not Configured</h2>
              <p className="text-muted-foreground mb-6">
                Please set VITE_CONTRACT_ADDRESS in your .env.local file with the deployed PrivateTodoList contract address.
              </p>
            </div>
          </div>
        )}

        {CONTRACT_ADDRESS && isConnected ? (
          <div className="space-y-8 max-w-4xl mx-auto">
            {/* Status Message */}
            {message && (
              <div className="p-4 bg-card rounded-lg border border-primary/20">
                <p className="text-sm text-muted-foreground">{message}</p>
              </div>
            )}

            {/* Add Todo Button */}
            <div className="flex justify-end mb-4">
              <AddActivityDialog 
                onAddActivity={(category, text) => handleAddTodo(category, text)} 
              />
            </div>

            {/* Loading State */}
            {isLoading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <span className="ml-3 text-muted-foreground">Loading todos...</span>
              </div>
            )}

            {/* Todos List */}
            {!isLoading && (
              <>
                <ActivityCard
                  title="My Todos"
                  icon={<CheckSquare className="w-5 h-5" />}
                  activities={todosAsActivities}
                  onActivityToggle={(id) => {
                    const todo = todos.find(t => t.id === id);
                    if (todo) {
                      handleToggleTodo(todo.index);
                    }
                  }}
                />

                {/* Progress Section */}
                {totalTodos > 0 && (
                  <div className="bg-card rounded-xl p-8 shadow-medium border border-primary/10">
                    <ProgressBar value={completedTodos} total={totalTodos} />
                  </div>
                )}

                {/* Empty State */}
                {totalTodos === 0 && !isLoading && (
                  <div className="text-center py-12">
                    <CheckSquare className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <h3 className="text-xl font-semibold mb-2">No todos yet</h3>
                    <p className="text-muted-foreground">
                      Create your first encrypted todo item to get started!
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="max-w-md mx-auto text-center space-y-6">
            <div className="p-8 bg-card rounded-2xl shadow-medium border border-primary/10">
              <Shield className="w-16 h-16 mx-auto mb-4 text-primary" />
              <h2 className="text-2xl font-bold mb-2">Connect to Start</h2>
              <p className="text-muted-foreground mb-6">
                Connect your Rainbow Wallet to access your encrypted to-do list. Your data is stored securely on-chain and only you can decrypt it.
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
              Your todos are encrypted and stored on-chain. Only accessible with your connected wallet.
            </p>
            <p className="text-xs text-muted-foreground">
              Built with privacy-first technology • Powered by Rainbow Wallet & FHEVM
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
