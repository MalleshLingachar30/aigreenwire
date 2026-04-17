import Link from "next/link";
import {
  formatArchiveDate,
  formatIssueNumber,
  listArchiveIssues,
} from "@/lib/archive";

export const dynamic = "force-dynamic";

export default async function IssuesPage() {
  const issues = await listArchiveIssues(50);

  return (
    <main className="min-h-screen bg-gradient-to-b from-emerald-50 via-lime-50 to-white text-slate-900">
      <section className="mx-auto w-full max-w-4xl px-6 pb-16 pt-12 md:px-10">
        <header className="space-y-4">
          <p className="inline-flex rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">
            Public Archive
          </p>
          <h1 className="text-3xl font-semibold leading-tight text-emerald-950 md:text-5xl">
            The AI Green Wire Issues
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-slate-700 md:text-base">
            Published issues from the weekly AI agriculture and ecology briefing.
          </p>
        </header>

        {issues.length === 0 ? (
          <section className="mt-10 rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-emerald-900">
              No public issues yet
            </h2>
            <p className="mt-2 text-sm text-slate-700">
              Once an issue is approved, it will appear here automatically.
            </p>
          </section>
        ) : (
          <section className="mt-10 space-y-4">
            {issues.map((issue) => (
              <article
                key={issue.id}
                className="rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm transition hover:border-emerald-300"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">
                  Issue {formatIssueNumber(issue.issueNumber)} |{" "}
                  {formatArchiveDate(issue.publishedAt)}
                </p>
                <h2 className="mt-2 text-xl font-semibold text-emerald-950">
                  <Link
                    href={`/issues/${issue.slug}`}
                    className="transition hover:text-emerald-700"
                  >
                    {issue.title}
                  </Link>
                </h2>
                <p className="mt-2 text-sm text-slate-700">{issue.subjectLine}</p>
                <p className="mt-3 text-sm text-slate-600">{issue.data.stories.length} stories</p>
              </article>
            ))}
          </section>
        )}
      </section>
    </main>
  );
}
