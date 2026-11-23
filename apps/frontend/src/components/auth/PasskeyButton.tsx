import React, { useState, useEffect } from 'react';
import { Fingerprint, Loader2, KeyRound } from 'lucide-react';
import { isPasskeySupported, isPlatformAuthenticatorAvailable, loginWithPasskey } from '../../utils/passkey';
import { useAuth } from '../../context/AuthContext';
import { UserProfile } from '@quiz-forge/shared';

interface PasskeyButtonProps {
  onSuccess?: (user: UserProfile) => void;
  onError?: (errorMessage: string) => void;
  className?: string;
}

export const PasskeyButton: React.FC<PasskeyButtonProps> = ({
  onSuccess,
  onError,
  className = '',
}) => {
  const [supported, setSupported] = useState<boolean>(() => isPasskeySupported());
  const [hasPlatformAuthenticator, setHasPlatformAuthenticator] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const { setUser } = useAuth();

  useEffect(() => {
    const checkSupport = async () => {
      const isSupp = isPasskeySupported();
      setSupported(isSupp);
      if (isSupp) {
        const hasPlatform = await isPlatformAuthenticatorAvailable();
        setHasPlatformAuthenticator(hasPlatform);
      }
    };
    checkSupport();
  }, []);

  const handlePasskeyLogin = async () => {
    if (!supported) {
      onError?.(
        'WebAuthn / Passkeys require a secure context (HTTPS or localhost) in a supported browser (Chrome, Edge, Safari, Firefox).'
      );
      return;
    }

    setIsAuthenticating(true);
    try {
      const result = await loginWithPasskey();
      setUser(result.user);
      onSuccess?.(result.user);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to authenticate using passkey. Please try again.';

      // Don't loudly alert if user simply cancelled the biometric prompt
      if (!message.toLowerCase().includes('cancelled') && !message.toLowerCase().includes('timed out')) {
        onError?.(message);
      }
    } finally {
      setIsAuthenticating(false);
    }
  };

  return (
    <button
      type="button"
      data-testid="passkey-login-button"
      onClick={handlePasskeyLogin}
      disabled={isAuthenticating}
      className={`w-full py-3 px-4 rounded-xl font-bold text-sm bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white shadow-sm border border-slate-700/80 dark:border-slate-700 transition flex items-center justify-center gap-2.5 active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      title={
        supported
          ? 'Sign in securely using biometric recognition (Touch ID, Windows Hello) or physical security key'
          : 'Passkeys require a secure context (HTTPS or localhost)'
      }
    >
      {isAuthenticating ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin text-[#38BDF8]" />
          <span>Verifying biometric passkey...</span>
        </>
      ) : (
        <>
          {hasPlatformAuthenticator ? (
            <Fingerprint className="w-4 h-4 text-[#38BDF8]" />
          ) : (
            <KeyRound className="w-4 h-4 text-[#38BDF8]" />
          )}
          <span>Sign in with Passkey</span>
          {!supported && (
            <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-normal">
              (Requires HTTPS)
            </span>
          )}
        </>
      )}
    </button>
  );
};
