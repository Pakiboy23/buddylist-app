import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import AppIcon from '@/components/AppIcon';
import HimWordmark from '@/components/HimWordmark';
import RetroWindow from '@/components/RetroWindow';
import { useAppRouter, navigateAppPath } from '@/lib/appNavigation';
import { waitForSessionOrNull } from '@/lib/authClient';
import { supabase } from '@/lib/supabase';
import { invokeDeleteAccount, screennameConfirmationMatches } from '@/lib/accountDeletion';

type LoadPhase = 'loading' | 'ready' | 'unauthorized';
type DeletionPhase = 'idle' | 'confirming' | 'deleting' | 'error';

export default function DeleteAccountPage() {
  const router = useAppRouter();

  const [loadPhase, setLoadPhase] = useState<LoadPhase>('loading');
  const [screenname, setScreenname] = useState<string>('');
  const [typedConfirm, setTypedConfirm] = useState('');
  const [showFinalModal, setShowFinalModal] = useState(false);
  const [deletionPhase, setDeletionPhase] = useState<DeletionPhase>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const fieldClass =
    'ui-focus-ring ui-auth-field min-h-[52px] w-full rounded-2xl px-4 py-3 text-[15px] font-medium';
  const sectionClass = 'ui-auth-card rounded-[1.6rem] p-5 backdrop-blur-2xl';
  const destructiveButtonClass =
    'ui-focus-ring min-h-[48px] w-full rounded-2xl bg-red-600 px-4 py-2.5 text-[14px] font-semibold text-white transition active:scale-[0.99] disabled:opacity-50 hover:bg-red-700';
  const cancelButtonClass =
    'ui-focus-ring min-h-[48px] w-full rounded-2xl border border-slate-300/80 bg-white/70 px-4 py-2.5 text-[14px] font-semibold text-slate-700 transition active:scale-[0.99] hover:bg-white dark:border-slate-700 dark:bg-[#0F1424]/70 dark:text-slate-200';

  useEffect(() => {
    let isCancelled = false;

    const bootstrap = async () => {
      const session = await waitForSessionOrNull();
      if (isCancelled) return;
      if (!session) {
        setLoadPhase('unauthorized');
        navigateAppPath(router, '/', { replace: true });
        return;
      }

      const meta = session.user.user_metadata as Record<string, unknown> | undefined;
      const metaScreenname = typeof meta?.screenname === 'string' ? meta.screenname : '';
      setScreenname(metaScreenname);
      setLoadPhase('ready');
    };

    void bootstrap();

    return () => {
      isCancelled = true;
    };
  }, [router]);

  const handleBack = useCallback(() => {
    navigateAppPath(router, '/account');
  }, [router]);

  const confirmMatches = useMemo(
    () => screennameConfirmationMatches(typedConfirm, screenname),
    [typedConfirm, screenname],
  );

  const handleProceedToFinalModal = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!confirmMatches) {
      setDeletionPhase('error');
      setErrorMessage('Type your screenname exactly to continue.');
      return;
    }
    setErrorMessage('');
    setDeletionPhase('confirming');
    setShowFinalModal(true);
  };

  const handleCancelFinal = () => {
    setShowFinalModal(false);
    setDeletionPhase('idle');
  };

  const handleDelete = async () => {
    setDeletionPhase('deleting');
    setErrorMessage('');

    const result = await invokeDeleteAccount();

    if (!result.ok) {
      setDeletionPhase('error');
      setErrorMessage(result.error || 'Account deletion failed. Please contact support.');
      setShowFinalModal(false);
      return;
    }

    // Success — sign out locally and bounce home.
    await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
    navigateAppPath(router, '/', { replace: true });
  };

  if (loadPhase === 'loading' || loadPhase === 'unauthorized') {
    return null;
  }

  return (
    <main className="ui-auth-shell relative min-h-[100dvh] overflow-y-auto pb-12">
      <div className="ui-auth-orb--rose pointer-events-none absolute -left-12 top-10 h-44 w-44 rounded-full blur-3xl" />
      <div className="ui-auth-orb--gold pointer-events-none absolute bottom-0 right-0 h-64 w-64 rounded-full blur-3xl" />

      <RetroWindow title="H.I.M.">
        <div className="mx-auto flex w-full max-w-md flex-col gap-4 pb-8 pt-2">
          <header className="flex items-start justify-between gap-4 px-1">
            <div className="min-w-0">
              <span className="ui-brand-sparkle inline-flex h-11 w-11 items-center justify-center rounded-2xl">
                <AppIcon kind="sparkle" className="h-5 w-5" />
              </span>
              <HimWordmark className="mt-4 text-[13px]" />
              <h1 className="mt-2 text-[31px] font-semibold tracking-[-0.04em] text-slate-900 dark:text-slate-50">
                Delete account
              </h1>
              <p className="mt-2 text-[14px] leading-6 text-slate-500 dark:text-slate-400">
                This is permanent. Your messages, buddies, and profile will be erased.
              </p>
            </div>
            <button
              type="button"
              onClick={handleBack}
              disabled={deletionPhase === 'deleting'}
              className="ui-focus-ring ui-auth-back inline-flex min-h-[40px] shrink-0 items-center rounded-full px-3 text-[12px] font-semibold transition disabled:opacity-50"
            >
              Back
            </button>
          </header>

          <div className="ui-note-info rounded-[1.4rem] border border-amber-300/50 bg-amber-50/80 px-4 py-3 text-[13px] leading-5 text-amber-800 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200">
            <p className="font-semibold">What gets deleted:</p>
            <ul className="mt-1 list-disc pl-5 leading-5">
              <li>All direct messages and room messages you sent</li>
              <li>Your buddies, connections, blocks, and reports</li>
              <li>Your profile, status, and push notification tokens</li>
              <li>Your auth account — you will not be able to sign back in</li>
            </ul>
          </div>

          <form onSubmit={handleProceedToFinalModal} className={`${sectionClass} space-y-4`}>
            <div>
              <h2 className="text-[16px] font-semibold text-slate-900 dark:text-slate-50">
                Confirm by typing your screenname
              </h2>
              <p className="mt-1 text-[13px] leading-5 text-slate-500 dark:text-slate-400">
                To make sure this is intentional, type <strong>{screenname}</strong> below.
              </p>
            </div>

            <div>
              <label htmlFor="delete-confirm-screenname" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                Your screenname
              </label>
              <input
                id="delete-confirm-screenname"
                type="text"
                value={typedConfirm}
                onChange={(event) => {
                  setTypedConfirm(event.target.value);
                  if (deletionPhase === 'error') {
                    setDeletionPhase('idle');
                    setErrorMessage('');
                  }
                }}
                className={fieldClass}
                placeholder={screenname}
                disabled={deletionPhase === 'deleting'}
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="off"
                data-testid="delete-confirm-input"
              />
            </div>

            <button
              type="submit"
              disabled={!confirmMatches || deletionPhase === 'deleting'}
              className={destructiveButtonClass}
              data-testid="delete-confirm-submit"
            >
              Continue
            </button>

            {errorMessage ? (
              <p
                role="status"
                aria-live="polite"
                className="rounded-[1.2rem] border border-amber-200/80 bg-amber-50/90 px-4 py-2.5 text-[13px] leading-5 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
              >
                {errorMessage}
              </p>
            ) : null}
          </form>
        </div>
      </RetroWindow>

      {showFinalModal ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-final-title"
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 px-4 pb-8 pt-12 backdrop-blur-sm sm:items-center"
        >
          <div className="w-full max-w-sm rounded-[1.6rem] border border-slate-200/80 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-[#0F1424]">
            <h2
              id="delete-final-title"
              className="text-[18px] font-semibold text-slate-900 dark:text-slate-50"
            >
              Delete this account?
            </h2>
            <p className="mt-2 text-[14px] leading-5 text-slate-600 dark:text-slate-300">
              This is final. There is no recovery — we cannot restore your account after this.
            </p>

            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={handleDelete}
                disabled={deletionPhase === 'deleting'}
                className={destructiveButtonClass}
                data-testid="delete-final-confirm"
              >
                {deletionPhase === 'deleting' ? 'Deleting…' : 'Delete my account'}
              </button>
              <button
                type="button"
                onClick={handleCancelFinal}
                disabled={deletionPhase === 'deleting'}
                className={cancelButtonClass}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
