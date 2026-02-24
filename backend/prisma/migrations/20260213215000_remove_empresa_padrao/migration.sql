-- Remove Empresa Padrão: transfere usuários/sessões para Sistema Administrativo
DO $$
DECLARE
  emp_padrao_id TEXT;
  sist_admin_id TEXT;
BEGIN
  SELECT id INTO emp_padrao_id FROM "Company" WHERE slug = 'empresa-padrao' LIMIT 1;
  SELECT id INTO sist_admin_id FROM "Company" WHERE slug = 'sistema-administrativo' LIMIT 1;
  
  IF sist_admin_id IS NOT NULL THEN
    UPDATE "User" SET "companyId" = sist_admin_id WHERE "companyId" = emp_padrao_id OR ("companyId" IS NULL AND role = 'SUPERADMIN');
    UPDATE "WhatsappSession" SET "companyId" = sist_admin_id WHERE "companyId" = emp_padrao_id;
  END IF;
  IF emp_padrao_id IS NOT NULL THEN
    DELETE FROM "Invoice" WHERE "companyId" = emp_padrao_id;
    DELETE FROM "Subscription" WHERE "companyId" = emp_padrao_id;
    DELETE FROM "Company" WHERE id = emp_padrao_id;
  END IF;
END $$;
