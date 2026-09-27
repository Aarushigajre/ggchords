import { notFound } from "next/navigation";
import { PROGRESSIONS, progressionIds, findProgression } from "@/lib/progressions/data";
import { ProgressionWorkspace } from "@/components/ProgressionWorkspace";

export function generateStaticParams() {
  return progressionIds().map((id) => ({ id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const progression = findProgression(id);
  if (!progression) return { title: "Not found — ggchords" };
  return {
    title: `${progression.title} chord progression — ggchords`,
    description: progression.description,
  };
}

export default async function ProgressionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const progression = findProgression(id);
  if (!progression) notFound();

  return (
    <ProgressionWorkspace
      title={progression.title}
      keyNameOriginal={progression.keyName}
      symbols={progression.symbols}
      description={progression.description}
      use={progression.use}
      level={progression.level}
      genre={progression.genre}
      aliases={progression.aliases}
      strumPatternId={progression.strumPattern}
      suggestedTempo={progression.tempo}
      meter={progression.meter}
    />
  );
}

export const dynamicParams = false;
