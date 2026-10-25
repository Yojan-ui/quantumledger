"use client";

import { Component, type ReactNode } from "react";

/**
 * Keeps one failing 3D scene from taking down the shared canvas: if a scene throws while
 * rendering or mounting, it draws nothing and the rest of the canvas keeps going. `onError` lets
 * the area bring its poster back (a lazily loaded scene can fail after the View's first frame has
 * already hidden it). Errors thrown inside a useFrame callback happen outside React and aren't
 * caught here.
 */
export class SceneBoundary extends Component<
  { children: ReactNode; onError?: () => void },
  { failed: boolean }
> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch() {
    this.props.onError?.();
  }

  override render() {
    return this.state.failed ? null : this.props.children;
  }
}
