type StatsBarProps = {
  activeCount: number
  highPriorityCount: number
  shippedCount: number
}

export function StatsBar({ activeCount, highPriorityCount, shippedCount }: StatsBarProps) {
  const metrics = [
    { label: 'Active specs', value: activeCount },
    { label: 'High priority', value: highPriorityCount },
    { label: 'Shipped', value: shippedCount },
  ]

  return (
    <div className="stats-strip">
      {metrics.map((metric) => (
        <div className="stat-cell" key={metric.label}>
          <span className="stat-label">{metric.label}</span>
          <span className="stat-value">{metric.value}</span>
        </div>
      ))}
    </div>
  )
}
