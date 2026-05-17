// src/app/(dashboard)/goals/new/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Plus, Trash2, Save, Send, AlertCircle } from "lucide-react";
import { UnitOfMeasurement } from "@prisma/client";
import { getUoMLabel } from "@/lib/utils";

const goalSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(200),
  description: z.string().max(1000).optional(),
  thrustAreaId: z.string().min(1, "Thrust area is required"),
  uom: z.nativeEnum(UnitOfMeasurement),
  target: z.number().positive("Target must be positive"),
  targetDate: z.string().optional(),
  weightage: z.number().min(10, "Minimum 10%").max(100, "Maximum 100%"),
});

const formSchema = z.object({
  goals: z
    .array(goalSchema)
    .min(1, "At least one goal is required")
    .max(8, "Maximum 8 goals allowed"),
});

type FormData = z.infer<typeof formSchema>;

export default function NewGoalPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [thrustAreas, setThrustAreas] = useState<{ id: string; name: string }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      goals: [
        {
          title: "",
          description: "",
          thrustAreaId: "",
          uom: "NUMERIC_MIN",
          target: 0,
          weightage: 100,
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "goals",
  });

  const watchedGoals = watch("goals");
  const totalWeightage = watchedGoals.reduce((sum, g) => sum + (g.weightage || 0), 0);
  const isWeightageValid = Math.abs(totalWeightage - 100) < 0.01;

  useEffect(() => {
    // Fetch thrust areas
    fetch("/api/thrust-areas")
      .then((res) => res.json())
      .then(setThrustAreas)
      .catch(console.error);
  }, []);

  const onSubmit = async (data: FormData, submit: boolean) => {
    if (!isWeightageValid) {
      toast({
        variant: "destructive",
        title: "Invalid weightage",
        description: "Total weightage must equal 100%",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goals: data.goals, submit }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create goals");
      }

      toast({
        title: submit ? "Goals submitted" : "Goals saved",
        description: submit
          ? "Your goals have been submitted for approval"
          : "Your goals have been saved as draft",
      });

      router.push("/goals");
      router.refresh();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const addGoal = () => {
    if (fields.length >= 8) {
      toast({
        variant: "destructive",
        title: "Maximum goals reached",
        description: "You can only have up to 8 goals",
      });
      return;
    }
    append({
      title: "",
      description: "",
      thrustAreaId: "",
      uom: "NUMERIC_MIN",
      target: 0,
      weightage: 0,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Create Goals</h2>
        <p className="text-muted-foreground">
          Define your performance goals for this cycle
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Goal Sheet</CardTitle>
              <CardDescription>
                Add up to 8 goals with a total weightage of 100%
              </CardDescription>
            </div>
            <div
              className={`px-4 py-2 rounded-lg ${
                isWeightageValid
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              <span className="font-medium">Total: {totalWeightage}%</span>
              {!isWeightageValid && (
                <span className="ml-2 text-sm">(must equal 100%)</span>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-6">
            {fields.map((field, index) => (
              <Card key={field.id} className="border-dashed">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Goal {index + 1}</CardTitle>
                    {fields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => remove(index)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor={`goals.${index}.title`}>Goal Title</Label>
                      <Input
                        {...register(`goals.${index}.title`)}
                        placeholder="e.g., Increase quarterly sales"
                      />
                      {errors.goals?.[index]?.title && (
                        <p className="text-sm text-red-500">
                          {errors.goals[index]?.title?.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`goals.${index}.thrustAreaId`}>Thrust Area</Label>
                      <Select
                        value={watchedGoals[index]?.thrustAreaId}
                        onValueChange={(value) =>
                          setValue(`goals.${index}.thrustAreaId`, value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select thrust area" />
                        </SelectTrigger>
                        <SelectContent>
                          {thrustAreas.map((area) => (
                            <SelectItem key={area.id} value={area.id}>
                              {area.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`goals.${index}.description`}>Description</Label>
                    <Textarea
                      {...register(`goals.${index}.description`)}
                      placeholder="Describe the goal and success criteria..."
                      rows={3}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor={`goals.${index}.uom`}>Unit of Measurement</Label>
                      <Select
                        value={watchedGoals[index]?.uom}
                        onValueChange={(value) =>
                          setValue(`goals.${index}.uom`, value as UnitOfMeasurement)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.values(UnitOfMeasurement).map((uom) => (
                            <SelectItem key={uom} value={uom}>
                              {getUoMLabel(uom)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`goals.${index}.target`}>Target</Label>
                      <Input
                        type="number"
                        {...register(`goals.${index}.target`, { valueAsNumber: true })}
                        placeholder="100"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`goals.${index}.weightage`}>Weightage (%)</Label>
                      <Input
                        type="number"
                        min="10"
                        max="100"
                        {...register(`goals.${index}.weightage`, { valueAsNumber: true })}
                      />
                      {errors.goals?.[index]?.weightage && (
                        <p className="text-sm text-red-500">
                          {errors.goals[index]?.weightage?.message}
                        </p>
                      )}
                    </div>
                  </div>

                  {watchedGoals[index]?.uom === "TIMELINE" && (
                    <div className="space-y-2">
                      <Label htmlFor={`goals.${index}.targetDate`}>Target Date</Label>
                      <Input
                        type="date"
                        {...register(`goals.${index}.targetDate`)}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}

            {fields.length < 8 && (
              <Button type="button" variant="outline" onClick={addGoal} className="w-full">
                <Plus className="mr-2 h-4 w-4" />
                Add Goal
              </Button>
            )}

            {!isWeightageValid && (
              <div className="flex items-center gap-2 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <AlertCircle className="h-5 w-5 text-yellow-600" />
                <p className="text-sm text-yellow-700">
                  Total weightage is {totalWeightage}%. Adjust weightages to equal 100%.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleSubmit((data) => onSubmit(data, false))}
                disabled={isSubmitting}
              >
                <Save className="mr-2 h-4 w-4" />
                Save Draft
              </Button>
              <Button
                type="button"
                onClick={handleSubmit((data) => onSubmit(data, true))}
                disabled={isSubmitting || !isWeightageValid}
              >
                <Send className="mr-2 h-4 w-4" />
                Submit for Approval
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
