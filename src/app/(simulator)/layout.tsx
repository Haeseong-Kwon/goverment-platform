import type { ReactNode } from "react";
import "@/features/administration-simulator/simulator.css";

export default function SimulatorLayout({ children }: { children: ReactNode }) {
  return <div className="simulator-shell">{children}</div>;
}

