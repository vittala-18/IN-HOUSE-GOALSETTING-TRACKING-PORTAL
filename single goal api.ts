// src/app/api/goals/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { goalSchema } from "@/lib/validations";

export async function GET(
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
      include: {
        thrustArea: true,
        employee: { select: { id: true, name: true, email: true, managerId: true } },
        achievements: { orderBy: { quarter: "asc" } },
        checkIns: {
          include: {
            comments: {
              include: { author: { select: { id: true, name: true, role: true } } },
              orderBy: { createdAt: "asc" },
            },
          },
          orderBy: { quarter: "asc" },
        },
        auditLogs: {
          include: { user: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!goal) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }

    // Authorization check
    const isOwner = goal.employeeId === session.user.id;
    const isManager = goal.employee.managerId === session.user.id;
    const isAdmin = session.user.role === "ADMIN";

    if (!isOwner && !isManager && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(goal);
  } catch (error) {
    console.error("GET /api/goals/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
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
      include: { employee: true },
    });

    if (!goal) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }

    // Only owner can edit draft goals
    if (goal.employeeId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (goal.status !== "DRAFT" && goal.status !== "REJECTED") {
      return NextResponse.json(
        { error: "Cannot edit goal in current status" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const validation = goalSchema.partial().safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error.errors },
        { status: 400 }
      );
    }

    const previousData = { ...goal };

    const updated = await prisma.goal.update({
      where: { id: params.id },
      data: {
        ...validation.data,
        targetDate: validation.data.targetDate
          ? new Date(validation.data.targetDate)
          : undefined,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        goalId: params.id,
        action: "UPDATE",
        changes: { before: previousData, after: updated },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/goals/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
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
    });

    if (!goal) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }

    if (goal.employeeId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (goal.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Cannot delete non-draft goal" },
        { status: 400 }
      );
    }

    await prisma.goal.delete({ where: { id: params.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/goals/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
