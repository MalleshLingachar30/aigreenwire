import { type IssueData } from "@/lib/claude";
import { renderIssue } from "@/lib/template";

const sampleIssue: IssueData = {
  issue_number: 1,
  subject_line:
    "The AI Green Wire · Issue 01 · ISRO Bhuvan and ICAR Soil Tool Go Mainstream",
  greeting_blurb:
    "Namaste. This week, India moved faster on practical AI for agriculture than most expected. Satellite-backed crop intelligence and state-level advisory rails are getting stitched into daily extension workflows. At the same time, forestry and biodiversity monitoring tools are becoming operational rather than pilot-only. For growers, this means decisions on water, disease, and tree planning can be grounded in better weekly signals.",
  stories: [
    {
      section: "india",
      tag: "REMOTE SENSING",
      headline:
        "ISRO-linked crop intelligence pilots expand pre-emptive stress alerts",
      paragraphs: [
        "State teams are using satellite layers and local field observations to detect stress windows before visible crop decline. The operational shift is from one-time mapping to repeat advisories at a cadence farmers can act on. Pilot officers reported better timing on fertilizer and irrigation interventions where advisories were integrated with local extension channels.",
        "For Indian growers, the immediate value is fewer blind spots in weather-disrupted weeks. Even when parcel-level precision is imperfect, trend-level warnings help de-risk timing decisions. Co-operatives with agronomy support can use these signals to batch field visits and reduce avoidable yield loss."
      ],
      action: "Ask your local extension office if district-level satellite advisories are being issued this season.",
      sources: [{ name: "ISRO Bhuvan", url: "https://bhuvan.nrsc.gov.in/home/index.php" }]
    },
    {
      section: "india",
      tag: "SOIL AI",
      headline:
        "ICAR-aligned soil intelligence tools improve nutrient scheduling",
      paragraphs: [
        "Soil advisory tooling tied to local agronomy datasets is helping extension teams move beyond generic fertilizer recommendations. District pilots are increasingly combining soil test records, weather context, and crop stage to prioritise the most time-sensitive actions.",
        "Growers that already run soil tests can see better value from the same data by linking advisory cadence to real weather and crop stage changes. This is especially relevant in mixed cropping belts where one-size plans underperform. The broader implication is lower input waste where advisory uptake is consistent."
      ],
      sources: [{ name: "ICAR", url: "https://icar.org.in/" }]
    },
    {
      section: "india",
      tag: "STATE PILOT",
      headline:
        "State agriculture departments scale multilingual AI advisory channels",
      paragraphs: [
        "Multiple state programs are moving from proof-of-concept chat or call pilots into structured advisory workflows. The key change is operational integration with existing agronomy and extension desks, not standalone demo bots.",
        "For farmers, this can improve response speed when pest, rainfall, or market conditions shift suddenly. Quality still depends on local validation, but the service model is becoming more practical week by week."
      ],
      sources: [{ name: "Ministry of Agriculture", url: "https://agricoop.nic.in/" }]
    },
    {
      section: "forestry",
      tag: "BIODIVERSITY",
      headline: "Remote biodiversity indexing tools become easier to deploy",
      paragraphs: [
        "Conservation groups are using AI-assisted image and acoustic analysis to process larger biodiversity datasets with fewer manual bottlenecks. This reduces cycle time between data collection and intervention planning.",
        "For Indian agroforestry planning, this strengthens the case for mixed-species belts and habitat-linked farm design where local biodiversity outcomes are measurable."
      ],
      sources: [{ name: "FAO Forestry", url: "https://www.fao.org/forestry/en/" }]
    },
    {
      section: "forestry",
      tag: "CARBON MRV",
      headline: "Forest carbon monitoring workflows improve verification speed",
      paragraphs: [
        "Teams working on carbon projects are pairing satellite streams with field audit data to improve confidence in change detection. That is reducing manual reconciliation overhead in periodic reporting windows.",
        "For tree growers, this matters because transparent monitoring lowers friction when engaging with formal carbon or sustainability-linked programs."
      ],
      sources: [{ name: "World Bank Forest Carbon", url: "https://www.worldbank.org/en/topic/climatechange/brief/forest-carbon-partnership-facility" }]
    },
    {
      section: "forestry",
      tag: "LANDSCAPE",
      headline: "AI-assisted restoration mapping narrows high-impact planting zones",
      paragraphs: [
        "Landscape models are increasingly identifying where restoration yields both ecological and livelihood gains. This helps planners prioritise zones with higher survival likelihood and corridor value.",
        "Indian districts with fragmented farm-forest boundaries can use these methods to sequence interventions instead of spreading budgets too thin."
      ],
      sources: [{ name: "WRI", url: "https://www.wri.org/initiatives/restoration" }]
    },
    {
      section: "forestry",
      tag: "FIRE RISK",
      headline: "Predictive fire-risk models improve early response readiness",
      paragraphs: [
        "Fire forecasting systems are combining weather and vegetation signals to identify near-term risk clusters before peak events. Agencies can pre-position response resources with better lead time.",
        "For growers near forest edges, early warnings support safer harvest schedules and better protection planning for young plantations."
      ],
      sources: [{ name: "Global Forest Watch", url: "https://www.globalforestwatch.org/" }]
    },
    {
      section: "students",
      tag: "RESEARCH",
      headline: "Applied AI-agri fellowships open new tracks for Indian students",
      paragraphs: [
        "Universities and research networks are expanding applied ML tracks focused on food systems, satellite agriculture, and ecology datasets. These programs emphasize deployable tools and public-impact use cases.",
        "Students can build stronger portfolios by contributing to open datasets or reproducible pilot evaluations tied to Indian agro-climatic contexts."
      ],
      sources: [{ name: "IIT Kharagpur AI4ICPS", url: "https://ai4icps.iitkgp.ac.in/" }]
    },
    {
      section: "students",
      tag: "CHALLENGE",
      headline: "Climate and agriculture AI challenges prioritise real-world validation",
      paragraphs: [
        "Current challenge calls are increasingly requiring baseline comparisons, deployment plans, and usability evidence rather than pure model metrics. This is improving solution quality and transferability.",
        "Researchers should prioritise partnerships with extension teams or local institutions to demonstrate impact beyond benchmark performance."
      ],
      sources: [{ name: "AI for Good", url: "https://aiforgood.itu.int/" }]
    },
  ],
  stats: [
    {
      value: "3",
      label: "India-focused AI agriculture stories this week",
      source_name: "AI Green Wire Desk",
      source_url: "https://aigreenwire.com/issues"
    },
    {
      value: "4",
      label: "Forestry and biodiversity developments tracked",
      source_name: "AI Green Wire Desk",
      source_url: "https://aigreenwire.com/issues"
    },
    {
      value: "2",
      label: "Student and researcher opportunities highlighted",
      source_name: "AI Green Wire Desk",
      source_url: "https://aigreenwire.com/issues"
    },
    {
      value: "7d",
      label: "Research window used for this issue",
      source_name: "AI Green Wire Desk",
      source_url: "https://aigreenwire.com/issues"
    }
  ],
  field_note: [
    "If you are planting or managing sandalwood in Karnataka, this is the season to tighten your decision rhythm. AI tools are most useful when paired with disciplined field notes, not as a replacement for local judgement. Keep block-level records on rainfall timing, pest pressure, and growth variation so advisory signals can be interpreted correctly.",
    "This month, choose one data habit you can sustain weekly: either structured soil updates or a fixed photo log by plot. Consistency will matter more than tool complexity."
  ]
};

export async function GET() {
  const html = renderIssue(sampleIssue, {
    unsubscribeUrl: "https://aigreenwire.com/unsubscribe?token=test-render-demo",
    viewInBrowserUrl: "https://aigreenwire.com/issues/01-isro-bhuvan-and-icar-soil-tool"
  });

  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
    },
  });
}
