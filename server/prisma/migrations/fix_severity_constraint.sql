-- Fix security_logs severity check constraint to allow 'warn'
-- Drop existing constraint and create new one

-- Drop the existing check constraint
ALTER TABLE security_logs DROP CONSTRAINT IF EXISTS security_logs_severity_check;

-- Add new check constraint that allows 'info', 'warn', 'error'
ALTER TABLE security_logs ADD CONSTRAINT security_logs_severity_check
  CHECK (severity IN ('info', 'warn', 'error'));
