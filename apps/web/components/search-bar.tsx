"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Input } from "@/components/ui/input";

export function SearchBar({
  defaultValue = "",
  size = "default",
}: {
  defaultValue?: string;
  size?: "default" | "large";
}) {
  const [query, setQuery] = useState(defaultValue);
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  }

  return (
    <form className="relative w-full" onSubmit={handleSubmit}>
      <Search
        aria-hidden="true"
        className={`absolute top-1/2 -translate-y-1/2 text-muted-foreground ${
          size === "large" ? "left-4 h-5 w-5" : "left-3 h-4 w-4"
        }`}
      />
      <Input
        aria-label="Search for solutions"
        className={
          size === "large" ? "h-14 rounded-xl pl-12 text-lg" : "h-10 pl-9"
        }
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search for solutions..."
        type="search"
        value={query}
      />
    </form>
  );
}
