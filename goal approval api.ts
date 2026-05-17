// src/app/api/goals/[id]/approve/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { approvalSchema } from "@/lib/validations";
import { GoalStatus } from "@prisma/client";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "MANAGER" && session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const goal = await prisma.goal.findUnique({
      where: { id: params.id },
      include: { employee: true },
    });

    if (!goal) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }

    // Verify manager relationship
    if (
      session.user.role === "MANAGER" &&
      goal.employee.managerId !== session.user.id
    ) {
      return NextResponse.json({ error: "Not your direct report" }, { status: 403 });
    }

    if (goal.status !== "PENDING_APPROVAL") {
      return NextResponse.json(
        { error: "Goal is not pending approval" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const validation = approvalSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error.errors },
        { status: 400 }
      );
    }

    const { action, reason, modifications } = validation.data;
    const previousData = { ...goal };

    let updatedGoal;

    if (action === "approve") {
      // Apply any modifications first
      const updateData: any = {
        status: GoalStatus.LOCKED,
        approvedAt: new Date(),
        lockedAt: new Date(),
      };

      if (modifications?.length) {
        const mod = modifications.find((m) => m.goalId === params.id);
        if (mod) {
          if (mod.target !== undefined) updateData.target = mod.target;
          if (mod.weightage !== undefined) updateData.weightage = mod.weightage;
        }
      }

      updatedGoal = await prisma.goal.update({
        where: { id: params.id },
        data: updateData,
      });
    } else if (action === "reject" || action === "return") {
      updatedGoal = await prisma.goal.update({
        where: { id: params.id },
        data: {
          status: GoalStatus.REJECTED,
          rejectionReason: reason,
        },
      });
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        goalId: params.id,
        action: action.toUpperCase(),
        changes: {
          before: previousData,
          after: updatedGoal,
          reason,
        },
      },
    });

    return NextResponse.json(updatedGoal);
  } catch (error) {
    console.error("POST /api/goals/[id]/approve error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
