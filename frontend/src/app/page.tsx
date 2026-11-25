import { WindowHome } from "@/components/home";
import { searchFromValues, type SearchValues } from "@/lib/discovery-list";
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<SearchValues>;
}) {
  return (
    <WindowHome
      today={new Date().toISOString().slice(0, 10)}
      initialQuery={searchFromValues(await searchParams).toString()}
    />
  );
}
