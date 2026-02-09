import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex flex-1 flex-col justify-center gap-4 px-4 text-center">
      <h1 className="font-bold text-4xl">Shareful</h1>
      <p className="mx-auto max-w-lg text-fd-muted-foreground text-lg">
        Share AI coding solutions as markdown files in GitHub repos. Discover,
        create, and publish reusable solutions with the community.
      </p>
      <div className="mt-4 flex justify-center gap-4">
        <Link
          className="rounded-md bg-fd-primary px-6 py-2 font-medium text-fd-primary-foreground"
          href="/docs"
        >
          Get started
        </Link>
        <Link
          className="rounded-md border border-fd-border px-6 py-2 font-medium"
          href="/docs/cli"
        >
          CLI reference
        </Link>
      </div>
    </div>
  );
}
