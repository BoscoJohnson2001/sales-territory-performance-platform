# PFIZER SALES PLATFORM
## Quick Command Reference

### Backend
```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run prisma:seed
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Deploy Frontend to GitHub Pages
```bash
cd frontend
npm run deploy
```

### Prisma Workflow
```bash
# After schema changes:
npm run prisma:migrate:dev  # create migration
npm run prisma:seed          # re-seed (upsert-safe)

# Full reset:
npm run prisma:reset

# Prod deploy:
npm run prisma:migrate:deploy
```
