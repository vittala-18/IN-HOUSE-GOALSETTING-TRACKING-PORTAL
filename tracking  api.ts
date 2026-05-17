// src/app/api/goals/[id]/achievements/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { achievementSchema } from "@/lib/validations";
import { calculateProgressScore, isWithinCheckInWindow } from "@/lib/utils";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const goal = await prisma.goal.findUnique({
      where: { id: params.id },
      include: { cycle: true },
    });

    if (!goal) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }

    if (goal.employeeId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (goal.status !== "LOCKED") {
      return NextResponse.json(
        { error: "Goal must be approved before tracking achievements" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const validation = achievementSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error.errors },
        { status: 400 }
      );
    }

    const { quarter, actualValue, completedDate, notes, progressStatus } = validation.data;

    // Check if within check-in window
    if (!isWithinCheckInWindow(goal.cycle, quarter)) {
      return NextResponse.json(
        { error: "Check-in window for this quarter is not active" },
        { status: 400 }
      );
    }

    // Calculate progress score
    const progressScore = calculateProgressScore(
      goal.uom,
      goal.target,
      actualValue || 0,
      goal.targetDate || undefined,
      completedDate ? new Date(completedDate) : undefined
    );

    // Upsert achievement
    const achievement = await prisma.achievement.upsert({
      where: {
        goalId_quarter: { goalId: params.id, quarter },
      },
      create: {
        goalId: params.id,
        quarter,
        plannedValue: goal.target,
        actualValue,
        completedDate: completedDate ? new Date(completedDate) : null,
        progressScore,
        notes,
      },
      update: {
        actualValue,
        completedDate: completedDate ? new Date(completedDate) : null,
        progressScore,
        notes,
      },
    });

    // Update goal progress status
    await prisma.goal.update({
      where: { id: params.id },
      data: { progressStatus },
    });

    // If this is a shared goal (primary owner), sync to all linked copies
    if (goal.isShared) {
      const sharedCopies = await prisma.goal.findMany({
        where: { sharedFromId: params.id },
      });

      for (const copy of sharedCopies) {
        await prisma.achievement.upsert({
          where: {
            goalId_quarter: { goalId: copy.id, quarter },
          },
          create: {
            goalId: copy.id,
            quarter,
            plannedValue: copy.target,
            actualValue,
            completedDate: completedDate ? new Date(completedDate) : null,
            progressScore: calculateProgressScore(
              copy.uom,
              copy.target,
              actualValue || 0,
              copy.targetDate || undefined,
              completedDate ? new Date(completedDate) : undefined
            ),
            notes,
          },
          update: {
            actualValue,
            completedDate: completedDate ? new Date(completedDate) : null,
            progressScore: calculateProgressScore(
              copy.uom,
              copy.target,
              actualValue || 0,
              copy.targetDate || undefined,
              completedDate ? new Date(completedDate) : undefined
            ),
            notes,
          },
        });
      }
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        goalId: params.id,
        action: "ACHIEVEMENT_UPDATE",
        changes: { quarter, achievement },
      },
    });

    return NextResponse.json(achievement);
  } catch (error) {
    console.error("POST /api/goals/[id]/achievements error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
