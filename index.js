// ===============================
// School Management System API
// ===============================

// 1. Imports
require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, param, query, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 2. App setup
const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

// Middleware
app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:3001', 'https://school-app-web.netlify.app', 'https://*.netlify.app'],
    credentials: true
}));
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));

// 3. Database configuration
// Support both connection string (DATABASE_URL) and individual config
const dbConfig = process.env.DATABASE_URL ? {
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
} : {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'myuser',
    password: process.env.DB_PASSWORD || 'MyStrongPass123!',
    database: process.env.DB_NAME || 'school_management',
    port: process.env.DB_PORT || 5432
};

// Create connection pool
const pool = new Pool(dbConfig);

// Helper function to format PostgreSQL results
const formatResult = (result) => {
    return { rows: result.rows, rowCount: result.rowCount };
};

// 4. Database initialization
const initDatabase = async () => {
    try {
        // Test connection
        const client = await pool.connect();
        console.log('✅ Connected to PostgreSQL database');
        
        // Create tables if they don't exist
        await pool.query(`
            -- Users table
            CREATE TABLE IF NOT EXISTS users (
                user_id SERIAL PRIMARY KEY,
                email VARCHAR(255) NOT NULL UNIQUE,
                password_hash VARCHAR(255) NOT NULL,
                role VARCHAR(20) NOT NULL DEFAULT 'student' CHECK (role IN ('admin', 'teacher', 'student', 'parent')),
                linked_student_id INTEGER NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        
            -- Students table
            CREATE TABLE IF NOT EXISTS students (
                student_id SERIAL PRIMARY KEY,
                first_name VARCHAR(100) NOT NULL,
                last_name VARCHAR(100) NOT NULL,
                date_of_birth DATE NOT NULL,
                gender VARCHAR(20) NOT NULL CHECK (gender IN ('male', 'female', 'other')),
                admission_number VARCHAR(50) NOT NULL UNIQUE,
                date_admitted DATE NOT NULL,
                class_id INTEGER NULL,
                address TEXT NULL,
                phone VARCHAR(20) NULL,
                parent_id INTEGER NULL,
                status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'graduated')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        
            -- Teachers table
            CREATE TABLE IF NOT EXISTS teachers (
                teacher_id SERIAL PRIMARY KEY,
                first_name VARCHAR(100) NOT NULL,
                last_name VARCHAR(100) NOT NULL,
                email VARCHAR(255) NOT NULL UNIQUE,
                phone VARCHAR(20) NULL,
                subject_specialization VARCHAR(200) NOT NULL,
                hire_date DATE NULL,
                salary DECIMAL(10, 2) NULL,
                status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'on_leave')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        
            -- Classes table
            CREATE TABLE IF NOT EXISTS classes (
                class_id SERIAL PRIMARY KEY,
                class_name VARCHAR(100) NOT NULL,
                grade_level INTEGER NOT NULL,
                class_teacher_id INTEGER NULL,
                academic_year VARCHAR(20) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        
            -- Subjects table
            CREATE TABLE IF NOT EXISTS subjects (
                subject_id SERIAL PRIMARY KEY,
                subject_name VARCHAR(100) NOT NULL,
                subject_code VARCHAR(50) NULL,
                description TEXT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        
            -- Teacher Subjects table
            CREATE TABLE IF NOT EXISTS teacher_subjects (
                assignment_id SERIAL PRIMARY KEY,
                teacher_id INTEGER NOT NULL,
                subject_id INTEGER NOT NULL,
                class_id INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(teacher_id, subject_id, class_id)
            );
        
            -- Grades table
            CREATE TABLE IF NOT EXISTS grades (
                grade_id SERIAL PRIMARY KEY,
                student_id INTEGER NOT NULL,
                subject_id INTEGER NOT NULL,
                class_id INTEGER NOT NULL,
                teacher_id INTEGER NOT NULL,
                exam_type VARCHAR(20) NOT NULL CHECK (exam_type IN ('test', 'midterm', 'final', 'assignment', 'project')),
                grade DECIMAL(5, 2) NOT NULL,
                max_grade DECIMAL(5, 2) DEFAULT 100,
                comments TEXT NULL,
                graded_at DATE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        
            -- Attendance table
            CREATE TABLE IF NOT EXISTS attendance (
                attendance_id SERIAL PRIMARY KEY,
                student_id INTEGER NOT NULL,
                class_id INTEGER NOT NULL,
                date DATE NOT NULL,
                status VARCHAR(20) NOT NULL CHECK (status IN ('present', 'absent', 'late', 'excused')),
                remarks TEXT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(student_id, class_id, date)
            );
        
            -- Fees table
            CREATE TABLE IF NOT EXISTS fees (
                fee_id SERIAL PRIMARY KEY,
                student_id INTEGER NOT NULL,
                fee_type VARCHAR(100) NOT NULL,
                amount DECIMAL(10, 2) NOT NULL,
                due_date DATE NOT NULL,
                status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'waived')),
                payment_date DATE NULL,
                payment_method VARCHAR(50) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        
            -- Events table
            CREATE TABLE IF NOT EXISTS events (
                event_id SERIAL PRIMARY KEY,
                title VARCHAR(200) NOT NULL,
                description TEXT NULL,
                event_date DATE NOT NULL,
                event_time TIME NULL,
                location VARCHAR(255) NULL,
                created_by INTEGER NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ Database tables ensured');
        
        // Insert sample data
        await pool.query(`
            INSERT INTO subjects (subject_name, subject_code, description) VALUES
            ('Mathematics', 'MATH', 'Basic mathematics'),
            ('English', 'ENG', 'English language'),
            ('Science', 'SCI', 'General science'),
            ('Social Studies', 'SST', 'Social studies'),
            ('Physics', 'PHY', 'Physics'),
            ('Chemistry', 'CHEM', 'Chemistry'),
            ('Biology', 'BIO', 'Biology'),
            ('History', 'HIST', 'World history')
            ON CONFLICT DO NOTHING;
        
            INSERT INTO classes (class_name, grade_level, academic_year) VALUES
            ('Grade 1', 1, '2024'),
            ('Grade 2', 2, '2024'),
            ('Grade 3', 3, '2024'),
            ('Grade 4', 4, '2024'),
            ('Grade 5', 5, '2024'),
            ('Grade 6', 6, '2024'),
            ('Form 1', 7, '2024'),
            ('Form 2', 8, '2024'),
            ('Form 3', 9, '2024'),
            ('Form 4', 10, '2024')
            ON CONFLICT DO NOTHING;
        `);
        console.log('✅ Sample data inserted');
        
        // Create default admin user
        const hashedPassword = await bcrypt.hash('admin123', 10);
        await pool.query(`
            INSERT INTO users (email, password_hash, role) 
            VALUES ($1, $2, $3)
            ON CONFLICT (email) DO UPDATE SET password_hash = $2, role = $3
        `, ['admin@school.com', hashedPassword, 'admin']);
        console.log('✅ Admin user created (admin@school.com / admin123)');
        
        client.release();
    } catch (err) {
        console.error('❌ Database initialization failed:', err.message);
    }
};

// 5. JWT Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

// Role-based access control middleware
const authorizeRoles = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
        }
        next();
    };
};

// 6. Validation error handler
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            error: 'Validation failed',
            details: errors.array() 
        });
    }
    next();
};

// ===============================
// AUTH ROUTES
// ===============================

// Register user
app.post('/api/auth/register', [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('role').isIn(['admin', 'teacher', 'student', 'parent']),
    handleValidationErrors
], async (req, res) => {
    try {
        const { email, password, role, linked_student_id } = req.body;

        // Check if email exists
        const existing = await pool.query('SELECT user_id FROM users WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await pool.query(
            'INSERT INTO users (email, password_hash, role, linked_student_id) VALUES ($1, $2, $3, $4) RETURNING user_id',
            [email, hashedPassword, role, linked_student_id || null]
        );

        res.status(201).json({
            message: 'User registered successfully',
            user_id: result.rows[0].user_id
        });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Login
app.post('/api/auth/login', [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
    handleValidationErrors
], async (req, res) => {
    try {
        const { email, password } = req.body;

        const users = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (users.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const user = users.rows[0];
        const match = await bcrypt.compare(password, user.password_hash);

        if (!match) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const token = jwt.sign(
            { 
                user_id: user.user_id, 
                email: user.email, 
                role: user.role,
                linked_student_id: user.linked_student_id 
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            message: 'Login successful',
            token,
            user: {
                user_id: user.user_id,
                email: user.email,
                role: user.role,
                linked_student_id: user.linked_student_id
            }
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get current user profile
app.get('/api/auth/me', authenticateToken, async (req, res) => {
    try {
        const users = await pool.query(
            'SELECT user_id, email, role, linked_student_id, created_at FROM users WHERE user_id = $1',
            [req.user.user_id]
        );
        if (users.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(users.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// ===============================
// STUDENTS ROUTES
// ===============================

// GET all students
app.get('/api/students', authenticateToken, async (req, res) => {
    try {
        const search = req.query.search || '';
        const status = req.query.status || '';
        const classId = req.query.class_id || '';

        let sql = `
            SELECT s.*, c.class_name, c.grade_level 
            FROM students s 
            LEFT JOIN classes c ON s.class_id = c.class_id 
            WHERE 1=1
        `;
        const params = [];
        let paramCount = 0;

        if (search) {
            paramCount++;
            sql += ` AND (s.first_name LIKE $${paramCount} OR s.last_name LIKE $${paramCount} OR s.admission_number LIKE $${paramCount})`;
            params.push(`%${search}%`);
        }

        if (status) {
            paramCount++;
            sql += ` AND s.status = $${paramCount}`;
            params.push(status);
        }

        if (classId) {
            paramCount++;
            sql += ` AND s.class_id = $${paramCount}`;
            params.push(classId);
        }

        sql += ' ORDER BY s.created_at DESC';

        const students = await pool.query(sql, params);
        res.json(students.rows);
    } catch (err) {
        console.error('Get students error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET single student
app.get('/api/students/:id', authenticateToken, async (req, res) => {
    try {
        const students = await pool.query(
            `SELECT s.*, c.class_name, c.grade_level, 
                    p.user_id as parent_user_id, p.email as parent_email
             FROM students s 
             LEFT JOIN classes c ON s.class_id = c.class_id 
             LEFT JOIN users p ON s.parent_id = p.user_id
             WHERE s.student_id = $1`,
            [req.params.id]
        );

        if (students.rows.length === 0) {
            return res.status(404).json({ error: 'Student not found' });
        }

        res.json(students.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// POST create student
app.post('/api/students', authenticateToken, authorizeRoles('admin', 'teacher'), [
    body('first_name').trim().notEmpty(),
    body('last_name').trim().notEmpty(),
    body('date_of_birth').isISO8601(),
    body('gender').isIn(['male', 'female', 'other']),
    body('admission_number').trim().notEmpty(),
    body('date_admitted').isISO8601(),
    handleValidationErrors
], async (req, res) => {
    try {
        const {
            first_name, last_name, date_of_birth, gender,
            admission_number, date_admitted, class_id, address, phone
        } = req.body;

        // Check admission number uniqueness
        const existing = await pool.query(
            'SELECT student_id FROM students WHERE admission_number = $1',
            [admission_number]
        );
        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'Admission number already exists' });
        }

        const result = await pool.query(
            `INSERT INTO students 
             (first_name, last_name, date_of_birth, gender, admission_number, date_admitted, class_id, address, phone)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING student_id`,
            [first_name, last_name, date_of_birth, gender, admission_number, date_admitted, class_id || null, address || null, phone || null]
        );

        res.status(201).json({
            message: 'Student created successfully',
            student_id: result.rows[0].student_id
        });
    } catch (err) {
        console.error('Create student error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT update student
app.put('/api/students/:id', authenticateToken, authorizeRoles('admin', 'teacher'), [
    body('first_name').optional().trim().notEmpty(),
    body('last_name').optional().trim().notEmpty(),
    body('gender').optional().isIn(['male', 'female', 'other']),
    handleValidationErrors
], async (req, res) => {
    try {
        const { first_name, last_name, date_of_birth, gender, class_id, address, phone, status } = req.body;

        await pool.query(
            `UPDATE students SET 
             first_name = COALESCE($1, first_name),
             last_name = COALESCE($2, last_name),
             date_of_birth = COALESCE($3, date_of_birth),
             gender = COALESCE($4, gender),
             class_id = COALESCE($5, class_id),
             address = COALESCE($6, address),
             phone = COALESCE($7, phone),
             status = COALESCE($8, status)
             WHERE student_id = $9`,
            [first_name, last_name, date_of_birth, gender, class_id, address, phone, status, req.params.id]
        );

        res.json({ message: 'Student updated successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE student
app.delete('/api/students/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM students WHERE student_id = $1', [req.params.id]);
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Student not found' });
        }

        res.json({ message: 'Student deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// ===============================
// TEACHERS ROUTES
// ===============================

// GET all teachers
app.get('/api/teachers', authenticateToken, async (req, res) => {
    try {
        const teachers = await pool.query('SELECT * FROM teachers ORDER BY created_at DESC');
        res.json(teachers.rows);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// GET single teacher
app.get('/api/teachers/:id', authenticateToken, async (req, res) => {
    try {
        const teachers = await pool.query('SELECT * FROM teachers WHERE teacher_id = $1', [req.params.id]);
        
        if (teachers.rows.length === 0) {
            return res.status(404).json({ error: 'Teacher not found' });
        }

        // Get assigned subjects
        const assignments = await pool.query(
            `SELECT ts.*, s.subject_name, c.class_name 
             FROM teacher_subjects ts
             JOIN subjects s ON ts.subject_id = s.subject_id
             JOIN classes c ON ts.class_id = c.class_id
             WHERE ts.teacher_id = $1`,
            [req.params.id]
        );

        res.json({ ...teachers.rows[0], assignments: assignments.rows });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// POST create teacher
app.post('/api/teachers', authenticateToken, authorizeRoles('admin'), [
    body('first_name').trim().notEmpty(),
    body('last_name').trim().notEmpty(),
    body('email').isEmail(),
    body('subject_specialization').trim().notEmpty(),
    handleValidationErrors
], async (req, res) => {
    try {
        const { first_name, last_name, email, phone, subject_specialization, hire_date, salary } = req.body;

        const existing = await pool.query('SELECT teacher_id FROM teachers WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        const result = await pool.query(
            `INSERT INTO teachers 
             (first_name, last_name, email, phone, subject_specialization, hire_date, salary)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING teacher_id`,
            [first_name, last_name, email, phone || null, subject_specialization, hire_date || new Date(), salary || null]
        );

        res.status(201).json({ message: 'Teacher created successfully', teacher_id: result.rows[0].teacher_id });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT update teacher
app.put('/api/teachers/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
    try {
        const { first_name, last_name, email, phone, subject_specialization, salary, status } = req.body;

        await pool.query(
            `UPDATE teachers SET 
             first_name = COALESCE($1, first_name),
             last_name = COALESCE($2, last_name),
             email = COALESCE($3, email),
             phone = COALESCE($4, phone),
             subject_specialization = COALESCE($5, subject_specialization),
             salary = COALESCE($6, salary),
             status = COALESCE($7, status)
             WHERE teacher_id = $8`,
            [first_name, last_name, email, phone, subject_specialization, salary, status, req.params.id]
        );

        res.json({ message: 'Teacher updated successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// ===============================
// CLASSES ROUTES
// ===============================

// GET all classes
app.get('/api/classes', authenticateToken, async (req, res) => {
    try {
        const classes = await pool.query(
            `SELECT c.*, t.first_name as teacher_first_name, t.last_name as teacher_last_name
             FROM classes c
             LEFT JOIN teachers t ON c.class_teacher_id = t.teacher_id
             ORDER BY c.grade_level, c.class_name`
        );
        res.json(classes.rows);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// GET single class with students
app.get('/api/classes/:id', authenticateToken, async (req, res) => {
    try {
        const classes = await pool.query(
            `SELECT c.*, t.first_name as teacher_first_name, t.last_name as teacher_last_name
             FROM classes c
             LEFT JOIN teachers t ON c.class_teacher_id = t.teacher_id
             WHERE c.class_id = $1`,
            [req.params.id]
        );

        if (classes.rows.length === 0) {
            return res.status(404).json({ error: 'Class not found' });
        }

        // Get students in class
        const students = await pool.query(
            'SELECT * FROM students WHERE class_id = $1 AND status = $2',
            [req.params.id, 'active']
        );

        // Get subjects taught in class
        const subjects = await pool.query(
            `SELECT DISTINCT s.*, ts.teacher_id, t.first_name, t.last_name
             FROM teacher_subjects ts
             JOIN subjects s ON ts.subject_id = s.subject_id
             LEFT JOIN teachers t ON ts.teacher_id = t.teacher_id
             WHERE ts.class_id = $1`,
            [req.params.id]
        );

        res.json({ ...classes.rows[0], students: students.rows, subjects: subjects.rows });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// POST create class
app.post('/api/classes', authenticateToken, authorizeRoles('admin'), [
    body('class_name').trim().notEmpty(),
    body('grade_level').isInt({ min: 1, max: 12 }),
    handleValidationErrors
], async (req, res) => {
    try {
        const { class_name, grade_level, class_teacher_id, academic_year } = req.body;

        const result = await pool.query(
            'INSERT INTO classes (class_name, grade_level, class_teacher_id, academic_year) VALUES ($1, $2, $3, $4) RETURNING class_id',
            [class_name, grade_level, class_teacher_id || null, academic_year || null]
        );

        res.status(201).json({ message: 'Class created successfully', class_id: result.rows[0].class_id });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT update class
app.put('/api/classes/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
    try {
        const { class_name, grade_level, class_teacher_id, academic_year, status } = req.body;

        await pool.query(
            `UPDATE classes SET 
             class_name = COALESCE($1, class_name),
             grade_level = COALESCE($2, grade_level),
             class_teacher_id = COALESCE($3, class_teacher_id),
             academic_year = COALESCE($4, academic_year)
             WHERE class_id = $5`,
            [class_name, grade_level, class_teacher_id, academic_year, req.params.id]
        );

        res.json({ message: 'Class updated successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// ===============================
// SUBJECTS ROUTES
// ===============================

// GET all subjects
app.get('/api/subjects', authenticateToken, async (req, res) => {
    try {
        const subjects = await pool.query('SELECT * FROM subjects ORDER BY subject_name');
        res.json(subjects.rows);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// POST create subject
app.post('/api/subjects', authenticateToken, authorizeRoles('admin'), [
    body('subject_name').trim().notEmpty(),
    handleValidationErrors
], async (req, res) => {
    try {
        const { subject_name, subject_code, description } = req.body;

        const result = await pool.query(
            'INSERT INTO subjects (subject_name, subject_code, description) VALUES ($1, $2, $3) RETURNING subject_id',
            [subject_name, subject_code || null, description || null]
        );

        res.status(201).json({ message: 'Subject created successfully', subject_id: result.rows[0].subject_id });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// ===============================
// GRADES ROUTES
// ===============================

// GET grades for a student (path format)
app.get('/api/grades/student/:id', authenticateToken, async (req, res) => {
    try {
        const grades = await pool.query(
            `SELECT g.*, s.subject_name, c.class_name
             FROM grades g
             JOIN subjects s ON g.subject_id = s.subject_id
             JOIN classes c ON g.class_id = c.class_id
             WHERE g.student_id = $1
             ORDER BY g.graded_at DESC`,
            [req.params.id]
        );
        res.json(grades.rows);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// GET grades for a student (query format: /api/grades?student_id=1)
app.get('/api/grades', authenticateToken, async (req, res) => {
    try {
        const studentId = req.query.student_id || req.query.studentId;
        if (!studentId) {
            return res.status(400).json({ error: 'student_id required' });
        }
        const grades = await pool.query(
            `SELECT g.*, s.subject_name, c.class_name
             FROM grades g
             JOIN subjects s ON g.subject_id = s.subject_id
             JOIN classes c ON g.class_id = c.class_id
             WHERE g.student_id = $1
             ORDER BY g.graded_at DESC`,
            [studentId]
        );
        res.json(grades.rows);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// POST create grade
app.post('/api/grades', authenticateToken, authorizeRoles('admin', 'teacher'), [
    body('student_id').isInt(),
    body('subject_id').isInt(),
    body('class_id').isInt(),
    body('exam_type').isIn(['test', 'midterm', 'final', 'assignment', 'project']),
    body('grade').isFloat({ min: 0 }),
    handleValidationErrors
], async (req, res) => {
    try {
        const { student_id, subject_id, class_id, exam_type, grade, max_grade, comments, graded_at } = req.body;

        const result = await pool.query(
            `INSERT INTO grades (student_id, subject_id, class_id, teacher_id, exam_type, grade, max_grade, comments, graded_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING grade_id`,
            [student_id, subject_id, class_id, req.user.user_id, exam_type, grade, max_grade || 100, comments || null, graded_at || new Date()]
        );

        res.status(201).json({ message: 'Grade recorded successfully', grade_id: result.rows[0].grade_id });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// ===============================
// ATTENDANCE ROUTES
// ===============================

// GET attendance for a student
app.get('/api/attendance/student/:id', authenticateToken, async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        
        let sql = `SELECT * FROM attendance WHERE student_id = $1`;
        const params = [req.params.id];
        
        if (start_date && end_date) {
            sql += ` AND date BETWEEN $2 AND $3`;
            params.push(start_date, end_date);
        }
        
        sql += ' ORDER BY date DESC';
        
        const attendance = await pool.query(sql, params);
        res.json(attendance.rows);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// POST record attendance
app.post('/api/attendance', authenticateToken, authorizeRoles('admin', 'teacher'), [
    body('student_id').isInt(),
    body('class_id').isInt(),
    body('date').isISO8601(),
    body('status').isIn(['present', 'absent', 'late', 'excused']),
    handleValidationErrors
], async (req, res) => {
    try {
        const { student_id, class_id, date, status, remarks } = req.body;

        const result = await pool.query(
            `INSERT INTO attendance (student_id, class_id, date, status, remarks)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (student_id, class_id, date) 
             DO UPDATE SET status = $4, remarks = $5
             RETURNING attendance_id`,
            [student_id, class_id, date, status, remarks || null]
        );

        res.status(201).json({ message: 'Attendance recorded successfully', attendance_id: result.rows[0].attendance_id });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// ===============================
// FEES ROUTES
// ===============================

// GET fees for a student
app.get('/api/fees/student/:id', authenticateToken, async (req, res) => {
    try {
        const fees = await pool.query(
            'SELECT * FROM fees WHERE student_id = $1 ORDER BY due_date DESC',
            [req.params.id]
        );
        res.json(fees.rows);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// POST create fee
app.post('/api/fees', authenticateToken, authorizeRoles('admin'), [
    body('student_id').isInt(),
    body('fee_type').trim().notEmpty(),
    body('amount').isFloat({ min: 0 }),
    body('due_date').isISO8601(),
    handleValidationErrors
], async (req, res) => {
    try {
        const { student_id, fee_type, amount, due_date } = req.body;

        const result = await pool.query(
            'INSERT INTO fees (student_id, fee_type, amount, due_date) VALUES ($1, $2, $3, $4) RETURNING fee_id',
            [student_id, fee_type, amount, due_date]
        );

        res.status(201).json({ message: 'Fee created successfully', fee_id: result.rows[0].fee_id });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT update fee payment
app.put('/api/fees/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
    try {
        const { status, payment_date, payment_method } = req.body;

        await pool.query(
            `UPDATE fees SET 
             status = COALESCE($1, status),
             payment_date = COALESCE($2, payment_date),
             payment_method = COALESCE($3, payment_method)
             WHERE fee_id = $4`,
            [status, payment_date, payment_method, req.params.id]
        );

        res.json({ message: 'Fee updated successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// ===============================
// EVENTS ROUTES
// ===============================

// GET all events
app.get('/api/events', authenticateToken, async (req, res) => {
    try {
        const events = await pool.query(
            'SELECT * FROM events ORDER BY event_date DESC'
        );
        res.json(events.rows);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// POST create event
app.post('/api/events', authenticateToken, authorizeRoles('admin', 'teacher'), [
    body('title').trim().notEmpty(),
    body('event_date').isISO8601(),
    handleValidationErrors
], async (req, res) => {
    try {
        const { title, description, event_date, event_time, location } = req.body;

        const result = await pool.query(
            'INSERT INTO events (title, description, event_date, event_time, location, created_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING event_id',
            [title, description || null, event_date, event_time || null, location || null, req.user.user_id]
        );

        res.status(201).json({ message: 'Event created successfully', event_id: result.rows[0].event_id });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// ===============================
// HEALTH CHECK
// ===============================

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
initDatabase().then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
    });
});

module.exports = app;
