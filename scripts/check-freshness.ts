import { sql } from "@/lib/db";
import {
  checkIssueFreshness,
  isIssueFreshEnough,
  formatFreshnessFailure,
  type PreviousIssueContext,
} from "@/lib/issue-freshness";
import { sanitizeIssueData } from "@/lib/citation-sanitize";
import type { IssueData } from "@/lib/claude";

type IssueRow = {
  issue_number: number;
  subject_line: string;
  greeting_blurb: string;
  stories_json: unknown;
};

function toPreviousContext(
  row: IssueRow,
  data: IssueData
): PreviousIssueContext {
  return {
    issueNumber: Number(row.issue_number),
    subjectLine: row.subject_line,
    greetingBlurb: row.greeting_blurb,
    fieldNote: data.field_note,
    stories: data.stories.map((s) => ({
      section: s.section,
      headline: s.headline,
      sourceUrls: s.sources.map((src) => src.url),
    })),
    stats: data.stats.map((s) => ({
      value: s.value,
      label: s.label,
      sourceUrl: s.source_url,
    })),
  };
}

async function main() {
  const rows = (await sql`
    SELECT issue_number, subject_line, greeting_blurb, stories_json
    FROM issues
    WHERE status = 'sent'
    ORDER BY issue_number ASC
  `) as IssueRow[];

  const parsed = rows.map((row) => {
    const raw =
      typeof row.stories_json === "string"
        ? JSON.parse(row.stories_json)
        : row.stories_json;
    const data = sanitizeIssueData(raw as IssueData);
    return { row, data };
  });

  // Check each issue against all previous ones
  for (let i = 1; i < parsed.length; i++) {
    const current = parsed[i]!;
    const previousContexts = parsed
      .slice(0, i)
      .reverse()
      .map((p) => toPreviousContext(p.row, p.data));

    const prevLabels = previousContexts
      .map((c) => `Issue ${c.issueNumber}`)
      .join(", ");

    console.log(
      `\n--- Issue ${current.row.issue_number} vs [${prevLabels}] ---`
    );

    const result = checkIssueFreshness(current.data, previousContexts);
    const fresh = isIssueFreshEnough(result);
    console.log("Fresh enough:", fresh);

    if (!fresh) {
      console.log("Failures:", formatFreshnessFailure(result));
    }

    // Print detailed breakdown
    if (result.duplicateSourceUrlMatches.length > 0) {
      console.log("\n  Duplicate source URLs:");
      for (const m of result.duplicateSourceUrlMatches) {
        console.log(`    "${m.currentHeadline}" <-> "${m.previousHeadline}"`);
        console.log(`    URL: ${m.sourceUrl}`);
      }
    }

    if (result.similarHeadlineMatches.length > 0) {
      console.log("\n  Similar headlines:");
      for (const m of result.similarHeadlineMatches) {
        console.log(
          `    "${m.currentHeadline}" <-> "${m.previousHeadline}" (${m.similarity.toFixed(2)})`
        );
      }
    }

    if (result.repeatedTopicLaneMatches.length > 0) {
      console.log("\n  Repeated topic lanes:");
      for (const m of result.repeatedTopicLaneMatches) {
        console.log(
          `    ${m.laneLabel} (from issue ${m.previousIssueNumber})`
        );
      }
    }

    if (result.duplicateStatMatches.length > 0) {
      console.log("\n  Duplicate stats:");
      for (const m of result.duplicateStatMatches) {
        console.log(
          `    ${m.currentValue} "${m.currentLabel}" <-> ${m.previousValue} "${m.previousLabel}"`
        );
      }
    }

    if (result.repeatedOpeningEntity) {
      console.log(
        `\n  Repeated opening entity: ${result.repeatedOpeningEntity.entity}`
      );
    }
    if (result.repeatedOpeningLens) {
      console.log(
        `\n  Repeated opening lens: ${result.repeatedOpeningLens.lens}`
      );
    }
    if (result.repeatedOpeningStructure) {
      console.log(
        `\n  Repeated opening structure: ${result.repeatedOpeningStructure.structure}`
      );
    }
    if (result.similarFieldNote) {
      console.log(
        `\n  Similar field note: ${result.similarFieldNote.similarity.toFixed(2)}`
      );
    }
    if (result.similarGreetingBlurb) {
      console.log(
        `\n  Similar greeting blurb: ${result.similarGreetingBlurb.similarity.toFixed(2)}`
      );
    }
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
