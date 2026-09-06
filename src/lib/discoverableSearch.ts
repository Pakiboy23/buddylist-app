/**
 * Privacy contract for global people search.
 *
 * Browse, Search, and Buddy-shell Find all read `public.users`. The
 * "Appear in Browse & Search" toggle writes `users.discoverable`. Any
 * lookup that is not a local buddy-list filter must apply this gate so
 * opt-out actually hides you.
 */

export const DISCOVERABLE_COLUMN = 'discoverable' as const;

export function applyDiscoverablePeopleGate<Q>(query: Q): Q {
  return (query as Q & { eq: (column: string, value: boolean) => Q }).eq(DISCOVERABLE_COLUMN, true);
}
