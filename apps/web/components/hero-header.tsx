"use client";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const menuItems = [{ name: "Docs", href: "/docs", external: true }];

export const HeroHeader = () => {
  const [menuState, setMenuState] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header>
      <a
        className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:bg-background focus:p-2 focus:text-foreground"
        href="#main-content"
      >
        Skip to content
      </a>
      <nav
        className={cn(
          "fixed z-20 w-full transition-all duration-300",
          isScrolled &&
            "border-black/5 border-b bg-background/75 backdrop-blur-lg"
        )}
        data-state={menuState && "active"}
      >
        <div className="mx-auto max-w-5xl px-6">
          <div className="relative flex flex-wrap items-center justify-between gap-6 py-6 lg:gap-0">
            <div className="flex w-full justify-between gap-6 lg:w-auto">
              <Link
                aria-label="home"
                className="flex items-center space-x-2"
                href="/"
              >
                <Logo />
              </Link>

              <button
                aria-label={menuState === true ? "Close Menu" : "Open Menu"}
                className="relative z-20 -m-2.5 -mr-4 block cursor-pointer p-2.5 lg:hidden"
                onClick={() => setMenuState(!menuState)}
                type="button"
              >
                <Menu className="m-auto size-6 in-data-[state=active]:rotate-180 in-data-[state=active]:scale-0 in-data-[state=active]:opacity-0 duration-200" />
                <X className="absolute inset-0 m-auto size-6 -rotate-180 in-data-[state=active]:rotate-0 in-data-[state=active]:scale-100 scale-0 in-data-[state=active]:opacity-100 opacity-0 duration-200" />
              </button>
            </div>

            <div className="hidden lg:block">
              <ul className="flex gap-1">
                {menuItems.map((item) => (
                  <li key={item.name}>
                    <Button asChild size="sm" variant="ghost">
                      <a className="text-base" href={item.href}>
                        <span>{item.name}</span>
                      </a>
                    </Button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mb-6 in-data-[state=active]:block hidden w-full flex-wrap items-center justify-end space-y-8 rounded-3xl border bg-background p-6 shadow-2xl shadow-zinc-300/20 md:flex-nowrap lg:hidden dark:shadow-none">
              <div className="lg:hidden">
                <ul className="space-y-6 text-base">
                  {menuItems.map((item) => {
                    const className =
                      "text-muted-foreground hover:text-accent-foreground block duration-150";
                    return (
                      <li key={item.name}>
                        <a className={className} href={item.href}>
                          <span>{item.name}</span>
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </nav>
    </header>
  );
};
