import Link from "next/link";
import { notFound } from "next/navigation";
import {
  formatArchiveDate,
  formatIssueNumber,
  getArchiveIssueBySlug,
} from "@/lib/archive";

export const dynamic = "force-dynamic";

type IssuePageProps = {
  params: Promise<{ slug: string }>;
};

export default async function IssuePage({ params }: IssuePageProps) {
  const { slug } = await params;
  const issue = await getArchiveIssueBySlug(slug);

  if (!issue) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-emerald-50 via-lime-50 to-white text-slate-900">
      <section className="mx-auto w-full max-w-4xl px-6 pb-20 pt-12 md:px-10">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Link href="/issues" className="text-emerald-700 hover:text-emerald-900">
            Back to archive
          </Link>
          <span className="text-slate-500">|</span>
          <span className="text-slate-600">
            Published {formatArchiveDate(issue.publishedAt)}
          </span>
        </div>

        <header className="mt-5 space-y-3 rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm md:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">
            Issue {formatIssueNumber(issue.issueNumber)}
          </p>
          <h1 className="text-3xl font-semibold leading-tight text-emerald-950 md:text-5xl">
            {issue.title}
          </h1>
          <p className="text-sm leading-relaxed text-slate-700 md:text-base">
            {issue.greetingBlurb}
          </p>
        </header>

        {issue.stories.length === 0 ? (
          <section className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            This issue is published but does not include a parseable story list.
          </section>
        ) : (
          <section className="mt-8 space-y-4">
            {issue.stories.map((story, index) => (
              <article
                key={`${issue.id}-${index}-${story.url}`}
                className="rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm"
              >
                {story.tag ? (
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">
                    {story.tag}
                  </p>
                ) : null}
                <h2 className="mt-2 text-xl font-semibold leading-snug text-emerald-950">
                  <a
                    href={story.url}
                    target="_blank"
                    rel="noreferrer"
                    className="transition hover:text-emerald-700"
                  >
                    {index + 1}. {story.title}
                  </a>
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-slate-700 md:text-base">
                  {story.summary}
                </p>
                <p className="mt-4 text-sm text-slate-600">
                  Source:{" "}
                  <a
                    href={story.url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-emerald-700 hover:text-emerald-900"
                  >
                    {story.source}
                  </a>
                </p>
              </article>
            ))}
          </section>
        )}
      </section>
    </main>
  );
}
