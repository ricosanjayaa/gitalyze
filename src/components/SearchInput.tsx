'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';

export function SearchInput() {
  const [username, setUsername] = useState('');
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim()) {
      router.push(`/dashboard/${username.trim()}`);
    }
  };

  return (
    <form onSubmit={handleSearch} className="group relative w-full">
      <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/50 to-secondary/50 rounded-lg blur-lg opacity-0 group-focus-within:opacity-50 transition-opacity duration-300"></div>
      <div className="relative flex items-center gap-2 sm:gap-3 w-full">
        <div className="relative flex-grow">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Enter GitHub username..."
            className="pl-9 h-10 sm:h-10 text-sm sm:text-sm rounded-lg bg-background/80 border-border/50 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background transition-all shadow-sm"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
        <Button type="submit" size="sm" className="h-10 sm:h-10 rounded-lg px-3 sm:px-4 text-xs sm:text-sm font-semibold">Analyze</Button>
      </div>
    </form>
  );
}
