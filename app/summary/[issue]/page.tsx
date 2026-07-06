import Link from "next/link";
import { notFound } from "next/navigation";
import { parseStoredIssueData } from "@/lib/citation-sanitize";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

type SummaryIssueRow = {
  issue_number: number;
  slug: string;
  title: string;
  subject_line: string;
  stories_json: unknown;
  status: string;
  generated_at: string;
  approved_at: string | null;
  sent_at: string | null;
};

type SummaryPageProps = {
  params: Promise<{ issue: string }>;
};

const SECTION_LABELS = {
  india: "India",
  forestry: "Forests, Carbon & Ecology",
  students: "Students & Researchers",
} as const;

const SECTION_KICKERS = {
  india: "Where AI is moving on the ground",
  forestry: "Signals from land, carbon and biodiversity systems",
  students: "Open doors for the next generation",
} as const;

async function findIssue(issueParam: string): Promise<SummaryIssueRow | null> {
  if (issueParam === "latest") {
    const rows = (await sql`
      SELECT
        issue_number,
        slug,
        title,
        subject_line,
        stories_json,
        status,
        generated_at::text AS generated_at,
        approved_at::text AS approved_at,
        sent_at::text AS sent_at
      FROM issues
      WHERE status IN ('approved', 'sent')
      ORDER BY COALESCE(sent_at, approved_at, generated_at) DESC, issue_number DESC
      LIMIT 1
    `) as SummaryIssueRow[];

    return rows[0] ?? null;
  }

  const issueNumber = Number.parseInt(issueParam, 10);
  if (!Number.isFinite(issueNumber) || issueNumber <= 0) {
    return null;
  }

  const rows = (await sql`
    SELECT
      issue_number,
      slug,
      title,
      subject_line,
      stories_json,
      status,
      generated_at::text AS generated_at,
      approved_at::text AS approved_at,
      sent_at::text AS sent_at
    FROM issues
    WHERE issue_number = ${issueNumber}
      AND status IN ('approved', 'sent')
    ORDER BY COALESCE(sent_at, approved_at, generated_at) DESC, issue_number DESC
    LIMIT 1
  `) as SummaryIssueRow[];

  return rows[0] ?? null;
}

function formatIssueNumber(issueNumber: number): string {
  return String(issueNumber).padStart(2, "0");
}

function formatPublishedDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(date);
}

export default async function SummaryArtifactPage({ params }: SummaryPageProps) {
  const { issue } = await params;
  const issueRow = await findIssue(issue);

  if (!issueRow) {
    notFound();
  }

  const issueData = parseStoredIssueData(
    issueRow.stories_json,
    Number(issueRow.issue_number)
  );
  const publishedAt =
    issueRow.sent_at ?? issueRow.approved_at ?? issueRow.generated_at;

  const groupedStories = {
    india: issueData.stories.filter((story) => story.section === "india"),
    forestry: issueData.stories.filter((story) => story.section === "forestry"),
    students: issueData.stories.filter((story) => story.section === "students"),
  };

  return (
    <main className="min-h-screen bg-[#f1efe8] text-[#18210f]">
      <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8 lg:px-10">
        <section className="overflow-hidden rounded-[32px] border border-[#c7d9a8] bg-[#fbf8ef] shadow-[0_28px_90px_rgba(23,52,4,0.08)]">
          <div className="relative overflow-hidden bg-[#173404] px-6 py-8 sm:px-10 sm:py-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(192,221,151,0.18),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(151,196,89,0.16),transparent_28%)]" />
            <div className="relative flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-3 rounded-full border border-[#97c459]/50 bg-[#284d0e]/70 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#d7edb4]">
                  <span className="inline-flex h-2.5 w-2.5 rounded-full bg-[#c0dd97]" />
                  AI Green Wire Weekly Summary
                </div>
                <h1 className="mt-5 max-w-3xl [font-family:Georgia,serif] text-4xl font-medium leading-tight text-[#eef7df] sm:text-5xl">
                  The AI Green Wire
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-[#d7edb4] sm:text-base">
                  A shareable weekly headline artifact for AI in agriculture,
                  agroforestry, forestry, biodiversity and ecology.
                </p>
              </div>

              <div className="rounded-[22px] border border-[#97c459]/35 bg-[#132a04]/80 px-4 py-4 text-right text-[#eef7df]">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#c0dd97]">
                  Issue {formatIssueNumber(issueRow.issue_number)}
                </div>
                <div className="mt-2 text-sm text-[#d7edb4]">
                  Published {formatPublishedDate(publishedAt)}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-8 px-6 py-8 sm:px-10 sm:py-10">
            <section className="grid gap-6 lg:grid-cols-[1.45fr_0.95fr]">
              <article className="rounded-[28px] border border-[#dfe9cb] bg-white/80 p-6 shadow-[0_18px_40px_rgba(23,52,4,0.05)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6a8f2c]">
                  This Week&apos;s Cover Signal
                </p>
                <h2 className="mt-3 [font-family:Georgia,serif] text-2xl leading-tight text-[#173404] sm:text-3xl">
                  {issueRow.title}
                </h2>
                <p className="mt-4 text-sm leading-7 text-[#3f4a35] sm:text-[15px]">
                  A compact, shareable readout of this week&apos;s key signals
                  from the full issue. Use this page as a repeatable template:
                  switch the URL to <span className="font-semibold text-[#173404]">/summary/latest</span> for
                  the newest released issue, or to a fixed issue number when you
                  want a locked weekly version.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    href={`/issues/${issueRow.slug}`}
                    className="inline-flex items-center rounded-full bg-[#173404] px-5 py-3 text-sm font-semibold text-[#eef7df] transition hover:bg-[#244f0a]"
                  >
                    Read Full Issue
                  </Link>
                  <Link
                    href="/issues"
                    className="inline-flex items-center rounded-full border border-[#c7d9a8] bg-[#f7f4e8] px-5 py-3 text-sm font-semibold text-[#173404] transition hover:border-[#97c459]"
                  >
                    Browse Archive
                  </Link>
                </div>
              </article>

              <aside className="rounded-[28px] border border-[#d7e5bd] bg-[#eff6df] p-6 shadow-[0_18px_40px_rgba(23,52,4,0.05)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6a8f2c]">
                  Subscribe CTA
                </p>
                <h3 className="mt-3 [font-family:Georgia,serif] text-2xl leading-tight text-[#173404]">
                  Get the Monday morning brief in your inbox.
                </h3>
                <ul className="mt-5 space-y-3 text-sm leading-6 text-[#314026]">
                  <li>Free weekly issue on AI in farming, forestry and ecology.</li>
                  <li>India-first editorial lens with practical field and market signals.</li>
                  <li>Archive access after signup with one-click unsubscribe.</li>
                </ul>
                <Link
                  href="/?archive=subscribe"
                  className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-[#639922] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#517d1b]"
                >
                  Subscribe to AI Green Wire
                </Link>
              </aside>
            </section>

            <section className="grid gap-5 lg:grid-cols-3">
              {(Object.keys(groupedStories) as Array<keyof typeof groupedStories>).map(
                (sectionKey) => (
                  <article
                    key={sectionKey}
                    className="rounded-[28px] border border-[#dfe9cb] bg-[#fffdf6] p-6 shadow-[0_16px_36px_rgba(23,52,4,0.04)]"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6a8f2c]">
                      {SECTION_KICKERS[sectionKey]}
                    </p>
                    <h3 className="mt-2 [font-family:Georgia,serif] text-2xl text-[#173404]">
                      {SECTION_LABELS[sectionKey]}
                    </h3>
                    <ul className="mt-5 space-y-4">
                      {groupedStories[sectionKey].map((story, index) => (
                        <li
                          key={`${sectionKey}-${index}`}
                          className="flex gap-3 border-t border-[#eef4e0] pt-4 first:border-t-0 first:pt-0"
                        >
                          <span className="mt-1 inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-[#173404] text-xs font-semibold text-[#eef7df]">
                            {index + 1}
                          </span>
                          <div>
                            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6a8f2c]">
                              {story.tag}
                            </div>
                            <p className="mt-1 text-sm leading-6 text-[#22301a]">
                              {story.headline}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </article>
                )
              )}
            </section>

            <section className="rounded-[28px] border border-[#d7e5bd] bg-[linear-gradient(135deg,#eff6df_0%,#fbf8ef_55%,#f6f1df_100%)] p-6 sm:p-8">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-2xl">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6a8f2c]">
                    Reusable Footer CTA
                  </p>
                  <h3 className="mt-2 [font-family:Georgia,serif] text-2xl leading-tight text-[#173404] sm:text-3xl">
                    Want the full brief every Monday instead of the recap?
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-[#314026] sm:text-[15px]">
                    Subscribe to get the complete issue with story detail,
                    source links, numbers, field notes and the archive.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Link
                    href="/?archive=subscribe"
                    className="inline-flex items-center rounded-full bg-[#173404] px-5 py-3 text-sm font-semibold text-[#eef7df] transition hover:bg-[#244f0a]"
                  >
                    Subscribe Free
                  </Link>
                  <Link
                    href={`/issues/${issueRow.slug}`}
                    className="inline-flex items-center rounded-full border border-[#b8cc92] bg-white/80 px-5 py-3 text-sm font-semibold text-[#173404] transition hover:border-[#97c459]"
                  >
                    Open Full Issue
                  </Link>
                </div>
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
