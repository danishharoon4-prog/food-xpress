import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Loader2, KeyRound, AlertCircle } from 'lucide-react';
import { z } from 'zod';
import { mapAuthError } from '@/lib/authErrors';

const passwordSchema = z
  .string()
  .min(6, 'Password must be at least 6 characters')
  .max(72, 'Password must be under 72 characters');

type FieldErrors = { password?: string; confirm?: string; form?: string };

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [canReset, setCanReset] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setCanReset(true);
        setErrors((p) => ({ ...p, form: undefined }));
      }
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setCanReset(true);
      else {
        // Give the recovery event a moment to arrive; otherwise show a helpful notice.
        setTimeout(() => {
          setCanReset((prev) => {
            if (!prev) {
              setErrors({
                form: 'This reset link is invalid or has expired. Request a new one from the sign-in page.',
              });
            }
            return prev;
          });
        }, 1500);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: FieldErrors = {};

    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) next.password = parsed.error.errors[0].message;
    if (password && confirm && password !== confirm) next.confirm = 'Passwords do not match';
    if (!confirm) next.confirm = next.confirm ?? 'Please confirm your password';

    if (Object.keys(next).length > 0) {
      setErrors(next);
      toast({
        title: 'Check the form',
        description: next.password ?? next.confirm ?? 'Please fix the highlighted fields.',
        variant: 'destructive',
      });
      return;
    }

    setErrors({});
    setIsLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        const friendly = mapAuthError(updateError);
        setErrors({ [friendly.field ?? 'form']: friendly.message } as FieldErrors);
        toast({ title: friendly.title, description: friendly.message, variant: 'destructive' });
        return;
      }

      toast({
        title: 'Password updated',
        description: 'Signing you out — please sign in with your new password.',
      });
      await supabase.auth.signOut();
      navigate('/auth', { replace: true });
    } catch (err) {
      const friendly = mapAuthError(err);
      setErrors({ form: friendly.message });
      toast({ title: friendly.title, description: friendly.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const disabled = !canReset || isLoading;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-accent/30 p-4">
      <Card className="w-full max-w-md shadow-soft-xl border-0">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mb-2">
            <KeyRound className="w-8 h-8 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-bold">Set a new password</CardTitle>
          <CardDescription>
            {canReset ? 'Enter your new password below.' : 'Waiting for reset link verification...'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {errors.form && (
              <Alert variant="destructive" className="animate-in fade-in-50">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{errors.form}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password) setErrors((p) => ({ ...p, password: undefined }));
                }}
                disabled={disabled}
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? 'new-password-error' : undefined}
                className={errors.password ? 'border-destructive focus-visible:ring-destructive' : ''}
              />
              {errors.password && (
                <p id="new-password-error" className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" /> {errors.password}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="Re-enter password"
                value={confirm}
                onChange={(e) => {
                  setConfirm(e.target.value);
                  if (errors.confirm) setErrors((p) => ({ ...p, confirm: undefined }));
                }}
                disabled={disabled}
                aria-invalid={!!errors.confirm}
                aria-describedby={errors.confirm ? 'confirm-password-error' : undefined}
                className={errors.confirm ? 'border-destructive focus-visible:ring-destructive' : ''}
              />
              {errors.confirm && (
                <p id="confirm-password-error" className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" /> {errors.confirm}
                </p>
              )}
            </div>
            <Button type="submit" className="w-full gradient-primary h-11" disabled={disabled}>
              {isLoading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Updating...</>
              ) : 'Update Password'}
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={() => navigate('/auth')}>
              Back to sign in
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
