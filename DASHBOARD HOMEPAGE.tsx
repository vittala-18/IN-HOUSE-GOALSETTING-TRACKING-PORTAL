// src/app/(dashboard)/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Target, CheckCircle, Clock, AlertCircle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const activeCycle = await prisma.performanceCycle.findFirst({
    where: { isActive: true },
  });

  // Get user's goals or team goals based on role
  const goalsQuery = {
    where: {
      ...(session.user.role === "EMPLOYEE"
        ? { employeeId: session.user.id }
        : session.user.role === "MANAGER"
        ? { employee: { managerId: session.user.id } }
        : {}),
      ...(activeCycle ? { cycleId: activeCycle.id } : {}),
    },
    include: {
      achievements: true,
      employee: { select: { name: true } },
    },
  };

  const goals = await prisma.goal.findMany(goalsQuery);

  const stats = {
    total: goals.length,
    completed: goals.filter((g) => g.progressStatus === "COMPLETED").length,
    onTrack: goals.filter((g) => g.progressStatus === "ON_TRACK").length,
    notStarted: goals.filter((g) => g.progressStatus === "NOT_STARTED").length,
    pendingApproval: goals.filter((g) => g.status === "PENDING_APPROVAL").length,
  };

  const avgProgress =
    goals.length > 0
      ? Math.round(
          goals.reduce((sum, g) => {
            const latestAchievement = g.achievements.sort((a, b) => b.quarter - a.quarter)[0];
            return sum + (latestAchievement?.progressScore || 0);
          }, 0) / goals.length
        )
      : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground">
            {activeCycle ? `Active Cycle: ${activeCycle.name}` : "No active cycle"}
          </p>
        </div>
        {session.user.role === "EMPLOYEE" && (
          <Link href="/goals/new">
            <Button>
              <Target className="mr-2 h-4 w-4" />
              Create Goals
            </Button>
          </Link>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Goals</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              {session.user.role === "EMPLOYEE" ? "Your goals" : "Team goals"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completed}</div>
            <Progress value={(stats.completed / stats.total) * 100 || 0} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">On Track</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.onTrack}</div>
            <p className="text-xs text-muted-foreground">In progress</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Approval</CardTitle>
            <AlertCircle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingApproval}</div>
            <p className="text-xs text-muted-foreground">Awaiting manager review</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Overall Progress</CardTitle>
            <CardDescription>Average achievement across all goals</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-8">
              <div className="relative h-40 w-40">
                <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
                  <circle
                    className="text-muted stroke-current"
                    strokeWidth="8"
                    fill="transparent"
                    r="42"
                    cx="50"
                    cy="50"
                  />
                  <circle
                    className="text-primary stroke-current"
                    strokeWidth="8"
                    strokeLinecap="round"
                    fill="transparent"
                    r="42"
                    cx="50"
                    cy="50"
                    style={{
                      strokeDasharray: `${avgProgress * 2.64} 264`,
                    }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-3xl font-bold">{avgProgress}%</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Goals</CardTitle>
            <CardDescription>Latest updates from your goal sheet</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {goals.slice(0, 5).map((goal) => (
                <div key={goal.id} className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{goal.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {session.user.role !== "EMPLOYEE" && `${goal.employee.name} • `}
                      {goal.weightage}% weightage
                    </p>
                  </div>
                  <div className="ml-4">
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        goal.progressStatus === "COMPLETED"
                          ? "bg-green-100 text-green-700"
                          : goal.progressStatus === "ON_TRACK"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {goal.progressStatus.replace("_", " ")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
