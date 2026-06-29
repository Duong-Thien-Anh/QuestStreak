BEGIN;

DELETE FROM "userCredentials"
WHERE "userId" = 1
  AND email <> 'admin@example.com';

UPDATE "roomJoinRequests" SET "reviewedBy" = 1 WHERE "reviewedBy" = 6;
UPDATE "registrationRequests" SET "reviewedBy" = 1 WHERE "reviewedBy" = 6;
UPDATE "taskSubmissions" SET "reviewedBy" = 1 WHERE "reviewedBy" = 6;
UPDATE "houseInvites" SET "acceptedBy" = 1 WHERE "acceptedBy" = 6;

UPDATE users
SET id = 1, "updatedAt" = now()
WHERE id = 6
  AND NOT EXISTS (SELECT 1 FROM users WHERE id = 1);

UPDATE "userCredentials"
SET id = 1, "userId" = 1, "updatedAt" = now()
WHERE email = 'admin@example.com';

SELECT setval(
  pg_get_serial_sequence('users', 'id'),
  COALESCE((SELECT max(id) FROM users), 1),
  true
);

SELECT setval(
  pg_get_serial_sequence('"userCredentials"', 'id'),
  COALESCE((SELECT max(id) FROM "userCredentials"), 1),
  true
);

COMMIT;
