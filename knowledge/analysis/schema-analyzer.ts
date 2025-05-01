namespace SchemaAnalyzer {
  const fs = require('fs/promises');
  const path = require('path');
  const { Pool } = require('pg');
  const dotenv = require('dotenv');

  // Load environment variables
  dotenv.config({ path: path.join(process.cwd(), '.env') });

  interface Column {
    table_name: string;
    column_name: string;
    data_type: string;
    is_nullable: string;
    column_default: string | null;
  }

  interface ForeignKey {
    table_name: string;
    column_name: string;
    foreign_table_name: string;
    foreign_column_name: string;
    constraint_name: string;
  }

  interface TableStats {
    table_name: string;
    row_count: number;
    total_size: string;
    index_size: string;
  }

  export async function main() {
    console.log('Starting database schema analysis...');

    const pool = new Pool({
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5432'),
      database: process.env.POSTGRES_DB || 'ciro',
      user: process.env.POSTGRES_USER || '***REMOVED***',
      password: process.env.POSTGRES_PASSWORD || '***REMOVED***'
    });

    try {
      // Create output directory
      const outputDir = path.join(process.cwd(), 'analysis', 'database');
      await fs.mkdir(outputDir, { recursive: true });

      // 1. Get tables list
      console.log('Retrieving tables...');
      const tableListQuery = `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name;
      `;
      const tablesResult = await pool.query(tableListQuery);
      const tables = tablesResult.rows.map((row: { table_name: string }) => row.table_name);

      // 2. Get columns for each table
      console.log('Retrieving columns...');
      const columnsQuery = `
        SELECT 
          table_name, 
          column_name, 
          data_type,
          is_nullable,
          column_default
        FROM 
          information_schema.columns 
        WHERE 
          table_schema = 'public'
        ORDER BY 
          table_name, ordinal_position;
      `;
      const columnsResult = await pool.query(columnsQuery);
      const columns = columnsResult.rows as Column[];

      // 3. Get foreign key constraints
      console.log('Retrieving foreign keys...');
      const foreignKeysQuery = `
        SELECT
          tc.table_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name,
          tc.constraint_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public';
      `;
      const foreignKeysResult = await pool.query(foreignKeysQuery);
      const foreignKeys = foreignKeysResult.rows as ForeignKey[];

      // 4. Get table statistics
      console.log('Retrieving table statistics...');
      const tableStatsQuery = `
        SELECT
          relname as table_name,
          n_live_tup as row_count,
          pg_size_pretty(pg_total_relation_size(relid)) as total_size,
          pg_size_pretty(pg_indexes_size(relid)) as index_size
        FROM pg_stat_user_tables
        ORDER BY n_live_tup DESC;
      `;
      const tableStatsResult = await pool.query(tableStatsQuery);
      const tableStats = tableStatsResult.rows as TableStats[];

      // 5. Get column statistics for RAG-related tables
      console.log('Retrieving column statistics for RAG tables...');
      const ragTables = ['data_sources', 'documents', 'embeddings', 'collections', 'chunks'];
      const columnStatsMap = new Map<string, any>();

      for (const table of ragTables) {
        if (tables.includes(table)) {
          try {
            const columnStatsQuery = `
              SELECT 
                column_name,
                pg_stats.null_frac as null_fraction,
                pg_stats.n_distinct as distinct_values,
                pg_stats.most_common_vals as common_values
              FROM 
                pg_stats
              WHERE 
                tablename = $1
                AND schemaname = 'public';
            `;
            const columnStatsResult = await pool.query(columnStatsQuery, [table]);
            columnStatsMap.set(table, columnStatsResult.rows);
          } catch (error) {
            console.warn(`Could not retrieve column statistics for table ${table}:`, error);
          }
        }
      }

      // 6. Generate schema report
      console.log('Generating schema report...');
      const report = generateSchemaReport(tables, columns, foreignKeys, tableStats, columnStatsMap);
      await fs.writeFile(path.join(outputDir, 'schema-report.md'), report, 'utf8');

      // 7. Save raw schema data
      console.log('Saving raw schema data...');
      await fs.writeFile(
        path.join(outputDir, 'tables.json'), 
        JSON.stringify(tables, null, 2), 
        'utf8'
      );
      
      await fs.writeFile(
        path.join(outputDir, 'columns.json'), 
        JSON.stringify(columns, null, 2), 
        'utf8'
      );
      
      await fs.writeFile(
        path.join(outputDir, 'foreign-keys.json'), 
        JSON.stringify(foreignKeys, null, 2), 
        'utf8'
      );
      
      await fs.writeFile(
        path.join(outputDir, 'table-stats.json'), 
        JSON.stringify(tableStats, null, 2), 
        'utf8'
      );

      // 8. Generate ER diagram in mermaid format
      console.log('Generating ER diagram...');
      const erDiagram = generateERDiagram(tables, columns, foreignKeys);
      await fs.writeFile(path.join(outputDir, 'er-diagram.mmd'), erDiagram, 'utf8');

      console.log('Schema analysis completed successfully!');
      console.log(`Reports saved to: ${outputDir}`);
    } catch (error) {
      console.error('Error during schema analysis:', error);
    } finally {
      await pool.end();
    }
  }

  function generateSchemaReport(
    tables: string[],
    columns: Column[],
    foreignKeys: ForeignKey[],
    tableStats: TableStats[],
    columnStatsMap: Map<string, any>
  ): string {
    let report = `# Database Schema Analysis Report\n\n`;
    report += `*Generated on: ${new Date().toISOString()}*\n\n`;
    
    report += `## Tables Overview\n\n`;
    report += `Total tables: ${tables.length}\n\n`;
    
    report += `| Table Name | Row Count | Total Size | Index Size |\n`;
    report += `|------------|-----------|------------|------------|\n`;
    
    for (const table of tables) {
      const stats = tableStats.find((s: TableStats) => s.table_name === table);
      report += `| ${table} | ${stats?.row_count || 'N/A'} | ${stats?.total_size || 'N/A'} | ${stats?.index_size || 'N/A'} |\n`;
    }
    
    report += `\n## Detailed Table Schemas\n\n`;
    
    for (const table of tables) {
      report += `### ${table}\n\n`;
      
      const tableColumns = columns.filter((c: Column) => c.table_name === table);
      const tableForeignKeys = foreignKeys.filter((fk: ForeignKey) => fk.table_name === table);
      const stats = tableStats.find((s: TableStats) => s.table_name === table);
      
      report += `**Statistics:**\n`;
      report += `- Row Count: ${stats?.row_count || 'N/A'}\n`;
      report += `- Total Size: ${stats?.total_size || 'N/A'}\n`;
      report += `- Index Size: ${stats?.index_size || 'N/A'}\n\n`;
      
      report += `**Columns:**\n\n`;
      report += `| Column Name | Data Type | Nullable | Default |\n`;
      report += `|-------------|-----------|----------|----------|\n`;
      
      for (const column of tableColumns) {
        report += `| ${column.column_name} | ${column.data_type} | ${column.is_nullable} | ${column.column_default || 'NULL'} |\n`;
      }
      
      if (tableForeignKeys.length > 0) {
        report += `\n**Foreign Keys:**\n\n`;
        report += `| Column | References | Constraint Name |\n`;
        report += `|--------|------------|----------------|\n`;
        
        for (const fk of tableForeignKeys) {
          report += `| ${fk.column_name} | ${fk.foreign_table_name}(${fk.foreign_column_name}) | ${fk.constraint_name} |\n`;
        }
      }
      
      // Add column statistics for RAG tables
      if (columnStatsMap.has(table)) {
        const columnStats = columnStatsMap.get(table);
        report += `\n**Column Statistics:**\n\n`;
        report += `| Column | Null % | Distinct Values | Common Values |\n`;
        report += `|--------|--------|-----------------|---------------|\n`;
        
        for (const stat of columnStats) {
          report += `| ${stat.column_name} | ${Math.round(stat.null_fraction * 100)}% | ${stat.distinct_values} | ${formatCommonValues(stat.common_values)} |\n`;
        }
      }
      
      report += `\n`;
    }
    
    report += `## RAG System Tables\n\n`;
    const ragTables = ['data_sources', 'documents', 'embeddings', 'collections', 'chunks'].filter((t: string) => tables.includes(t));
    
    if (ragTables.length > 0) {
      report += `The following tables are part of the RAG system:\n\n`;
      for (const table of ragTables) {
        report += `- ${table}\n`;
      }
    } else {
      report += `No dedicated RAG system tables were identified.\n`;
    }
    
    return report;
  }

  function formatCommonValues(values: any): string {
    if (!values) return 'N/A';
    if (Array.isArray(values)) {
      return values.slice(0, 3).join(', ') + (values.length > 3 ? '...' : '');
    }
    return String(values);
  }

  function generateERDiagram(
    tables: string[],
    columns: Column[],
    foreignKeys: ForeignKey[]
  ): string {
    let diagram = `erDiagram\n`;
    
    // Define entities
    for (const table of tables) {
      const tableColumns = columns.filter((c: Column) => c.table_name === table);
      
      diagram += `    ${table} {\n`;
      for (const column of tableColumns) {
        const nullable = column.is_nullable === 'YES' ? 'optional' : 'required';
        diagram += `        ${column.data_type} ${column.column_name} ${nullable}\n`;
      }
      diagram += `    }\n`;
    }
    
    // Define relationships
    for (const fk of foreignKeys) {
      diagram += `    ${fk.table_name} }|--|| ${fk.foreign_table_name} : "${fk.constraint_name}"\n`;
    }
    
    return diagram;
  }
}

// Call the main function from outside the namespace
SchemaAnalyzer.main().catch((error: any) => {
  console.error('Unhandled error:', error);
  process.exit(1);
}); 