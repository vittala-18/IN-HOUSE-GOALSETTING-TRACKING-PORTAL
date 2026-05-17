// src/lib/validations.ts
import { z } from "zod";
import { UnitOfMeasurement, ProgressStatus } from "@prisma/client";

export const goalSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(200),
  description: z.string().max(1000).optional(),
  thrustAreaId: z.string().min(1, "Thrust area is required"),
  uom: z.nativeEnum(UnitOfMeasurement),
  target: z.number().positive("Target must be positive").optional(),
  targetDate: z.string().datetime().optional(),
  weightage: z
    .number()
    .min(10, "Minimum weightage is 10%")
    .max(100, "Maximum weightage is 100%"),
});

export const goalSheetSchema = z
  .array(goalSchema)
  .min(1, "At least one goal is required")
  .max(8, "Maximum 8 goals allowed")
  .refine(
    (goals) => {
      const total = goals.reduce((sum, g) => sum + g.weightage, 0);
      return Math.abs(total - 100) < 0.01;
    },
    { message: "Total weightage must equal 100%" }
  );

export const achievementSchema = z.object({
  quarter: z.number().min(1).max(4),
  actualValue: z.number().optional(),
  completedDate: z.string().datetime().optional(),
  notes: z.string().max(500).optional(),
  progressStatus: z.nativeEnum(ProgressStatus),
});

export const checkInCommentSchema = z.object({
  content: z.string().min(1).max(2000),
});

export const approvalSchema = z.object({
  action: z.enum(["approve", "reject", "return"]),
  reason: z.string().optional(),
  modifications: z
    .array(
      z.object({
        goalId: z.string(),
        target: z.number().optional(),
        weightage: z.number().min(10).max(100).optional(),
      })
    )
    .optional(),
});

export type GoalInput = z.infer<typeof goalSchema>;
export type AchievementInput = z.infer<typeof achievementSchema>;
export type ApprovalInput = z.infer<typeof approvalSchema>;
