import RechtSeite from "@/app/components/ui/RechtSeite";

export const metadata = {
  title: "Impressum und Datenschutz — KANA AI",
};

interface PageProps {
  searchParams: Promise<{ doc?: string }>;
}

export default async function RechtPage({ searchParams }: PageProps) {
  const { doc } = await searchParams;
  return <RechtSeite start={doc === "datenschutz" ? "datenschutz" : "impressum"} />;
}
