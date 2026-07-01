INSERT INTO "User" ("id", "name", "email", "passwordHash", "role", "active", "createdAt", "updatedAt")
VALUES ('admin_flauzino', 'Flauzino', 'flauzino', '$2b$12$8xYmb.WCFdm.g.EYpztMNOnlKJfapL5n./EixXwyMpkFEbESA9ItS', 'ADMIN', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("email") DO NOTHING;