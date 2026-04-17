import type { IssueData, Story } from "./claude";

const LOGO_URL = process.env.NEXT_PUBLIC_GROBET_LOGO_URL || "";
const PHOTO_URL = process.env.NEXT_PUBLIC_EDITOR_PHOTO_URL || "";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://aigreenwire.com";

function weekRange(d: Date): string {
  const start = new Date(d);
  start.setDate(d.getDate() - 6);
  return `Week of ${start.getDate()}–${d.getDate()} ${d.toLocaleString("en-GB", {
    month: "long",
    year: "numeric",
  })}`;
}

function renderSources(sources: Story["sources"]): string {
  return sources
    .map(
      (source) =>
        `<a href="${source.url}" style="color:#3B6D11;text-decoration:none;font-weight:500;font-style:normal;">${source.name}</a>`
    )
    .join(" · ");
}

function renderStoryCard(story: Story): string {
  const paragraphs = story.paragraphs
    .map(
      (paragraph) =>
        `<p style="font-size:14px;margin:0 0 8px;color:#2C2C2A;line-height:1.65;">${paragraph}</p>`
    )
    .join("");

  const action = story.action
    ? `<p style="font-size:14px;margin:0 0 8px;color:#2C2C2A;line-height:1.65;"><strong style="font-weight:500;">What you can do:</strong> ${story.action}</p>`
    : "";

  return `
    <div style="background:#ffffff;border-radius:10px;padding:16px 18px;margin-bottom:12px;border:0.5px solid #EAF3DE;">
      <span style="display:inline-block;font-size:10px;background:#EAF3DE;color:#3B6D11;padding:2px 8px;border-radius:10px;margin-bottom:7px;letter-spacing:0.5px;text-transform:uppercase;font-weight:500;">${story.tag}</span>
      <h3 style="font-size:15.5px;font-weight:500;margin:0 0 7px;color:#173404;line-height:1.35;">${story.headline}</h3>
      ${paragraphs}
      ${action}
      <span style="display:block;font-size:11.5px;color:#5F5E5A;margin-top:10px;padding-top:8px;border-top:0.5px solid #EAF3DE;font-style:italic;">
        Source: ${renderSources(story.sources)}
      </span>
    </div>`;
}

function renderStatCard(stat: IssueData["stats"][0], variant: "a" | "b" | "c" | "d"): string {
  const colors = {
    a: { bg: "#639922", lbl: "#EAF3DE", src: "#C0DD97" },
    b: { bg: "#BA7517", lbl: "#FAEEDA", src: "#FAEEDA" },
    c: { bg: "#3B6D11", lbl: "#C0DD97", src: "#C0DD97" },
    d: { bg: "#854F0B", lbl: "#FAEEDA", src: "#FAEEDA" },
  }[variant];

  return `
    <div style="background:${colors.bg};color:#ffffff;padding:14px;border-radius:10px;">
      <div style="font-size:24px;font-weight:500;font-family:Georgia,serif;">${stat.value}</div>
      <div style="font-size:11.5px;color:${colors.lbl};margin-top:2px;line-height:1.3;">${stat.label}</div>
      <span style="display:block;font-size:10px;color:${colors.src};margin-top:6px;">
        <a href="${stat.source_url}" style="color:${colors.lbl};text-decoration:underline;">${stat.source_name}</a>
      </span>
    </div>`;
}

function renderLogoSlot(): string {
  if (!LOGO_URL) {
    return '<div style="width:40px;height:40px;border-radius:50%;background:#C0DD97;color:#173404;text-align:center;line-height:40px;font-weight:600;font-size:12px;overflow:hidden;">GB</div>';
  }

  return `
    <div style="width:40px;height:40px;border-radius:50%;background:#C0DD97;text-align:center;line-height:40px;overflow:hidden;">
      <img src="${LOGO_URL}" alt="Grow Better India" width="40" height="40" style="display:block;width:40px;height:40px;object-fit:cover;border-radius:50%;" />
    </div>`;
}

function renderEditorSlot(): string {
  if (!PHOTO_URL) {
    return '<div style="width:62px;height:62px;border-radius:50%;background:#C0DD97;border:3px solid #639922;color:#173404;text-align:center;line-height:56px;font-weight:600;font-size:14px;overflow:hidden;">MS</div>';
  }

  return `
    <div style="width:62px;height:62px;border-radius:50%;background:#C0DD97;border:3px solid #639922;overflow:hidden;">
      <img src="${PHOTO_URL}" alt="Mallesh Samala" width="62" height="62" style="display:block;width:62px;height:62px;object-fit:cover;" />
    </div>`;
}

export function renderIssue(
  data: IssueData,
  opts: { unsubscribeUrl: string; viewInBrowserUrl?: string } = { unsubscribeUrl: "" }
): string {
  const today = new Date();
  const weekStr = weekRange(today);

  const indiaStories = data.stories.filter((story) => story.section === "india");
  const forestryStories = data.stories.filter((story) => story.section === "forestry");
  const studentStories = data.stories.filter((story) => story.section === "students");
  const variants: Array<"a" | "b" | "c" | "d"> = ["a", "b", "c", "d"];

  const viewInBrowser = opts.viewInBrowserUrl
    ? `<div style="text-align:center;padding:10px;font-size:11px;color:#888780;">
         <a href="${opts.viewInBrowserUrl}" style="color:#3B6D11;">View this issue in your browser</a>
       </div>`
    : "";

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>The AI Green Wire · Issue ${String(data.issue_number).padStart(2, "0")}</title>
</head>
<body style="margin:0;padding:20px 0;background:#F1EFE8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
${viewInBrowser}
<div style="max-width:720px;margin:0 auto;color:#2C2C2A;line-height:1.6;background:#FBF9F2;border-radius:12px;overflow:hidden;">

  <div style="background:#173404;color:#EAF3DE;padding:24px 28px 20px;">
    <div style="display:table;width:100%;margin-bottom:18px;">
      <div style="display:table-cell;vertical-align:middle;">
        <table cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="vertical-align:middle;">
            ${renderLogoSlot()}
          </td>
          <td style="padding-left:10px;vertical-align:middle;">
            <div style="font-size:13px;color:#C0DD97;font-weight:500;line-height:1.2;">Grow Better India</div>
            <div style="font-size:10px;color:#97C459;letter-spacing:1.5px;text-transform:uppercase;font-weight:400;">Sandalwood Intelligence</div>
          </td>
        </tr></table>
      </div>
      <div style="display:table-cell;vertical-align:middle;text-align:right;">
        <span style="background:#639922;color:#EAF3DE;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:500;letter-spacing:0.5px;">Issue ${String(
          data.issue_number
        ).padStart(2, "0")}</span>
      </div>
    </div>
    <h1 style="font-family:Georgia,serif;font-size:34px;margin:4px 0 6px;font-weight:500;line-height:1.1;color:#EAF3DE;">The AI Green Wire</h1>
    <div style="font-size:14px;color:#C0DD97;">A weekly briefing on AI in agriculture, agroforestry and ecology.</div>
    <div style="font-size:12px;color:#97C459;margin-top:10px;letter-spacing:0.5px;">${weekStr} · Bengaluru</div>
  </div>

  <div style="padding:24px 28px 20px;">

    <div style="font-size:15px;color:#173404;margin-bottom:22px;padding:16px 18px;background:#EAF3DE;border-radius:10px;border-left:3px solid #639922;line-height:1.65;">
      ${data.greeting_blurb}
    </div>

    <div style="display:table;width:100%;margin:26px 0 14px;">
      <table cellpadding="0" cellspacing="0" border="0" style="width:100%;"><tr>
        <td style="width:26px;vertical-align:middle;"><div style="width:26px;height:26px;background:#639922;border-radius:50%;color:#fff;text-align:center;line-height:26px;font-size:13px;font-weight:500;">1</div></td>
        <td style="padding-left:10px;vertical-align:middle;font-size:15px;font-weight:500;color:#173404;">What's new in India</td>
        <td style="width:100%;padding-left:10px;"><div style="height:1px;background:#C0DD97;"></div></td>
      </tr></table>
    </div>

    ${indiaStories.map(renderStoryCard).join("")}

    <div style="display:table;width:100%;margin:26px 0 14px;">
      <table cellpadding="0" cellspacing="0" border="0" style="width:100%;"><tr>
        <td style="width:26px;vertical-align:middle;"><div style="width:26px;height:26px;background:#639922;border-radius:50%;color:#fff;text-align:center;line-height:26px;font-size:13px;font-weight:500;">2</div></td>
        <td style="padding-left:10px;vertical-align:middle;font-size:15px;font-weight:500;color:#173404;">Trees, forests &amp; biodiversity</td>
        <td style="width:100%;padding-left:10px;"><div style="height:1px;background:#C0DD97;"></div></td>
      </tr></table>
    </div>

    ${forestryStories.map(renderStoryCard).join("")}

    <div style="text-align:center;margin:32px 0 24px;font-size:10px;color:#97C459;letter-spacing:3px;text-transform:uppercase;">
      — Page Two · The Numbers &amp; What's Next —
    </div>

    <div style="display:table;width:100%;margin:26px 0 14px;">
      <table cellpadding="0" cellspacing="0" border="0" style="width:100%;"><tr>
        <td style="width:26px;vertical-align:middle;"><div style="width:26px;height:26px;background:#639922;border-radius:50%;color:#fff;text-align:center;line-height:26px;font-size:13px;font-weight:500;">3</div></td>
        <td style="padding-left:10px;vertical-align:middle;font-size:15px;font-weight:500;color:#173404;">The week in numbers</td>
        <td style="width:100%;padding-left:10px;"><div style="height:1px;background:#C0DD97;"></div></td>
      </tr></table>
    </div>

    <table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:16px 0 10px;">
      <tr>
        <td style="width:50%;padding:0 5px 10px 0;">${data.stats[0] ? renderStatCard(data.stats[0], variants[0]) : ""}</td>
        <td style="width:50%;padding:0 0 10px 5px;">${data.stats[1] ? renderStatCard(data.stats[1], variants[1]) : ""}</td>
      </tr>
      <tr>
        <td style="width:50%;padding:0 5px 0 0;">${data.stats[2] ? renderStatCard(data.stats[2], variants[2]) : ""}</td>
        <td style="width:50%;padding:0 0 0 5px;">${data.stats[3] ? renderStatCard(data.stats[3], variants[3]) : ""}</td>
      </tr>
    </table>

    <div style="background:#FAEEDA;border-radius:10px;padding:18px 20px;margin:22px 0;">
      <div style="font-size:11px;color:#854F0B;letter-spacing:1.5px;text-transform:uppercase;font-weight:500;margin-bottom:8px;">If you grow sandalwood, pay attention to this</div>
      ${data.field_note
        .map(
          (paragraph) =>
            `<p style="font-size:14px;margin:0 0 10px;color:#412402;line-height:1.65;">${paragraph}</p>`
        )
        .join("")}
    </div>

    <div style="display:table;width:100%;margin:26px 0 14px;">
      <table cellpadding="0" cellspacing="0" border="0" style="width:100%;"><tr>
        <td style="width:26px;vertical-align:middle;"><div style="width:26px;height:26px;background:#639922;border-radius:50%;color:#fff;text-align:center;line-height:26px;font-size:13px;font-weight:500;">4</div></td>
        <td style="padding-left:10px;vertical-align:middle;font-size:15px;font-weight:500;color:#173404;">For students and researchers</td>
        <td style="width:100%;padding-left:10px;"><div style="height:1px;background:#C0DD97;"></div></td>
      </tr></table>
    </div>

    ${studentStories.map(renderStoryCard).join("")}

  </div>

  <div style="background:#173404;color:#EAF3DE;padding:24px 28px;margin-top:20px;">
    <table cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="vertical-align:middle;">
        ${renderEditorSlot()}
      </td>
      <td style="padding-left:14px;vertical-align:middle;">
        <div style="font-size:12px;color:#97C459;letter-spacing:1px;text-transform:uppercase;">From the editor</div>
        <div style="font-family:Georgia,serif;font-size:18px;font-style:italic;color:#EAF3DE;margin-top:2px;">Mallesh Samala</div>
        <div style="font-size:11.5px;color:#C0DD97;margin-top:2px;">Co-founder, Grobet India · Karnataka Forest Dept. certified sandalwood trainer</div>
      </td>
    </tr></table>
    <div style="font-size:13px;color:#C0DD97;margin-top:14px;line-height:1.65;font-style:italic;">
      Every week I read through roughly three hundred signals on AI, agriculture and forestry so you do not have to. If a development changes how I think about the land, it finds its way into this briefing. Reply and tell me what you would like covered next week.
    </div>
    <div style="font-size:10px;color:#97C459;margin-top:14px;border-top:0.5px solid #3B6D11;padding-top:10px;text-align:center;line-height:1.6;">
      Published weekly by Grobet India Agrotech Pvt Ltd (CIN U62090KA2023PTC170106) · Bengaluru<br />
      <a href="${SITE_URL}" style="color:#C0DD97;text-decoration:underline;">aigreenwire.com</a> ·
      <a href="${opts.unsubscribeUrl}" style="color:#C0DD97;text-decoration:underline;">Unsubscribe</a>
    </div>
  </div>

</div>
</body>
</html>`;
}
