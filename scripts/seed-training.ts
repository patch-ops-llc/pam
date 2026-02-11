/**
 * Seed script for the HubSpot Technical Training Program.
 * 
 * Usage:
 *   1. Via Admin UI: Go to /training/admin, click "Import Seed Data", 
 *      paste the contents of scripts/seed-hubspot-training.json
 *   2. Via API: POST /api/training/seed with the JSON body
 *   3. Via this script: npx tsx scripts/seed-training.ts
 * 
 * Requires DATABASE_URL environment variable to be set.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const seedDataPath = path.join(__dirname, "seed-hubspot-training.json");
  const seedData = JSON.parse(fs.readFileSync(seedDataPath, "utf-8"));

  const baseUrl = process.env.API_URL || "http://localhost:5000";

  console.log("Seeding HubSpot Technical Training Program...");
  console.log(`Target: ${baseUrl}/api/training/seed`);

  const response = await fetch(`${baseUrl}/api/training/seed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(seedData),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`Failed to seed: ${response.status} ${text}`);
    process.exit(1);
  }

  const result = await response.json();
  console.log("Success!", result);
}

main().catch(console.error);
