"use client";

import { View } from "@react-three/drei";
import type { ReactNode } from "react";

/**
 * A window into the site's single WebGL canvas. Demo scenes render here through drei's <View>
 * (scissored into this element's rectangle), so the whole site keeps one GL context.
 */
export function SceneView({ children, className }: { children: ReactNode; className?: string }) {
  return <View className={className}>{children}</View>;
}
