'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, Frown } from 'lucide-react';

export default function NotFoundPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto bg-secondary/50 border border-border/20 rounded-full p-3 mb-4 w-fit">
            <Frown className="w-8 h-8 text-muted-foreground" />
          </div>
          <CardTitle className="text-2xl font-sans">Page not found</CardTitle>
          <CardDescription className="font-sans">The page you are looking for does not exist.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => router.push('/')} variant="outline" className="rounded-lg">
            <ArrowLeft className="w-4 h-4 mr-2" />
            <span className="font-sans">Go back</span>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
