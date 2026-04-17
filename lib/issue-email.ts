import type { IssueData } from "@/lib/claude";
import { buildAppUrl, isUuidToken } from "@/lib/subscription";
import { renderIssue } from "@/lib/template";

export type IssueDeliveryLinks = {
  unsubscribeUrl: string;
  viewInBrowserUrl: string;
};

export function buildIssueDeliveryLinks(
  issueSlug: string,
  unsubscribeToken: string
): IssueDeliveryLinks {
  const slug = issueSlug.trim();

  if (!slug) {
    throw new Error("Issue slug is required for browser-view links.");
  }

  if (!isUuidToken(unsubscribeToken)) {
    throw new Error("Archive access token must be a valid UUID.");
  }

  return {
    unsubscribeUrl: buildAppUrl("/api/unsubscribe", {
      token: unsubscribeToken,
    }),
    viewInBrowserUrl: buildAppUrl(`/issues/${slug}`, {
      token: unsubscribeToken,
    }),
  };
}

export function renderIssueForSubscriber(
  issueData: IssueData,
  issueSlug: string,
  unsubscribeToken: string
): string {
  const links = buildIssueDeliveryLinks(issueSlug, unsubscribeToken);
  return renderIssue(issueData, links);
}
