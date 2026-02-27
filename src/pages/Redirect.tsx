import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, ExternalLink } from 'lucide-react';

export default function RedirectPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const redirectUrl = searchParams.get('url');

  if (!redirectUrl) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invalid Redirect</CardTitle>
            <CardDescription>No redirect URL was provided.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate(-1)} variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleContinue = () => {
    window.open(redirectUrl, '_blank', 'noopener,noreferrer');
    window.close();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle className="text-2xl">Leaving our site</CardTitle>
          <CardDescription>You are about to be redirected to an external website.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-4 border rounded-md break-all">
            <p className="text-sm text-muted-foreground font-mono">{redirectUrl.toLowerCase()}</p>
          </div>
          <div className="flex justify-center gap-4">
            <Button onClick={() => navigate(-1)} variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={handleContinue}>
              Continue
              <ExternalLink className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
