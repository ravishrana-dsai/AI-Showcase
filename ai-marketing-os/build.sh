#!/bin/sh
export DATABASE_URL="postgresql://marketing_os:f26af0bc4d18fce3e05011215ecb5ee9@localhost:5432/marketing_os"
npx prisma generate && npm run build
