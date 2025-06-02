-- ===================================================
-- Row-Level Security (RLS) Policies for Multi-Tenant Energy Billing System
-- ===================================================
-- This script implements comprehensive RLS policies to ensure complete data isolation
-- between organizations and clients in the energy billing platform.
--
-- Security Model:
-- - Organizations are the top-level tenants (e.g., EIS Power)
-- - Clients are energy companies within each organization
-- - Customers are end-users within each client
-- - All data access is restricted by organization_id and/or client_id
-- ===================================================

-- Enable RLS on all tables that need tenant isolation
-- ===================================================

-- Core tenant tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Energy billing tables
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE meter_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tariff_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE tariff_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Existing system tables
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_widgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE automations ENABLE ROW LEVEL SECURITY;

-- ===================================================
-- Helper Functions for RLS
-- ===================================================

-- Function to get current user's organization ID from session
CREATE OR REPLACE FUNCTION get_current_organization_id()
RETURNS INTEGER AS $$
BEGIN
  -- Get organization ID from PostgreSQL session variable
  -- This will be set by the application layer during user authentication
  RETURN COALESCE(
    current_setting('app.current_organization_id', true)::INTEGER,
    0  -- Default to 0 if not set (will deny access)
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Function to get current user's ID from session
CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS INTEGER AS $$
BEGIN
  RETURN COALESCE(
    current_setting('app.current_user_id', true)::INTEGER,
    0  -- Default to 0 if not set
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Function to check if current user is organization admin
CREATE OR REPLACE FUNCTION is_organization_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users 
    WHERE id = get_current_user_id() 
    AND role IN ('ADMIN', 'ENERGY_ADMIN')
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Function to get accessible client IDs for current user
CREATE OR REPLACE FUNCTION get_accessible_client_ids()
RETURNS INTEGER[] AS $$
BEGIN
  RETURN ARRAY(
    SELECT c.id 
    FROM clients c 
    WHERE c."organizationId" = get_current_organization_id()
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ===================================================
-- RLS Policies for Core Tables
-- ===================================================

-- Organizations: Users can only see their own organization
DROP POLICY IF EXISTS organization_isolation ON organizations;
CREATE POLICY organization_isolation ON organizations
  FOR ALL
  TO public
  USING (id = get_current_organization_id())
  WITH CHECK (id = get_current_organization_id());

-- Organization Members: Users can only see members of their organization
DROP POLICY IF EXISTS org_member_isolation ON organization_members;
CREATE POLICY org_member_isolation ON organization_members
  FOR ALL
  TO public
  USING (organization_id = get_current_organization_id())
  WITH CHECK (organization_id = get_current_organization_id());

-- Users: Users can see all users in their organization
DROP POLICY IF EXISTS user_org_isolation ON users;
CREATE POLICY user_org_isolation ON users
  FOR SELECT
  TO public
  USING (
    id IN (
      SELECT om.user_id 
      FROM organization_members om 
      WHERE om.organization_id = get_current_organization_id()
    )
    OR id = get_current_user_id()  -- Users can always see themselves
  );

-- Users: Users can only update their own record
DROP POLICY IF EXISTS user_self_update ON users;
CREATE POLICY user_self_update ON users
  FOR UPDATE
  TO public
  USING (id = get_current_user_id())
  WITH CHECK (id = get_current_user_id());

-- ===================================================
-- RLS Policies for Energy Billing Tables
-- ===================================================

-- Clients: Scoped to organization
DROP POLICY IF EXISTS client_org_isolation ON clients;
CREATE POLICY client_org_isolation ON clients
  FOR ALL
  TO public
  USING ("organizationId" = get_current_organization_id())
  WITH CHECK ("organizationId" = get_current_organization_id());

-- Customers: Scoped to clients within organization
DROP POLICY IF EXISTS customer_client_isolation ON customers;
CREATE POLICY customer_client_isolation ON customers
  FOR ALL
  TO public
  USING (
    "clientId" IN (
      SELECT id FROM clients 
      WHERE "organizationId" = get_current_organization_id()
    )
  )
  WITH CHECK (
    "clientId" IN (
      SELECT id FROM clients 
      WHERE "organizationId" = get_current_organization_id()
    )
  );

-- Meter Readings: Scoped through customer -> client -> organization
DROP POLICY IF EXISTS meter_reading_isolation ON meter_readings;
CREATE POLICY meter_reading_isolation ON meter_readings
  FOR ALL
  TO public
  USING (
    "customerId" IN (
      SELECT c.id FROM customers c
      JOIN clients cl ON c."clientId" = cl.id
      WHERE cl."organizationId" = get_current_organization_id()
    )
  )
  WITH CHECK (
    "customerId" IN (
      SELECT c.id FROM customers c
      JOIN clients cl ON c."clientId" = cl.id
      WHERE cl."organizationId" = get_current_organization_id()
    )
  );

-- Tariff Rates: Scoped to clients within organization
DROP POLICY IF EXISTS tariff_rate_isolation ON tariff_rates;
CREATE POLICY tariff_rate_isolation ON tariff_rates
  FOR ALL
  TO public
  USING (
    "clientId" IN (
      SELECT id FROM clients 
      WHERE "organizationId" = get_current_organization_id()
    )
  )
  WITH CHECK (
    "clientId" IN (
      SELECT id FROM clients 
      WHERE "organizationId" = get_current_organization_id()
    )
  );

-- Tariff Blocks: Scoped through tariff rates
DROP POLICY IF EXISTS tariff_block_isolation ON tariff_blocks;
CREATE POLICY tariff_block_isolation ON tariff_blocks
  FOR ALL
  TO public
  USING (
    "tariffRateId" IN (
      SELECT tr.id FROM tariff_rates tr
      JOIN clients cl ON tr."clientId" = cl.id
      WHERE cl."organizationId" = get_current_organization_id()
    )
  )
  WITH CHECK (
    "tariffRateId" IN (
      SELECT tr.id FROM tariff_rates tr
      JOIN clients cl ON tr."clientId" = cl.id
      WHERE cl."organizationId" = get_current_organization_id()
    )
  );

-- Billing Periods: Scoped through customer -> client -> organization
DROP POLICY IF EXISTS billing_period_isolation ON billing_periods;
CREATE POLICY billing_period_isolation ON billing_periods
  FOR ALL
  TO public
  USING (
    "customerId" IN (
      SELECT c.id FROM customers c
      JOIN clients cl ON c."clientId" = cl.id
      WHERE cl."organizationId" = get_current_organization_id()
    )
  )
  WITH CHECK (
    "customerId" IN (
      SELECT c.id FROM customers c
      JOIN clients cl ON c."clientId" = cl.id
      WHERE cl."organizationId" = get_current_organization_id()
    )
  );

-- Invoices: Scoped through customer -> client -> organization
DROP POLICY IF EXISTS invoice_isolation ON invoices;
CREATE POLICY invoice_isolation ON invoices
  FOR ALL
  TO public
  USING (
    "customerId" IN (
      SELECT c.id FROM customers c
      JOIN clients cl ON c."clientId" = cl.id
      WHERE cl."organizationId" = get_current_organization_id()
    )
  )
  WITH CHECK (
    "customerId" IN (
      SELECT c.id FROM customers c
      JOIN clients cl ON c."clientId" = cl.id
      WHERE cl."organizationId" = get_current_organization_id()
    )
  );

-- ===================================================
-- RLS Policies for Existing System Tables
-- ===================================================

-- Workspaces: Scoped to organization
DROP POLICY IF EXISTS workspace_org_isolation ON workspaces;
CREATE POLICY workspace_org_isolation ON workspaces
  FOR ALL
  TO public
  USING (organization_id = get_current_organization_id())
  WITH CHECK (organization_id = get_current_organization_id());

-- Files: Scoped to organization
DROP POLICY IF EXISTS file_org_isolation ON files;
CREATE POLICY file_org_isolation ON files
  FOR ALL
  TO public
  USING (organization_id = get_current_organization_id())
  WITH CHECK (organization_id = get_current_organization_id());

-- Data Sources: Scoped to organization (via workspace_id)
DROP POLICY IF EXISTS data_source_org_isolation ON data_sources;
CREATE POLICY data_source_org_isolation ON data_sources
  FOR ALL
  TO public
  USING (workspace_id = get_current_organization_id())
  WITH CHECK (workspace_id = get_current_organization_id());

-- Document Chunks: Scoped through data source -> organization
DROP POLICY IF EXISTS document_chunk_isolation ON document_chunks;
CREATE POLICY document_chunk_isolation ON document_chunks
  FOR ALL
  TO public
  USING (
    data_source_id IN (
      SELECT ds.id FROM data_sources ds
      WHERE ds.workspace_id = get_current_organization_id()
    )
  )
  WITH CHECK (
    data_source_id IN (
      SELECT ds.id FROM data_sources ds
      WHERE ds.workspace_id = get_current_organization_id()
    )
  );

-- Chat Sessions: Scoped to organization
DROP POLICY IF EXISTS chat_session_org_isolation ON chat_sessions;
CREATE POLICY chat_session_org_isolation ON chat_sessions
  FOR ALL
  TO public
  USING (organization_id = get_current_organization_id())
  WITH CHECK (organization_id = get_current_organization_id());

-- Chat Messages: Scoped through chat session -> organization
DROP POLICY IF EXISTS chat_message_isolation ON chat_messages;
CREATE POLICY chat_message_isolation ON chat_messages
  FOR ALL
  TO public
  USING (
    session_id IN (
      SELECT cs.id FROM chat_sessions cs
      WHERE cs.organization_id = get_current_organization_id()
    )
  )
  WITH CHECK (
    session_id IN (
      SELECT cs.id FROM chat_sessions cs
      WHERE cs.organization_id = get_current_organization_id()
    )
  );

-- Dashboards: Scoped to organization
DROP POLICY IF EXISTS dashboard_org_isolation ON dashboards;
CREATE POLICY dashboard_org_isolation ON dashboards
  FOR ALL
  TO public
  USING (organization_id = get_current_organization_id())
  WITH CHECK (organization_id = get_current_organization_id());

-- Dashboard Widgets: Scoped through dashboard -> organization
DROP POLICY IF EXISTS dashboard_widget_isolation ON dashboard_widgets;
CREATE POLICY dashboard_widget_isolation ON dashboard_widgets
  FOR ALL
  TO public
  USING (
    dashboard_id IN (
      SELECT d.id FROM dashboards d
      WHERE d.organization_id = get_current_organization_id()
    )
  )
  WITH CHECK (
    dashboard_id IN (
      SELECT d.id FROM dashboards d
      WHERE d.organization_id = get_current_organization_id()
    )
  );

-- Conversations: Scoped to organization
DROP POLICY IF EXISTS conversation_org_isolation ON conversations;
CREATE POLICY conversation_org_isolation ON conversations
  FOR ALL
  TO public
  USING (organization_id = get_current_organization_id())
  WITH CHECK (organization_id = get_current_organization_id());

-- Messages: Scoped through conversation -> organization
DROP POLICY IF EXISTS message_isolation ON messages;
CREATE POLICY message_isolation ON messages
  FOR ALL
  TO public
  USING (
    conversation_id IN (
      SELECT c.id FROM conversations c
      WHERE c.organization_id = get_current_organization_id()
    )
  )
  WITH CHECK (
    conversation_id IN (
      SELECT c.id FROM conversations c
      WHERE c.organization_id = get_current_organization_id()
    )
  );

-- Automations: Scoped to organization
DROP POLICY IF EXISTS automation_org_isolation ON automations;
CREATE POLICY automation_org_isolation ON automations
  FOR ALL
  TO public
  USING (organization_id = get_current_organization_id())
  WITH CHECK (organization_id = get_current_organization_id());

-- ===================================================
-- Security Monitoring and Testing
-- ===================================================

-- Create a view to monitor RLS policy effectiveness
CREATE OR REPLACE VIEW rls_security_monitor AS
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled,
  (SELECT count(*) FROM pg_policy WHERE polrelid = (schemaname||'.'||tablename)::regclass) as policy_count
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- Function to test RLS isolation
CREATE OR REPLACE FUNCTION test_rls_isolation(test_org_id INTEGER)
RETURNS TABLE(table_name TEXT, isolation_test_result TEXT) AS $$
BEGIN
  -- Set the test organization context
  PERFORM set_config('app.current_organization_id', test_org_id::TEXT, true);
  
  -- Test each table (example for a few key tables)
  RETURN QUERY
  SELECT 'organizations'::TEXT, 
         CASE WHEN count(*) = 1 AND max(id) = test_org_id 
              THEN 'PASS: Only own organization visible'
              ELSE 'FAIL: Cross-tenant data visible'
         END::TEXT
  FROM organizations;
  
  RETURN QUERY
  SELECT 'clients'::TEXT,
         CASE WHEN count(*) = (SELECT count(*) FROM clients WHERE "organizationId" = test_org_id)
              THEN 'PASS: Only own clients visible'
              ELSE 'FAIL: Cross-tenant clients visible'
         END::TEXT
  FROM clients;
  
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Performance optimization indexes for RLS policies
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_clients_organization_id ON clients("organizationId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_client_id ON customers("clientId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_meter_readings_customer_id ON meter_readings("customerId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tariff_rates_client_id ON tariff_rates("clientId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_billing_periods_customer_id ON billing_periods("customerId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_customer_id ON invoices("customerId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_client_id ON invoices("clientId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_organization_members_org_id ON organization_members(organization_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_sessions_org_id ON chat_sessions(organization_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workspaces_org_id ON workspaces(organization_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_files_org_id ON files(organization_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_data_sources_workspace_id ON data_sources(workspace_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dashboards_org_id ON dashboards(organization_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conversations_org_id ON conversations(organization_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_automations_org_id ON automations(organization_id);

-- ===================================================
-- Migration Complete
-- ===================================================
-- RLS policies are now active and will enforce multi-tenant isolation
-- Use the test_rls_isolation() function to verify security
-- Monitor policy effectiveness with the rls_security_monitor view
-- =================================================== 