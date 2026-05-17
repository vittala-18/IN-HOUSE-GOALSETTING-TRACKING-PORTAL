// src/app/api/goals/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { goalSheetSchema } from "@/lib/validations";
import { GoalStatus } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const cycleId = searchParams.get("cycleId");
    const employeeId = searchParams.get("employeeId");

    // Build where clause based on role
    const where: any = {};
    
    if (cycleId) where.cycleId = cycleId;

    if (session.user.role === "EMPLOYEE") {
      where.employeeId = session.user.id;
    } else if (session.user.role === "MANAGER") {
      if (employeeId) {
        // Verify this employee reports to the manager
        const employee = await prisma.user.findFirst({
          where: { id: employeeId, managerId: session.user.id },
        });
        if (!employee) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        where.employeeId = employeeId;
      } else {
        // Get all direct reports' goals
        where.employee = { managerId: session.user.id };
      }
    }
    // Admin can see all

    const goals = await prisma.goal.findMany({
      where,
      include: {
        thrustArea: true,
        employee: { select: { id: true, name: true, email: true } },
        achievements: true,
        checkIns: { include: { comments: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(goals);
  } catch (error) {
    console.error("GET /api/goals error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { goals, cycleId, submit } = body;

    // Validate goal sheet
    const validation = goalSheetSchema.safeParse(goals);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error.errors },
        { status: 400 }
      );
    }

    // Check for active cycle
    const cycle = await prisma.performanceCycle.findFirst({
      where: cycleId ? { id: cycleId } : { isActive: true },
    });

    if (!cycle) {
      return NextResponse.json({ error: "No active performance cycle" }, { status: 400 });
    }

    // Check if within goal setting window
    const now = new Date();
    if (now < cycle.goalSettingStart || now > cycle.goalSettingEnd) {
      return NextResponse.json(
        { error: "Goal setting window is closed" },
        { status: 400 }
      );
    }

    // Check existing goals count
    const existingCount = await prisma.goal.count({
      where: { employeeId: session.user.id, cycleId: cycle.id },
    });

    if (existingCount + goals.length > 8) {
      return NextResponse.json(
        { error: "Maximum 8 goals allowed per cycle" },
        { status: 400 }
      );
    }

    // Create goals
    const createdGoals = await prisma.$transaction(
      validation.data.map((goal) =>
        prisma.goal.create({
          data: {
            title: goal.title,
            description: goal.description,
            thrustAreaId: goal.thrustAreaId,
            uom: goal.uom,
            target: goal.target || 0,
            targetDate: goal.targetDate ? new Date(goal.targetDate) : null,
            weightage: goal.weightage,
            employeeId: session.user.id,
            cycleId: cycle.id,
            status: submit ? GoalStatus.PENDING_APPROVAL : GoalStatus.DRAFT,
          },
        })
      )
    );

    // Log audit
    await prisma.auditLog.createMany({
      data: createdGoals.map((goal) => ({
        userId: session.user.id,
        goalId: goal.id,
        action: submit ? "SUBMIT" : "CREATE",
        changes: { created: goal },
      })),
    });

    return NextResponse.json(createdGoals, { status: 201 });
  } catch (error) {
    console.error("POST /api/goals error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
