// src/app/api/check-ins/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkInCommentSchema } from "@/lib/validations";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const goalId = searchParams.get("goalId");
    const quarter = searchParams.get("quarter");

    const where: any = {};
    if (goalId) where.goalId = goalId;
    if (quarter) where.quarter = parseInt(quarter);

    const checkIns = await prisma.checkIn.findMany({
      where,
      include: {
        goal: {
          include: {
            employee: { select: { id: true, name: true } },
            achievements: true,
          },
        },
        comments: {
          include: { author: { select: { id: true, name: true, role: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(checkIns);
  } catch (error) {
    console.error("GET /api/check-ins error:", error);
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
    const { goalId, quarter, comment } = body;

    const validation = checkInCommentSchema.safeParse({ content: comment });
    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error.errors },
        { status: 400 }
      );
    }

    const goal = await prisma.goal.findUnique({
      where: { id: goalId },
      include: { employee: true },
    });

    if (!goal) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }

    // Verify authorization
    const isOwner = goal.employeeId === session.user.id;
    const isManager = goal.employee.managerId === session.user.id;

    if (!isOwner && !isManager && session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Find or create check-in
    let checkIn = await prisma.checkIn.findUnique({
      where: { goalId_quarter: { goalId, quarter } },
    });

    if (!checkIn) {
      checkIn = await prisma.checkIn.create({
        data: { goalId, quarter },
      });
    }

    // Add comment
    const newComment = await prisma.checkInComment.create({
      data: {
        checkInId: checkIn.id,
        authorId: session.user.id,
        content: comment,
        isManager: isManager || session.user.role === "ADMIN",
      },
      include: { author: { select: { id: true, name: true, role: true } } },
    });

    return NextResponse.json(newComment, { status: 201 });
  } catch (error) {
    console.error("POST /api/check-ins error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
