import { Pool, neonConfig } from '@neondatabase/serverless';
import * as schema from '../shared/schema';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import ws from 'ws';

// Configure WebSocket for Neon
neonConfig.webSocketConstructor = ws;

// Get database URL from command line args or environment
const dbUrl = process.argv[2] || process.env.DATABASE_URL;

if (!dbUrl) {
  console.error('Usage: tsx scripts/export-database.ts [DATABASE_URL]');
  console.error('Or set DATABASE_URL environment variable');
  process.exit(1);
}

const pool = new Pool({ connectionString: dbUrl });

// List of all tables to export (matching your schema)
const tables = [
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

async function exportDatabase() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
  const exportDir = join(process.cwd(), 'database_exports', timestamp);
  
  // Create export directory
  mkdirSync(exportDir, { recursive: true });
  
  console.log(`Exporting database to: ${exportDir}\n`);

  const stats = {
    total: 0,
    tables: {} as Record<string, number>,
  };

  for (const tableName of tables) {
    try {
      const result = await pool.query(`SELECT * FROM ${tableName}`);
      const rows = result.rows;
      
      // Save to JSON file
      const filePath = join(exportDir, `${tableName}.json`);
      writeFileSync(filePath, JSON.stringify(rows, null, 2), 'utf-8');
      
      stats.tables[tableName] = rows.length;
      stats.total += rows.length;
      
      console.log(`✓ ${tableName}: ${rows.length} records`);
    } catch (error: any) {
      console.error(`✗ ${tableName}: ${error.message}`);
      stats.tables[tableName] = 0;
    }
  }

  // Save export metadata
  const metadata = {
    exportDate: new Date().toISOString(),
    databaseUrl: dbUrl!.replace(/:[^:@]+@/, ':****@'), // Hide password
    stats,
  };
  
  writeFileSync(
    join(exportDir, '_metadata.json'),
    JSON.stringify(metadata, null, 2),
    'utf-8'
  );

  console.log(`\n✓ Export complete!`);
  console.log(`Total records exported: ${stats.total}`);
  console.log(`Location: ${exportDir}`);

  await pool.end();
}

exportDatabase().catch((error) => {
  console.error('Export failed:', error);
  process.exit(1);
});
