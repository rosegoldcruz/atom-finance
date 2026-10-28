#!/bin/sh
set -eu
npx prisma migrate deploy
exec npx tsx server/index.ts
