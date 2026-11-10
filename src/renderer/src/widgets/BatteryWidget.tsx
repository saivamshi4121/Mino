interface BatteryWidgetProps {
  percent: number | null
  charging: boolean
}

export default function BatteryWidget({
  percent,
  charging
}: BatteryWidgetProps): React.JSX.Element {
  return (
    <section
      className={`island-widget island-battery${charging ? ' island-battery--charging' : ''}`}
      aria-label={
        percent === null
          ? 'Battery unavailable'
          : `Battery ${percent} percent${charging ? ', charging' : ''}`
      }
    >
      <svg className="island-battery-icon" viewBox="0 0 36 22" aria-hidden="true">
        <rect x="1" y="2" width="29" height="18" rx="4" />
        <path className="island-battery-terminal" d="M32 7h3v8h-3z" />
        {percent !== null && (
          <rect
            className="island-battery-level"
            x="4"
            y="5"
            width={Math.max(1, (percent / 100) * 23)}
            height="12"
            rx="2"
          />
        )}
        {charging && <path className="island-battery-bolt" d="m17 4-6 8h4l-1 6 6-9h-4z" />}
      </svg>
      <span className="island-battery-percent">{percent === null ? 'N/A' : `${percent}%`}</span>
      <span className="island-battery-status">
        {charging ? 'Charging' : percent === null ? 'No battery' : 'Battery'}
      </span>
    </section>
  )
}
