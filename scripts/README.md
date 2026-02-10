# Database Export/Import Scripts

These scripts allow you to export and import your entire PostgreSQL database as JSON files.

## Export Database

Export all tables from a database to JSON files:

```bash
# Export from development database (uses $DATABASE_URL by default)
npx tsx scripts/export-database.ts

# Export from production database (provide connection string)
npx tsx scripts/export-database.ts "postgresql://user:password@host/database"
```

This will create a timestamped directory in `database_exports/` with:
- One JSON file per table (e.g., `users.json`, `agencies.json`)
- A `_metadata.json` file with export statistics

## Import Database

Import JSON files from an export directory into a database:

```bash
# Import into development database
npx tsx scripts/import-database.ts $DATABASE_URL ./database_exports/2024-10-15

# Import into a different database
npx tsx scripts/import-database.ts "postgresql://user:password@host/database" ./database_exports/2024-10-15
```

**⚠️ Warning:** The import script will **TRUNCATE** (delete all data from) each table before importing. Make sure you have a backup!

## Complete Migration Workflow

To copy production data to development:

1. **Export from production:**
   ```bash
   # Get your production DATABASE_URL from the Replit database pane
   npx tsx scripts/export-database.ts "YOUR_PRODUCTION_DATABASE_URL"
   ```

2. **Import into development:**
   ```bash
   # Use your development DATABASE_URL (already in environment)
   npx tsx scripts/import-database.ts $DATABASE_URL ./database_exports/YYYY-MM-DD
   ```

## Notes

- The scripts handle foreign key constraints automatically
- Exports are organized by date in `database_exports/YYYY-MM-DD/`
- Each export includes metadata about what was exported
- Sensitive data (passwords in connection strings) is masked in metadata
