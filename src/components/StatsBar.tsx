import { formatCount } from '../utils/pluralize'

type StatsBarProps = {
  activeCount: number
  highPriorityCount: number
  shippedCount: number
}

export function StatsBar({ activeCount, highPriorityCount, shippedCount }: StatsBarProps) {
  return (
    <p className="tally">
      {formatCount(activeCount, 'spec')}, {shippedCount} shipped, {highPriorityCount} high priority
    </p>
  )
}
