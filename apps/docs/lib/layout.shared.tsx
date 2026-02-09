import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import Image from "next/image";

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <>
          <Image
            alt=""
            className="size-6"
            height={24}
            src="/logo.svg"
            width={24}
          />
          <span>Shareful</span>
        </>
      ),
      url: "https://shareful.ai",
    },
  };
}
