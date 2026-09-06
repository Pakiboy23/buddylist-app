/**
 * Privacy contract for global people search.
 *
 * Browse, Search, and Buddy-shell Find all read `public.users`. The
 * "Appear in Browse & Search" toggle writes `users.discoverable`. Any
 * lookup that is not a local buddy-list filter must apply this gate so
 * opt-out actually hides you.
 *
 * Browse also requires a non-empty away_message — it is the presence
 * board. Search and Buddy-shell Find stay away-optional on purpose:
 * a known screenname should still resolve after opt-in, even if that
 * person has not posted a line yet.
 */

export const DISCOVERABLE_COLUMN = 'discoverable' as const;
export const AWAY_MESSAGE_COLUMN = 'away_message' as const;

export function applyDiscoverablePeopleGate<Q>(query: Q): Q {
  return (query as Q & { eq: (column: string, value: boolean) => Q }).eq(DISCOVERABLE_COLUMN, true);
}

type AwayMessageQuery<Q> = Q & {
  not: (column: string, operator: string, value: null) => AwayMessageQuery<Q>;
  neq: (column: string, value: string) => Q;
};

export function applyBrowseAwayMessageRequired<Q>(query: Q): Q {
  return (query as AwayMessageQuery<Q>)
    .not(AWAY_MESSAGE_COLUMN, 'is', null)
    .neq(AWAY_MESSAGE_COLUMN, '');
}
