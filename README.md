# School Management System Backend

Node.js Express API for School Management System

## Prerequisites

- Node.js 18+
- MySQL 8.0+

## Installation

```bash
npm install
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

```env
# Database Configuration
DB_HOST=localhost
DB_USER=myuser
DB_PASSWORD=MyStrongPass123!
DB_NAME=school_management

# Server Configuration
PORT=3000

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-in-production
```

## Database Setup

1. Create the database:
```sql
CREATE DATABASE school_management;
```

2. Run the schema:
```bash
mysql -u root -p school_management < database/schema.sql
```

## Development

```bash
npm run dev
```

## Production

```bash
npm start
```

## Deploy to Render.com

### 1. Create GitHub Repository
Push this code to GitHub:
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/yourusername/school_app_backend.git
git push -u origin main
```

### 2. Create MySQL Database on Render
1. Go to https://dashboard.render.com
2. Click "New" → "PostgreSQL" or "MySQL"
3. Configure:
   - Name: `school-db`
   - Database: `school_management`
   - User: `school_user`
4. Wait for database to be provisioned
5. Copy the internal database URL

### 3. Create Web Service on Render
1. Click "New" → "Web Service"
2. Connect your GitHub repository
3. Configure:
   - Name: `school-api`
   - Root Directory: `/` (leave default)
   - Build Command: `npm install`
   - Start Command: `npm start`
4. Add Environment Variables:
   - `DB_HOST`: from MySQL connection
   - `DB_USER`: from MySQL connection
   - `DB_PASSWORD`: from MySQL connection
   - `DB_NAME`: `school_management`
   - `JWT_SECRET`: generate a strong random string
   - `PORT`: `10000` (Render assigns this automatically)

### 4. Run Database Schema
1. In Render dashboard, go to your MySQL database
2. Click "psql" shell or use a MySQL client
3. Copy contents of `database/schema.sql` and run

### 5. Get Your Backend URL
After deployment, your API will be at:
`https://school-api-xxxx.onrender.com`

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user

### Students
- `GET /api/students` - List all students
- `GET /api/students/:id` - Get single student
- `POST /api/students` - Create student (admin/teacher)
- `PUT /api/students/:id` - Update student (admin/teacher)
- `DELETE /api/students/:id` - Delete student (admin)

### Teachers
- `GET /api/teachers` - List all teachers
- `GET /api/teachers/:id` - Get single teacher
- `POST /api/teachers` - Create teacher (admin)
- `PUT /api/teachers/:id` - Update teacher (admin)

### Classes
- `GET /api/classes` - List all classes
- `GET /api/classes/:id` - Get class with students

## Default Admin Account

After running the schema, create an admin user via the register endpoint:
- Email: `admin@school.com`
- Password: `admin123` (change in production!)
