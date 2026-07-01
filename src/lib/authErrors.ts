// Central mapping of Supabase auth errors to user-friendly copy.
// Keeps toast + inline messages consistent across auth flows.

export type FriendlyAuthError = {
  title: string;
  message: string;
  field?: 'email' | 'password' | 'confirm' | 'form';
};

export function mapAuthError(error: unknown): FriendlyAuthError {
  const raw =
    (error as any)?.message ??
    (typeof error === 'string' ? error : 'Something went wrong');
  const msg = String(raw).toLowerCase();

  if (msg.includes('rate') || msg.includes('too many')) {
    return {
      title: 'Too many attempts',
      message: 'Please wait a minute before trying again.',
      field: 'form',
    };
  }
  if (msg.includes('invalid') && msg.includes('email')) {
    return { title: 'Invalid email', message: 'Enter a valid email address.', field: 'email' };
  }
  if (msg.includes('user not found') || msg.includes('no user')) {
    return {
      title: 'Account not found',
      message: "We couldn't find an account with that email.",
      field: 'email',
    };
  }
  if (msg.includes('email') && msg.includes('not confirmed')) {
    return {
      title: 'Email not confirmed',
      message: 'Please verify your email before resetting your password.',
      field: 'email',
    };
  }
  if (msg.includes('same') && msg.includes('password')) {
    return {
      title: 'Choose a different password',
      message: 'Your new password must be different from the current one.',
      field: 'password',
    };
  }
  if (msg.includes('weak') || msg.includes('at least') || msg.includes('short')) {
    return {
      title: 'Password too weak',
      message: 'Use at least 6 characters, mixing letters and numbers.',
      field: 'password',
    };
  }
  if (msg.includes('expired') || msg.includes('invalid token') || msg.includes('otp')) {
    return {
      title: 'Reset link expired',
      message: 'This reset link is invalid or has expired. Request a new one.',
      field: 'form',
    };
  }
  if (msg.includes('network') || msg.includes('failed to fetch')) {
    return {
      title: 'Connection issue',
      message: 'Check your internet connection and try again.',
      field: 'form',
    };
  }

  return { title: 'Something went wrong', message: raw, field: 'form' };
}
