import Link from "next/link";
import { LANGUAGE_CONFIG, type Language } from "@/lib/whatsapp-cards";

const LANGUAGE_ORDER: Language[] = ["kn", "te", "ta", "hi"];

type WhatsAppCardLinksProps = {
  issueNumber: number;
  languages: Language[];
};

export function WhatsAppCardLinks({
  issueNumber,
  languages,
}: WhatsAppCardLinksProps) {
  const availableLanguages = LANGUAGE_ORDER.filter((language) =>
    languages.includes(language)
  );

  if (availableLanguages.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
        WhatsApp cards
      </span>
      {availableLanguages.map((language) => (
        <Link
          key={language}
          href={`/c/${issueNumber}/${language}`}
          className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-800 transition hover:border-emerald-300 hover:bg-emerald-100 hover:text-emerald-900"
        >
          {LANGUAGE_CONFIG[language].nativeName}
        </Link>
      ))}
    </div>
  );
}
