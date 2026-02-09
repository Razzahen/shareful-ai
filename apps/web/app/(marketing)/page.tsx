import CallToAction from "@/components/call-to-action-1";
import Content from "@/components/content-3";
import Features from "@/components/features-1";
import HeroSection from "@/components/hero-section-1";
import { getHomepageData } from "@/lib/homepage";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { allTime } = await getHomepageData(20);

  return (
    <div className="flex flex-1 flex-col">
      <HeroSection totalShares={allTime.total} />
      <Features />
      <Content />
      <CallToAction />
    </div>
  );
}
