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
      "The AI Green Wire · Issue 08 · District yield models, wildlife AI, and student grants before monsoon",
    greeting_blurb:
      "Namaste. This week’s strongest signals are practical ones. India-focused teams are getting more specific about district yields and orchard nutrition, while conservation researchers are showing which AI systems can finally turn long monitoring backlogs into decisions that still matter in season.",
    stories: [
      {
        section: "india",
        tag: "District yield models",
        headline:
          "A six-crop India dataset shows simpler random-forest forecasting still beats fancier network add-ons",
        paragraphs: [
          "A March Frontiers study tested yield forecasting across 52 years of district-level data from 311 Indian districts covering rice, wheat, maize, groundnut, cotton, and sugarcane. The practical result was clear: random forest outperformed the more elaborate network-enhanced setup across all six crops, with R² values ranging from 0.946 to 0.988.",
          "The added district-similarity and crop-network features contributed less than 1% to model importance. For India’s digital-agriculture stack, that is a useful correction: stronger historical data and cleaner field variables may matter more right now than another layer of model complexity.",
        ],
        action:
          "If you are evaluating farm AI tools this kharif, ask first about data coverage and validation geography, not just about the model family.",
        sources: [
          {
            name: "Frontiers in Agronomy",
            url: "https://www.frontiersin.org/journals/agronomy/articles/10.3389/fagro.2026.1767878/full",
          },
        ],
      },
      {
        section: "india",
        tag: "Orchard diagnostics",
        headline:
          "Machine-learning soil diagnosis in Meghalaya points Khasi mandarin growers toward zinc before more blanket input use",
        paragraphs: [
          "Another 2026 Frontiers paper analysed 180 Khasi mandarin orchards in Meghalaya and used machine-learning regressors to connect soil conditions to fruit yield. The headline agronomic result was that zinc deficiency emerged as the key limiting factor, while XGBoost delivered the strongest predictive performance among the tested models.",
          "That matters because the orchards in the study averaged about 4.9 Mg per hectare, well below the broader Indian citrus average cited by the authors. It is the kind of site-specific signal that can move AI from dashboard talk into a more disciplined fertiliser and orchard-revival decision.",
        ],
        action:
          "For horticulture teams, the lesson is to push for micronutrient-specific diagnostics before adding more generic nutrient spending.",
        sources: [
          {
            name: "Frontiers in Agronomy",
            url: "https://www.frontiersin.org/journals/agronomy/articles/10.3389/fagro.2026.1719690/full",
          },
        ],
      },
      {
        section: "india",
        tag: "Breeding workflows",
        headline:
          "WSU and ICAR are using AI to speed wheat line selection before breeders commit years to the wrong material",
        paragraphs: [
          "Washington State University said its AI-ENGAGE project with the University of Tokyo and the Indian Council of Agricultural Research will genotype around 1,000 unique wheat plant samples to help identify higher-yielding lines faster. The project carries a $400,000 NSF-linked award and is designed to process a thousandfold more data than conventional methods.",
          "This is one of the more credible AI-in-agriculture lanes because it targets a real breeding bottleneck instead of user-facing hype. If the resulting tool becomes freely usable for breeders, it could matter more than most farm software because selection errors at this stage echo through years of varietal work.",
        ],
        action:
          "Watch whether the project publishes usable breeder-side tooling or validation results tied to Indian germplasm rather than just research milestones.",
        sources: [
          {
            name: "WSU",
            url: "https://news.wsu.edu/news/2026/03/03/with-nsf-award-wsu-crop-scientist-harnesses-ai-to-identify-higher-yielding-wheat/",
          },
        ],
      },
      {
        section: "forestry",
        tag: "Wildlife monitoring",
        headline:
          "SpeciesNet is cutting camera-trap analysis from half a year to a few days without breaking most ecological conclusions",
        paragraphs: [
          "Researchers from Washington State University and Google reported on 7 May that a fully automated SpeciesNet pipeline can cut wildlife-camera processing from six to seven months, and sometimes up to a year, to just a few days or roughly a week. Across key occupancy-style measures, AI-derived conclusions aligned with human-labelled results in about 85–90% of cases.",
          "That is a meaningful operational shift for conservation teams. It suggests AI is now credible enough to remove one of the biggest camera-trap bottlenecks for common species, making near-real-time monitoring more plausible for protected areas and biodiversity programmes that used to drown in image backlogs.",
        ],
        action:
          "If you run camera traps, the practical threshold is no longer perfect image classification but whether the ecological decision stays stable after automation.",
        sources: [
          {
            name: "WSU",
            url: "https://news.wsu.edu/press-release/2026/05/07/ai-cuts-wildlife-tracking-time-from-months-to-days/",
          },
        ],
      },
      {
        section: "forestry",
        tag: "Fire detection",
        headline:
          "A hybrid RF-XGB wildfire system posts 0.9631 accuracy in an 80-node field deployment",
        paragraphs: [
          "A Scientific Reports paper published on 13 May described an IoT-and-machine-learning framework for wildfire detection and prediction built around a hybrid random-forest and XGBoost model. The system reported 0.9631 accuracy, a 0.9627 F1 score, and a 0.994 ROC-AUC while operating with 80 sensor nodes and projected lifetimes up to 11 months.",
          "This is worth watching because it moves beyond satellite-only narratives. Energy-efficient edge sensing plus machine-learning triage is closer to the kind of infrastructure districts, plantations, and restoration corridors could actually test before fire season escalates.",
        ],
        action:
          "For tree-crop and forest managers, pay attention to whether similar low-power sensor networks appear in Indian dryland and plantation belts next.",
        sources: [
          {
            name: "Scientific Reports",
            url: "https://www.nature.com/articles/s41598-026-52395-w",
          },
        ],
      },
      {
        section: "forestry",
        tag: "Forest intelligence",
        headline:
          "WRI is pushing tropical forest-loss data into an AI-style chat interface just as fire becomes the harder global threat",
        paragraphs: [
          "World Resources Institute updated its Global Forest Review on 29 April and reported that tropical primary forest loss fell 36% in 2025 compared with 2024, even though the world still lost 4.3 million hectares of tropical primary forest. The same update also pushes that data into Global Nature Watch, an AI-powered interface meant to make complex land and forest data easier to use.",
          "The bigger signal is the timing, not just the interface. WRI notes that fires have burned more than twice as much tree cover over the last three years as they did two decades ago. Easier access to current forest data matters much more when fire pressure is rising this fast.",
        ],
        action:
          "If you work on restoration or carbon projects, use this as a prompt to review whether your teams can query current forest-loss data fast enough to change field decisions.",
        sources: [
          {
            name: "World Resources Institute",
            url: "https://gfr.wri.org/latest-analysis-deforestation-trends",
          },
        ],
      },
      {
        section: "students",
        tag: "Student opportunity",
        headline:
          "AGGNITE 6.0 is open for agriculture students who can turn a real farm problem into a business model",
        paragraphs: [
          "The current AGGNITE 6.0 page from a-IDEA at ICAR-NAARM lists an ideation competition for students aged 17 to 27 who are enrolled in UG, PG, or PhD programmes in agriculture and allied domains. Entries can be individual or two-person teams, and the programme offers a bootcamp for the top 10 finalists, incubation opportunities, and direct startup networking.",
          "That makes it one of the cleaner India-facing opportunities this month for students sitting on a credible AI, hardware, market-linkage, or climate-service idea who need sharper commercial framing. The focus on original solutions and scalable business models is the right filter.",
        ],
        action:
          "If you are applying, tighten the user problem and first deployment plan before polishing the deck design.",
        sources: [
          {
            name: "a-IDEA NAARM",
            url: "https://www.aidea.naarm.org.in/aggnite",
          },
        ],
      },
      {
        section: "students",
        tag: "Training pipeline",
        headline:
          "UT San Antonio and Southwest Research Institute are building a 40-student smart-agriculture talent track",
        paragraphs: [
          "UT San Antonio announced on 6 May that its new REEL-A3 programme with Southwest Research Institute will train 40 undergraduates over five years in AI, IoT, drones, robotics, and autonomous systems for smart agriculture. The programme is backed by a $750,000 USDA award and runs as a 24-week research experience with stipends, housing, meal allowance, and travel support.",
          "For Indian students and faculty watching global talent pipelines, the message is straightforward: agricultural AI training is getting more structured, paid, and interdisciplinary. The next workforce will be built through these blended engineering-and-agronomy programmes, not through isolated coding workshops.",
        ],
        action:
          "Use this as a benchmark when judging whether local student programmes are offering serious field-and-systems exposure or just generic AI branding.",
        sources: [
          {
            name: "UT San Antonio",
            url: "https://news.utsa.edu/2026/05/cultivating-the-future-joint-ut-san-antonio-swri-program-to-train-next-generation-of-smart-agriculture-experts/",
          },
        ],
      },
      {
        section: "students",
        tag: "Grant funding",
        headline:
          "USDA’s 2026 AFRI education call leaves a large open lane for agriculture technology and workforce proposals",
        paragraphs: [
          "USDA NIFA’s 2026 AFRI Education and Workforce Development opportunity lists an estimated $39.7 million in total funding, with awards ranging from $10,000 to $650,000 and a closing date of 31 December 2026. The programme explicitly covers agriculture technology, natural resources, education, and workforce-building themes.",
          "This matters because it is not just a scholarship-style notice. It is a large signal that applied agricultural AI training, fellowships, and education pipelines are still drawing institutional money at scale, which is exactly the lane colleges and interdisciplinary labs should be watching.",
        ],
        action:
          "If you work in a college or lab, start pairing domain faculty with data or engineering faculty early so proposal design is not left to the last quarter.",
        sources: [
          {
            name: "USDA NIFA",
            url: "https://www.nifa.usda.gov/grants/funding-opportunities/agriculture-food-research-initiative-education-workforce-development",
          },
        ],
      },
    ],
    stats: [
      {
        value: "311 districts",
        label: "Indian districts used in the six-crop yield-model dataset",
        source_name: "Frontiers in Agronomy",
        source_url:
          "https://www.frontiersin.org/journals/agronomy/articles/10.3389/fagro.2026.1767878/full",
      },
      {
        value: "85–90%",
        label: "Alignment between AI and human ecological conclusions in the SpeciesNet study",
        source_name: "WSU",
        source_url: "https://news.wsu.edu/press-release/2026/05/07/ai-cuts-wildlife-tracking-time-from-months-to-days/",
      },
      {
        value: "0.9631",
        label: "Accuracy reported for the hybrid wildfire detection framework",
        source_name: "Scientific Reports",
        source_url: "https://www.nature.com/articles/s41598-026-52395-w",
      },
      {
        value: "$39.7M",
        label: "Estimated total funding in USDA NIFA’s 2026 AFRI education and workforce call",
        source_name: "USDA NIFA",
        source_url:
          "https://www.nifa.usda.gov/grants/funding-opportunities/agriculture-food-research-initiative-education-workforce-development",
      },
    ],
    field_note: [
      "For sandalwood, horticulture, and mixed-tree plots, the pre-monsoon question is not whether you have enough dashboards but whether you have a repeatable baseline. Mark weak blocks now, record collar condition and drainage trouble spots, and keep one simple visual log from the same points before the first heavy rain rewrites the field picture.",
      "If you are testing any AI tool this season, force it onto one narrow decision: yield expectation, nutrient correction, mortality watch, or fire risk. A tool that helps one real choice on one defined block is worth more than a platform that claims to solve the whole farm.",
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
            generated_by: "cron-manual-issue-08-route",
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
        rerendered_by: "cron-manual-issue-08-route",
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
      const existingDraft = await findDraftIssue(8);
      if (!existingDraft) {
        return NextResponse.json(
          { ok: false, message: "Draft issue 08 not found for refresh." },
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

    if (nextIssueNumber !== 8) {
      return NextResponse.json(
        {
          ok: false,
          message: `Manual issue 08 route expected next sent issue number 8, found ${nextIssueNumber}.`,
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
    const message = error instanceof Error ? error.message : "Failed to create manual issue 08.";

    console.error(
      "[cron] manual issue 08 failed",
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
