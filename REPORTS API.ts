// src/app/api/reports/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const cycleId = searchParams.get("cycleId");
    const format = searchParams.get("format") || "json";

    let data: any;

    switch (type) {
      case "achievement":
        data = await getAchievementReport(session.user, cycleId);
        break;
      case "completion":
        data = await getCompletionDashboard(cycleId);
        break;
      case "analytics":
        data = await getAnalytics(cycleId);
        break;
      default:
        return NextResponse.json({ error: "Invalid report type" }, { status: 400 });
    }

    if (format === "csv") {
      const csv = convertToCSV(data);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename=${type}-report.csv`,
        },
      });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("GET /api/reports error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function getAchievementReport(user: any, cycleId: string | null) {
  const where: any = {};
  if (cycleId) where.cycleId = cycleId;

  // Filter based on role
  if (user.role === "MANAGER") {
    where.employee = { managerId: user.id };
  } else if (user.role === "EMPLOYEE") {
    where.employeeId = user.id;
  }
  // Admin sees all

  const goals = await prisma.goal.findMany({
    where,
    include: {
      employee: { select: { name: true, email: true, department: true } },
      thrustArea: { select: { name: true } },
      achievements: { orderBy: { quarter: "asc" } },
    },
  });

  return goals.map((goal) => ({
    employeeName: goal.employee.name,
    employeeEmail: goal.employee.email,
    department: goal.employee.department,
    thrustArea: goal.thrustArea.name,
    goalTitle: goal.title,
    uom: goal.uom,
    target: goal.target,
    weightage: goal.weightage,
    status: goal.status,
    progressStatus: goal.progressStatus,
    achievements: goal.achievements.map((a) => ({
      quarter: `Q${a.quarter}`,
      planned: a.plannedValue,
      actual: a.actualValue,
      progressScore: a.progressScore,
    })),
  }));
}

async function getCompletionDashboard(cycleId: string | null) {
  const where: any = {};
  if (cycleId) where.cycleId = cycleId;

  const [
    totalEmployees,
    goalsSubmitted,
    goalsApproved,
    checkInsCompleted,
  ] = await Promise.all([
    prisma.user.count({ where: { role: "EMPLOYEE" } }),
    prisma.goal.count({ where: { ...where, status: { not: "DRAFT" } } }),
    prisma.goal.count({ where: { ...where, status: "LOCKED" } }),
    prisma.checkIn.count(),
  ]);

  // Get per-quarter check-in completion
  const quarterCompletion = await Promise.all(
    [1, 2, 3, 4].map(async (quarter) => {
      const completed = await prisma.checkIn.count({
        where: { quarter },
      });
      const expected = await prisma.goal.count({
        where: { ...where, status: "LOCKED" },
      });
      return {
        quarter: `Q${quarter}`,
        completed,
        expected,
        percentage: expected > 0 ? Math.round((completed / expected) * 100) : 0,
      };
    })
  );

  // Manager completion rates
  const managerStats = await prisma.user.findMany({
    where: { role: "MANAGER" },
    select: {
      id: true,
      name: true,
      directReports: {
        select: {
          goals: {
            where,
            select: {
              id: true,
              status: true,
              checkIns: { select: { id: true } },
            },
          },
        },
      },
    },
  });

  const managerCompletion = managerStats.map((manager) => {
    const allGoals = manager.directReports.flatMap((r) => r.goals);
    const totalGoals = allGoals.length;
    const approvedGoals = allGoals.filter((g) => g.status === "LOCKED").length;
    const checkInsLogged = allGoals.flatMap((g) => g.checkIns).length;

    return {
      managerId: manager.id,
      managerName: manager.name,
      totalGoals,
      approvedGoals,
      checkInsLogged,
      approvalRate: totalGoals > 0 ? Math.round((approvedGoals / totalGoals) * 100) : 0,
    };
  });

  return {
    summary: {
      totalEmployees,
      goalsSubmitted,
      goalsApproved,
      checkInsCompleted,
    },
    quarterCompletion,
    managerCompletion,
  };
}

async function getAnalytics(cycleId: string | null) {
  const where: any = { status: "LOCKED" };
  if (cycleId) where.cycleId = cycleId;

  // Goal distribution by thrust area
  const byThrustArea = await prisma.goal.groupBy({
    by: ["thrustAreaId"],
    where,
    _count: true,
  });

  const thrustAreas = await prisma.thrustArea.findMany();
  const thrustAreaMap = Object.fromEntries(thrustAreas.map((ta) => [ta.id, ta.name]));

  // Goal distribution by UoM
  const byUoM = await prisma.goal.groupBy({
    by: ["uom"],
    where,
    _count: true,
  });

  // Goal distribution by progress status
  const byProgressStatus = await prisma.goal.groupBy({
    by: ["progressStatus"],
    where,
    _count: true,
  });

  // Quarter-over-quarter achievement trends
  const achievements = await prisma.achievement.findMany({
    where: { goal: where },
    include: { goal: { select: { weightage: true } } },
  });

  const qoqTrends = [1, 2, 3, 4].map((quarter) => {
    const quarterAchievements = achievements.filter((a) => a.quarter === quarter);
    const avgScore =
      quarterAchievements.length > 0
        ? quarterAchievements.reduce((sum, a) => sum + (a.progressScore || 0), 0) /
          quarterAchievements.length
        : 0;

    return {
      quarter: `Q${quarter}`,
      averageScore: Math.round(avgScore),
      totalGoals: quarterAchievements.length,
    };
  });

  return {
    byThrustArea: byThrustArea.map((item) => ({
      thrustArea: thrustAreaMap[item.thrustAreaId] || "Unknown",
      count: item._count,
    })),
    byUoM: byUoM.map((item) => ({
      uom: item.uom,
      count: item._count,
    })),
    byProgressStatus: byProgressStatus.map((item) => ({
      status: item.progressStatus,
      count: item._count,
    })),
    qoqTrends,
  };
}

function convertToCSV(data: any[]): string {
  if (!data.length) return "";

  // Flatten nested objects for CSV
  const flattenObject = (obj: any, prefix = ""): any => {
    return Object.keys(obj).reduce((acc: any, key) => {
      const pre = prefix.length ? `${prefix}_` : "";
      if (typeof obj[key] === "object" && obj[key] !== null && !Array.isArray(obj[key])) {
        Object.assign(acc, flattenObject(obj[key], pre + key));
      } else if (Array.isArray(obj[key])) {
        acc[pre + key] = JSON.stringify(obj[key]);
      } else {
        acc[pre + key] = obj[key];
      }
      return acc;
    }, {});
  };

  const flattened = data.map((item) => flattenObject(item));
  const headers = Object.keys(flattened[0]);
  const rows = flattened.map((row) =>
    headers.map((header) => JSON.stringify(row[header] ?? "")).join(",")
  );

  return [headers.join(","), ...rows].join("\n");
}
