import { Skeleton } from '@/components/skeleton'

import { ProjectModalSummary } from '@/lib/types'

type OverviewTabProps = {
  summary: ProjectModalSummary | undefined
  loading: boolean
}

export function OverviewTab({ summary, loading }: OverviewTabProps) {
  if (loading && !summary) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-5 w-48" />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, idx) => (
            <Skeleton key={idx} className="h-24" />
          ))}
        </div>
      </div>
    )
  }

  if (!summary) {
    return <div className="p-4 text-sm text-muted-foreground">Metadata unavailable.</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold uppercase text-muted-foreground">Quick stats</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {summary.quick_stats.map((stat) => (
            <div key={stat.id} className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">{stat.label}</div>
              <div className="mt-1 text-sm font-medium">{stat.value}</div>
              {stat.subvalue && <div className="text-xs text-muted-foreground">{stat.subvalue}</div>}
              {stat.timestamp && (
                <div className="mt-1 text-xs text-muted-foreground">{new Date(stat.timestamp).toLocaleString()}</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {summary.language_mix.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold uppercase text-muted-foreground">Languages</h3>
          <LanguageDistribution stats={summary.language_mix} />
        </div>
      )}

      {summary.highlight && summary.highlight.snippet && (
        <div className="rounded-md border bg-muted/40 p-4">
          <div className="text-xs font-semibold uppercase text-muted-foreground">Highlight</div>
          <div className="mt-1 text-sm font-medium">{summary.highlight.title || summary.highlight.path}</div>
          <p className="mt-2 text-sm text-muted-foreground">{summary.highlight.snippet}</p>
        </div>
      )}
    </div>
  )
}

type LanguageDistributionProps = {
  stats: ProjectModalSummary['language_mix']
}

function LanguageDistribution({ stats }: LanguageDistributionProps) {
  const total = stats.reduce((sum, stat) => sum + stat.count, 0)
  if (!total) return null

  return (
    <div>
      <div className="flex h-2 overflow-hidden rounded bg-muted">
        {stats.map((stat) => (
          <div
            key={stat.language}
            className="bg-primary/70 first:rounded-l last:rounded-r"
            style={{ width: `${Math.max((stat.count / total) * 100, 4)}%` }}
            title={`${stat.language} · ${stat.count}`}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
        {stats.map((stat) => (
          <span key={stat.language}>
            {stat.language} ({stat.count})
          </span>
        ))}
      </div>
    </div>
  )
}
