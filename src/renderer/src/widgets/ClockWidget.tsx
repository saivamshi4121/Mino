import { useEffect, useState } from 'react'

function getNow(): Date {
  return new Date()
}

export default function ClockWidget(): React.JSX.Element {
  const [now, setNow] = useState(getNow)

  useEffect(() => {
    const interval = window.setInterval(() => setNow(getNow()), 1000)
    return () => window.clearInterval(interval)
  }, [])

  return (
    <section className="island-widget island-clock" aria-label="Current time and date">
      <span className="island-clock-time">
        {now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
      </span>
      <span className="island-clock-date">
        {now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
      </span>
    </section>
  )
}
