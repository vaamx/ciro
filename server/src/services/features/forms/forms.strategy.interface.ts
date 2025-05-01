/**
 * Defines the required fields for a basic connection form.
 * Specific strategies can extend this.
 */
export interface BaseConnectionFormData {
  dataSourceType: string; // e.g., 'snowflake', 'mysql'
  displayName: string;
  [key: string]: any; // Allow additional fields
}

/**
 * Represents the structure of a form field for UI generation.
 */
export interface FormField {
  name: string; // Field name/key
  label: string; // User-friendly label
  type: 'text' | 'password' | 'textarea' | 'select' | 'number' | 'checkbox';
  required: boolean;
  placeholder?: string;
  options?: { label: string; value: string }[]; // For select type
  defaultValue?: any;
  validationRegex?: string;
  helperText?: string;
}

/**
 * Represents the structure of a form schema.
 */
export interface FormSchema {
  fields: FormField[];
  // Potentially add sections or other layout hints later
}

/**
 * Result of a connection test.
 */
export interface ConnectionTestResult {
  success: boolean;
  message?: string;
  details?: Record<string, any>; // e.g., version, current role
}

/**
 * Interface for datasource-specific form generation and connection testing strategies.
 */
export interface IFormsStrategy {
  /**
   * Gets the form schema needed to collect connection credentials for this data source type.
   */
  getFormSchema(): Promise<FormSchema>;

  /**
   * Tests a connection using the provided credentials.
   * @param credentials Data matching the structure defined by getFormSchema.
   */
  testConnection(credentials: Record<string, any>): Promise<ConnectionTestResult>;

  /**
   * Lists available warehouses (if applicable).
   * Optional method, only implement if the source type supports it.
   */
  listWarehouses?(credentials: Record<string, any>): Promise<string[]>;

  /**
   * Lists available databases (if applicable).
   * Optional method, only implement if the source type supports it.
   */
  listDatabases?(credentials: Record<string, any>): Promise<string[]>;

  /**
   * Lists available schemas within a database (if applicable).
   * Optional method, only implement if the source type supports it.
   */
  listSchemas?(credentials: Record<string, any>, database: string): Promise<string[]>;
  
  /**
   * Lists available tables within a schema (if applicable).
   * Optional method, only implement if the source type supports it.
   */
  listTables?(credentials: Record<string, any>, database: string, schema: string): Promise<string[]>;
  
  /**
   * Lists available roles (if applicable).
   * Optional method, only implement if the source type supports it.
   */
  listRoles?(credentials: Record<string, any>): Promise<string[]>;
} 