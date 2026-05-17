// src/app/api/shared-goals/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GoalStatus } from "@prisma/client";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "MANAGER" && session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { sourceGoalId, recipientIds, defaultWeightage } = body;

    const sourceGoal = await prisma.goal.findUnique({
      where: { id: sourceGoalId },
    });

    if (!sourceGoal) {
      return NextResponse.json({ error: "Source goal not found" }, { status: 404 });
    }

    // If manager, verify recipients are direct reports
    if (session.user.role === "MANAGER") {
      const validRecipients = await prisma.user.findMany({
        where: {
          id: { in: recipientIds },
          managerId: session.user.id,
        },
      });

      if (validRecipients.length !== recipientIds.length) {
        return NextResponse.json(
          { error: "Some recipients are not your direct reports" },
          { status: 403 }
        );
      }
    }

    // Mark source as shared
    await prisma.goal.update({
      where: { id: sourceGoalId },
      data: { isShared: true },
    });

    // Create shared goal copies for each recipient
    const sharedGoals = await prisma.$transaction(
      recipientIds.map((userId: string) =>
        prisma.goal.create({
          data: {
            title: sourceGoal.title,
            description: sourceGoal.description,
            thrustAreaId: sourceGoal.thrustAreaId,
            uom: sourceGoal.uom,
            target: sourceGoal.target,
            targetDate: sourceGoal.targetDate,
            weightage: defaultWeightage || 10,
            employeeId: userId,
            cycleId: sourceGoal.cycleId,
            status: GoalStatus.LOCKED, // Shared goals are auto-locked
            isShared: false, // This is a copy
            sharedFromId: sourceGoalId,
            approvedAt: new Date(),
            lockedAt: new Date(),
          },
        })
      )
    );

    // Create recipient records
    await prisma.sharedGoalRecipient.createMany({
      data: recipientIds.map((userId: string, index: number) => ({
        goalId: sourceGoalId,
        userId,
        weightage: defaultWeightage || 10,
      })),
    });

    return NextResponse.json(sharedGoals, { status: 201 });
  } catch (error) {
    console.error("POST /api/shared-goals error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
