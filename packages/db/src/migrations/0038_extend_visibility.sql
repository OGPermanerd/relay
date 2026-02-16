-- Phase 69: Extended Visibility
-- Adds CHECK constraint for 4 visibility levels
-- Modifies RLS policy on skills to allow cross-tenant global_approved reads

-- Step 1: Add CHECK constraint for the 4 valid visibility values
ALTER TABLE skills
  ADD CONSTRAINT skills_visibility_check
  CHECK (visibility IN ('global_approved', 'tenant', 'personal', 'private'));

-- Step 2: Drop existing restrictive tenant isolation policy
DROP POLICY IF EXISTS tenant_isolation ON skills;

-- Step 3: Recreate policy allowing cross-tenant reads for global_approved skills
-- USING: Allow reads if same tenant OR skill is global_approved
-- WITH CHECK: Only allow writes within own tenant (no cross-tenant inserts/updates)
CREATE POLICY tenant_isolation ON skills FOR ALL
  USING (
    tenant_id = current_setting('app.current_tenant_id', true)
    OR visibility = 'global_approved'
  )
  WITH CHECK (
    tenant_id = current_setting('app.current_tenant_id', true)
  );
