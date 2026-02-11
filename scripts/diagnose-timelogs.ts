import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

// Configure WebSocket for Neon
neonConfig.webSocketConstructor = ws;

const dbUrl = process.argv[2] || process.env.DATABASE_URL;

if (!dbUrl) {
  console.error('Usage: npx tsx scripts/diagnose-timelogs.ts [DATABASE_URL]');
  console.error('Or set DATABASE_URL environment variable');
  process.exit(1);
}

const pool = new Pool({ connectionString: dbUrl });

async function diagnose() {
  console.log('=== Time Logs Diagnostic ===\n');

  // 1. Total count
  const countResult = await pool.query('SELECT COUNT(*) as total FROM time_logs');
  console.log(`Total time_logs in database: ${countResult.rows[0].total}\n`);

  // 2. Date range
  const rangeResult = await pool.query(`
    SELECT 
      MIN(log_date) as earliest,
      MAX(log_date) as latest,
      MIN(created_at) as earliest_created,
      MAX(created_at) as latest_created
    FROM time_logs
  `);
  const range = rangeResult.rows[0];
  console.log(`Earliest log_date: ${range.earliest}`);
  console.log(`Latest log_date: ${range.latest}`);
  console.log(`Earliest created_at: ${range.earliest_created}`);
  console.log(`Latest created_at: ${range.latest_created}\n`);

  // 3. Count by month
  const monthlyResult = await pool.query(`
    SELECT 
      TO_CHAR(log_date, 'YYYY-MM') as month,
      COUNT(*) as count,
      SUM(CAST(actual_hours AS DECIMAL)) as total_actual,
      SUM(CAST(billed_hours AS DECIMAL)) as total_billed
    FROM time_logs
    GROUP BY TO_CHAR(log_date, 'YYYY-MM')
    ORDER BY month DESC
    LIMIT 12
  `);
  console.log('Time logs by month:');
  console.log('-'.repeat(60));
  for (const row of monthlyResult.rows) {
    console.log(`  ${row.month}: ${row.count} logs (actual: ${row.total_actual}h, billed: ${row.total_billed}h)`);
  }
  console.log();

  // 4. Show the most recent 10 time logs with their dates
  const recentResult = await pool.query(`
    SELECT 
      id, 
      log_date, 
      created_at,
      task_name,
      actual_hours,
      billed_hours
    FROM time_logs 
    ORDER BY log_date DESC 
    LIMIT 10
  `);
  console.log('Most recent 10 time logs:');
  console.log('-'.repeat(80));
  for (const row of recentResult.rows) {
    const logDate = new Date(row.log_date).toISOString().slice(0, 10);
    const createdAt = new Date(row.created_at).toISOString().slice(0, 19);
    console.log(`  ${logDate} | created: ${createdAt} | ${row.task_name} | actual: ${row.actual_hours}h | billed: ${row.billed_hours}h`);
  }
  console.log();

  // 5. Check January and February 2025 specifically
  for (const [year, month, label] of [[2025, 1, 'Jan 2025'], [2025, 2, 'Feb 2025'], [2026, 1, 'Jan 2026'], [2026, 2, 'Feb 2026']]) {
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const end = month === 12 
      ? `${(year as number) + 1}-01-01`
      : `${year}-${String((month as number) + 1).padStart(2, '0')}-01`;
    
    const result = await pool.query(
      `SELECT COUNT(*) as count FROM time_logs WHERE log_date >= $1 AND log_date < $2`,
      [start, end]
    );
    console.log(`${label}: ${result.rows[0].count} time logs`);
  }

  await pool.end();
}

diagnose().catch((error) => {
  console.error('Diagnostic failed:', error);
  process.exit(1);
});
