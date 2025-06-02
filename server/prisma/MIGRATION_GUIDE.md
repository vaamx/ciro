# Database Migration Guide: Energy Billing Models & Row-Level Security

## Overview

This guide documents the comprehensive database migration that adds energy billing models and implements Row-Level Security (RLS) for multi-tenant data isolation.

## Migration Details

### Migration: `20250601172703_add_energy_billing_models`

**What this migration does:**
1. Adds comprehensive energy billing models to support multi-tenant energy billing system
2. Implements Row-Level Security (RLS) policies for complete data isolation
3. Creates helper functions and monitoring utilities for RLS management
4. Adds performance indexes optimized for multi-tenant queries

### New Energy Billing Models Added

#### 1. Client
- Represents energy companies (EIS Power's customers)
- Each client has their own portal and customer base
- Fields: name, code, contact info, billing configuration
- Multi-tenant isolation via `organizationId`

#### 2. Customer  
- End-users within each client's portal
- Fields: customer info, service address, account details
- Multi-tenant isolation via `clientId` → `organizationId`

#### 3. MeterReading
- Energy consumption data with time-of-use support
- Fields: meter data, readings, demand, time-of-use periods
- Supports 15-minute interval data processing

#### 4. TariffRate
- Pricing structures (flat, tiered, time-of-use, demand)
- Fields: rate configuration, effective dates, pricing tiers
- Supports complex rate structures

#### 5. TariffBlock
- Tiered pricing blocks for complex rate structures
- Used with TariffRate for tiered billing

#### 6. BillingPeriod
- Billing cycles with calculated totals
- Links customers to billing periods and invoice generation

#### 7. Invoice
- Final bills with detailed charge breakdown
- Fields: charges, usage summary, payment tracking
- PDF generation support

### Enhanced Role System

Extended the existing `Role` enum to support energy billing:
- `ENERGY_ADMIN` - Energy system administrators
- `CLIENT_ADMIN` - Client portal administrators  
- `CUSTOMER_USER` - End customer users

## Row-Level Security (RLS) Implementation

### Security Model

**Three-tier isolation:**
1. **Organizations** - Top-level tenants (e.g., EIS Power)
2. **Clients** - Energy companies within each organization
3. **Customers** - End-users within each client

### RLS Helper Functions

1. `get_current_organization_id()` - Retrieves current user's organization context
2. `get_current_user_id()` - Gets current user ID from session
3. `is_organization_admin()` - Checks admin privileges
4. `get_accessible_client_ids()` - Returns accessible clients for user

### Security Policies Applied

**Core Tables:**
- `organizations` - Users see only their organization
- `organization_members` - Scoped to user's organization  
- `users` - Users see organization members + themselves

**Energy Billing Tables:**
- `clients` - Scoped to organization
- `customers` - Scoped to clients within organization
- `meter_readings` - Scoped through customer → client → organization
- `tariff_rates` - Scoped to clients within organization
- `billing_periods` - Scoped through customer chain
- `invoices` - Scoped through customer chain

**Existing System Tables:**
- All existing tables (workspaces, files, chat_sessions, etc.) now have RLS policies

### Performance Optimizations

Created indexes optimized for RLS policy queries:
- `idx_clients_organization_id`
- `idx_customers_client_id`  
- `idx_meter_readings_customer_id`
- `idx_tariff_rates_client_id`
- `idx_billing_periods_customer_id`
- `idx_invoices_customer_id`
- Plus indexes for existing system tables

## Migration Process

### 1. Schema Migration (Automated)

```bash
cd server/
npx prisma migrate dev --name add_energy_billing_models
```

This creates and applies the database schema changes automatically.

### 2. RLS Policies Application

The RLS policies are applied via a separate SQL script:

```bash
# Apply RLS policies
docker exec -i ciro-postgres psql -U postgres -d ciro_db < \
  server/prisma/migrations/20250601172703_add_energy_billing_models/rls-policies.sql
```

### 3. Verification

Test RLS isolation:
```sql
-- Set organization context
SELECT set_config('app.current_organization_id', '1', true);

-- Test isolation function
SELECT * FROM test_rls_isolation(1);

-- Monitor RLS effectiveness  
SELECT * FROM rls_security_monitor;
```

## Environment-Specific Deployment

### Development Environment
1. Run Prisma migration: `npx prisma migrate dev`
2. Apply RLS policies via Docker exec (as shown above)
3. Test with existing test users

### Staging Environment
1. Backup database before migration
2. Run migration: `npx prisma migrate deploy`  
3. Apply RLS policies via database admin connection
4. Run verification tests
5. Test application functionality

### Production Environment  
1. **CRITICAL**: Schedule maintenance window
2. Create full database backup
3. Test migration on staging replica first
4. Run migration: `npx prisma migrate deploy`
5. Apply RLS policies via secure admin connection
6. Run comprehensive verification tests
7. Monitor application performance post-migration
8. Have rollback plan ready

## Rollback Procedures

### Emergency Rollback (RLS Only)

If RLS policies cause issues, disable them quickly:

```bash
# Disable RLS only (keeps schema changes)
docker exec -i ciro-postgres psql -U postgres -d ciro_db < \
  server/prisma/migrations/20250601172703_add_energy_billing_models/rollback-rls-policies.sql
```

### Full Schema Rollback

**WARNING**: This will remove all energy billing data!

```bash
# Rollback the entire migration
npx prisma migrate reset  # Development only
# OR manually drop tables and restore from backup (Production)
```

## Application Integration Requirements

### 1. Update Prisma Client Generation
```bash
npx prisma generate
```

### 2. Environment Variables
Ensure these are set for RLS context:
- Session variables set via Prisma middleware
- User authentication provides organization context

### 3. Application Code Updates
- Import new models in services
- Update authentication middleware to set RLS context
- Implement tenant context providers

## Security Verification Checklist

- [ ] RLS is enabled on all tenant-scoped tables
- [ ] Helper functions are created with SECURITY DEFINER
- [ ] Policies prevent cross-tenant data access
- [ ] Performance indexes are created
- [ ] Monitoring views are functional
- [ ] Test isolation with multiple organizations
- [ ] Verify existing functionality still works
- [ ] Test admin vs regular user access
- [ ] Confirm API endpoints respect tenant isolation

## Monitoring & Maintenance

### Regular Security Audits
```sql
-- Check RLS status
SELECT * FROM rls_security_monitor;

-- Test isolation periodically  
SELECT * FROM test_rls_isolation(1);
SELECT * FROM test_rls_isolation(2);
```

### Performance Monitoring
- Monitor query performance with new RLS policies
- Check index usage and effectiveness
- Watch for slow queries on tenant-scoped operations

## Troubleshooting

### Common Issues

1. **Permission denied errors**
   - Check organization context is set in session
   - Verify user is member of organization
   - Confirm RLS policies are correctly applied

2. **Performance issues**
   - Verify indexes are being used
   - Check query execution plans
   - Consider additional indexes if needed

3. **Cross-tenant data visibility**
   - Test RLS isolation function
   - Check policy conditions match schema field names
   - Verify session variables are set correctly

### Debug Queries

```sql
-- Check current session context
SELECT current_setting('app.current_organization_id', true);
SELECT current_setting('app.current_user_id', true);

-- View active policies
SELECT schemaname, tablename, policyname, cmd, permissive, roles, qual, with_check
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

## Support Contacts

- **Database Issues**: Database Administrator
- **Application Integration**: Backend Development Team  
- **Security Concerns**: Security Team
- **Performance Issues**: DevOps Team

---

**Migration Created**: 2025-06-01  
**Documentation Version**: 1.0  
**Last Updated**: 2025-06-01 