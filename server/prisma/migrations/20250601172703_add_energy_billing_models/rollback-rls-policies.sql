-- ===================================================
-- ROLLBACK SCRIPT for RLS Policies
-- ===================================================
-- This script removes all RLS policies and helper functions
-- Use this to rollback the RLS implementation if needed
-- WARNING: This will disable multi-tenant security!
-- ===================================================

-- Disable RLS on all tables
ALTER TABLE organizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE meter_readings DISABLE ROW LEVEL SECURITY;
ALTER TABLE tariff_rates DISABLE ROW LEVEL SECURITY;
ALTER TABLE tariff_blocks DISABLE ROW LEVEL SECURITY;
ALTER TABLE billing_periods DISABLE ROW LEVEL SECURITY;
ALTER TABLE invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces DISABLE ROW LEVEL SECURITY;
ALTER TABLE files DISABLE ROW LEVEL SECURITY;
ALTER TABLE data_sources DISABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks DISABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE dashboards DISABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_widgets DISABLE ROW LEVEL SECURITY;
ALTER TABLE conversations DISABLE ROW LEVEL SECURITY;
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE automations DISABLE ROW LEVEL SECURITY;

-- Drop all RLS policies
DROP POLICY IF EXISTS organization_isolation ON organizations;
DROP POLICY IF EXISTS org_member_isolation ON organization_members;
DROP POLICY IF EXISTS user_org_isolation ON users;
DROP POLICY IF EXISTS user_self_update ON users;
DROP POLICY IF EXISTS client_org_isolation ON clients;
DROP POLICY IF EXISTS customer_client_isolation ON customers;
DROP POLICY IF EXISTS meter_reading_isolation ON meter_readings;
DROP POLICY IF EXISTS tariff_rate_isolation ON tariff_rates;
DROP POLICY IF EXISTS tariff_block_isolation ON tariff_blocks;
DROP POLICY IF EXISTS billing_period_isolation ON billing_periods;
DROP POLICY IF EXISTS invoice_isolation ON invoices;
DROP POLICY IF EXISTS workspace_org_isolation ON workspaces;
DROP POLICY IF EXISTS file_org_isolation ON files;
DROP POLICY IF EXISTS data_source_org_isolation ON data_sources;
DROP POLICY IF EXISTS document_chunk_isolation ON document_chunks;
DROP POLICY IF EXISTS chat_session_org_isolation ON chat_sessions;
DROP POLICY IF EXISTS chat_message_isolation ON chat_messages;
DROP POLICY IF EXISTS dashboard_org_isolation ON dashboards;
DROP POLICY IF EXISTS dashboard_widget_isolation ON dashboard_widgets;
DROP POLICY IF EXISTS conversation_org_isolation ON conversations;
DROP POLICY IF EXISTS message_isolation ON messages;
DROP POLICY IF EXISTS automation_org_isolation ON automations;

-- Drop helper functions
DROP FUNCTION IF EXISTS get_current_organization_id();
DROP FUNCTION IF EXISTS get_current_user_id();
DROP FUNCTION IF EXISTS is_organization_admin();
DROP FUNCTION IF EXISTS get_accessible_client_ids();
DROP FUNCTION IF EXISTS test_rls_isolation(INTEGER);

-- Drop monitoring views
DROP VIEW IF EXISTS rls_security_monitor;

-- Drop RLS-specific indexes (optional, but these can stay for performance)
-- DROP INDEX IF EXISTS idx_clients_organization_id;
-- DROP INDEX IF EXISTS idx_customers_client_id;
-- DROP INDEX IF EXISTS idx_meter_readings_customer_id;
-- DROP INDEX IF EXISTS idx_tariff_rates_client_id;
-- DROP INDEX IF EXISTS idx_billing_periods_customer_id;
-- DROP INDEX IF EXISTS idx_invoices_customer_id;
-- DROP INDEX IF EXISTS idx_invoices_client_id;

-- ===================================================
-- ROLLBACK COMPLETE
-- ===================================================
-- All RLS policies have been removed
-- Multi-tenant security is now DISABLED
-- =================================================== 