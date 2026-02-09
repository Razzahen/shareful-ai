import { ShareSearch } from "@/components/share-search";

export const dynamic = "force-static";
export const revalidate = false;

export default function SearchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="size-full min-h-full">
      <main className="w-full flex-1 overflow-y-auto overflow-x-hidden bg-background">
        <div className="mx-auto max-w-5xl px-6 py-8">
          <ShareSearch />
        </div>
        {children}
      </main>
    </div>
  );
}
