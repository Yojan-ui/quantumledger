import { Hero } from "@/components/home/Hero";
import { Demos, Features, FinalCta, Industries, WhyQSetu } from "@/components/home/Sections";
import { Story } from "@/components/home/Story";
import { WhyNow } from "@/components/home/WhyNow";
import { CHAPTERS } from "@/components/home/chapters";
import { Footer } from "@/components/ui/Footer";
import { Nav } from "@/components/ui/Nav";

export default function Home() {
  return (
    <>
      <Nav />
      <main id="main">
        <Hero />
        <WhyNow />
        <div className="sr-only">
          <h2>The Q-Setu story</h2>
          <ol>
            {CHAPTERS.slice(1).map((c) => (
              <li key={c.id}>
                {c.title} {c.body}
              </li>
            ))}
          </ol>
        </div>
        <Story />
        <Features />
        <WhyQSetu />
        <Industries />
        <Demos />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
