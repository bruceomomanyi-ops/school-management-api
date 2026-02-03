# School Management System Backend

Node.js Express API for School Management System - configured for PostgreSQL (Render.com)

## Prerequisites

- Node.js 18+
- PostgreSQL 14+

## Installation

```bash
npm install
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

```env
# Database Configuration (for local development)
DB_HOST=localhost
DB_USER=myuser
DB_PASSWORD=MyStrongPass123!
DB_NAME=school_management
DB_PORT=5432

# Server Configuration
PORT=3000

# JWT Configuration (change this in production!)
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# For production (Render.com), use DATABASE_URL instead
# DATABASE_URL=postgres://user:pass@host:5432/db
```

## Local Development

1. Create PostgreSQL database:
```sql
CREATE DATABASE school_management;
```

2. Run the schema:
```bash
psql -U myuser -d school_management -f database/schema.postgres.sql
```

3. Start the server:
```bash
npm run dev
```

## Production Deployment (Render.com)

### 1. Create GitHub Repository
Push this code to GitHub:
```bash
git add .
git commit -m "Update to PostgreSQL for Render.com"
git remote add origin https://github.com/bruceomomanyi-ops/school-management-api.git
git push -u origin main
```

### 2. Create PostgreSQL Database on Render
1. Go to https://dashboard.render.com
2. Click "New +" → "PostgreSQL"
3. Configure:
   - **Name**: `school-db`
   - **Database**: `school_management`
   - **User**: `school_user`
4. Wait for provisioning (~2 minutes)
5. Copy the **"Internal Database URL"** (format: `postgres://user:pass@host:5432/db`)

### 3. Create Web Service on Render
1. Click "New +" → "Web Service"
2. Connect your GitHub repository
3. Configure:
   - **Name**: `school-api`
   - **Root Directory**: `/`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. Add Environment Variables:
   ```
   DATABASE_URL=postgres://your-copied-url-here
   JWT_SECRET=generate-a-strong-random-string-here
   PORT=10000
   ```
5. Click "Create Web Service"

### 4. Run Database Schema
Once the database is ready:
1. Go to your PostgreSQL database in Render dashboard
2. Click "psql" shell
3. Copy contents of `database/schema.postgres.sql` and run

### 5. Get Your Backend URL
After deployment, your API will be at:
`https://school-api-xxxx.onrender.com`

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user

### Students
- `GET /api/students` - List all students (with optional filters)
- `GET /api/students/:id` - Get single student
- `POST /api/students` - Create student (admin/teacher)
- `PUT /api/students/:id` - Update student (admin/teacher)
- `DELETE /api/students/:id` - Delete student (admin)

### Teachers
- `GET /api/teachers` - List all teachers
- `GET /api/teachers/:id` - Get single teacher with assignments
- `POST /api/teachers` - Create teacher (admin)
- `PUT /api/teachers/:id` - Update teacher (admin)

### Classes
- `GET /api/classes` - List all classes
- `GET /api/classes/:id` - Get class with students and subjects
- `POST /api/classes` - Create class (admin)
- `PUT /api/classes/:id` - Update class (admin)

### Subjects
- `GET /api/subjects` - List all subjects
- `POST /api/subjects` - Create subject (admin)

### Grades
- `GET /api/grades/student/:id` - Get grades for a student
- `POST /api/grades` - Record grade (admin/teacher)

### Attendance
- `GET /api/attendance/student/:id` - Get attendance for a student
- `POST /api/attendance` - Record attendance (admin/teacher)

### Fees
- `GET /api/fees/student/:id` - Get fees for a student
- `POST /api/fees` - Create fee (admin)
- `PUT /api/fees/:id` - Update fee payment (admin)

### Events
- `GET /api/events` - List all events
- `POST /api/events` - Create event (admin/teacher)

### Health Check
- `GET /api/health` - Health check endpoint

## Frontend Integration

Update your Flutter frontend `lib/services/api_config.dart`:

```dart
class ApiConfig {
  static const String baseUrl = 'https://school-api-xxxx.onrender.com';
}
```

## License

ISC
