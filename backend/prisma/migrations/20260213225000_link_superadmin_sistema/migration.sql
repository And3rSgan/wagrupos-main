-- Garante que todos os SuperAdmin estejam vinculados à empresa Sistema Administrativo
UPDATE "User" u
SET "companyId" = (SELECT id FROM "Company" WHERE slug = 'sistema-administrativo' LIMIT 1)
WHERE u.role = 'SUPERADMIN'
  AND (
    u."companyId" IS NULL
    OR NOT EXISTS (SELECT 1 FROM "Company" c WHERE c.id = u."companyId")
  );
