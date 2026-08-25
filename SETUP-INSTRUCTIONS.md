# AI Pledge - PostgreSQL Setup Instructions

## ⚠️ PostgreSQL Not Installed

You need to install PostgreSQL before running the application.

## 🔧 Step-by-Step Setup

### Step 1: Install PostgreSQL

```bash
# Install PostgreSQL using Homebrew
brew install postgresql@15

# Start PostgreSQL service
brew services start postgresql@15
```

Wait a minute for the service to start, then verify:

```bash
# Check if PostgreSQL is running
brew services list | grep postgresql
```

You should see `postgresql@15` with status `started`.

### Step 2: Create Database User (Optional)

By default, PostgreSQL creates a user with your macOS username. You can use that or create a new user:

```bash
# Connect to PostgreSQL
psql postgres

# Inside psql, create a user and database:
CREATE USER ai_pledge_user WITH PASSWORD 'your_secure_password';
CREATE DATABASE ai_pledge OWNER ai_pledge_user;
GRANT ALL PRIVILEGES ON DATABASE ai_pledge TO ai_pledge_user;

# Exit psql
\q
```

### Step 3: Update .env File

The `.env` file has been configured with default settings:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ai_pledge
```

**If you created a custom user**, update it to:

```env
DATABASE_URL=postgresql://ai_pledge_user:your_secure_password@localhost:5432/ai_pledge
```

**If using your macOS user**, update it to:

```env
DATABASE_URL=postgresql://your_username@localhost:5432/ai_pledge
```

(Replace `your_username` with your actual macOS username)

### Step 4: Create the Database

**Option A: Using default postgres user**
```bash
createdb -U postgres ai_pledge
```

**Option B: Using your macOS user**
```bash
createdb ai_pledge
```

**Option C: Using custom user**
```bash
createdb -U ai_pledge_user ai_pledge
```

### Step 5: Initialize Database Schema

```bash
npm run init-db
```

You should see:
```
✅  Connected successfully
✅  Schema executed successfully
✅  Tables created:
    ✓ students (14 columns)
    ✓ employees (14 columns)
```

### Step 6: Start the Server

```bash
npm start
```

You should see:
```
✅  AI Ethics Pledge
    Local:     http://localhost:6003
    Frontend:  https://vucse.app/oath
    API:       https://vucse.app/APO
    Database:  postgresql://****:****@localhost:5432/ai_pledge
```

### Step 7: Test Everything

```bash
npm test
```

---

## 🐛 Troubleshooting

### Error: "connection refused"

PostgreSQL is not running. Start it:
```bash
brew services start postgresql@15
```

### Error: "database does not exist"

Create the database:
```bash
createdb ai_pledge
```

### Error: "password authentication failed"

Update your DATABASE_URL in `.env` with the correct username/password.

### Error: "peer authentication failed"

You're trying to use a user that doesn't exist. Either:
1. Use your macOS username in DATABASE_URL, or
2. Create the PostgreSQL user first (see Step 2)

---

## 🚀 Quick Alternative: Use SQLite (Development Only)

If you want to test quickly without PostgreSQL, I can help you set up SQLite instead. Let me know!

---

## 📚 Next Steps

Once PostgreSQL is running:

1. **Configure existing university database** (optional):
   - Uncomment `EXISTING_DB_URL` in `.env`
   - Update `server.js` with your actual table/column names

2. **Start developing**:
   ```bash
   npm run dev  # Auto-reloads on changes
   ```

3. **Access the app**:
   - Open http://localhost:6003 in your browser
   - Test registration and pledge flow

---

Need help? Check:
- PostgreSQL docs: https://www.postgresql.org/docs/
- Homebrew PostgreSQL guide: https://wiki.postgresql.org/wiki/Homebrew
