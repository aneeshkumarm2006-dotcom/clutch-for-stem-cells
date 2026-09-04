import * as React from "react";
import {
  Activity,
  Bone,
  Calculator,
  ClipboardCheck,
  Droplet,
  Flame,
  Gauge,
  Percent,
  Plane,
  Ruler,
  Scale,
  Search,
  Stethoscope,
  Table2,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { ToolIcon as ToolIconKey } from "@/config/tools";

/**
 * Icon lookup for the tools registry.
 *
 * `config/tools.ts` stores an icon as a string so it stays free of React and can
 * be read by the admin form and by scripts. This is the one place that string
 * becomes a component, and the `Record` is exhaustive over the key union, so
 * adding an icon key without adding an icon is a compile error rather than a
 * blank square on the hub.
 */
const ICONS: Record<ToolIconKey, LucideIcon> = {
  calculator: Calculator,
  plane: Plane,
  scale: Scale,
  clipboard: ClipboardCheck,
  gauge: Gauge,
  activity: Activity,
  flame: Flame,
  percent: Percent,
  ruler: Ruler,
  droplet: Droplet,
  stethoscope: Stethoscope,
  search: Search,
  table: Table2,
  bone: Bone,
};

export function ToolIcon({
  icon,
  className,
}: {
  icon: ToolIconKey;
  className?: string;
}) {
  const Icon = ICONS[icon];
  return <Icon className={cn("size-5", className)} aria-hidden="true" />;
}
