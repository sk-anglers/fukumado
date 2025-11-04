import prisma from '../src/services/prismaService';

async function fixSeverityConstraint() {
  try {
    console.log('[Migration] Fixing security_logs severity check constraint...');

    // Drop existing constraint
    await prisma.$executeRawUnsafe(`
      ALTER TABLE security_logs DROP CONSTRAINT IF EXISTS security_logs_severity_check;
    `);
    console.log('[Migration] ✓ Dropped existing constraint');

    // Add new constraint that allows 'info', 'warn', 'error'
    await prisma.$executeRawUnsafe(`
      ALTER TABLE security_logs ADD CONSTRAINT security_logs_severity_check
        CHECK (severity IN ('info', 'warn', 'error'));
    `);
    console.log('[Migration] ✓ Added new constraint (allows: info, warn, error)');

    console.log('[Migration] ✅ Migration completed successfully');
  } catch (error) {
    console.error('[Migration] ❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

fixSeverityConstraint();
