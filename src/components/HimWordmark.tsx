interface HimWordmarkProps {
  className?: string;
  showOnlinePip?: boolean;
}

export default function HimWordmark({
  className = '',
  showOnlinePip = false,
}: HimWordmarkProps) {
  return (
    <span translate="no" className={`ui-wordmark ${className}`.trim()}>
      <span>H.I.M.</span>
      {showOnlinePip ? <span aria-hidden="true" className="ui-online-pip" /> : null}
    </span>
  );
}
