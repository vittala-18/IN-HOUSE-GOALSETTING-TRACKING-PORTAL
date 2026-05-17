// src/app/(dashboard)/approvals/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Check, X, RotateCcw, Edit2 } from "lucide-react";
import { getUoMLabel } from "@/lib/utils";

interface Goal {
  id: string;
  title: string;
  description: string;
  target: number;
  weightage: number;
  uom: string;
  status: string;
  employee: { id: string; name: string; email: string };
  thrustArea: { name: string };
}

export default function ApprovalsPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [editedTarget, setEditedTarget] = useState<number>(0);
  const [editedWeightage, setEditedWeightage] = useState<number>(0);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);

  useEffect(() => {
    fetchPendingGoals();
  }, []);

  const fetchPendingGoals = async () => {
    try {
      const response = await fetch("/api/goals?status=PENDING_APPROVAL");
      const data = await response.json();
      setGoals(data.filter((g: Goal) => g.status === "PENDING_APPROVAL"));
    } catch (error) {
      console.error("Failed to fetch goals:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApproval = async (goalId: string, action: "approve" | "reject" | "return", modifications?: any) => {
    try {
      const response = await fetch(`/api/goals/${goalId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          reason: action !== "approve" ? rejectReason : undefined,
          modifications,
        }),
      });

      if (!response.ok) throw new Error("Failed to process approval");

      toast({
        title: action === "approve" ? "Goal approved" : action === "reject" ? "Goal rejected" : "Goal returned",
        description: action === "approve"
          ? "The goal has been approved and locked"
          : "The employee has been notified",
      });

      // Remove from list
      setGoals(goals.filter((g) => g.id !== goalId));
      setShowRejectDialog(false);
      setShowEditDialog(false);
      setRejectReason("");
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to process approval",
      });
    }
  };

  const openEditDialog = (goal: Goal) => {
    setSelectedGoal(goal);
    setEditedTarget(goal.target);
    setEditedWeightage(goal.weightage);
    setShowEditDialog(true);
  };

  const handleApproveWithEdits = () => {
    if (!selectedGoal) return;
    handleApproval(selectedGoal.id, "approve", [
      {
        goalId: selectedGoal.id,
        target: editedTarget,
        weightage: editedWeightage,
      },
    ]);
  };

  // Group goals by employee
  const goalsByEmployee = goals.reduce((acc, goal) => {
    const empId = goal.employee.id;
    if (!acc[empId]) {
      acc[empId] = {
        employee: goal.employee,
        goals: [],
      };
    }
    acc[empId].goals.push(goal);
    return acc;
  }, {} as Record<string, { employee: any; goals: Goal[] }>);

  if (isLoading) {
    return <div className="flex justify-center py-12">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Pending Approvals</h2>
        <p className="text-muted-foreground">Review and approve team member goals</p>
      </div>

      {Object.keys(goalsByEmployee).length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Check className="h-12 w-12 text-green-500 mb-4" />
            <p className="text-muted-foreground">No pending approvals</p>
          </CardContent>
        </Card>
      ) : (
        Object.values(goalsByEmployee).map(({ employee, goals: empGoals }) => (
          <Card key={employee.id}>
            <CardHeader>
              <CardTitle>{employee.name}</CardTitle>
              <CardDescription>{employee.email}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {empGoals.map((goal) => (
                  <div
                    key={goal.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{goal.title}</h4>
                        <Badge variant="outline">{goal.thrustArea.name}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {getUoMLabel(goal.uom as any)} • Target: {goal.target} • Weightage: {goal.weightage}%
                      </p>
                      {goal.description && (
                        <p className="text-sm mt-2">{goal.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(goal)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedGoal(goal);
                          setShowRejectDialog(true);
                        }}
                      >
                        <RotateCcw className="h-4 w-4 mr-1" />
                        Return
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          setSelectedGoal(goal);
                          setShowRejectDialog(true);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleApproval(goal.id, "approve")}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))
      )}

      {/* Reject/Return Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Return Goal for Rework</DialogTitle>
            <DialogDescription>
              Provide feedback to help the employee improve their goal
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Enter your feedback..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => selectedGoal && handleApproval(selectedGoal.id, "reject")}
              disabled={!rejectReason.trim()}
            >
              Return for Rework
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit & Approve Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit & Approve Goal</DialogTitle>
            <DialogDescription>
              Modify target or weightage before approving
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Target</label>
              <Input
                type="number"
                value={editedTarget}
                onChange={(e) => setEditedTarget(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Weightage (%)</label>
              <Input
                type="number"
                min="10"
                max="100"
                value={editedWeightage}
                onChange={(e) => setEditedWeightage(Number(e.target.value))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleApproveWithEdits}>
              Approve with Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
