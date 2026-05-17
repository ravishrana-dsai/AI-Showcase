-- Run as postgres superuser to fix "User talent_hub was denied access"
-- Usage: psql postgres -f scripts/create-db-user.sql
-- Or: psql -U postgres -f scripts/create-db-user.sql

-- Drop and recreate (uncomment only if you want a fresh start)
-- DROP DATABASE IF EXISTS talent_hub;
-- DROP USER IF EXISTS talent_hub;

CREATE USER talent_hub WITH PASSWORD 'talent_hub_dev';
CREATE DATABASE talent_hub OWNER talent_hub;
GRANT ALL PRIVILEGES ON DATABASE talent_hub TO talent_hub;
