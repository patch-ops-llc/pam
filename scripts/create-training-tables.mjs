import pg from "pg";
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS training_programs (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT NOT NULL,
        description TEXT,
        philosophy TEXT,
        prerequisites TEXT,
        estimated_hours TEXT,
        status TEXT NOT NULL DEFAULT 'draft',
        "order" INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS training_phases (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        program_id VARCHAR NOT NULL REFERENCES training_programs(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT,
        estimated_hours TEXT,
        milestone_review TEXT,
        pass_criteria TEXT,
        "order" INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS training_modules (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        phase_id VARCHAR NOT NULL REFERENCES training_phases(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        estimated_hours TEXT,
        client_story TEXT,
        assignment TEXT,
        testing_requirements TEXT,
        deliverables_and_presentation TEXT,
        be_ready_to_answer TEXT,
        "order" INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS training_module_sections (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        module_id VARCHAR NOT NULL REFERENCES training_modules(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        section_type TEXT NOT NULL DEFAULT 'content',
        content TEXT,
        "order" INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS training_enrollments (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        program_id VARCHAR NOT NULL REFERENCES training_programs(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'not_started',
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        CONSTRAINT unique_enrollment UNIQUE (user_id, program_id)
      );

      CREATE TABLE IF NOT EXISTS training_module_submissions (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        enrollment_id VARCHAR NOT NULL REFERENCES training_enrollments(id) ON DELETE CASCADE,
        module_id VARCHAR NOT NULL REFERENCES training_modules(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'not_started',
        submission_notes TEXT,
        reviewer_notes TEXT,
        reviewer_rating TEXT,
        reviewed_by VARCHAR REFERENCES users(id),
        submitted_at TIMESTAMP,
        reviewed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        CONSTRAINT unique_submission UNIQUE (enrollment_id, module_id)
      );
    `);
    console.log("All 6 training tables created successfully!");
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
