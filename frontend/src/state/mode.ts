import { useFeed } from "./feed";
import { modeOf, useScenario, type CryptoMode } from "./scenario";

/** Selected signature posture: the classical what-if flag, else the engine's live NIST level. */
export function useCryptoMode(): CryptoMode {
  const classical = useScenario((s) => s.classical);
  const level = useFeed((s) => s.status?.controls.nist_level);
  return modeOf(classical, level);
}
