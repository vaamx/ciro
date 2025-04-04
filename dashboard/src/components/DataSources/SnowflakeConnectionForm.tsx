import React, { useState } from 'react';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useNotification } from '../../contexts/NotificationContext';
import { ChevronRight, ChevronLeft, Check, X, Database, Server } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface SnowflakeConnectionFormProps {
  onConnectionSuccess: (dataSource: any) => void;
  onCancel: () => void;
}

type FormStep = 'account' | 'authentication' | 'resources' | 'confirmation';

interface SnowflakeFormData {
  name: string;
  account: string;
  username: string;
  password: string;
  useKeyPair: boolean;
  privateKey?: string;
  privateKeyPass?: string;
  warehouse: string;
  database: string;
  schema: string;
  role: string;
  description: string;
  useRowLevelIndexing: boolean;
}

interface ResourceOption {
  name: string;
  type: 'warehouse' | 'database' | 'schema' | 'role';
  database?: string; // Optional database property for schema resources
}

const SnowflakeConnectionForm: React.FC<SnowflakeConnectionFormProps> = ({
  onConnectionSuccess,
  onCancel
}) => {
  const { currentOrganization } = useOrganization();
  const { showNotification } = useNotification();
  
  // State for the multi-step form
  const [currentStep, setCurrentStep] = useState<FormStep>('account');
  const [loading, setLoading] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableResources, setAvailableResources] = useState<{
    warehouses: ResourceOption[];
    databases: ResourceOption[];
    schemas: ResourceOption[];
    roles: ResourceOption[];
  }>({
    warehouses: [],
    databases: [],
    schemas: [],
    roles: []
  });
  
  // Form data
  const [formData, setFormData] = useState<SnowflakeFormData>({
    name: 'Snowflake Connection',
    account: '',
    username: '',
    password: '',
    useKeyPair: false,
    warehouse: '',
    database: '',
    schema: '',
    role: '',
    description: 'Snowflake Data Connection',
    useRowLevelIndexing: true
  });

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // If database selection changes, fetch schemas for that database
    if (name === 'database' && value) {
      updateSchemasForDatabase(value);
    }
  };

  // Update schemas when a different database is selected
  const updateSchemasForDatabase = async (database: string) => {
    setLoading(true);
    setError(null);
    
    try {
      // Create connection params similar to fetchSnowflakeResources
      const connectionParams = {
        account: formData.account,
        username: formData.username,
        password: formData.useKeyPair ? undefined : formData.password,
        privateKey: formData.useKeyPair ? formData.privateKey : undefined,
        privateKeyPass: formData.useKeyPair && formData.privateKeyPass ? formData.privateKeyPass : undefined,
        role: formData.role
      };
      
      console.log(`Updating schemas for database: ${database}`);
      
      const schemaResponse = await fetch(`${API_BASE_URL}/api/snowflake/schemas?database=${database}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(connectionParams)
      });
      
      if (!schemaResponse.ok) {
        throw new Error(`Failed to fetch schemas: ${schemaResponse.status} ${schemaResponse.statusText}`);
      }
      
      const schemas = await schemaResponse.json();
      console.log(`Fetched ${schemas.length} schemas for database ${database}:`, schemas);
      
      setAvailableResources(prev => ({
        ...prev,
        schemas: schemas.map((schema: any) => ({ 
          name: schema.name, 
          database: schema.database,
          type: 'schema' as const 
        }))
      }));
      
      // Reset schema selection
      setFormData(prev => ({ ...prev, schema: schemas.length > 0 ? schemas[0].name : '' }));
    } catch (error: any) {
      console.error(`Error fetching schemas for database ${database}:`, error);
      setError(`Error fetching schemas: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Handle checkbox changes
  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: checked }));
  };

  // Test the connection
  const testConnection = async () => {
    setTestingConnection(true);
    setError(null);

    try {
      if (!currentOrganization) {
        throw new Error('No organization selected');
      }

      const connectionData = formData.useKeyPair 
        ? {
            account: formData.account,
            username: formData.username,
            privateKey: formData.privateKey,
            privateKeyPass: formData.privateKeyPass,
            warehouse: formData.warehouse,
            database: formData.database,
            schema: formData.schema,
            role: formData.role
          }
        : {
            account: formData.account,
            username: formData.username,
            password: formData.password,
            warehouse: formData.warehouse,
            database: formData.database,
            schema: formData.schema,
            role: formData.role
          };

      const response = await fetch(`${API_BASE_URL}/api/snowflake/test-connection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify(connectionData)
      });

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'Failed to connect to Snowflake');
      }

      showNotification({ 
        type: 'success', 
        message: 'Successfully connected to Snowflake' 
      });

      // Fetch available resources 
      await fetchSnowflakeResources();
      
      // Move to the resources step
      setCurrentStep('resources');
    } catch (error: any) {
      setError(error.message || 'Failed to connect to Snowflake');
      showNotification({ 
        type: 'error', 
        message: error.message || 'Failed to connect to Snowflake' 
      });
    } finally {
      setTestingConnection(false);
    }
  };

  // Fetch available Snowflake resources
  const fetchSnowflakeResources = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Create connection params
      const connectionParams = {
        account: formData.account,
        username: formData.username,
        password: formData.useKeyPair ? undefined : formData.password,
        privateKey: formData.useKeyPair ? formData.privateKey : undefined,
        privateKeyPass: formData.useKeyPair && formData.privateKeyPass ? formData.privateKeyPass : undefined,
      };
      
      console.log("Fetching resources with account:", formData.account);
      
      // Fetch roles
      const rolesResponse = await fetch(`${API_BASE_URL}/api/snowflake/roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(connectionParams)
      });
      
      if (!rolesResponse.ok) {
        throw new Error(`Failed to fetch roles: ${rolesResponse.status} ${rolesResponse.statusText}`);
      }
      
      const roles = await rolesResponse.json();
      console.log("Fetched roles:", roles);
      setAvailableResources(prev => ({
        ...prev,
        roles: roles.map((role: any) => ({ name: role.name, type: 'role' as const }))
      }));
      
      // Set default role if not selected
      if (!formData.role && roles.length > 0) {
        // Prefer ACCOUNTADMIN if available
        const accountAdminRole = roles.find((r: any) => r.name === 'ACCOUNTADMIN');
        if (accountAdminRole) {
          setFormData(prev => ({ ...prev, role: accountAdminRole.name }));
        } else {
          setFormData(prev => ({ ...prev, role: roles[0].name }));
        }
      }
      
      // Fetch warehouses with the selected role
      const warehouseResponse = await fetch(`${API_BASE_URL}/api/snowflake/warehouses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...connectionParams,
          role: formData.role || (roles.length > 0 ? roles[0].name : undefined)
        })
      });
      
      if (!warehouseResponse.ok) {
        throw new Error(`Failed to fetch warehouses: ${warehouseResponse.status} ${warehouseResponse.statusText}`);
      }
      
      const warehouses = await warehouseResponse.json();
      console.log("Fetched warehouses:", warehouses);
      setAvailableResources(prev => ({
        ...prev,
        warehouses: warehouses.map((wh: any) => ({ name: wh.name, type: 'warehouse' as const }))
      }));
      
      // Set default warehouse if not selected
      if (!formData.warehouse && warehouses.length > 0) {
        setFormData(prev => ({ ...prev, warehouse: warehouses[0].name }));
      }
      
      // Fetch databases with the selected role
      const databaseResponse = await fetch(`${API_BASE_URL}/api/snowflake/databases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...connectionParams,
          role: formData.role || (roles.length > 0 ? roles[0].name : undefined)
        })
      });
      
      if (!databaseResponse.ok) {
        throw new Error(`Failed to fetch databases: ${databaseResponse.status} ${databaseResponse.statusText}`);
      }
      
      const databases = await databaseResponse.json();
      console.log("Fetched databases:", databases);
      setAvailableResources(prev => ({
        ...prev,
        databases: databases.map((db: any) => ({ name: db.name, type: 'database' as const }))
      }));
      
      // Set default database if not selected
      if (!formData.database && databases.length > 0) {
        setFormData(prev => ({ ...prev, database: databases[0].name }));
      }
      
      // Only fetch schemas if a database is selected
      if (formData.database || (databases.length > 0 && databases[0].name)) {
        const selectedDatabase = formData.database || (databases.length > 0 ? databases[0].name : '');
        
        const schemaResponse = await fetch(`${API_BASE_URL}/api/snowflake/schemas?database=${selectedDatabase}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...connectionParams,
            role: formData.role || (roles.length > 0 ? roles[0].name : undefined)
          })
        });
        
        if (!schemaResponse.ok) {
          throw new Error(`Failed to fetch schemas: ${schemaResponse.status} ${schemaResponse.statusText}`);
        }
        
        const schemas = await schemaResponse.json();
        console.log("Fetched schemas:", schemas);
        setAvailableResources(prev => ({
          ...prev,
          schemas: schemas.map((schema: any) => ({ 
            name: schema.name, 
            database: schema.database,
            type: 'schema' as const 
          }))
        }));
        
        // Set default schema if not selected
        if (!formData.schema && schemas.length > 0) {
          setFormData(prev => ({ ...prev, schema: schemas[0].name }));
        }
      }
      
      setLoading(false);
      setCurrentStep('resources');
    } catch (err: any) {
      console.error('Error fetching Snowflake resources:', err);
      setError(`Error fetching Snowflake resources: ${err.message}`);
      setLoading(false);
    }
  };

  // Handle final submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!currentOrganization) {
        throw new Error('No organization selected');
      }

      // Create the data source
      const response = await fetch(`${API_BASE_URL}/api/data-sources`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          name: formData.name,
          type: 'snowflake',
          description: formData.description,
          organization_id: currentOrganization.id,
          metadata: {
            snowflake_account: formData.account,
            snowflake_username: formData.username,
            snowflake_password: formData.useKeyPair ? undefined : formData.password,
            snowflake_private_key: formData.useKeyPair ? formData.privateKey : undefined,
            snowflake_private_key_pass: formData.useKeyPair ? formData.privateKeyPass : undefined,
            snowflake_warehouse: formData.warehouse,
            snowflake_database: formData.database,
            snowflake_schema: formData.schema,
            snowflake_role: formData.role,
            authentication_type: formData.useKeyPair ? 'key_pair' : 'password',
            use_row_level_indexing: formData.useRowLevelIndexing
          },
          metrics: {
            records: 0,
            syncRate: 0,
            avgSyncTime: '0s'
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create data source');
      }

      const dataSource = await response.json();
      showNotification({ 
        type: 'success', 
        message: 'Successfully connected to Snowflake' 
      });
      onConnectionSuccess(dataSource);
    } catch (error: any) {
      setError(error.message || 'Failed to create Snowflake data source');
      showNotification({ 
        type: 'error', 
        message: error.message || 'Failed to create data source' 
      });
    } finally {
      setLoading(false);
    }
  };

  // Navigation between steps
  const nextStep = () => {
    if (currentStep === 'account') setCurrentStep('authentication');
    else if (currentStep === 'authentication') testConnection();
    else if (currentStep === 'resources') setCurrentStep('confirmation');
  };

  const prevStep = () => {
    if (currentStep === 'authentication') setCurrentStep('account');
    else if (currentStep === 'resources') setCurrentStep('authentication');
    else if (currentStep === 'confirmation') setCurrentStep('resources');
  };

  // Render the account information step
  const renderAccountStep = () => {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Account Information</h3>
        <p className="text-sm text-gray-500">
          Enter your Snowflake account identifier and connection name.
        </p>
        
        <div className="space-y-2">
          <label className="block text-sm font-medium">Connection Name</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium">Snowflake Account Identifier</label>
          <input
            type="text"
            name="account"
            value={formData.account}
            onChange={handleInputChange}
            placeholder="xy12345.us-east-1"
            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
            required
          />
          <div className="text-xs text-gray-500">
            <p>Format examples:</p>
            <ul className="list-disc pl-4">
              <li>AWS: <code>xy12345.us-east-1</code></li>
              <li>Azure: <code>ORGNAME-ACCOUNTNAME.azure_region.azure</code></li>
              <li>GCP: <code>xy12345.us-central1.gcp</code></li>
            </ul>
            <p className="mt-1">For Azure accounts, include the full identifier with region.</p>
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium">Description</label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
            rows={2}
          />
        </div>
      </div>
    );
  };

  // Render the authentication step
  const renderAuthenticationStep = () => {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Authentication</h3>
        <p className="text-sm text-gray-500">
          Enter your Snowflake credentials. We do not store your password - it's only used to establish a connection.
        </p>

        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 rounded-md text-sm">
          <p>Your credentials are only used to establish a connection to Snowflake. 
             Your password is never stored in our system.</p>
        </div>
        
        <div className="space-y-2">
          <label className="block text-sm font-medium">Username</label>
          <input
            type="text"
            name="username"
            value={formData.username}
            onChange={handleInputChange}
            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
            required
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center mb-2">
            <input
              type="checkbox"
              id="useKeyPair"
              name="useKeyPair"
              checked={formData.useKeyPair}
              onChange={handleCheckboxChange}
              className="mr-2"
            />
            <label htmlFor="useKeyPair" className="text-sm font-medium">
              Use Key Pair Authentication (Advanced)
            </label>
          </div>

          {!formData.useKeyPair ? (
            <div className="space-y-2">
              <label className="block text-sm font-medium">Password</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                required
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium">Private Key</label>
                <textarea
                  name="privateKey"
                  value={formData.privateKey}
                  onChange={handleInputChange}
                  className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 font-mono text-xs"
                  rows={5}
                  placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium">Private Key Passphrase</label>
                <input
                  type="password"
                  name="privateKeyPass"
                  value={formData.privateKeyPass}
                  onChange={handleInputChange}
                  className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                />
                <p className="text-xs text-gray-500">Leave empty if your private key is not encrypted</p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render the resources selection step
  const renderResourcesStep = () => {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Select Resources</h3>
        <p className="text-sm text-gray-500">
          Choose the Snowflake resources you want to connect to.
        </p>
        
        <div className="space-y-2">
          <label className="block text-sm font-medium">Role</label>
          <select
            name="role"
            value={formData.role}
            onChange={handleInputChange}
            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
          >
            <option value="">Select a role</option>
            {availableResources.roles.map(role => (
              <option key={role.name} value={role.name}>{role.name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium">Warehouse</label>
          <select
            name="warehouse"
            value={formData.warehouse}
            onChange={handleInputChange}
            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
          >
            <option value="">Select a warehouse</option>
            {availableResources.warehouses.map(warehouse => (
              <option key={warehouse.name} value={warehouse.name}>{warehouse.name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium">Database</label>
          <select
            name="database"
            value={formData.database}
            onChange={handleInputChange}
            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
          >
            <option value="">Select a database</option>
            {availableResources.databases.map(database => (
              <option key={database.name} value={database.name}>{database.name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium">Schema</label>
          <select
            name="schema"
            value={formData.schema}
            onChange={handleInputChange}
            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
          >
            <option value="">Select a schema</option>
            {availableResources.schemas.map(schema => (
              <option 
                key={`${schema.database || 'no-db'}-${schema.name}`} 
                value={schema.name}
              >
                {schema.name}
              </option>
            ))}
          </select>
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center">
            <input
              type="checkbox"
              id="useRowLevelIndexing"
              name="useRowLevelIndexing"
              checked={formData.useRowLevelIndexing}
              onChange={handleCheckboxChange}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="useRowLevelIndexing" className="ml-2 block text-sm font-medium">
              Use Row-Level Indexing (Recommended)
            </label>
          </div>
          <p className="text-xs text-gray-500 ml-6">
            Stores every row with its own vector for more accurate aggregation queries. 
            Recommended for analytics and BI use cases.
          </p>
        </div>
      </div>
    );
  };

  // Render the confirmation step
  const renderConfirmationStep = () => {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Confirm Connection</h3>
        <p className="text-sm text-gray-500">
          Review your settings before creating the connection.
        </p>
        
        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-md">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium">Connection Name</p>
              <p className="text-sm text-gray-500">{formData.name}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Account</p>
              <p className="text-sm text-gray-500">{formData.account}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Username</p>
              <p className="text-sm text-gray-500">{formData.username}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Authentication</p>
              <p className="text-sm text-gray-500">{formData.useKeyPair ? 'Key Pair' : 'Password'}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Role</p>
              <p className="text-sm text-gray-500">{formData.role || '<None>'}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Warehouse</p>
              <p className="text-sm text-gray-500">{formData.warehouse || '<None>'}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Database</p>
              <p className="text-sm text-gray-500">{formData.database || '<None>'}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Schema</p>
              <p className="text-sm text-gray-500">{formData.schema || '<None>'}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Row-Level Indexing</p>
              <p className="text-sm text-gray-500">{formData.useRowLevelIndexing ? 'Enabled' : 'Disabled'}</p>
            </div>
          </div>
        </div>

        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300 rounded-md text-sm">
          <p>By creating this connection, you're allowing the application to query your Snowflake data with the permissions of the specified role. You can revoke access at any time by removing the data source.</p>
        </div>
      </div>
    );
  };

  // Step indicator
  const renderStepIndicator = () => {
    const steps = [
      { id: 'account', name: 'Account', icon: <Server className="w-5 h-5" /> },
      { id: 'authentication', name: 'Authentication', icon: <X className="w-5 h-5" /> },
      { id: 'resources', name: 'Resources', icon: <Database className="w-5 h-5" /> },
      { id: 'confirmation', name: 'Confirmation', icon: <Check className="w-5 h-5" /> }
    ];
    
    return (
      <div className="mb-6">
        <nav aria-label="Progress">
          <ol className="flex items-center">
            {steps.map((step, stepIdx) => {
              const isCurrent = step.id === currentStep;
              const isCompleted = 
                (step.id === 'account' && ['authentication', 'resources', 'confirmation'].includes(currentStep)) ||
                (step.id === 'authentication' && ['resources', 'confirmation'].includes(currentStep)) ||
                (step.id === 'resources' && currentStep === 'confirmation');
              
              return (
                <li key={step.name} className={`relative ${stepIdx !== steps.length - 1 ? 'pr-8 sm:pr-20' : ''}`}>
                  {isCompleted ? (
                    <div className="absolute inset-0 flex items-center" aria-hidden="true">
                      <div className="h-0.5 w-full bg-purple-600"></div>
                    </div>
                  ) : stepIdx !== 0 ? (
                    <div className="absolute inset-0 flex items-center" aria-hidden="true">
                      <div className="h-0.5 w-full bg-gray-200 dark:bg-gray-700"></div>
                    </div>
                  ) : null}
                  <div
                    className={`relative flex h-8 w-8 items-center justify-center rounded-full ${
                      isCompleted
                        ? 'bg-purple-600'
                        : isCurrent
                        ? 'bg-white dark:bg-gray-800 border-2 border-purple-600'
                        : 'bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600'
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="h-5 w-5 text-white" />
                    ) : (
                      <span
                        className={
                          isCurrent
                            ? 'text-purple-600 dark:text-purple-400'
                            : 'text-gray-500 dark:text-gray-400'
                        }
                      >
                        {step.icon}
                      </span>
                    )}
                  </div>
                  <div className="hidden sm:block absolute left-0 mt-3 text-center w-full">
                    <span className={`text-xs font-medium ${
                      isCurrent ? 'text-purple-600 dark:text-purple-400' : 
                      isCompleted ? 'text-gray-900 dark:text-gray-100' : 
                      'text-gray-500 dark:text-gray-400'
                    }`}>
                      {step.name}
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        </nav>
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-3xl w-full mx-auto">
      <h2 className="text-xl font-semibold mb-4">Connect to Snowflake</h2>
      
      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-800 rounded-md">
          {error}
        </div>
      )}
      
      {renderStepIndicator()}
      
      <form onSubmit={handleSubmit}>
        <div className="min-h-[300px]">
          {currentStep === 'account' && renderAccountStep()}
          {currentStep === 'authentication' && renderAuthenticationStep()}
          {currentStep === 'resources' && renderResourcesStep()}
          {currentStep === 'confirmation' && renderConfirmationStep()}
        </div>
        
        <div className="mt-6 flex justify-between">
          <button
            type="button"
            onClick={currentStep === 'account' ? onCancel : prevStep}
            className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600"
            disabled={loading || testingConnection}
          >
            {currentStep === 'account' ? 'Cancel' : (
              <span className="flex items-center">
                <ChevronLeft className="w-4 h-4 mr-1" />
                Back
              </span>
            )}
          </button>
          
          <button
            type={currentStep === 'confirmation' ? 'submit' : 'button'}
            onClick={currentStep === 'confirmation' ? undefined : nextStep}
            className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            disabled={loading || testingConnection}
          >
            {loading || testingConnection ? (
              <span className="flex items-center">
                <span className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                {testingConnection ? 'Testing Connection...' : 'Processing...'}
              </span>
            ) : currentStep === 'confirmation' ? (
              'Create Connection'
            ) : (
              <span className="flex items-center">
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default SnowflakeConnectionForm;