import { Deck } from "@/components/pitch/Deck";
import { pageMeta } from "@/lib/meta";

export const metadata = pageMeta({
  title: "Pitch",
  description:
    "Q-Setu in seven slides: problem, why now, solution, live demo, difference, business model, ask.",
  path: "/pitch",
});

export default function Pitch() {
  return <Deck />;
}
