"use client";

import { Component, type ReactNode } from "react";

/**
 * Keeps one failing 3D scene from taking down the shared canvas: if a scene throws while
 * rendering or mounting, it draws nothing and the rest of the canvas keeps going. (Its area keeps
 * its poster, since the scene never reports a first frame.) Errors thrown inside a useFrame
 * callback happen outside React and aren't caught here.
 */
export class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override render() {
    return this.state.failed ? null : this.props.children;
  }
}
