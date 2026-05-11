import Link from "next/link";
import { notFound } from "next/navigation";
import { formatArchiveDate, getLatestArchiveIssue } from "@/lib/archive";

export const dynamic = "force-dynamic";

export default async function SampleIssuePage() {
  const issue = await getLatestArchiveIssue();

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
          <Link href="/" className="text-[#3B6D11] hover:text-[#173404]">
            Back to home
          </Link>
          <span className="text-slate-500">|</span>
          <Link href="/w/6" className="text-[#3B6D11] hover:text-[#173404]">
            WhatsApp sample
          </Link>
          <span className="text-slate-500">|</span>
          <span className="text-slate-600">
            Public sample issue · Published {formatArchiveDate(issue.publishedAt)}
          </span>
        </div>
        <section
          className="mt-6 [&_a:hover]:opacity-85"
          dangerouslySetInnerHTML={{ __html: issueBodyHtml }}
        />
      </section>
    </main>
  );
}
