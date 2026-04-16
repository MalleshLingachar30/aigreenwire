// Template B renderer — full HTML email
// Replace placeholder URLs with actual logo and photo before launch.

const LOGO_URL = "https://aigreenwire.com/logo.png"; // TODO: replace
const EDITOR_PHOTO_URL = "https://aigreenwire.com/editor.jpg"; // TODO: replace

export interface Story {
  title: string;
  summary: string;
  source: string;
  url: string;
  tag?: string;
}

export interface IssueData {
  issueNumber: number;
  title: string;
  subjectLine: string;
  greetingBlurb: string;
  stories: Story[];
  editorNote?: string;
  unsubscribeUrl: string;
}

export function renderIssueHtml(data: IssueData): string {
  const storiesHtml = data.stories
    .map(
      (s, i) => `
    <tr>
      <td style="padding:24px 0;border-bottom:1px solid #e5e7eb;">
        ${s.tag ? `<p style="margin:0 0 6px;font-size:11px;font-weight:600;color:#16a34a;text-transform:uppercase;letter-spacing:0.05em;">${s.tag}</p>` : ""}
        <h2 style="margin:0 0 8px;font-size:18px;font-weight:700;color:#14532d;line-height:1.4;">
          <a href="${s.url}" style="color:#14532d;text-decoration:none;">${i + 1}. ${s.title}</a>
        </h2>
        <p style="margin:0 0 8px;font-size:15px;color:#374151;line-height:1.6;">${s.summary}</p>
        <a href="${s.url}" style="font-size:13px;color:#16a34a;">Read more at ${s.source} →</a>
      </td>
    </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${data.subjectLine}</title>
</head>
<body style="margin:0;padding:0;background:#f0fdf4;font-family:'Georgia',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
          <!-- Header -->
          <tr>
            <td style="background:#14532d;padding:28px 40px;text-align:center;">
              <img src="${LOGO_URL}" alt="The AI Green Wire" width="180" style="display:block;margin:0 auto 12px;" />
              <p style="margin:0;font-size:12px;color:#86efac;letter-spacing:0.1em;text-transform:uppercase;">Issue ${String(data.issueNumber).padStart(2, "0")} · AI in Agriculture &amp; Ecology</p>
            </td>
          </tr>
          <!-- Greeting -->
          <tr>
            <td style="padding:32px 40px 0;">
              <p style="margin:0;font-size:16px;color:#374151;line-height:1.7;">${data.greetingBlurb}</p>
            </td>
          </tr>
          <!-- Stories -->
          <tr>
            <td style="padding:16px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                ${storiesHtml}
              </table>
            </td>
          </tr>
          <!-- Editor note -->
          ${
            data.editorNote
              ? `<tr>
            <td style="padding:24px 40px;background:#f0fdf4;border-top:2px solid #dcfce7;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-right:16px;vertical-align:top;">
                    <img src="${EDITOR_PHOTO_URL}" width="56" height="56" style="border-radius:50%;display:block;" />
                  </td>
                  <td>
                    <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#14532d;">From the Editor</p>
                    <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">${data.editorNote}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`
              : ""
          }
          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;text-align:center;border-top:1px solid #e5e7eb;">
              <p style="margin:0 0 8px;font-size:12px;color:#9ca3af;">
                You're receiving this because you subscribed at aigreenwire.com
              </p>
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                <a href="${data.unsubscribeUrl}" style="color:#16a34a;">Unsubscribe</a> · Grobet India Agrotech
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
