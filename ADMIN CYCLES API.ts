// src/app/api/admin/cycles/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const cycles = await prisma.performanceCycle.findMany({
      orderBy: { startDate: "desc" },
    });

    return NextResponse.json(cycles);
  } catch (error) {
    console.error("GET /api/admin/cycles error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const {
      name,
      startDate,
      endDate,
      goalSettingStart,
      goalSettingEnd,
      q1CheckInStart,
      q1CheckInEnd,
      q2CheckInStart,
      q2CheckInEnd,
      q3CheckInStart,
      q3CheckInEnd,
      q4CheckInStart,
      q4CheckInEnd,
      isActive,
    } = body;

    // If setting as active, deactivate others
    if (isActive) {
      await prisma.performanceCycle.updateMany({
        data: { isActive: false },
      });
    }

    const cycle = await prisma.performanceCycle.create({
      data: {
        name,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        goalSettingStart: new Date(goalSettingStart),
        goalSettingEnd: new Date(goalSettingEnd),
        q1CheckInStart: new Date(q1CheckInStart),
        q1CheckInEnd: new Date(q1CheckInEnd),
        q2CheckInStart: new Date(q2CheckInStart),
        q2CheckInEnd: new Date(q2CheckInEnd),
        q3CheckInStart: new Date(q3CheckInStart),
        q3CheckInEnd: new Date(q3CheckInEnd),
        q4CheckInStart: new Date(q4CheckInStart),
        q4CheckInEnd: new Date(q4CheckInEnd),
        isActive: isActive || false,
      },
    });

    return NextResponse.json(cycle, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/cycles error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
