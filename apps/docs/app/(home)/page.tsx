import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex flex-col justify-center text-center flex-1 gap-4 px-4">
      <h1 className="text-4xl font-bold">Shareful</h1>
      <p className="text-lg text-fd-muted-foreground max-w-lg mx-auto">
        Share AI coding solutions as markdown files in GitHub repos. Discover,
        create, and publish reusable solutions with the community.
      </p>
      <div className="flex gap-4 justify-center mt-4">
        <Link
          href="/docs"
          className="px-6 py-2 rounded-md bg-fd-primary text-fd-primary-foreground font-medium"
        >
          Get started
        </Link>
        <Link
          href="/docs/cli"
          className="px-6 py-2 rounded-md border border-fd-border font-medium"
        >
          CLI reference
        </Link>
      </div>
    </div>
  );
}
