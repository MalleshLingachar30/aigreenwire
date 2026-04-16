import { type IssueData, renderIssueHtml } from "@/lib/template";

const sampleIssue: IssueData = {
  issueNumber: 1,
  title: "The AI Green Wire - Issue 01",
  subjectLine:
    "Issue 01: Soil Intelligence, Water Security, and Climate-Ready Agriculture",
  greetingBlurb:
    "Welcome to Issue 01 of The AI Green Wire. Each week, we track practical AI signals shaping agriculture, forestry, agroforestry, and ecology.",
  stories: [
    {
      title:
        "Satellite + AI models now detect crop stress before field symptoms appear",
      summary:
        "New remote-sensing pipelines are helping agronomy teams identify stress signatures early, improving intervention timing and reducing yield loss in high-variability seasons.",
      source: "Nature",
      url: "https://www.nature.com/",
      tag: "Precision Farming",
    },
    {
      title:
        "Watershed management programs are adopting predictive irrigation models",
      summary:
        "Regional pilot projects are combining weather forecasts, soil moisture estimates, and local crop calendars to optimize irrigation schedules with measurable water savings.",
      source: "FAO",
      url: "https://www.fao.org/",
      tag: "Water",
    },
    {
      title:
        "Agroforestry planners use AI-assisted mapping for biodiversity corridors",
      summary:
        "Landscape planning teams are using machine learning to prioritize corridor restoration zones that improve habitat continuity while protecting farm productivity.",
      source: "World Resources Institute",
      url: "https://www.wri.org/",
      tag: "Agroforestry",
    },
  ],
  editorNote:
    "The winners over the next decade will be teams that combine local field context with reliable AI decision support. Start small, measure impact weekly, and scale what works.",
  unsubscribeUrl: "https://aigreenwire.com/unsubscribe?token=test-render-demo",
};

export async function GET() {
  const html = renderIssueHtml(sampleIssue);

  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
    },
  });
}
