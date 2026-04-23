interface HimWordmarkProps {
  className?: string;
  showOnlinePip?: boolean;
}

// H.I.M. wordmark where each period in the acronym is a colored presence dot.
// Rose → Gold → Lavender maps directly to the three brand accent colors.
// The dots are the same "online" indicator used throughout the app — presence made literal.
export default function HimWordmark({
  className = '',
  showOnlinePip = false,
}: HimWordmarkProps) {
  return (
    <span translate="no" className={`ui-wordmark ${className}`.trim()}>
      <span className="him-letter">H</span>
      <span
        className="him-pip"
        style={{ background: 'var(--rose)' }}
        aria-hidden="true"
      />
      <span className="him-letter">I</span>
      <span
        className="him-pip"
        style={{ background: 'var(--gold)' }}
        aria-hidden="true"
      />
      <span className="him-letter">M</span>
      <span
        className="him-pip"
        style={{ background: 'var(--lavender)' }}
        aria-hidden="true"
      />
      {showOnlinePip ? (
        <span aria-hidden="true" className="ui-online-pip" />
      ) : null}
    </span>
  );
}
