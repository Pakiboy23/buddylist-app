import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { JoinedRoomCard } from '@/components/JoinedRoomCard';

const LATE_NIGHT = {
  id: 'room-late-night',
  slug: 'late-night',
  name: 'Late Night',
  description: 'For the night owls. No judgment.',
};

function renderCard(room: { id: string; slug: string; name: string; description: string }) {
  return renderToStaticMarkup(
    createElement(JoinedRoomCard, {
      room,
      isSelected: false,
      isJoining: false,
      onOpen: () => undefined,
      onLeave: () => undefined,
    }),
  );
}

describe('JoinedRoomCard', () => {
  it('shows the seeded Late Night name and description', () => {
    const html = renderCard(LATE_NIGHT);

    expect(html).toContain('Late Night');
    expect(html).toContain('For the night owls. No judgment.');
    expect(html).toContain('data-testid="room-row-late-night"');
    expect(html).toContain('data-room-description="For the night owls. No judgment."');
    expect(html).not.toContain('Los Angeles');
    expect(html).not.toContain('ui-room-live-pill');
    expect(html).not.toContain('ui-room-tag');
    expect(html).not.toContain('active right now');
  });

  it('shows Los Angeles with its own catalog line', () => {
    const html = renderCard({
      id: 'room-la',
      slug: 'la',
      name: 'Los Angeles',
      description: 'West Coast vibes, sun and screens.',
    });

    expect(html).toContain('Los Angeles');
    expect(html).toContain('West Coast vibes, sun and screens.');
    expect(html).not.toContain('local plans');
  });

  it('omits a subtitle when the catalog description is blank', () => {
    const html = renderCard({
      id: 'room-blank',
      slug: 'everywhere-else',
      name: 'Everywhere Else',
      description: '   ',
    });

    expect(html).toContain('Everywhere Else');
    expect(html).toContain('data-room-description=""');
    expect(html).not.toContain('text-slate-400');
  });
});
