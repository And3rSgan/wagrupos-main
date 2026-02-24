-- Vincular SuperAdmin a uma empresa com validade até 2093
-- 1. Criar ou obter plano Vitalício
INSERT INTO "Plan" (id, name, slug, price, limits, "isActive")
SELECT gen_random_uuid()::text, 'Vitalício', 'vitalicio', 0, '{}', true
WHERE NOT EXISTS (SELECT 1 FROM "Plan" WHERE slug = 'vitalicio');

-- 2. Criar empresa do SuperAdmin (ignora se já existir)
INSERT INTO "Company" (id, name, slug, "isActive")
SELECT
  'company-superadmin-sistema',
  'Sistema Administrativo',
  'sistema-administrativo',
  true
WHERE NOT EXISTS (SELECT 1 FROM "Company" WHERE slug = 'sistema-administrativo');

-- 3. Criar assinatura com validade até 31/12/2093
INSERT INTO "Subscription" (
  id,
  "companyId",
  "planId",
  status,
  "billingDay",
  "currentPeriodStart",
  "currentPeriodEnd",
  "trialEndsAt"
)
SELECT
  gen_random_uuid()::text,
  c.id,
  (SELECT id FROM "Plan" WHERE slug = 'vitalicio' LIMIT 1),
  'active',
  1,
  CURRENT_DATE,
  '2093-12-31'::timestamp,
  NULL
FROM "Company" c
WHERE c.slug = 'sistema-administrativo'
  AND NOT EXISTS (SELECT 1 FROM "Subscription" s WHERE s."companyId" = c.id);

-- 4. Vincular SuperAdmin à empresa (usar id da company criada ou existente)
UPDATE "User" u
SET "companyId" = (SELECT id FROM "Company" WHERE slug = 'sistema-administrativo' LIMIT 1)
WHERE u.role = 'SUPERADMIN'
  AND u."companyId" IS NULL;
