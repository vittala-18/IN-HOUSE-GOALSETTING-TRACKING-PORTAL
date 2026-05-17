// prisma/seed.ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Create Thrust Areas
  const thrustAreas = await Promise.all([
    prisma.thrustArea.create({ data: { name: "Revenue Growth", description: "Sales and revenue targets" } }),
    prisma.thrustArea.create({ data: { name: "Operational Excellence", description: "Efficiency and quality metrics" } }),
    prisma.thrustArea.create({ data: { name: "Customer Satisfaction", description: "NPS and customer success" } }),
    prisma.thrustArea.create({ data: { name: "People Development", description: "Team and skill building" } }),
    prisma.thrustArea.create({ data: { name: "Innovation", description: "New products and processes" } }),
  ]);

  // Create Users
  const hashedPassword = await bcrypt.hash("password123", 10);

  const admin = await prisma.user.create({
    data: {
      email: "admin@demo.com",
      name: "Admin User",
      password: hashedPassword,
      role: "ADMIN",
      department: "HR",
    },
  });

  const manager = await prisma.user.create({
    data: {
      email: "manager@demo.com",
      name: "Sarah Manager",
      password: hashedPassword,
      role: "MANAGER",
      department: "Sales",
    },
  });

  const employee = await prisma.user.create({
    data: {
      email: "employee@demo.com",
      name: "John Employee",
      password: hashedPassword,
      role: "EMPLOYEE",
      department: "Sales",
      managerId: manager.id,
    },
  });

  const employee2 = await prisma.user.create({
    data: {
      email: "jane@demo.com",
      name: "Jane Developer",
      password: hashedPassword,
      role: "EMPLOYEE",
      department: "Engineering",
      managerId: manager.id,
    },
  });

  // Create Performance Cycle
  const cycle = await prisma.performanceCycle.create({
    data: {
      name: "FY 2025-26",
      startDate: new Date("2025-04-01"),
      endDate: new Date("2026-03-31"),
      goalSettingStart: new Date("2025-05-01"),
      goalSettingEnd: new Date("2025-05-31"),
      q1CheckInStart: new Date("2025-07-01"),
      q1CheckInEnd: new Date("2025-07-31"),
      q2CheckInStart: new Date("2025-10-01"),
      q2CheckInEnd: new Date("2025-10-31"),
      q3CheckInStart: new Date("2026-01-01"),
      q3CheckInEnd: new Date("2026-01-31"),
      q4CheckInStart: new Date("2026-03-01"),
      q4CheckInEnd: new Date("2026-04-15"),
      isActive: true,
    },
  });

  // Create Sample Goals for Employee
  await prisma.goal.createMany({
    data: [
      {
        title: "Achieve quarterly sales target of ₹50L",
        description: "Close deals worth ₹50 lakhs in Q1",
        thrustAreaId: thrustAreas[0].id,
        employeeId: employee.id,
        cycleId: cycle.id,
        uom: "NUMERIC_MIN",
        target: 5000000,
        weightage: 40,
        status: "LOCKED",
        progressStatus: "ON_TRACK",
        approvedAt: new Date(),
        lockedAt: new Date(),
      },
      {
        title: "Maintain customer retention above 95%",
        description: "Ensure existing customers renew their contracts",
        thrustAreaId: thrustAreas[2].id,
        employeeId: employee.id,
        cycleId: cycle.id,
        uom: "PERCENTAGE_MIN",
        target: 95,
        weightage: 30,
        status: "LOCKED",
        progressStatus: "ON_TRACK",
        approvedAt: new Date(),
        lockedAt: new Date(),
      },
      {
        title: "Complete product training certification",
        description: "Get certified in all new product features",
        thrustAreaId: thrustAreas[3].id,
        employeeId: employee.id,
        cycleId: cycle.id,
        uom: "TIMELINE",
        target: 1,
        targetDate: new Date("2025-09-30"),
        weightage: 20,
        status: "LOCKED",
        progressStatus: "NOT_STARTED",
        approvedAt: new Date(),
        lockedAt: new Date(),
      },
      {
        title: "Zero escalations from key accounts",
        description: "Maintain service quality for top 10 accounts",
        thrustAreaId: thrustAreas[1].id,
        employeeId: employee.id,
        cycleId: cycle.id,
        uom: "ZERO_BASED",
        target: 0,
        weightage: 10,
        status: "LOCKED",
        progressStatus: "ON_TRACK",
        approvedAt: new Date(),
        lockedAt: new Date(),
      },
    ],
  });

  console.log("Database seeded successfully!");
  console.log("\nDemo Credentials:");
  console.log("  Admin:    admin@demo.com / password123");
  console.log("  Manager:  manager@demo.com / password123");
  console.log("  Employee: employee@demo.com / password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
