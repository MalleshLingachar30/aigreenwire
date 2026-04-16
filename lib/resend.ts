import { Resend } from "resend";

export const resend = new Resend(process.env.RESEND_API_KEY);

export const FROM_ADDRESS =
  process.env.RESEND_FROM_EMAIL ?? "The AI Green Wire <editor@aigreenwire.com>";

// Convenience: send a single HTML email and return the Resend message id.
// Throws if Resend returns an error so callers can handle it.
export async function sendEmail({
  to,
  subject,
  html,
  replyTo,
  tags,
}: {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
  tags?: { name: string; value: string }[];
}): Promise<string> {
  const { data, error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
    ...(replyTo ? { replyTo: [replyTo] } : {}),
    ...(tags ? { tags } : {}),
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }

  return data!.id;
}

// Batch send — up to 100 emails per call (counts as 1 request vs rate limit).
// Used for newsletter blasts.
export async function batchSendEmails(
  emails: {
    to: string;
    subject: string;
    html: string;
    tags?: { name: string; value: string }[];
  }[]
): Promise<{ id: string; to: string }[]> {
  const payload = emails.map((e) => ({
    from: FROM_ADDRESS,
    to: [e.to],
    subject: e.subject,
    html: e.html,
    ...(e.tags ? { tags: e.tags } : {}),
  }));

  const { data, error } = await resend.batch.send(payload);

  if (error) {
    throw new Error(`Resend batch error: ${error.message}`);
  }

  // Resend v6 batch response: data.data is the array of {id} objects
  const items: { id: string }[] = (data as { data?: { id: string }[] } | null)?.data ?? [];
  return items.map((item, i) => ({
    id: item.id,
    to: emails[i].to,
  }));
}
