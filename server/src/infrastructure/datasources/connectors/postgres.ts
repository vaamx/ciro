import { Pool, QueryResult } from 'pg';
import { DataSourceConnector } from './factory';
import { OpenAIService } from '../../ai/openai';

export class PostgresConnector implements DataSourceConnector {
  private pool: Pool;
  private openai: OpenAIService;

  constructor() {
    this.pool = new Pool({
      user: process.env.POSTGRES_USER,
      host: process.env.POSTGRES_HOST,
      database: process.env.POSTGRES_DB,
      password: process.env.POSTGRES_PASSWORD,
      port: Number(process.env.POSTGRES_PORT),
    });
    this.openai = new OpenAIService();
  }

  async connect(): Promise<void> {
    try {
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
    } catch (error) {
      throw new Error('Failed to connect to PostgreSQL');
    }
  }

  async query(naturalQuery: string): Promise<any> {
    try {
      // Use OpenAI to convert natural language to SQL
      const sqlQuery = await this.convertToSQL(naturalQuery);
      
      // Execute the SQL query
      const result = await this.pool.query(sqlQuery);
      return this.formatResult(result);
    } catch (error) {
      throw new Error(`Query execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async disconnect(): Promise<void> {
    await this.pool.end();
  }

  private async convertToSQL(naturalQuery: string): Promise<string> {
    const prompt = `Convert this natural language query to SQL: "${naturalQuery}"
    Rules:
    - Only return the SQL query, no explanations
    - Use basic SQL operations (SELECT, FROM, WHERE, etc.)
    - Avoid complex operations that might be unsafe
    - If the query seems unsafe or unclear, return "SELECT 1"`;

    const response = await this.openai.generateChatResponse(
      [{ role: 'user', content: prompt }]
    );

    // Basic SQL injection prevention
    const sql = response.trim();
    if (this.isSafeSQL(sql)) {
      return sql;
    }
    throw new Error('Generated SQL query failed safety checks');
  }

  private isSafeSQL(sql: string): boolean {
    // Basic SQL safety checks
    const unsafe = [
      'DROP',
      'DELETE',
      'UPDATE',
      'INSERT',
      'ALTER',
      'TRUNCATE',
      'GRANT',
      'REVOKE'
    ];

    return !unsafe.some(term => 
      sql.toUpperCase().includes(term)
    );
  }

  private formatResult(result: QueryResult): any {
    return {
      rows: result.rows,
      rowCount: result.rowCount,
      fields: result.fields.map(f => ({
        name: f.name,
        type: f.dataTypeID
      }))
    };
  }
} 