type IssuePageProps = {
  params: Promise<{ slug: string }>;
};

export default async function IssuePage({ params }: IssuePageProps) {
  const { slug } = await params;

  return (
    <main className="min-h-screen p-8">
      <h1 className="text-3xl font-bold text-green-900 mb-6">
        Issue: {slug}
      </h1>
      <p className="text-green-700">Issue content coming soon.</p>
    </main>
  );
}
