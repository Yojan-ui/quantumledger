/**
 * The last resort for a next/dynamic import whose chunk failed to load twice (each loader retries
 * once first): render nothing for that component instead of crashing the page. 3D areas keep their
 * poster (see components/scenes/LazyView).
 */
export const chunkFailed = () => ({ default: () => null });
