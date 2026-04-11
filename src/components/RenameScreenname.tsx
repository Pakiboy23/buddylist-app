'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

type RenameError = 'taken' | 'too_short' | 'too_long' | 'invalid_chars' | 'update_failed';

interface RenameScreennameProps {
  currentUsername: string;
  userId: string;
  onSuccess: (newUsername: string) => void;
  onClose: () => void;
}

const SCREENNAME_PATTERN = /^[a-zA-Z0-9_.]+$/;

function validateScreenname(value: string): RenameError | null {
  const trimmedValue = value.trim();

  if (trimmedValue.length < 3) {
    return 'too_short';
  }

  if (trimmedValue.length > 20) {
    return 'too_long';
  }

  if (!SCREENNAME_PATTERN.test(trimmedValue)) {
    return 'invalid_chars';
  }

  return null;
}

async function isScreennameTaken(candidate: string, userId: string) {
  const { data, error } = await supabase
    .from('users')
    .select('id')
    .eq('screenname', candidate)
    .neq('id', userId)
    .limit(1);

  if (error) {
    throw error;
  }

  return (data ?? []).length > 0;
}

function getErrorMessage(error: RenameError | null) {
  switch (error) {
    case 'taken':
      return 'That screenname is already taken.';
    case 'too_short':
      return 'Screennames must be at least 3 characters.';
    case 'too_long':
      return 'Screennames can be at most 20 characters.';
    case 'invalid_chars':
      return 'Use only letters, numbers, underscores, and periods.';
    case 'update_failed':
      return 'We could not update your screenname. Try again.';
    default:
      return '';
  }
}

export default function RenameScreenname({
  currentUsername,
  userId,
  onSuccess,
  onClose,
}: RenameScreennameProps) {
  const [draftValue, setDraftValue] = useState(currentUsername);
  const [isFocused, setIsFocused] = useState(false);
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<RenameError | null>(null);
  const checkRequestIdRef = useRef(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    const trimmedDraft = draftValue.trim();
    const trimmedCurrentUsername = currentUsername.trim();

    checkRequestIdRef.current += 1;
    const requestId = checkRequestIdRef.current;

    if (!trimmedDraft || trimmedDraft === trimmedCurrentUsername) {
      setIsCheckingAvailability(false);
      setError(null);
      return;
    }

    const validationError = validateScreenname(trimmedDraft);
    if (validationError) {
      setIsCheckingAvailability(false);
      setError(validationError);
      return;
    }

    setIsCheckingAvailability(true);

    const timeoutId = window.setTimeout(() => {
      void (async () => {
        try {
          const taken = await isScreennameTaken(trimmedDraft, userId);
          if (checkRequestIdRef.current !== requestId) {
            return;
          }
          setError(taken ? 'taken' : null);
        } catch (availabilityError) {
          console.error('Failed to check screenname availability:', availabilityError);
          if (checkRequestIdRef.current !== requestId) {
            return;
          }
          setError('update_failed');
        } finally {
          if (checkRequestIdRef.current === requestId) {
            setIsCheckingAvailability(false);
          }
        }
      })();
    }, 400);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [currentUsername, draftValue, userId]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedDraft = draftValue.trim();
    const trimmedCurrentUsername = currentUsername.trim();

    if (!trimmedDraft || trimmedDraft === trimmedCurrentUsername) {
      onClose();
      return;
    }

    const validationError = validateScreenname(trimmedDraft);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const taken = await isScreennameTaken(trimmedDraft, userId);
      if (taken) {
        setError('taken');
        return;
      }

      const changedAt = new Date().toISOString();
      const { error: updateError } = await supabase
        .from('users')
        .update({
          screenname: trimmedDraft,
          screenname_changed_at: changedAt,
        })
        .eq('id', userId);

      if (updateError) {
        console.error('Failed to update screenname:', updateError);
        setError('update_failed');
        return;
      }

      onSuccess(trimmedDraft);
      onClose();
    } catch (updateError) {
      console.error('Failed to rename screenname:', updateError);
      setError('update_failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isConfirmDisabled =
    isSubmitting ||
    isCheckingAvailability ||
    !draftValue.trim() ||
    draftValue.trim() === currentUsername.trim() ||
    (error !== null && error !== 'update_failed');

  return (
    <div
      onClick={onClose}
      style={{
        alignItems: 'center',
        background: 'rgba(0,0,0,0.7)',
        bottom: 0,
        display: 'flex',
        justifyContent: 'center',
        left: 0,
        padding: '24px',
        position: 'fixed',
        right: 0,
        top: 0,
        zIndex: 80,
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          background: '#1D1916',
          border: '1px solid #3A3028',
          borderRadius: '20px',
          boxShadow: '0 24px 80px rgba(0, 0, 0, 0.35)',
          color: '#F7F1EC',
          maxWidth: '420px',
          padding: '24px',
          width: '100%',
        }}
      >
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'flex-start' }}>
            <div>
              <p
                style={{
                  fontFamily: 'Nunito, sans-serif',
                  fontSize: '22px',
                  fontWeight: 700,
                  lineHeight: 1.2,
                  margin: 0,
                }}
              >
                Change screenname
              </p>
              <p
                style={{
                  color: '#C5B8AD',
                  fontFamily: 'Nunito, sans-serif',
                  fontSize: '14px',
                  lineHeight: 1.5,
                  margin: '8px 0 0',
                }}
              >
                Old screennames are released right away.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#C5B8AD',
                cursor: 'pointer',
                fontFamily: 'Nunito, sans-serif',
                fontSize: '14px',
                fontWeight: 700,
                padding: 0,
              }}
            >
              Close
            </button>
          </div>

          <div style={{ marginTop: '20px' }}>
            <label
              htmlFor="rename-screenname-input"
              style={{
                display: 'block',
                fontFamily: 'Nunito, sans-serif',
                fontSize: '13px',
                fontWeight: 700,
                marginBottom: '8px',
              }}
            >
              Desired screenname
            </label>
            <input
              id="rename-screenname-input"
              ref={inputRef}
              value={draftValue}
              onBlur={() => setIsFocused(false)}
              onChange={(event) => setDraftValue(event.target.value)}
              onFocus={() => setIsFocused(true)}
              spellCheck={false}
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="off"
              style={{
                background: '#15110F',
                border: `1px solid ${isFocused ? '#E8608A' : '#3A3028'}`,
                borderRadius: '14px',
                color: '#F7F1EC',
                fontFamily: '"IBM Plex Mono", monospace',
                fontSize: '16px',
                outline: 'none',
                padding: '14px 16px',
                width: '100%',
              }}
            />
            <p
              style={{
                color: '#9E8D80',
                fontFamily: 'Nunito, sans-serif',
                fontSize: '12px',
                lineHeight: 1.5,
                margin: '8px 0 0',
              }}
            >
              3–20 characters. Letters, numbers, underscores, and periods only.
            </p>
          </div>

          <div style={{ marginTop: '14px', minHeight: '20px' }}>
            {error ? (
              <p
                style={{
                  color: '#E8608A',
                  fontFamily: 'Nunito, sans-serif',
                  fontSize: '13px',
                  fontWeight: 700,
                  margin: 0,
                }}
              >
                {getErrorMessage(error)}
              </p>
            ) : isCheckingAvailability ? (
              <p
                style={{
                  color: '#C5B8AD',
                  fontFamily: 'Nunito, sans-serif',
                  fontSize: '13px',
                  margin: 0,
                }}
              >
                Checking availability…
              </p>
            ) : draftValue.trim() && draftValue.trim() !== currentUsername.trim() ? (
              <p
                style={{
                  color: '#C5B8AD',
                  fontFamily: 'Nunito, sans-serif',
                  fontSize: '13px',
                  margin: 0,
                }}
              >
                Screenname is available.
              </p>
            ) : null}
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'transparent',
                border: '1px solid #3A3028',
                borderRadius: '14px',
                color: '#F7F1EC',
                cursor: 'pointer',
                flex: 1,
                fontFamily: 'Nunito, sans-serif',
                fontSize: '14px',
                fontWeight: 700,
                padding: '14px 16px',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isConfirmDisabled}
              style={{
                background: '#E8608A',
                border: 'none',
                borderRadius: '14px',
                color: 'white',
                cursor: isConfirmDisabled ? 'not-allowed' : 'pointer',
                flex: 1,
                fontFamily: 'Nunito, sans-serif',
                fontSize: '14px',
                fontWeight: 700,
                opacity: isConfirmDisabled ? 0.5 : 1,
                padding: '14px 16px',
              }}
            >
              {isSubmitting ? 'Saving…' : 'Confirm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
