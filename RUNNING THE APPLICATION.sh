# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your database credentials

# Push schema to database
npx prisma db push

# Generate Prisma client
npx prisma generate

# Seed the database
npm run db:seed

# Start development server
npm run dev
