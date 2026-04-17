import LandingPageClient from './landing-page-client';

type SearchParams = {
  archive?: string;
};

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const initialArchivePrompt = params.archive === 'subscribe';

  return <LandingPageClient initialArchivePrompt={initialArchivePrompt} />;
}
