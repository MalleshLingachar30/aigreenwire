import { NextRequest, NextResponse } from "next/server";
import { isCronRequestAuthorized } from "@/lib/api-auth";
import { type IssueData } from "@/lib/claude";
import { sanitizeIssueData, parseStoredIssueData } from "@/lib/citation-sanitize";
import { sql } from "@/lib/db";
import {
  checkIssueFreshness,
  formatFreshnessFailure,
  isIssueFreshEnough,
  type PreviousIssueContext,
} from "@/lib/issue-freshness";
import { buildAppUrl } from "@/lib/subscription";
import { renderIssue } from "@/lib/template";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type MaxIssueNumberRow = {
  max_issue_number: number | string | null;
};

type PreviousIssueRow = {
  issue_number: number;
  subject_line: string;
  greeting_blurb: string;
  stories_json: unknown;
};

type DraftIssueRow = {
  id: string;
  issue_number: number;
  slug: string;
  title: string;
  subject_line: string;
  status: string;
};

type ExistingDraftRow = {
  id: string;
  issue_number: number;
  slug: string;
  title: string;
  subject_line: string;
  status: string;
  stories_json: unknown;
};

const MAX_INSERT_ATTEMPTS = 3;
const PREVIOUS_ISSUES_LOOKBACK = 2;

function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) {
    throw new Error("NEXT_PUBLIC_SITE_URL is missing.");
  }

  return raw.replace(/\/+$/, "");
}

function getAdminPassword(): string {
  const value = process.env.ADMIN_PASSWORD;
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("ADMIN_PASSWORD is missing.");
  }

  return value.trim();
}

function slugify(input: string): string {
  const value = input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  return value || "weekly-briefing";
}

function extractHeadline(subjectLine: string): string {
  const parts = subjectLine
    .split("·")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 3) {
    return parts[parts.length - 1] as string;
  }

  return subjectLine.trim();
}

function buildIssueSlug(issueNumber: number, subjectLine: string): string {
  const issueLabel = String(issueNumber).padStart(2, "0");
  const headline = extractHeadline(subjectLine);
  const slugPart = slugify(headline).slice(0, 64).replace(/^-+|-+$/g, "");
  return `${issueLabel}-${slugPart}`.replace(/-+/g, "-");
}

function isUniqueViolation(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.message.toLowerCase().includes("duplicate key value");
}

async function getNextIssueNumber(): Promise<number> {
  const rows = (await sql`
    SELECT COALESCE(MAX(issue_number), 0) AS max_issue_number
    FROM issues
    WHERE status = 'sent'
  `) as MaxIssueNumberRow[];

  const max = Number(rows[0]?.max_issue_number ?? 0);
  return Number.isFinite(max) ? max + 1 : 1;
}

async function getPreviousIssueContexts(nextIssueNumber: number): Promise<PreviousIssueContext[]> {
  const rows = (await sql`
    SELECT
      issue_number,
      subject_line,
      greeting_blurb,
      stories_json
    FROM issues
    WHERE issue_number < ${nextIssueNumber}
      AND status = 'sent'
    ORDER BY issue_number DESC
    LIMIT ${PREVIOUS_ISSUES_LOOKBACK}
  `) as PreviousIssueRow[];

  return rows.map((previous) => {
    const parsed = parseStoredIssueData(previous.stories_json, Number(previous.issue_number));

    return {
      issueNumber: Number(previous.issue_number),
      subjectLine: previous.subject_line,
      greetingBlurb: previous.greeting_blurb,
      fieldNote: parsed.field_note,
      stories: parsed.stories.map((story) => ({
        section: story.section,
        headline: story.headline,
        sourceUrls: story.sources.map((source) => source.url),
      })),
      stats: parsed.stats.map((stat) => ({
        value: stat.value,
        label: stat.label,
        sourceUrl: stat.source_url,
      })),
    };
  });
}

function buildManualIssue(issueNumber: number): IssueData {
  return sanitizeIssueData({
    issue_number: issueNumber,
    subject_line:
      "The AI Green Wire · Issue 06 · Field pilots, forest benchmarks, and student grants before monsoon",
    greeting_blurb:
      "Namaste. This week’s strongest signal is operational: ICAR-CRIDA and Mahyco are putting yield forecasting onto live wheat and rice plots, while researchers and land managers push biodiversity and water tools closer to field use. The common thread is execution, not announcement. Watch which of these systems publishes usable results before the monsoon turns pilots into real decisions.",
    stories: [
      {
        section: "india",
        tag: "Yield forecasting",
        headline:
          "ICAR-CRIDA and Mahyco push wheat and rice forecasting onto live seed and demo plots",
        paragraphs: [
          "On 23 April, ICAR-CRIDA signed a research agreement with Mahyco to improve wheat and rice yield prediction in smallholder landscapes using multimodel ensemble approaches. The institute says it will provide in-season forecasts for seed production and demonstration plots through advanced crop-simulation modelling.",
          "That matters because it turns AI-adjacent forecasting into an operational farm workflow rather than a national promise. If the models hold up through the season, input timing, seed planning, and procurement decisions can be adjusted while crops are still in the ground.",
        ],
        action:
          "Watch whether the partnership starts publishing accuracy ranges or expands beyond demonstration plots after kharif.",
        sources: [
          {
            name: "ICAR",
            url: "https://icar.org.in/en/icar-crida-hyderabad-signs-moa-mahyco-private-limited",
          },
        ],
      },
      {
        section: "india",
        tag: "Research to market",
        headline:
          "IARI’s industry meet shows robotics, sensing, and soil tools moving out of the lab",
        paragraphs: [
          "At ICAR-IARI’s 23 April natural-resource-management industry meet, the institute highlighted current work in robotics, AI, precision agriculture, smart sensing, UAV applications, and AI-enabled decision support across its engineering and physics divisions.",
          "The stronger signal was commercial readiness. IARI said Krishikosh now holds around 325,000 knowledge assets including roughly 215,000 theses, and that an in-house soil test meter has already been licensed to 21 firms. That suggests some of these tools are being packaged for transfer rather than left as lab demonstrations.",
        ],
        action:
          "For field teams, the practical question is which sensing and soil tools can plug into existing water, nutrient, and extension workflows this season.",
        sources: [
          {
            name: "ICAR-IARI",
            url: "https://www.iari.res.in/files/Latest-News/NRM_Meet_14042026.pdf",
          },
        ],
      },
      {
        section: "india",
        tag: "Traceable markets",
        headline:
          "ITC ties digital farm support to an audited sustainability benchmark in wheat and paddy clusters",
        paragraphs: [
          "On 15 April, ITC said its wheat and paddy sourcing clusters became the first in India to receive the global FSA 3.0 Silver benchmark. The programme covered more than 3,500 farmers across 70-plus FPOs and 22,000-plus acres in Uttar Pradesh and Bihar.",
          "The important detail is not the badge alone but the operating model behind it: ITC ties documented on-ground practice change to traceability and its ITCMAARS phygital support stack. That is closer to the kind of auditable field deployment buyers and processors will actually pay for than another generic platform claim.",
        ],
        action:
          "Watch whether more grain buyers start demanding the same digital audit trail from cluster-based sourcing this kharif.",
        sources: [
          {
            name: "ITC",
            url: "https://itcportal.com/media-centre/itc-stories/itc-s-fsa-3-0-silver-benchmark-sustainable-agriculture.html",
          },
        ],
      },
      {
        section: "forestry",
        tag: "Forest data",
        headline:
          "Deep4Dist sets a cleaner benchmark for bark beetle, windthrow, and clear-cut detection",
        paragraphs: [
          "A new Scientific Data release, Deep4Dist, packages roughly 17,500 labelled forest-disturbance image patches into a benchmark built from very high resolution aerial and LiDAR-derived data. The set covers five channels and targets practical disturbance classes including bark beetle outbreaks, windthrow, and clear-cuts.",
          "This matters because forestry teams still struggle to compare models across uneven local datasets. A shared benchmark with published baseline results gives researchers and vendors a cleaner way to test whether new monitoring models are genuinely better or just differently tuned.",
        ],
        action:
          "If you work on restoration or carbon MRV, watch whether Indian and Southeast Asian teams adapt this benchmark logic to monsoon and mixed-species forests.",
        sources: [
          {
            name: "Nature Scientific Data",
            url: "https://www.nature.com/articles/s41597-026-07084-8",
          },
        ],
      },
      {
        section: "forestry",
        tag: "Biodiversity monitoring",
        headline:
          "CIFOR-ICRAF and Map of Life show why AI works best in mixed biodiversity monitoring stacks",
        paragraphs: [
          "A new CIFOR-ICRAF update on its Map of Life partnership shows how camera traps, soundscapes, eDNA, bird counts, fish assessments, and local ecological knowledge are being combined with AI-assisted analysis across five countries. Early results from Guyana identified 741 species across three monitoring methods, including threatened species that a single method could miss.",
          "The takeaway is strategic as much as technical: biodiversity monitoring is moving away from one-tool claims and toward mixed evidence pipelines. That matters for restoration, compliance, and community-led monitoring because the strongest systems now blend AI with local field knowledge instead of trying to replace it.",
        ],
        action:
          "Watch for national biodiversity strategies that start budgeting for multi-sensor monitoring instead of one-off satellite or camera projects.",
        sources: [
          {
            name: "CIFOR-ICRAF",
            url: "https://www.cifor-icraf.org/press/press-release/how-smarter-biodiversity-monitoring-is-helping-protect-the-ecosystems-people-rely-on/",
          },
        ],
      },
      {
        section: "forestry",
        tag: "AI mapping",
        headline:
          "GUARDEN’s AI maps aim to make biodiversity trade-offs visible before projects reach site work",
        paragraphs: [
          "An EU CORDIS update on the GUARDEN project shows AI ecological modelling being combined with satellite indicators, citizen science, acoustic data, and augmented reality to build biodiversity maps for planners and land managers. The system is designed to flag route options, invasive-species risks, and habitats needing deeper field checks.",
          "The larger point is that AI is becoming more useful at triage than at final judgment. If these map layers help teams decide where not to build, where to survey first, or where to restore earlier, they can save both money and ecological damage long before a formal clearance fight starts.",
        ],
        action:
          "Look for versions of this workflow in transmission, mining, and watershed projects where early ecological screening is often weakest.",
        sources: [
          {
            name: "CORDIS",
            url: "https://cordis.europa.eu/article/id/464237-new-ai-maps-help-protect-biodiversity-across-sectors",
          },
        ],
      },
      {
        section: "forestry",
        tag: "Water and trees",
        headline:
          "ECMWF uses machine learning to show where tree planting cuts floods without draining groundwater",
        paragraphs: [
          "A new ECMWF-backed study used machine learning and hydrological modelling to test where afforestation improves water outcomes rather than worsening them. The team reports that well-targeted planting can reduce flood peaks by up to 43 percent while preserving groundwater by as much as 60 percent, with the best trade-off often appearing around 40 to 80 percent cover.",
          "This matters for agroforestry and restoration planning because blanket tree-planting targets can backfire in water-stressed landscapes. The better question is where tree cover helps recharge, slow runoff, and support livelihoods instead of simply adding hectares to a dashboard.",
        ],
        action:
          "If you are planning catchment work before monsoon, use this as a reminder to map water behaviour first and tree density second.",
        sources: [
          {
            name: "ECMWF",
            url: "https://www.ecmwf.int/en/about/media-centre/news/2026/machine-learning-tree-planting-water-sustainability",
          },
        ],
      },
      {
        section: "students",
        tag: "Student challenge",
        headline:
          "a-IDEA’s AGGNITE 6.0 is open for students turning agri problems into ventures",
        paragraphs: [
          "The a-IDEA platform at ICAR-NAARM has opened AGGNITE 6.0 for students aged 17 to 27, including undergraduate, postgraduate, and PhD applicants, with entries accepted from individuals or teams of two. The programme is positioned around agriculture and allied sectors and lists 13 May as the deadline.",
          "That makes it one of the cleaner late-spring entry points for students who want structured validation rather than just another pitch-deck contest. It is especially relevant if your idea sits between farm operations, AI tools, traceability, or climate services and needs a sharper commercial frame.",
        ],
        action:
          "If you have a prototype, use the next week to tighten the user problem and evidence rather than overbuilding the technology story.",
        sources: [
          {
            name: "a-IDEA",
            url: "https://aidea.naarm.org.in/",
          },
        ],
      },
      {
        section: "students",
        tag: "Grant support",
        headline:
          "Pusa Krishi’s UPJA and ARISE grants reopen a practical route from campus prototypes to agri startups",
        paragraphs: [
          "On 17 April, Pusa Krishi at ICAR-IARI launched the 2026 editions of UPJA and ARISE, two grant-in-aid programmes aimed at incubating agribusiness ideas and early startups. UPJA can support selected ventures with up to ₹25 lakh, while ARISE offers support up to ₹5 lakh, and the student orientation track can go up to ₹4 lakh.",
          "The timing matters because these grants sit closer to execution than many academic innovation calls. For students and recent founders, this is one of the more usable bridges between a research-backed idea and first commercial testing, with the current deadline set for 17 May.",
        ],
        action:
          "If you apply, show why your product can survive one real cropping season, not just why it looks strong in a demo.",
        sources: [
          {
            name: "ICAR-IARI",
            url: "https://www.iari.res.in/files/Latest-News/ICAR-IARI_Launches_UPJA_17042026.pdf",
          },
        ],
      },
    ],
    stats: [
      {
        value: "₹25 lakh",
        label: "Top grant support available under Pusa Krishi’s UPJA 2026 programme",
        source_name: "ICAR-IARI",
        source_url: "https://www.iari.res.in/files/Latest-News/ICAR-IARI_Launches_UPJA_17042026.pdf",
      },
      {
        value: "741 species",
        label: "Species identified in early Guyana monitoring results across three methods",
        source_name: "CIFOR-ICRAF",
        source_url:
          "https://www.cifor-icraf.org/press/press-release/how-smarter-biodiversity-monitoring-is-helping-protect-the-ecosystems-people-rely-on/",
      },
      {
        value: "88.2%",
        label: "Benchmark overall accuracy reported for the Deep4Dist disturbance dataset",
        source_name: "Nature Scientific Data",
        source_url: "https://www.nature.com/articles/s41597-026-07084-8",
      },
      {
        value: "43%",
        label: "Maximum flood-peak reduction in ECMWF’s targeted afforestation scenarios",
        source_name: "ECMWF",
        source_url: "https://www.ecmwf.int/en/about/media-centre/news/2026/machine-learning-tree-planting-water-sustainability",
      },
    ],
    field_note: [
      "For sandalwood and mixed-tree plots, use the next three weeks to build a pre-monsoon baseline instead of waiting for visible stress. Mark survival block by block, note waterlogging-prone corners, and photograph canopy condition from the same points so you can compare after the first serious rains.",
      "If you are trialling new AI or sensing tools, start with the simplest repeatable log: tree count, mortality, collar health, weed pressure, and drainage notes. A clean seasonal record from one acre will beat a glossy dashboard built on guesses every time.",
    ],
  });
}

async function createDraftIssue(generated: IssueData): Promise<DraftIssueRow> {
  const unsubscribePreviewUrl = buildAppUrl("/unsubscribe", {
    token: "preview-only",
    status: "preview",
  });

  for (let attempt = 0; attempt < MAX_INSERT_ATTEMPTS; attempt += 1) {
    const issueNumber = await getNextIssueNumber();
    generated.issue_number = issueNumber;
    const sanitizedIssue = sanitizeIssueData(generated);
    const title = extractHeadline(sanitizedIssue.subject_line);
    const slug = buildIssueSlug(issueNumber, sanitizedIssue.subject_line);
    const htmlRendered = renderIssue(sanitizedIssue, {
      unsubscribeUrl: unsubscribePreviewUrl,
    });

    try {
      const rows = (await sql`
        INSERT INTO issues (
          issue_number,
          slug,
          title,
          subject_line,
          greeting_blurb,
          stories_json,
          html_rendered,
          status,
          metadata
        )
        VALUES (
          ${issueNumber},
          ${slug},
          ${title},
          ${sanitizedIssue.subject_line},
          ${sanitizedIssue.greeting_blurb},
          ${JSON.stringify(sanitizedIssue)}::jsonb,
          ${htmlRendered},
          'draft',
          ${JSON.stringify({
            generation_model: "manual-curation",
            generated_by: "cron-manual-issue-06-route",
          })}::jsonb
        )
        RETURNING
          id::text AS id,
          issue_number,
          slug,
          title,
          subject_line,
          status
      `) as DraftIssueRow[];

      const draft = rows[0];
      if (!draft) {
        throw new Error("Failed to insert manual issue.");
      }

      return draft;
    } catch (error) {
      if (isUniqueViolation(error) && attempt < MAX_INSERT_ATTEMPTS - 1) {
        continue;
      }
      throw error;
    }
  }

  throw new Error("Could not create manual draft after retries.");
}

async function findDraftIssue(issueNumber: number): Promise<ExistingDraftRow | null> {
  const rows = (await sql`
    SELECT
      id::text AS id,
      issue_number,
      slug,
      title,
      subject_line,
      status,
      stories_json
    FROM issues
    WHERE issue_number = ${issueNumber}
      AND status = 'draft'
    ORDER BY generated_at DESC NULLS LAST, id DESC
    LIMIT 1
  `) as ExistingDraftRow[];

  return rows[0] ?? null;
}

async function rerenderDraft(issue: ExistingDraftRow): Promise<void> {
  const unsubscribePreviewUrl = buildAppUrl("/unsubscribe", {
    token: "preview-only",
    status: "preview",
  });
  const issueData = buildManualIssue(issue.issue_number);
  const htmlRendered = renderIssue(issueData, {
    unsubscribeUrl: unsubscribePreviewUrl,
  });

  await sql`
    UPDATE issues
    SET
      slug = ${buildIssueSlug(issue.issue_number, issueData.subject_line)},
      title = ${extractHeadline(issueData.subject_line)},
      subject_line = ${issueData.subject_line},
      greeting_blurb = ${issueData.greeting_blurb},
      stories_json = ${JSON.stringify(issueData)}::jsonb,
      html_rendered = ${htmlRendered},
      metadata = COALESCE(metadata, '{}'::jsonb) || ${JSON.stringify({
        rerendered_by: "cron-manual-issue-06-route",
      })}::jsonb
    WHERE id = ${issue.id}
  `;
}

export async function GET(request: NextRequest) {
  if (!isCronRequestAuthorized(request)) {
    return NextResponse.json(
      { ok: false, message: "Unauthorized cron trigger." },
      { status: 401 }
    );
  }

  try {
    const nextIssueNumber = await getNextIssueNumber();
    const shouldRefresh = request.nextUrl.searchParams.get("refresh") === "1";

    if (shouldRefresh) {
      const existingDraft = await findDraftIssue(6);
      if (!existingDraft) {
        return NextResponse.json(
          { ok: false, message: "Draft issue 06 not found for refresh." },
          { status: 404 }
        );
      }

      await rerenderDraft(existingDraft);
      const siteUrl = getSiteUrl();
      const encodedPassword = encodeURIComponent(getAdminPassword());
      const previewUrl = `${siteUrl}/api/admin/preview?id=${existingDraft.id}&password=${encodedPassword}`;

      return NextResponse.json(
        {
          ok: true,
          issue: {
            id: existingDraft.id,
            issueNumber: Number(existingDraft.issue_number),
            slug: existingDraft.slug,
            title: existingDraft.title,
            subjectLine: existingDraft.subject_line,
            status: existingDraft.status,
          },
          previewUrl,
          refreshed: true,
        },
        { status: 200 }
      );
    }

    if (nextIssueNumber !== 6) {
      return NextResponse.json(
        {
          ok: false,
          message: `Manual issue 06 route expected next sent issue number 6, found ${nextIssueNumber}.`,
        },
        { status: 409 }
      );
    }

    const previousIssues = await getPreviousIssueContexts(nextIssueNumber);
    const issue = buildManualIssue(nextIssueNumber);
    const freshness = checkIssueFreshness(issue, previousIssues);

    if (!isIssueFreshEnough(freshness)) {
      return NextResponse.json(
        {
          ok: false,
          message: `Manual issue failed freshness checks: ${formatFreshnessFailure(freshness)}`,
        },
        { status: 422 }
      );
    }

    const draft = await createDraftIssue(issue);
    const siteUrl = getSiteUrl();
    const encodedPassword = encodeURIComponent(getAdminPassword());
    const previewUrl = `${siteUrl}/api/admin/preview?id=${draft.id}&password=${encodedPassword}`;

    return NextResponse.json(
      {
        ok: true,
        issue: {
          id: draft.id,
          issueNumber: Number(draft.issue_number),
          slug: draft.slug,
          title: draft.title,
          subjectLine: draft.subject_line,
          status: draft.status,
        },
        previewUrl,
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create manual issue 06.";

    console.error(
      "[cron] manual issue 06 failed",
      JSON.stringify({
        message,
        error:
          error instanceof Error
            ? {
                name: error.name,
                message: error.message,
                stack: error.stack,
              }
            : error,
      })
    );

    return NextResponse.json(
      {
        ok: false,
        message,
      },
      { status: 500 }
    );
  }
}
