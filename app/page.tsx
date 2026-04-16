"use client";

import { FormEvent, useState } from "react";

type SubmissionState = "idle" | "submitting" | "success" | "error";

type SubscribeResponse = {
  ok?: boolean;
  success?: boolean;
  status?: string;
  message?: string;
};

const PILLARS = [
  {
    title: "Signal Over Hype",
    detail:
      "Practical AI use cases in agriculture, forestry, and ecology with clear implications for real operators.",
  },
  {
    title: "Weekly Curation",
    detail:
      "One concise issue each week with trend snapshots, field examples, and short analysis you can act on.",
  },
  {
    title: "Operator Perspective",
    detail:
      "Written for teams building on the ground, not for speculative headline chasing.",
  },
];

function isSubscribeSuccess(response: Response, payload: unknown): boolean {
  if (!response.ok || !payload || typeof payload !== "object") {
    return false;
  }

  const data = payload as SubscribeResponse;
  const message = data.message?.toLowerCase() ?? "";
  const status = data.status?.toLowerCase() ?? "";

  if (message.includes("placeholder")) {
    return false;
  }

  return (
    data.ok === true ||
    data.success === true ||
    status === "subscribed" ||
    status === "pending_confirmation" ||
    status === "queued"
  );
}

export default function HomePage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submissionState, setSubmissionState] =
    useState<SubmissionState>("idle");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSubmissionState("submitting");

    try {
      const response = await fetch("/api/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim() || undefined,
          email: email.trim(),
        }),
      });

      const payload = (await response.json().catch(() => null)) as unknown;

      if (isSubscribeSuccess(response, payload)) {
        setSubmissionState("success");
        setName("");
        setEmail("");
        return;
      }

      setSubmissionState("error");
    } catch {
      setSubmissionState("error");
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-emerald-50 via-lime-50 to-white text-slate-900">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 pb-16 pt-14 md:px-10 md:pt-20">
        <div className="space-y-5">
          <p className="inline-flex rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">
            Weekly Briefing
          </p>
          <h1 className="max-w-4xl text-4xl font-semibold leading-tight text-emerald-950 md:text-6xl">
            The AI Green Wire
          </h1>
          <p className="max-w-3xl text-base leading-relaxed text-slate-700 md:text-lg">
            A weekly digest on AI across agriculture, agroforestry, forestry,
            and ecology. We track what matters, strip out noise, and focus on
            insights teams can use immediately.
          </p>
          <p className="text-sm text-slate-600">
            Built by Grobet India Agrotech for practitioners, founders,
            operators, and researchers working close to land systems.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {PILLARS.map((pillar) => (
            <article
              key={pillar.title}
              className="rounded-2xl border border-emerald-100 bg-white/85 p-5 shadow-sm"
            >
              <h2 className="text-lg font-semibold text-emerald-900">
                {pillar.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-700">
                {pillar.detail}
              </p>
            </article>
          ))}
        </div>

        <section className="rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm md:p-8">
          <div className="space-y-3">
            <h2 className="text-2xl font-semibold text-emerald-950 md:text-3xl">
              Join the early subscriber list
            </h2>
            <p className="max-w-2xl text-sm leading-relaxed text-slate-700 md:text-base">
              You will receive one issue each week. No spam, no noisy alerts,
              and no sharing of your information.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="mt-6 grid gap-3 md:grid-cols-[1fr_1fr_auto]"
          >
            <label className="sr-only" htmlFor="name">
              Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              placeholder="Name (optional)"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="h-12 rounded-xl border border-slate-300 px-4 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
            />

            <label className="sr-only" htmlFor="email">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="Email address"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-12 rounded-xl border border-slate-300 px-4 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
            />

            <button
              type="submit"
              disabled={submissionState === "submitting"}
              className="h-12 rounded-xl bg-emerald-700 px-5 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-emerald-500"
            >
              {submissionState === "submitting"
                ? "Submitting..."
                : "Subscribe"}
            </button>
          </form>

          <div className="mt-3 min-h-6 text-sm" aria-live="polite">
            {submissionState === "success" && (
              <p className="text-emerald-800">
                Thanks. Please check your inbox for the confirmation step.
              </p>
            )}
            {submissionState === "error" && (
              <p className="text-amber-800">
                Subscription is not fully enabled yet. Please try again soon.
              </p>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}
