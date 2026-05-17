// src/app/(dashboard)/goals/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Plus, Eye, Edit } from "lucide-react";
import { formatDate, getUoMLabel } from "@/lib/utils";

export default async function GoalsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const activeCycle = await prisma.performanceCycle.findFirst({
    where: { isActive: true },
  });

  const goals = await prisma.goal.findMany({
    where: {
      employeeId: session.user.id,
      ...(activeCycle ? { cycleId: activeCycle.id } : {}),
    },
    include: {
      thrustArea: true,
      achievements: { orderBy: { quarter: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  const statusColors: Record<string, string> = {
    DRAFT: "bg-gray-100 text-gray-700",
    PENDING_APPROVAL: "bg-yellow-100 text-yellow-700",
    APPROVED: "bg-blue-100 text-blue-700",
    REJECTED: "bg-red-100 text-red-700",
    LOCKED: "bg-green-100 text-green-700",
  };

  const progressColors: Record<string, string> = {
    NOT_STARTED: "bg-gray-100 text-gray-700",
    ON_TRACK: "bg-blue-100 text-blue-700",
    COMPLETED: "bg-green-100 text-green-700",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">My Goals</h2>
          <p className="text-muted-foreground">
            {activeCycle ? `Cycle: ${activeCycle.name}` : "No active cycle"}
          </p>
        </div>
        <Link href="/goals/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create Goals
          </Button>
        </Link>
      </div>

      {goals.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">You haven't created any goals yet</p>
            <Link href="/goals/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Goal
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {goals.map((goal) => {
            const latestAchievement = goal.achievements[goal.achievements.length - 1];
            const progressScore = latestAchievement?.progressScore || 0;

            return (
              <Card key={goal.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">{goal.title}</CardTitle>
                      <CardDescription>
                        {goal.thrustArea.name} • {getUoMLabel(goal.uom)}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={statusColors[goal.status]}>
                        {goal.status.replace("_", " ")}
                      </Badge>
                      <Badge className={progressColors[goal.progressStatus]}>
                        {goal.progressStatus.replace("_", " ")}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Target</p>
                      <p className="font-medium">
                        {goal.uom === "TIMELINE" && goal.targetDate
                          ? formatDate(goal.targetDate)
                          : goal.target}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Weightage</p>
                      <p className="font-medium">{goal.weightage}%</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Progress</p>
                      <div className="flex items-center gap-2">
                        <Progress value={progressScore} className="flex-1" />
                        <span className="text-sm font-medium">{Math.round(progressScore)}%</span>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Link href={`/goals/${goal.id}`}>
                        <Button variant="outline" size="sm">
                          <Eye className="mr-2 h-4 w-4" />
                          View
                        </Button>
                      </Link>
                      {(goal.status === "DRAFT" || goal.status === "REJECTED") && (
                        <Link href={`/goals/${goal.id}/edit`}>
                          <Button variant="outline" size="sm">
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>

                  {goal.rejectionReason && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-700">
                        <strong>Rejection Reason:</strong> {goal.rejectionReason}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
