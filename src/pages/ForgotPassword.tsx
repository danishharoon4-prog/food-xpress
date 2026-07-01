import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, ArrowLeft, AlertCircle, CheckCircle2 } from 'lucide-react';
import { z } from 'zod';
import { mapAuthError } from '@/lib/authErrors';

const emailSchema = z.string().trim().email('Please enter a valid email address');

type FieldErrors = { email?: string; form?: string };

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      const msg = parsed.error.errors[0].message;
      setErrors({ email: msg });
      toast({ title: 'Invalid email', description: msg, variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(parsed.data, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (resetError) {
        const friendly = mapAuthError(resetError);
        setErrors({ [friendly.field ?? 'form']: friendly.message } as FieldErrors);
        toast({ title: friendly.title, description: friendly.message, variant: 'destructive' });
        return;
      }

      setSent(true);
      toast({
        title: 'Check your email',
        description: `We sent a password reset link to ${parsed.data}.`,
      });
    } catch (err) {
      const friendly = mapAuthError(err);
      setErrors({ form: friendly.message });
      toast({ title: friendly.title, description: friendly.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-accent/30 p-4">
      <Card className="w-full max-w-md shadow-soft-xl border-0">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mb-2">
            <Mail className="w-8 h-8 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-bold">Forgot Password?</CardTitle>
          <CardDescription>
            {sent
              ? 'Check your inbox for the reset link. It may take a minute to arrive.'
              : "Enter your email and we'll send you a link to reset your password."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!sent ? (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {errors.form && (
                <Alert variant="destructive" className="animate-in fade-in-50">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{errors.form}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="forgot-email">Email</Label>
                <Input
                  id="forgot-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email) setErrors((p) => ({ ...p, email: undefined }));
                  }}
                  disabled={isLoading}
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? 'forgot-email-error' : undefined}
                  className={errors.email ? 'border-destructive focus-visible:ring-destructive' : ''}
                />
                {errors.email && (
                  <p id="forgot-email-error" className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" /> {errors.email}
                  </p>
                )}
              </div>
              <Button type="submit" className="w-full gradient-primary h-11" disabled={isLoading}>
                {isLoading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending...</>
                ) : 'Send Reset Link'}
              </Button>
            </form>
          ) : (
            <div className="space-y-4">
              <Alert className="border-primary/30 bg-primary/5">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <AlertDescription>
                  Reset link sent to <span className="font-medium">{email}</span>. It expires in 1 hour.
                </AlertDescription>
              </Alert>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => { setSent(false); setErrors({}); }}
              >
                Send another email
              </Button>
            </div>
          )}
          <Link to="/auth" className="mt-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground story-link">
            <ArrowLeft className="w-4 h-4" /> Back to sign in
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
