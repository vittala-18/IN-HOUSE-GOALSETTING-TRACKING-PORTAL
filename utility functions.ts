// src/lib/utils.ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { UnitOfMeasurement } from "@prisma/client";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function calculateProgressScore(
  uom: UnitOfMeasurement,
  target: number,
  actual: number,
  targetDate?: Date,
  completedDate?: Date
): number {
  switch (uom) {
    case "NUMERIC_MIN":
    case "PERCENTAGE_MIN":
      // Higher is better: Achievement ÷ Target
      return Math.min((actual / target) * 100, 100);

    case "NUMERIC_MAX":
    case "PERCENTAGE_MAX":
      // Lower is better: Target ÷ Achievement
      if (actual === 0) return 100;
      return Math.min((target / actual) * 100, 100);

    case "TIMELINE":
      // Date-based completion
      if (!targetDate || !completedDate) return 0;
      if (completedDate <= targetDate) return 100;
      // Penalize late completion
      const daysLate = Math.floor(
        (completedDate.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      return Math.max(100 - daysLate * 5, 0);

    case "ZERO_BASED":
      // Zero = Success
      return actual === 0 ? 100 : 0;

    default:
      return 0;
  }
}

export function getCurrentQuarter(): number {
  const month = new Date().getMonth() + 1;
  if (month >= 4 && month <= 6) return 1;
  if (month >= 7 && month <= 9) return 2;
  if (month >= 10 && month <= 12) return 3;
  return 4;
}

export function isWithinCheckInWindow(
  cycle: {
    q1CheckInStart: Date;
    q1CheckInEnd: Date;
    q2CheckInStart: Date;
    q2CheckInEnd: Date;
    q3CheckInStart: Date;
    q3CheckInEnd: Date;
    q4CheckInStart: Date;
    q4CheckInEnd: Date;
  },
  quarter: number
): boolean {
  const now = new Date();
  const windows = {
    1: { start: cycle.q1CheckInStart, end: cycle.q1CheckInEnd },
    2: { start: cycle.q2CheckInStart, end: cycle.q2CheckInEnd },
    3: { start: cycle.q3CheckInStart, end: cycle.q3CheckInEnd },
    4: { start: cycle.q4CheckInStart, end: cycle.q4CheckInEnd },
  };
  const window = windows[quarter as keyof typeof windows];
  return now >= window.start && now <= window.end;
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function getUoMLabel(uom: UnitOfMeasurement): string {
  const labels: Record<UnitOfMeasurement, string> = {
    NUMERIC_MIN: "Numeric (Higher is Better)",
    NUMERIC_MAX: "Numeric (Lower is Better)",
    PERCENTAGE_MIN: "Percentage (Higher is Better)",
    PERCENTAGE_MAX: "Percentage (Lower is Better)",
    TIMELINE: "Timeline (Date-based)",
    ZERO_BASED: "Zero-based (Zero = Success)",
  };
  return labels[uom];
}
