import { db } from "./db";
import { users, agencies, accounts, projects, timeLogs } from "@shared/schema";

export async function seedData() {
  console.log("Seeding database with initial data...");

  try {
    // Create Users
    const createdUsers = await db.insert(users).values([
      {
        username: "zach.west",
        email: "zach@patchops.io",
        firstName: "Zach",
        lastName: "West",
        password: "hashed_password", // In production, this would be properly hashed
        role: "admin",
        employmentType: "full-time"
      },
      {
        username: "alyssa.milligan",
        email: "alyssa@patchops.io",
        firstName: "Alyssa",
        lastName: "Milligan",
        password: "hashed_password",
        role: "manager",
        employmentType: "full-time"
      },
      {
        username: "angela.green",
        email: "angela@patchops.io",
        firstName: "Angela",
        lastName: "Green",
        password: "hashed_password",
        role: "user",
        employmentType: "full-time"
      },
      {
        username: "lianna.lifson",
        email: "lianna@patchops.io",
        firstName: "Lianna",
        lastName: "Lifson",
        password: "hashed_password",
        role: "user",
        employmentType: "full-time"
      },
      {
        username: "justin.fligg",
        email: "justin@patchops.io",
        firstName: "Justin",
        lastName: "Fligg",
        password: "hashed_password",
        role: "user",
        employmentType: "full-time"
      },
      {
        username: "alex.kemple",
        email: "alex@patchops.io",
        firstName: "Alex",
        lastName: "Kemple",
        password: "hashed_password",
        role: "user",
        employmentType: "full-time"
      },
      {
        username: "ashlynn.owen",
        email: "ashlynn@patchops.io",
        firstName: "Ashlynn",
        lastName: "Owen",
        password: "hashed_password",
        role: "user",
        employmentType: "full-time"
      }
    ]).returning();

    // Create Agencies
    const createdAgencies = await db.insert(agencies).values([
      {
        name: "PatchOps",
        description: "Technology solutions and operations consulting agency",
        monthlyBillingTarget: "120000.00",
        contactEmail: "contact@patchops.com",
        contactPhone: "+1 (555) 123-4567"
      },
      {
        name: "Instrumental Group",
        description: "Strategic consulting and implementation services",
        monthlyBillingTarget: "95000.00",
        contactEmail: "hello@instrumentalgroup.com",
        contactPhone: "+1 (555) 234-5678"
      },
      {
        name: "New Edge Growth",
        description: "Growth-focused marketing and technology solutions",
        monthlyBillingTarget: "150000.00",
        contactEmail: "team@newedgegrowth.com",
        contactPhone: "+1 (555) 345-6789"
      },
      {
        name: "Sayer Strategies",
        description: "Business strategy and digital transformation",
        monthlyBillingTarget: "110000.00",
        contactEmail: "info@sayerstrategies.com",
        contactPhone: "+1 (555) 456-7890"
      },
      {
        name: "Penguin Strategies",
        description: "Creative marketing and brand development",
        monthlyBillingTarget: "85000.00",
        contactEmail: "creative@penguinstrategies.com",
        contactPhone: "+1 (555) 567-8901"
      }
    ]).returning();

    // Create a map for easy lookup
    const agencyMap = createdAgencies.reduce((map, agency) => {
      map[agency.name] = agency.id;
      return map;
    }, {} as Record<string, string>);

    // Create Accounts
    const createdAccounts = await db.insert(accounts).values([
      // PatchOps accounts
      {
        agencyId: agencyMap["PatchOps"],
        name: "Hamilton Technologies",
        description: "Technology consulting and software development company",
        contactEmail: "projects@hamilton-tech.com",
        contactPhone: "+1 (555) 111-1111"
      },
      {
        agencyId: agencyMap["PatchOps"],
        name: "Junkluggers",
        description: "Eco-friendly junk removal and donation services",
        contactEmail: "marketing@junkluggers.com",
        contactPhone: "+1 (555) 222-2222"
      },
      {
        agencyId: agencyMap["PatchOps"],
        name: "Talroo",
        description: "Job search and recruitment platform",
        contactEmail: "partnerships@talroo.com",
        contactPhone: "+1 (555) 333-3333"
      },
      {
        agencyId: agencyMap["PatchOps"],
        name: "Southeastern Equipment",
        description: "Heavy equipment sales and rental company",
        contactEmail: "digital@southeastern-equipment.com",
        contactPhone: "+1 (555) 444-4444"
      },
      // Instrumental Group accounts
      {
        agencyId: agencyMap["Instrumental Group"],
        name: "Huntin Fool",
        description: "Hunting and outdoor recreation membership service",
        contactEmail: "tech@huntinfool.com",
        contactPhone: "+1 (555) 555-5555"
      },
      {
        agencyId: agencyMap["Instrumental Group"],
        name: "Waites Systems",
        description: "Enterprise software solutions and consulting",
        contactEmail: "projects@waitessystems.com",
        contactPhone: "+1 (555) 666-6666"
      },
      // Sayer Strategies accounts
      {
        agencyId: agencyMap["Sayer Strategies"],
        name: "Alliance Power Consulting",
        description: "Energy sector consulting and analytics",
        contactEmail: "digital@alliancepower.com",
        contactPhone: "+1 (555) 777-7777"
      },
      {
        agencyId: agencyMap["Sayer Strategies"],
        name: "Cohesion",
        description: "Team collaboration and productivity software",
        contactEmail: "development@cohesion.app",
        contactPhone: "+1 (555) 888-8888"
      },
      // Penguin Strategies accounts
      {
        agencyId: agencyMap["Penguin Strategies"],
        name: "Enprotech",
        description: "Environmental technology and consulting",
        contactEmail: "innovation@enprotech.com",
        contactPhone: "+1 (555) 999-9999"
      },
      {
        agencyId: agencyMap["Penguin Strategies"],
        name: "Lettuce",
        description: "Sustainable agriculture and food technology",
        contactEmail: "partnerships@lettuce.tech",
        contactPhone: "+1 (555) 000-0000"
      },
      // New Edge Growth accounts
      {
        agencyId: agencyMap["New Edge Growth"],
        name: "NextWorld",
        description: "Virtual reality and metaverse solutions",
        contactEmail: "business@nextworld.vr",
        contactPhone: "+1 (555) 111-2222"
      },
      {
        agencyId: agencyMap["New Edge Growth"],
        name: "Actabl",
        description: "Restaurant technology and POS systems",
        contactEmail: "integrations@actabl.com",
        contactPhone: "+1 (555) 333-4444"
      }
    ]).returning();

    // Create a map for account lookup
    const accountMap = createdAccounts.reduce((map, account) => {
      map[account.name] = account.id;
      return map;
    }, {} as Record<string, string>);

    // Create Projects
    await db.insert(projects).values([
      {
        agencyId: agencyMap["PatchOps"],
        accountId: accountMap["Hamilton Technologies"],
        name: "HubSpot Implementation + Data Migration",
        description: "Complete HubSpot CRM implementation with legacy data migration and custom workflows",
        status: "active",
        startDate: new Date("2024-10-01"),
        endDate: new Date("2024-12-31"),
        estimatedHours: "240.00"
      },
      {
        agencyId: agencyMap["PatchOps"],
        accountId: accountMap["Talroo"],
        name: "HubSpot Implementation + Data Migration",
        description: "HubSpot setup for recruitment workflows with job posting integration",
        status: "active",
        startDate: new Date("2024-11-01"),
        endDate: new Date("2025-01-31"),
        estimatedHours: "180.00"
      },
      {
        agencyId: agencyMap["Instrumental Group"],
        accountId: accountMap["Huntin Fool"],
        name: "HubSpot Implementation + Custom UI",
        description: "HubSpot implementation with custom member portal and branded interface",
        status: "active",
        startDate: new Date("2024-09-15"),
        endDate: new Date("2024-12-15"),
        estimatedHours: "320.00"
      },
      {
        agencyId: agencyMap["Sayer Strategies"],
        accountId: accountMap["Cohesion"],
        name: "Custom UI Extension + Customer Portal Update",
        description: "Custom user interface development and customer portal modernization",
        status: "active",
        startDate: new Date("2024-10-15"),
        endDate: new Date("2025-02-15"),
        estimatedHours: "280.00"
      },
      {
        agencyId: agencyMap["PatchOps"],
        accountId: accountMap["Junkluggers"],
        name: "HubSpot Appointment Center",
        description: "Custom appointment scheduling system integrated with HubSpot CRM",
        status: "active",
        startDate: new Date("2024-11-15"),
        endDate: new Date("2025-01-15"),
        estimatedHours: "160.00"
      }
    ]);

    // Create some sample time logs
    await db.insert(timeLogs).values([
      {
        userId: createdUsers[0].id, // Zach West
        agencyId: agencyMap["PatchOps"],
        accountId: accountMap["Hamilton Technologies"],
        projectId: null, // General work
        taskId: null,
        taskName: "Client Meetings",
        description: "Initial client meeting and project planning discussion",
        actualHours: "2.5",
        billedHours: "2.0",
        tier: "tier1",
        logDate: new Date("2024-12-18"),
        startTime: new Date("2024-12-18T09:00:00Z"),
        endTime: new Date("2024-12-18T11:30:00Z")
      },
      {
        userId: createdUsers[1].id, // Alyssa Milligan
        agencyId: agencyMap["PatchOps"],
        accountId: accountMap["Junkluggers"],
        projectId: null,
        taskId: null,
        taskName: "Project Management",
        description: "Appointment center requirements gathering and wireframing",
        actualHours: "4.0",
        billedHours: "4.0",
        tier: "tier1",
        logDate: new Date("2024-12-18"),
        startTime: new Date("2024-12-18T13:00:00Z"),
        endTime: new Date("2024-12-18T17:00:00Z")
      },
      {
        userId: createdUsers[2].id, // Angela Green
        agencyId: agencyMap["Instrumental Group"],
        accountId: accountMap["Huntin Fool"],
        projectId: null,
        taskId: null,
        taskName: "Building",
        description: "Custom UI development for member portal login flow",
        actualHours: "6.0",
        billedHours: "5.5",
        tier: "tier2",
        logDate: new Date("2024-12-17"),
        startTime: new Date("2024-12-17T08:30:00Z"),
        endTime: new Date("2024-12-17T14:30:00Z")
      },
      {
        userId: createdUsers[3].id, // Lianna Lifson
        agencyId: agencyMap["Sayer Strategies"],
        accountId: accountMap["Cohesion"],
        projectId: null,
        taskId: null,
        taskName: "Testing",
        description: "Customer portal UI testing and bug fixes",
        actualHours: "3.5",
        billedHours: "3.5",
        tier: "tier1",
        logDate: new Date("2024-12-17"),
        startTime: new Date("2024-12-17T10:00:00Z"),
        endTime: new Date("2024-12-17T13:30:00Z")
      },
      {
        userId: createdUsers[4].id, // Justin Fligg
        agencyId: agencyMap["New Edge Growth"],
        accountId: accountMap["Actabl"],
        projectId: null,
        taskId: null,
        taskName: "Documentation",
        description: "Restaurant POS integration research and documentation",
        actualHours: "5.0",
        billedHours: "4.5",
        tier: "tier1",
        logDate: new Date("2024-12-16"),
        startTime: new Date("2024-12-16T09:00:00Z"),
        endTime: new Date("2024-12-16T14:00:00Z")
      },
      {
        userId: createdUsers[0].id, // Zach West
        agencyId: agencyMap["PatchOps"],
        accountId: accountMap["Talroo"],
        projectId: null,
        taskId: null,
        taskName: "Project Management",
        description: "HubSpot data migration planning and schema design",
        actualHours: "1.5",
        billedHours: "1.5",
        tier: "tier1",
        logDate: new Date("2024-12-16"),
        startTime: new Date("2024-12-16T15:00:00Z"),
        endTime: new Date("2024-12-16T16:30:00Z")
      }
    ]);

    console.log("Database seeded successfully!");
    console.log(`Created ${createdUsers.length} users`);
    console.log(`Created ${createdAgencies.length} agencies`);
    console.log(`Created ${createdAccounts.length} accounts`);
    console.log("Created 5 projects");
    console.log("Created 6 sample time log entries");

  } catch (error) {
    console.error("Error seeding database:", error);
    throw error;
  }
}

// Run seed function
seedData().then(() => {
  console.log("Seed completed");
  process.exit(0);
}).catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});