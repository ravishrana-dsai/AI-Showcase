/**
 * Sets portal@123 as the password for ravish.rana@dream11.com.
 * Run with: DATABASE_URL="..." node --input-type=module scripts/set-admin-password.mjs
 *
 * Local:
 *   node --input-type=module scripts/set-admin-password.mjs
 *
 * Production:
 *   API_KEY=$(jq -r '.apiKey' ~/.dreamplay/credentials.json)
 *   DB_URL=$(curl -s -H "Authorization: Bearer $API_KEY" \
 *     https://experiments.dreamplay.co/api/databases/hiring-portal | jq -r '.public_url')
 *   DATABASE_URL="$DB_URL" node --input-type=module scripts/set-admin-password.mjs
 */

import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { PrismaClient } = require("./packages/db/node_modules/@prisma/client");
const bcrypt = require("./node_modules/bcryptjs");

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://talent_hub:talent_hub_dev@localhost:5432/talent_hub?schema=public";

const prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });

const passwordHash = await bcrypt.hash("portal@123", 12);

const updated = await prisma.user.updateMany({
  where: { email: "ravish.rana@dream11.com" },
  data: { passwordHash },
});

if (updated.count === 0) {
  console.log("No user found with email ravish.rana@dream11.com");
} else {
  console.log("Password set to portal@123 for ravish.rana@dream11.com");
}

await prisma.$disconnect();
