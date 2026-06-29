BEGIN;

INSERT INTO users (id, "unionId", name, email, role, "lastSignInAt", "createdAt", "updatedAt")
SELECT
  missing.id,
  'repaired:user:' || missing.id::text,
  COALESCE(member_names.name, 'Repaired User #' || missing.id::text),
  NULL,
  'user',
  now(),
  now(),
  now()
FROM (
  SELECT refs.id
  FROM (
    SELECT "ownerId"::bigint AS id FROM houses
    UNION
    SELECT "userId"::bigint AS id FROM "houseMembers" WHERE "userId" <> 0
    UNION
    SELECT "userId"::bigint AS id FROM "userCredentials"
    UNION
    SELECT "userId"::bigint AS id FROM "userPreferences"
  ) refs
  LEFT JOIN users u ON u.id = refs.id
  WHERE u.id IS NULL
) missing
LEFT JOIN (
  SELECT DISTINCT ON ("userId")
    "userId"::bigint AS id,
    nickname AS name
  FROM "houseMembers"
  WHERE "userId" <> 0
  ORDER BY "userId", id
) member_names ON member_names.id = missing.id
ORDER BY missing.id;

SELECT setval(
  pg_get_serial_sequence('users', 'id'),
  COALESCE((SELECT max(id) FROM users), 1),
  true
);

COMMIT;
