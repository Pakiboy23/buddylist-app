'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  createEmptyMutualContext,
  loadMutualContext,
  type MutualContext,
} from '@/lib/mutualContext';

interface MutualContextState {
  targetUserId: string | null;
  context: MutualContext;
  isLoading: boolean;
  error: string | null;
}

export function useMutualContext(targetUserId: string | null | undefined) {
  const normalizedTargetId = targetUserId?.trim() || null;
  const [state, setState] = useState<MutualContextState>({
    targetUserId: null,
    context: createEmptyMutualContext(),
    isLoading: false,
    error: null,
  });

  useEffect(() => {
    if (!normalizedTargetId) {
      return;
    }

    let isCancelled = false;
    void loadMutualContext(normalizedTargetId)
      .then((context) => {
        if (!isCancelled) {
          setState({ targetUserId: normalizedTargetId, context, isLoading: false, error: null });
        }
      })
      .catch((error) => {
        if (!isCancelled) {
          setState({
            targetUserId: normalizedTargetId,
            context: createEmptyMutualContext(),
            isLoading: false,
            error: error instanceof Error ? error.message : 'Could not load shared context.',
          });
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [normalizedTargetId]);

  return useMemo(() => {
    if (state.targetUserId === normalizedTargetId) {
      return state;
    }

    return {
      targetUserId: normalizedTargetId,
      context: createEmptyMutualContext(),
      isLoading: Boolean(normalizedTargetId),
      error: null,
    };
  }, [normalizedTargetId, state]);
}
