import { Pool, neonConfig } from '@neondatabase/serverless';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import ws from 'ws';

// Configure WebSocket for Neon
neonConfig.webSocketConstructor = ws;

// Get database URL and export directory from command line args
const dbUrl = process.argv[2] || process.env.DATABASE_URL;
const exportDir = process.argv[3];

if (!dbUrl || !exportDir) {
  console.error('Usage: tsx scripts/import-database.ts [DATABASE_URL] [EXPORT_DIR]');
  console.error('Example: tsx scripts/import-database.ts $DATABASE_URL ./database_exports/2024-10-15');
  process.exit(1);
}

if (!existsSync(exportDir)) {
  console.error(`Export directory not found: ${exportDir}`);
  process.exit(1);
}

const pool = new Pool({ connectionString: dbUrl });

// Import order matters due to foreign key constraints
const tableImportOrder = [
  'users',
  'branding_config',
  'agencies',
  'accounts',
  'projects',
  'workstreams',
  'workstream_assignments',
  'tasks',
  'time_logs',
  'calendar_connections',
  'calendars',
  'calendar_events',
  'slack_configurations',
  'quota_configs',
  'penguin_hours_tracker',
  'forecast_invoices',
  'forecast_expenses',
  'forecast_scenarios',
  'project_team_members',
  'user_availability',
  'proposals',
  'pipeline_stages',
  'leads',
  'deals',
];

async function importDatabase() {
  console.log(`Importing database from: ${exportDir}\n`);
  
  const stats = {
    imported: 0,
    skipped: 0,
    errors: 0,
  };

  for (const tableName of tableImportOrder) {
    const filePath = join(exportDir, `${tableName}.json`);
    
    if (!existsSync(filePath)) {
      console.log(`⊘ ${tableName}: file not found, skipping`);
      stats.skipped++;
      continue;
    }

    try {
      const data = JSON.parse(readFileSync(filePath, 'utf-8'));
      
      if (!Array.isArray(data) || data.length === 0) {
        console.log(`⊘ ${tableName}: no data to import`);
        stats.skipped++;
        continue;
      }

      // Get column names from first row
      const columns = Object.keys(data[0]);
      
      // Clear existing data (optional - comment this out if you want to append instead)
      await pool.query(`TRUNCATE TABLE ${tableName} CASCADE`);
      
      // Insert each row
      for (const row of data) {
        const values = columns.map(col => row[col]);
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
        const query = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
        
        await pool.query(query, values);
      }
      
      console.log(`✓ ${tableName}: imported ${data.length} records`);
      stats.imported += data.length;
    } catch (error: any) {
      console.error(`✗ ${tableName}: ${error.message}`);
      stats.errors++;
    }
  }

  console.log(`\n✓ Import complete!`);
  console.log(`Records imported: ${stats.imported}`);
  console.log(`Tables skipped: ${stats.skipped}`);
  console.log(`Errors: ${stats.errors}`);

  await pool.end();
}

importDatabase().catch((error) => {
  console.error('Import failed:', error);
  process.exit(1);
});
