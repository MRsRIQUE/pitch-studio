"use client";

import * as React from "react";
import { BorderBeam, type BorderBeamSize } from "border-beam";
import { MetalFx, type MetalFxVariant } from "metal-fx";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
const subscribeHydration = () => () => {};

/**
 * `metal-fx` checks WebGL support while rendering. The server necessarily sees
 * no WebGL, while a capable browser sees it immediately, so rendering the
 * library during hydration produces different trees. `useSyncExternalStore`
 * keeps the server snapshot for hydration and switches to the client snapshot
 * immediately afterwards without an effect-driven setState.
 */
function useHydrated(): boolean {
  return React.useSyncExternalStore(
    subscribeHydration,
    () => true,
    () => false,
  );
}

function useReducedMotion(): boolean {
  return React.useSyncExternalStore(
    (notify) => {
      const media = window.matchMedia(REDUCED_MOTION);
      media.addEventListener("change", notify);
      return () => media.removeEventListener("change", notify);
    },
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  );
}

export function ChatBorderBeam({
  children,
  className,
  size = "md",
  strength = 0.7,
  active = true,
  borderRadius,
  theme = "light",
}: {
  children: React.ReactElement;
  className?: string;
  size?: BorderBeamSize;
  strength?: number;
  active?: boolean;
  borderRadius?: number;
  theme?: "light" | "dark";
}) {
  const reducedMotion = useReducedMotion();
  return (
    <BorderBeam
      className={className}
      size={size}
      colorVariant="colorful"
      strength={strength}
      active={active && !reducedMotion}
      theme={theme}
      borderRadius={borderRadius}
    >
      {children}
    </BorderBeam>
  );
}

export function MetalCommand({
  children,
  className,
  active = true,
  variant = "circle",
  strength = 0.92,
  theme = "light",
  surface,
}: {
  children: React.ReactElement;
  className?: string;
  active?: boolean;
  variant?: MetalFxVariant;
  strength?: number;
  theme?: "light" | "dark";
  /** Cor da superfície interna, já que o MetalFx normaliza o fundo do filho. */
  surface?: React.CSSProperties["backgroundColor"];
}) {
  const reducedMotion = useReducedMotion();
  const hydrated = useHydrated();

  if (!hydrated) {
    return (
      <div
        className={className ? `metal-fx-fallback ${className}` : "metal-fx-fallback"}
        data-metal-fx-unsupported=""
        style={{ display: "inline-flex", ...(surface ? { backgroundColor: surface } : {}) }}
      >
        {children}
      </div>
    );
  }

  return (
    <MetalFx
      className={className}
      preset="chromatic"
      variant={variant}
      strength={active ? strength : 0.34}
      glowGain={active ? 0.78 : 0.28}
      theme={theme}
      innerShadow
      paused={reducedMotion || !active}
      style={surface ? { backgroundColor: surface } : undefined}
    >
      {children}
    </MetalFx>
  );
}
