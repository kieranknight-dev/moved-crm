import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-2xl mb-2">Welcome back, Ge.</h1>
      <p className="text-ink-500 mb-8">
        Build a new workout or manage what's already live.
      </p>
      <div className="flex flex-wrap gap-4">
        <Link
          href="/dashboard"
          className="rounded-pill bg-blush-500 text-white px-6 py-3 text-sm font-medium shadow-cta hover:shadow-cardHover transition-shadow"
        >
          View Dashboard
        </Link>
        <Link
          href="/builder"
          className="rounded-pill border border-blush-200 px-6 py-3 text-sm font-medium hover:bg-blush-50 transition-colors"
        >
          + New Workout
        </Link>
        <Link
          href="/library"
          className="rounded-pill border border-blush-200 px-6 py-3 text-sm font-medium hover:bg-blush-50 transition-colors"
        >
          View All Workouts
        </Link>
      </div>
    </div>
  )
}
