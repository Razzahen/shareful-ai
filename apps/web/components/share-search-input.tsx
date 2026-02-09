"use client";

import { Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";

export function ShareSearchInput() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryFromParams = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(queryFromParams);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const isSearchRoute = pathname?.startsWith("/search");

  useEffect(() => {
    setQuery(queryFromParams);
  }, [queryFromParams]);

  useEffect(() => {
    if (!isSearchRoute) {
      return;
    }

    const input = inputRef.current;
    if (!input) {
      return;
    }

    const focusInput = () => {
      if (document.activeElement !== input) {
        input.focus();
      }
    };

    focusInput();
    const timeoutId = window.setTimeout(focusInput, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isSearchRoute]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isCmdF =
        (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f";
      if (!isCmdF) {
        return;
      }

      event.preventDefault();
      inputRef.current?.focus();
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  function updateQuery(nextValue: string) {
    setQuery(nextValue);
    const trimmed = nextValue.trim();
    const params = new URLSearchParams(
      isSearchRoute ? searchParams.toString() : ""
    );
    const previousQuery = isSearchRoute ? queryFromParams : "";

    if (trimmed) {
      params.set("q", trimmed);
    } else {
      params.delete("q");
    }

    // If the query changes, clear any strict-match request flags so we don't
    // accidentally re-run expensive checks while typing.
    if (trimmed !== previousQuery) {
      params.delete("strict");
    }

    const queryString = params.toString();
    const target = queryString ? `/search?${queryString}` : "/search";

    let currentTarget: string;
    if (pathname?.startsWith("/search")) {
      const currentQueryString = searchParams.toString();
      currentTarget = currentQueryString
        ? `/search?${currentQueryString}`
        : "/search";
    } else {
      currentTarget = pathname ?? "/";
    }

    if (target === currentTarget) {
      return;
    }

    router.replace(target, { scroll: false });
  }

  return (
    <InputGroup className="h-8 w-full md:h-12">
      <InputGroupAddon align="inline-start">
        <Search className="size-4" />
      </InputGroupAddon>
      <InputGroupInput
        autoComplete="off"
        autoFocus={isSearchRoute}
        name="q"
        onChange={(event) => updateQuery(event.target.value)}
        placeholder="Search for solutions..."
        ref={inputRef}
        value={query}
      />
      {query ? (
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            aria-label="Clear search"
            onClick={() => updateQuery("")}
            size="icon-xs"
            variant="ghost"
          >
            <X className="size-3.5" />
          </InputGroupButton>
        </InputGroupAddon>
      ) : null}
    </InputGroup>
  );
}
