import Link from "next/link";
import { notFound } from "next/navigation";
import { requireArchiveAccess } from "@/lib/archive-access";
import {
  formatArchiveDate,
  getArchiveIssueBySlug,
} from "@/lib/archive";
import { WhatsAppCardLinks } from "../whatsapp-card-links";

export const dynamic = "force-dynamic";

type IssuePageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ token?: string | string[] }>;
};

export default async function IssuePage({ params, searchParams }: IssuePageProps) {
  const resolvedSearchParams = await searchParams;
  const queryToken = Array.isArray(resolvedSearchParams.token)
    ? resolvedSearchParams.token[0]
    : resolvedSearchParams.token;
  await requireArchiveAccess(queryToken ?? null);

  const { slug } = await params;
  const issue = await getArchiveIssueBySlug(slug);

  if (!issue) {
    notFound();
  }

  const renderedHtml = issue.htmlRendered || "";
  const bodyMatch = renderedHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const issueBodyHtml = bodyMatch ? bodyMatch[1] : renderedHtml;

  return (
    <main className="min-h-screen bg-[#F1EFE8] text-slate-900">
      <section className="mx-auto w-full max-w-5xl px-6 pb-20 pt-10 md:px-10">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Link href="/issues" className="text-[#3B6D11] hover:text-[#173404]">
            Back to archive
          </Link>
          <span className="text-slate-500">|</span>
          <Link href="/unsubscribe" className="text-[#3B6D11] hover:text-[#173404]">
            Unsubscribe
          </Link>
          <span className="text-slate-500">|</span>
          <span className="text-slate-600">
            Published {formatArchiveDate(issue.publishedAt)}
          </span>
        </div>
        <div className="mt-4">
          <WhatsAppCardLinks
            issueNumber={issue.issueNumber}
            languages={issue.availableCardLanguages}
          />
        </div>
        <section
          className="mt-6 [&_a:hover]:opacity-85"
          dangerouslySetInnerHTML={{ __html: issueBodyHtml }}
        />
      </section>
    </main>
  );
}
