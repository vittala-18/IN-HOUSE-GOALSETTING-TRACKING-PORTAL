// src/app/(dashboard)/check-ins/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Save, MessageSquare } from "lucide-react";
import { getCurrentQuarter, getUoMLabel } from "@/lib/utils";

interface Goal {
  id: string;
  title: string;
  target: number;
  uom: string;
  weightage: number;
  progressStatus: string;
  achievements: {
    quarter: number;
    actualValue: number;
    progressScore: number;
    notes: string;
  }[];
  checkIns: {
    quarter: number;
    comments: {
      content: string;
      isManager: boolean;
      author: { name: string };
      createdAt: string;
    }[];
  }[];
}

export default function CheckInsPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeQuarter, setActiveQuarter] = useState(getCurrentQuarter());
  const [achievementValues, setAchievementValues] = useState<Record<string, number>>({});
  const [progressStatuses, setProgressStatuses] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [comment, setComment] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchGoals();
  }, []);

  const fetchGoals = async () => {
    try {
      const response = await fetch("/api/goals?status=LOCKED");
      const data = await response.json();
      setGoals(data);

      // Initialize form values from existing achievements
      const values: Record<string, number> = {};
      const statuses: Record<string, string> = {};
      const notesMap: Record<string, string> = {};

      data.forEach((goal: Goal) => {
        const achievement = goal.achievements.find((a) => a.quarter === activeQuarter);
        if (achievement) {
          values[goal.id] = achievement.actualValue;
          notesMap[goal.id] = achievement.notes || "";
        }
        statuses[goal.id] = goal.progressStatus;
      });

      setAchievementValues(values);
      setProgressStatuses(statuses);
      setNotes(notesMap);
    } catch (error) {
      console.error("Failed to fetch goals:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveAchievement = async (goalId: string) => {
    try {
      const response = await fetch(`/api/goals/${goalId}/achievements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quarter: activeQuarter,
          actualValue: achievementValues[goalId],
          notes: notes[goalId],
          progressStatus: progressStatuses[goalId],
        }),
      });

      if (!response.ok) throw new Error("Failed to save achievement");

      toast({
        title: "Achievement saved",
        description: `Q${activeQuarter} progress has been recorded`,
      });

      fetchGoals();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save achievement",
      });
    }
  };

  const addComment = async (goalId: string) => {
    if (!comment[goalId]?.trim()) return;

    try {
      const response = await fetch("/api/check-ins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goalId,
          quarter: activeQuarter,
          comment: comment[goalId],
        }),
      });

      if (!response.ok) throw new Error("Failed to add comment");

      toast({
        title: "Comment added",
        description: "Your check-in comment has been saved",
      });

      setComment((prev) => ({ ...prev, [goalId]: "" }));
      fetchGoals();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to add comment",
      });
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-12">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Quarterly Check-ins</h2>
          <p className="text-muted-foreground">
            Log your achievement progress and participate in check-in discussions
          </p>
        </div>
      </div>

      <Tabs
        value={`Q${activeQuarter}`}
        onValueChange={(v) => setActiveQuarter(parseInt(v.replace("Q", "")))}
      >
        <TabsList>
          <TabsTrigger value="Q1">Q1 (Apr-Jun)</TabsTrigger>
          <TabsTrigger value="Q2">Q2 (Jul-Sep)</TabsTrigger>
          <TabsTrigger value="Q3">Q3 (Oct-Dec)</TabsTrigger>
          <TabsTrigger value="Q4">Q4 (Jan-Mar)</TabsTrigger>
        </TabsList>

        {[1, 2, 3, 4].map((quarter) => (
          <TabsContent key={quarter} value={`Q${quarter}`}>
            <div className="space-y-4">
              {goals.map((goal) => {
                const achievement = goal.achievements.find((a) => a.quarter === quarter);
                const checkIn = goal.checkIns.find((c) => c.quarter === quarter);

                return (
                  <Card key={goal.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{goal.title}</CardTitle>
                          <CardDescription>
                            {getUoMLabel(goal.uom as any)} • Target: {goal.target} • Weightage: {goal.weightage}%
                          </CardDescription>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Progress Score</p>
                          <p className="text-2xl font-bold">
                            {achievement?.progressScore?.toFixed(0) || 0}%
                          </p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-3">
                        <div>
                          <label className="text-sm font-medium">Actual Achievement</label>
                          <Input
                            type="number"
                            value={achievementValues[goal.id] || ""}
                            onChange={(e) =>
                              setAchievementValues((prev) => ({
                                ...prev,
                                [goal.id]: Number(e.target.value),
                              }))
                            }
                            placeholder="Enter actual value"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Status</label>
                          <Select
                            value={progressStatuses[goal.id]}
                            onValueChange={(value) =>
                              setProgressStatuses((prev) => ({ ...prev, [goal.id]: value }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="NOT_STARTED">Not Started</SelectItem>
                              <SelectItem value="ON_TRACK">On Track</SelectItem>
                              <SelectItem value="COMPLETED">Completed</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-end">
                          <Button onClick={() => saveAchievement(goal.id)} className="w-full">
                            <Save className="mr-2 h-4 w-4" />
                            Save Progress
                          </Button>
                        </div>
                      </div>

                      <div>
                        <label className="text-sm font-medium">Notes</label>
                        <Textarea
                          value={notes[goal.id] || ""}
                          onChange={(e) =>
                            setNotes((prev) => ({ ...prev, [goal.id]: e.target.value }))
                          }
                          placeholder="Add notes about your progress..."
                          rows={2}
                        />
                      </div>

                      <div className="border-t pt-4">
                        <h4 className="font-medium mb-3 flex items-center gap-2">
                          <MessageSquare className="h-4 w-4" />
                          Check-in Discussion
                        </h4>

                        {checkIn?.comments && checkIn.comments.length > 0 && (
                          <div className="space-y-3 mb-4">
                            {checkIn.comments.map((c, idx) => (
                              <div
                                key={idx}
                                className={`p-3 rounded-lg ${
                                  c.isManager ? "bg-blue-50 border-l-4 border-blue-500" : "bg-gray-50"
                                }`}
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-medium text-sm">
                                    {c.author.name}
                                    {c.isManager && " (Manager)"}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {new Date(c.createdAt).toLocaleDateString()}
                                  </span>
                                </div>
                                <p className="text-sm">{c.content}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="flex gap-2">
                          <Textarea
                            value={comment[goal.id] || ""}
                            onChange={(e) =>
                              setComment((prev) => ({ ...prev, [goal.id]: e.target.value }))
                            }
                            placeholder="Add a check-in comment..."
                            rows={2}
                            className="flex-1"
                          />
                          <Button
                            onClick={() => addComment(goal.id)}
                            disabled={!comment[goal.id]?.trim()}
                          >
                            Post
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
