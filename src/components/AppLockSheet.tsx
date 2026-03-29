'use client';

import { KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from 'react';
import AppIcon from '@/components/AppIcon';
import { APP_LOCK_AUTO_LOCK_OPTIONS, formatAppLockTimeoutLabel, isValidAppLockPin } from '@/lib/appLock';

type AppLockMode = 'setup' | 'unlock';
type PinField = 'pin' | 'confirm';

interface AppLockSheetProps {
  isOpen: boolean;
  mode: AppLockMode;
  pinDraft: string;
  confirmDraft: string;
  errorMessage?: string | null;
  autoLockSeconds: number;
  biometricLabel?: string | null;
  isBiometricAvailable?: boolean;
  isBiometricAuthenticating?: boolean;
  onPinChange: (value: string) => void;
  onConfirmChange: (value: string) => void;
  onAutoLockSecondsChange: (value: (typeof APP_LOCK_AUTO_LOCK_OPTIONS)[number]) => void;
  onSubmit: () => void;
  onCancel: () => void;
  onUseBiometrics?: () => void;
}

const PIN_SLOT_COUNT = 6;
const DIGIT_LAYOUT = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

function normalizePin(value: string) {
  return value.replace(/\D/g, '').slice(0, PIN_SLOT_COUNT);
}

interface PinRowProps {
  label: string;
  value: string;
  active: boolean;
  helperText: string;
  onPress: () => void;
}

function PinRow({ label, value, active, helperText, onPress }: PinRowProps) {
  return (
    <button
      type="button"
      onClick={onPress}
      className={`ui-focus-ring w-full rounded-[1.4rem] border px-4 py-3 text-left transition ${
        active
          ? 'border-blue-400 bg-blue-50/90 shadow-[0_12px_30px_rgba(59,130,246,0.18)] dark:border-blue-400/80 dark:bg-blue-500/10'
          : 'border-white/75 bg-white/78 dark:border-slate-800 dark:bg-slate-950/45'
      }`}
      aria-label={`${label}. ${value.length} of ${PIN_SLOT_COUNT} digits entered.`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400 dark:text-slate-500">
            {label}
          </p>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{helperText}</p>
        </div>
        <div className="flex items-center gap-2" aria-hidden="true">
          {Array.from({ length: PIN_SLOT_COUNT }).map((_, index) => {
            const isFilled = index < value.length;
            return (
              <span
                key={`${label}-${index}`}
                className={`flex h-3.5 w-3.5 items-center justify-center rounded-full border transition ${
                  isFilled
                    ? 'border-slate-900 bg-slate-900 dark:border-slate-100 dark:bg-slate-100'
                    : active
                      ? 'border-blue-300 bg-blue-100/70 dark:border-blue-500/60 dark:bg-blue-500/20'
                      : 'border-slate-200 bg-white/30 dark:border-slate-700 dark:bg-slate-900/40'
                }`}
              />
            );
          })}
        </div>
      </div>
    </button>
  );
}

export default function AppLockSheet({
  isOpen,
  mode,
  pinDraft,
  confirmDraft,
  errorMessage = null,
  autoLockSeconds,
  biometricLabel = 'Biometric unlock',
  isBiometricAvailable = false,
  isBiometricAuthenticating = false,
  onPinChange,
  onConfirmChange,
  onAutoLockSecondsChange,
  onSubmit,
  onCancel,
  onUseBiometrics,
}: AppLockSheetProps) {
  const canDismiss = mode === 'setup';
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const focusFallbackRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [activeField, setActiveField] = useState<PinField>('pin');

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    previouslyFocusedElementRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();
    focusFallbackRef.current?.focus();

    return () => {
      previouslyFocusedElementRef.current?.focus();
    };
  }, [isOpen, mode]);

  const updateValue = (field: PinField, nextValue: string) => {
    const normalized = normalizePin(nextValue);
    if (field === 'pin') {
      onPinChange(normalized);
      return;
    }
    onConfirmChange(normalized);
  };

  const appendDigit = (digit: string) => {
    const targetField = mode === 'unlock' ? 'pin' : activeField;
    const currentValue = targetField === 'pin' ? pinDraft : confirmDraft;
    if (currentValue.length >= PIN_SLOT_COUNT) {
      return;
    }
    updateValue(targetField, `${currentValue}${digit}`);
  };

  const removeDigit = () => {
    const targetField = mode === 'unlock' ? 'pin' : activeField;
    const currentValue = targetField === 'pin' ? pinDraft : confirmDraft;
    updateValue(targetField, currentValue.slice(0, -1));
  };

  const canAdvanceSetup = mode === 'setup' && activeField === 'pin' && isValidAppLockPin(pinDraft);
  const canSubmitUnlock = mode === 'unlock' && isValidAppLockPin(pinDraft);
  const canSubmitSetup = mode === 'setup' && activeField === 'confirm' && isValidAppLockPin(confirmDraft);
  const primaryDisabled = !(canAdvanceSetup || canSubmitUnlock || canSubmitSetup);

  const activePrompt = useMemo(() => {
    if (mode === 'unlock') {
      return `Enter your app PIN to unlock BuddyList. ${isBiometricAvailable ? `${biometricLabel} is also ready.` : ''}`.trim();
    }

    if (activeField === 'confirm') {
      return 'Re-enter the same PIN to finish turning on app lock.';
    }

    return 'Choose a 4 to 6 digit PIN. Digits stay hidden while you type.';
  }, [activeField, biometricLabel, isBiometricAvailable, mode]);

  const primaryLabel =
    mode === 'unlock' ? 'Unlock' : activeField === 'confirm' ? 'Turn On App Lock' : 'Continue';

  const handlePrimaryAction = () => {
    if (mode === 'setup' && activeField === 'pin') {
      if (isValidAppLockPin(pinDraft)) {
        setActiveField('confirm');
      }
      return;
    }

    onSubmit();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (/^\d$/.test(event.key)) {
      event.preventDefault();
      appendDigit(event.key);
      return;
    }

    if (event.key === 'Backspace') {
      event.preventDefault();
      removeDigit();
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      handlePrimaryAction();
      return;
    }

    if (event.key === 'Escape' && canDismiss) {
      event.preventDefault();
      onCancel();
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/35 backdrop-blur-[6px]"
      onClick={canDismiss ? onCancel : undefined}
      onKeyDown={handleKeyDown}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="ui-sheet-surface w-full max-w-md rounded-t-[2rem]"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex justify-center pb-1 pt-3">
          <div className="ui-drag-handle" />
        </div>

        <div className="ui-sheet-header">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600/12 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300">
              <AppIcon kind="lock" className="h-5 w-5" />
            </div>
            <div>
              <h2 id={titleId} className="ui-sheet-title text-[length:var(--ui-text-lg)]">
                {mode === 'unlock' ? 'Unlock BuddyList' : 'Turn On App Lock'}
              </h2>
              <p className="text-[12px] text-slate-500 dark:text-slate-400">
                {mode === 'unlock' ? 'Private chats stay covered until you unlock.' : 'Use a hidden PIN like your iPhone lock screen.'}
              </p>
            </div>
          </div>

          {canDismiss ? (
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onCancel}
              aria-label="Close app lock setup"
              className="ui-focus-ring ui-sheet-close h-11 w-11 text-[length:var(--ui-text-sm)] font-semibold"
            >
              <AppIcon kind="close" className="h-4 w-4" />
            </button>
          ) : (
            <div ref={focusFallbackRef} tabIndex={-1} aria-hidden="true" className="h-11 w-11" />
          )}
        </div>

        <div className="space-y-4 px-5 pb-2">
          <p id={descriptionId} className="text-[13px] leading-6 text-slate-600 dark:text-slate-300">
            {activePrompt}
          </p>

          <div className="space-y-3">
            <PinRow
              label={mode === 'unlock' ? 'App PIN' : 'Create PIN'}
              value={pinDraft}
              active={mode === 'unlock' || activeField === 'pin'}
              helperText={mode === 'unlock' ? '4 to 6 hidden digits' : 'Pick the PIN you want to use on this device'}
              onPress={() => setActiveField('pin')}
            />

            {mode === 'setup' ? (
              <PinRow
                label="Confirm PIN"
                value={confirmDraft}
                active={activeField === 'confirm'}
                helperText="Enter the same PIN again"
                onPress={() => setActiveField('confirm')}
              />
            ) : null}
          </div>

          {mode === 'setup' ? (
            <div className="ui-panel-card rounded-[1.4rem] px-4 py-3">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-slate-900 dark:text-slate-300">
                  <AppIcon kind="clock" className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">Auto-lock</p>
                  <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                    Choose how quickly BuddyList asks for the PIN after you leave the app.
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {APP_LOCK_AUTO_LOCK_OPTIONS.map((value) => {
                  const selected = autoLockSeconds === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => onAutoLockSecondsChange(value)}
                      className={`ui-focus-ring rounded-full border px-3 py-2 text-[11px] font-semibold transition ${
                        selected
                          ? 'border-blue-500 bg-blue-600 text-white shadow-[0_12px_30px_rgba(37,99,235,0.22)]'
                          : 'border-white/75 bg-white/78 text-slate-600 dark:border-slate-800 dark:bg-slate-950/45 dark:text-slate-300'
                      }`}
                    >
                      {formatAppLockTimeoutLabel(value)}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {errorMessage ? (
            <div className="rounded-[1.4rem] border border-rose-200/80 bg-rose-50/95 px-4 py-3 text-[12px] text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
              {errorMessage}
            </div>
          ) : null}

          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              {DIGIT_LAYOUT.map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => appendDigit(digit)}
                  className="ui-focus-ring flex h-14 items-center justify-center rounded-[1.25rem] border border-white/80 bg-white/82 text-[20px] font-semibold text-slate-800 shadow-[0_12px_24px_rgba(15,23,42,0.08)] transition hover:-translate-y-[1px] dark:border-slate-800 dark:bg-slate-950/45 dark:text-slate-100"
                  aria-label={`Digit ${digit}`}
                >
                  {digit}
                </button>
              ))}
              <div className="flex items-center justify-center">
                {mode === 'unlock' && isBiometricAvailable && onUseBiometrics ? (
                  <button
                    type="button"
                    onClick={onUseBiometrics}
                    disabled={isBiometricAuthenticating}
                    className="ui-focus-ring flex h-14 w-full items-center justify-center rounded-[1.25rem] border border-blue-200 bg-blue-50/95 px-2 text-[11px] font-semibold text-blue-700 transition disabled:opacity-60 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200"
                  >
                    {isBiometricAuthenticating ? 'Checking...' : biometricLabel}
                  </button>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => appendDigit('0')}
                className="ui-focus-ring flex h-14 items-center justify-center rounded-[1.25rem] border border-white/80 bg-white/82 text-[20px] font-semibold text-slate-800 shadow-[0_12px_24px_rgba(15,23,42,0.08)] transition hover:-translate-y-[1px] dark:border-slate-800 dark:bg-slate-950/45 dark:text-slate-100"
                aria-label="Digit 0"
              >
                0
              </button>
              <button
                type="button"
                onClick={removeDigit}
                className="ui-focus-ring flex h-14 items-center justify-center rounded-[1.25rem] border border-white/80 bg-white/82 px-3 text-[12px] font-semibold text-slate-500 shadow-[0_12px_24px_rgba(15,23,42,0.08)] transition hover:-translate-y-[1px] dark:border-slate-800 dark:bg-slate-950/45 dark:text-slate-300"
              >
                Delete
              </button>
            </div>

            <button
              type="button"
              onClick={handlePrimaryAction}
              disabled={primaryDisabled}
              className="ui-focus-ring ui-button-primary w-full rounded-[1.4rem] px-4 py-3 text-[14px] font-semibold disabled:opacity-60"
            >
              {primaryLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
