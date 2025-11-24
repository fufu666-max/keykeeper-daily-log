import { CheckSquare, Lock } from 'lucide-react';

export const Logo = () => {
  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <CheckSquare className="w-8 h-8 text-primary" strokeWidth={2} />
        <Lock className="w-4 h-4 text-accent absolute -bottom-1 -right-1" strokeWidth={2.5} />
      </div>
      <span className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
        Keykeeper
      </span>
    </div>
  );
};
