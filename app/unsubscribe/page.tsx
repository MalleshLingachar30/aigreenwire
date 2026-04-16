import Link from "next/link";

type SearchParams = {
  status?: string;
  token?: string;
};

function copyForStatus(status: string) {
  switch (status) {
    case "confirmed":
      return {
        title: "Subscription confirmed",
        message:
          "Your email is now confirmed for The AI Green Wire. If you ever want to stop receiving it, use the unsubscribe action below.",
      };
    case "already-confirmed":
      return {
        title: "Already confirmed",
        message:
          "This email is already confirmed. If you want to stop receiving future issues, you can unsubscribe below.",
      };
    case "unsubscribed":
      return {
        title: "You are unsubscribed",
        message:
          "Your email has been removed from future sends. You can subscribe again at any time from the homepage.",
      };
    case "already-unsubscribed":
      return {
        title: "Already unsubscribed",
        message:
          "This unsubscribe link has already been used, and no further action is needed.",
      };
    case "invalid-token":
      return {
        title: "Invalid link",
        message:
          "This link is invalid or expired. If you still want to manage your subscription, submit your email again from the homepage.",
      };
    default:
      return {
        title: "Subscription settings",
        message:
          "Use the links from your email to confirm your subscription or unsubscribe at any time.",
      };
  }
}

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const status = params.status ?? "default";
  const token = params.token?.trim() ?? "";
  const { title, message } = copyForStatus(status);
  const unsubscribeHref =
    token.length > 0 ? `/api/unsubscribe?token=${encodeURIComponent(token)}` : null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-green-50 px-6 py-12">
      <div className="w-full max-w-xl rounded-2xl border border-green-100 bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-semibold text-green-900">{title}</h1>
        <p className="mt-3 text-base leading-relaxed text-green-800">{message}</p>

        {unsubscribeHref && (status === "confirmed" || status === "already-confirmed") && (
          <Link
            href={unsubscribeHref}
            className="mt-6 inline-flex rounded-lg bg-green-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-900"
          >
            Unsubscribe now
          </Link>
        )}

        <Link
          href="/"
          className="mt-6 inline-flex rounded-lg border border-green-300 px-4 py-2 text-sm font-semibold text-green-800 transition hover:bg-green-100"
        >
          Back to homepage
        </Link>
      </div>
    </main>
  );
}
