// ===============================
// School Management System API
// ===============================

// 1. Imports
require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
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
app.use(cors());
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));

// 3. Database configuration
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'myuser',
    password: process.env.DB_PASSWORD || 'MyStrongPass123!',
    database: process.env.DB_NAME || 'school_management',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

// Create connection pool
const pool = mysql.createPool(dbConfig);

// 4. Database initialization
const initDatabase = async () => {
    try {
        // Test connection
        const connection = await pool.getConnection();
        console.log('✅ Connected to MySQL database');
        connection.release();

        // Create database if not exists
        await pool.query('CREATE DATABASE IF NOT EXISTS school_management');
        console.log('✅ Database ensured');
    } catch (err) {
        console.error('❌ Database connection failed:', err.message);
        // Continue anyway - schema.sql should be run manually
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
        const [existing] = await pool.query('SELECT user_id FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const [result] = await pool.query(
            'INSERT INTO users (email, password_hash, role, linked_student_id) VALUES (?, ?, ?, ?)',
            [email, hashedPassword, role, linked_student_id || null]
        );

        res.status(201).json({
            message: 'User registered successfully',
            user_id: result.insertId
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

        const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const user = users[0];
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
        const [users] = await pool.query(
            'SELECT user_id, email, role, linked_student_id, created_at FROM users WHERE user_id = ?',
            [req.user.user_id]
        );
        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(users[0]);
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

        if (search) {
            sql += ' AND (s.first_name LIKE ? OR s.last_name LIKE ? OR s.admission_number LIKE ?)';
            const searchParam = `%${search}%`;
            params.push(searchParam, searchParam, searchParam);
        }

        if (status) {
            sql += ' AND s.status = ?';
            params.push(status);
        }

        if (classId) {
            sql += ' AND s.class_id = ?';
            params.push(classId);
        }

        sql += ' ORDER BY s.created_at DESC';

        const [students] = await pool.query(sql, params);
        res.json(students);
    } catch (err) {
        console.error('Get students error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET single student
app.get('/api/students/:id', authenticateToken, async (req, res) => {
    try {
        const [students] = await pool.query(
            `SELECT s.*, c.class_name, c.grade_level, 
                    p.user_id as parent_user_id, p.email as parent_email
             FROM students s 
             LEFT JOIN classes c ON s.class_id = c.class_id 
             LEFT JOIN users p ON s.parent_id = p.user_id
             WHERE s.student_id = ?`,
            [req.params.id]
        );

        if (students.length === 0) {
            return res.status(404).json({ error: 'Student not found' });
        }

        res.json(students[0]);
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
        const [existing] = await pool.query(
            'SELECT student_id FROM students WHERE admission_number = ?',
            [admission_number]
        );
        if (existing.length > 0) {
            return res.status(400).json({ error: 'Admission number already exists' });
        }

        const [result] = await pool.query(
            `INSERT INTO students 
             (first_name, last_name, date_of_birth, gender, admission_number, date_admitted, class_id, address, phone)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [first_name, last_name, date_of_birth, gender, admission_number, date_admitted, class_id || null, address || null, phone || null]
        );

        res.status(201).json({
            message: 'Student created successfully',
            student_id: result.insertId
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
             first_name = COALESCE(?, first_name),
             last_name = COALESCE(?, last_name),
             date_of_birth = COALESCE(?, date_of_birth),
             gender = COALESCE(?, gender),
             class_id = COALESCE(?, class_id),
             address = COALESCE(?, address),
             phone = COALESCE(?, phone),
             status = COALESCE(?, status)
             WHERE student_id = ?`,
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
        const [result] = await pool.query('DELETE FROM students WHERE student_id = ?', [req.params.id]);
        
        if (result.affectedRows === 0) {
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
        const [teachers] = await pool.query('SELECT * FROM teachers ORDER BY created_at DESC');
        res.json(teachers);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// GET single teacher
app.get('/api/teachers/:id', authenticateToken, async (req, res) => {
    try {
        const [teachers] = await pool.query('SELECT * FROM teachers WHERE teacher_id = ?', [req.params.id]);
        
        if (teachers.length === 0) {
            return res.status(404).json({ error: 'Teacher not found' });
        }

        // Get assigned subjects
        const [assignments] = await pool.query(
            `SELECT ts.*, s.subject_name, c.class_name 
             FROM teacher_subjects ts
             JOIN subjects s ON ts.subject_id = s.subject_id
             JOIN classes c ON ts.class_id = c.class_id
             WHERE ts.teacher_id = ?`,
            [req.params.id]
        );

        res.json({ ...teachers[0], assignments });
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

        const [existing] = await pool.query('SELECT teacher_id FROM teachers WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        const [result] = await pool.query(
            `INSERT INTO teachers 
             (first_name, last_name, email, phone, subject_specialization, hire_date, salary)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [first_name, last_name, email, phone || null, subject_specialization, hire_date || new Date(), salary || null]
        );

        res.status(201).json({ message: 'Teacher created successfully', teacher_id: result.insertId });
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
             first_name = COALESCE(?, first_name),
             last_name = COALESCE(?, last_name),
             email = COALESCE(?, email),
             phone = COALESCE(?, phone),
             subject_specialization = COALESCE(?, subject_specialization),
             salary = COALESCE(?, salary),
             status = COALESCE(?, status)
             WHERE teacher_id = ?`,
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
        const [classes] = await pool.query(
            `SELECT c.*, t.first_name as teacher_first_name, t.last_name as teacher_last_name
             FROM classes c
             LEFT JOIN teachers t ON c.class_teacher_id = t.teacher_id
             ORDER BY c.grade_level, c.class_name`
        );
        res.json(classes);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// GET single class with students
app.get('/api/classes/:id', authenticateToken, async (req, res) => {
    try {
        const [classes] = await pool.query(
            `SELECT c.*, t.first_name as teacher_first_name, t.last_name as teacher_last_name
             FROM classes c
             LEFT JOIN teachers t ON c.class_teacher_id = t.teacher_id
             WHERE c.class_id = ?`,
            [req.params.id]
        );

        if (classes.length === 0) {
            return res.status(404).json({ error: 'Class not found' });
        }

        // Get students in class
        const [students] = await pool.query(
            'SELECT * FROM students WHERE class_id = ? AND status = "active"',
            [req.params.id]
        );

        // Get subjects taught in class
        const [subjects] = await pool.query(
            `SELECT DISTINCT s.*, ts.teacher_id, t.first_name, t.last_name
             FROM teacher_subjects ts
             JOIN subjects s ON ts.subject_id = s.subject_id
             LEFT JOIN teachers t ON ts.teacher_id = t.teacher_id
             WHERE ts.class_id = ?`,
            [req.params.id]
        );

        res.json({ ...classes[0], students, subjects });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// POST create class
app.post('/api/classes', authenticateToken, authorizeRoles('admin'), [
    body('class_name').trim().notEmpty(),
    body('grade_level').isInt({ min: 1, max: 12 }),
    body('academic_year').matches(/^\d{4}-\d{4}$/),
    handleValidationErrors
], async (req, res) => {
    try {
        const { class_name, grade_level, class_teacher_id, academic_year } = req.body;

        const [result] = await pool.query(
            'INSERT INTO classes (class_name, grade_level, class_teacher_id, academic_year) VALUES (?, ?, ?, ?)',
            [class_name, grade_level, class_teacher_id || null, academic_year]
        );

        res.status(201).json({ message: 'Class created successfully', class_id: result.insertId });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT update class
app.put('/api/classes/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
    try {
        const { class_name, grade_level, class_teacher_id, academic_year } = req.body;

        await pool.query(
            `UPDATE classes SET 
             class_name = COALESCE(?, class_name),
             grade_level = COALESCE(?, grade_level),
             class_teacher_id = COALESCE(?, class_teacher_id),
             academic_year = COALESCE(?, academic_year)
             WHERE class_id = ?`,
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
        const [subjects] = await pool.query('SELECT * FROM subjects ORDER BY subject_name');
        res.json(subjects);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// POST create subject
app.post('/api/subjects', authenticateToken, authorizeRoles('admin'), [
    body('subject_name').trim().notEmpty(),
    body('subject_code').trim().notEmpty(),
    handleValidationErrors
], async (req, res) => {
    try {
        const { subject_name, subject_code, description, credit_hours } = req.body;

        const [existing] = await pool.query('SELECT subject_id FROM subjects WHERE subject_code = ?', [subject_code]);
        if (existing.length > 0) {
            return res.status(400).json({ error: 'Subject code already exists' });
        }

        const [result] = await pool.query(
            'INSERT INTO subjects (subject_name, subject_code, description, credit_hours) VALUES (?, ?, ?, ?)',
            [subject_name, subject_code, description || null, credit_hours || 1]
        );

        res.status(201).json({ message: 'Subject created successfully', subject_id: result.insertId });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// ===============================
// TEACHER SUBJECT ASSIGNMENTS
// ===============================

// GET assignments
app.get('/api/assignments', authenticateToken, async (req, res) => {
    try {
        const { academic_year } = req.query;
        let sql = `
            SELECT ts.*, t.first_name, t.last_name, t.email, 
                   s.subject_name, s.subject_code, c.class_name, c.grade_level
            FROM teacher_subjects ts
            JOIN teachers t ON ts.teacher_id = t.teacher_id
            JOIN subjects s ON ts.subject_id = s.subject_id
            JOIN classes c ON ts.class_id = c.class_id
        `;
        
        if (academic_year) {
            sql += ' WHERE ts.academic_year = ?';
            const [assignments] = await pool.query(sql, [academic_year]);
            return res.json(assignments);
        }

        const [assignments] = await pool.query(sql + ' ORDER BY ts.academic_year, c.class_name');
        res.json(assignments);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// POST create assignment
app.post('/api/assignments', authenticateToken, authorizeRoles('admin'), [
    body('teacher_id').isInt(),
    body('subject_id').isInt(),
    body('class_id').isInt(),
    body('academic_year').matches(/^\d{4}-\d{4}$/),
    handleValidationErrors
], async (req, res) => {
    try {
        const { teacher_id, subject_id, class_id, academic_year } = req.body;

        const [result] = await pool.query(
            'INSERT INTO teacher_subjects (teacher_id, subject_id, class_id, academic_year) VALUES (?, ?, ?, ?)',
            [teacher_id, subject_id, class_id, academic_year]
        );

        res.status(201).json({ message: 'Assignment created successfully', assignment_id: result.insertId });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Assignment already exists' });
        }
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE assignment
app.delete('/api/assignments/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
    try {
        const [result] = await pool.query('DELETE FROM teacher_subjects WHERE assignment_id = ?', [req.params.id]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Assignment not found' });
        }

        res.json({ message: 'Assignment deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// ===============================
// GRADES ROUTES
// ===============================

// GET grades
app.get('/api/grades', authenticateToken, async (req, res) => {
    try {
        const { student_id, class_id, subject_id, academic_year, term } = req.query;
        
        let sql = `
            SELECT g.*, s.first_name, s.last_name, s.admission_number,
                   sub.subject_name, sub.subject_code, c.class_name
            FROM grades g
            JOIN students s ON g.student_id = s.student_id
            JOIN subjects sub ON g.subject_id = sub.subject_id
            JOIN classes c ON g.class_id = c.class_id
            WHERE 1=1
        `;
        const params = [];

        if (student_id) {
            sql += ' AND g.student_id = ?';
            params.push(student_id);
        }
        if (class_id) {
            sql += ' AND g.class_id = ?';
            params.push(class_id);
        }
        if (subject_id) {
            sql += ' AND g.subject_id = ?';
            params.push(subject_id);
        }
        if (academic_year) {
            sql += ' AND g.academic_year = ?';
            params.push(academic_year);
        }
        if (term) {
            sql += ' AND g.term = ?';
            params.push(term);
        }

        sql += ' ORDER BY g.academic_year, g.term, s.last_name';

        const [grades] = await pool.query(sql, params);
        res.json(grades);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// GET student report card
app.get('/api/grades/report/:student_id', authenticateToken, async (req, res) => {
    try {
        const { academic_year, term } = req.query;
        const studentId = req.params.student_id;

        // Check authorization - students can only view their own grades
        if (req.user.role === 'student' && req.user.linked_student_id != studentId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const [students] = await pool.query(
            'SELECT * FROM students WHERE student_id = ?',
            [studentId]
        );
        if (students.length === 0) {
            return res.status(404).json({ error: 'Student not found' });
        }

        let sql = `
            SELECT g.*, sub.subject_name, sub.subject_code, t.first_name as teacher_first, t.last_name as teacher_last
            FROM grades g
            JOIN subjects sub ON g.subject_id = sub.subject_id
            LEFT JOIN teachers t ON g.teacher_id = t.teacher_id
            WHERE g.student_id = ?
        `;
        const params = [studentId];

        if (academic_year) {
            sql += ' AND g.academic_year = ?';
            params.push(academic_year);
        }
        if (term) {
            sql += ' AND g.term = ?';
            params.push(term);
        }

        const [grades] = await pool.query(sql, params);

        // Calculate average
        const totalScore = grades.reduce((sum, g) => sum + parseFloat(g.total_score || 0), 0);
        const average = grades.length > 0 ? (totalScore / grades.length).toFixed(2) : 0;

        res.json({
            student: students[0],
            academic_year: academic_year || '2024-2025',
            term: term || 'term1',
            grades,
            summary: {
                total_subjects: grades.length,
                average_score: average,
                highest_score: grades.length > 0 ? Math.max(...grades.map(g => parseFloat(g.total_score))) : 0,
                lowest_score: grades.length > 0 ? Math.min(...grades.map(g => parseFloat(g.total_score))) : 0
            }
        });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// POST create grade
app.post('/api/grades', authenticateToken, authorizeRoles('admin', 'teacher'), [
    body('student_id').isInt(),
    body('subject_id').isInt(),
    body('class_id').isInt(),
    body('term').isIn(['term1', 'term2', 'term3']),
    body('academic_year').matches(/^\d{4}-\d{4}$/),
    handleValidationErrors
], async (req, res) => {
    try {
        const { student_id, subject_id, class_id, teacher_id, academic_year, term, assignment_score, exam_score } = req.body;

        const [result] = await pool.query(
            `INSERT INTO grades 
             (student_id, subject_id, class_id, teacher_id, academic_year, term, assignment_score, exam_score)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE 
             assignment_score = VALUES(assignment_score),
             exam_score = VALUES(exam_score)`,
            [student_id, subject_id, class_id, teacher_id || req.user.user_id, academic_year, term, assignment_score || null, exam_score || null]
        );

        res.status(201).json({ message: 'Grade recorded successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// ===============================
// ATTENDANCE ROUTES
// ===============================

// GET attendance
app.get('/api/attendance', authenticateToken, async (req, res) => {
    try {
        const { student_id, class_id, start_date, end_date, status } = req.query;
        
        let sql = `
            SELECT a.*, s.first_name, s.last_name, s.admission_number, c.class_name
            FROM attendance a
            JOIN students s ON a.student_id = s.student_id
            JOIN classes c ON a.class_id = c.class_id
            WHERE 1=1
        `;
        const params = [];

        if (student_id) {
            sql += ' AND a.student_id = ?';
            params.push(student_id);
        }
        if (class_id) {
            sql += ' AND a.class_id = ?';
            params.push(class_id);
        }
        if (start_date) {
            sql += ' AND a.date >= ?';
            params.push(start_date);
        }
        if (end_date) {
            sql += ' AND a.date <= ?';
            params.push(end_date);
        }
        if (status) {
            sql += ' AND a.status = ?';
            params.push(status);
        }

        sql += ' ORDER BY a.date DESC, s.last_name';

        const [attendance] = await pool.query(sql, params);
        res.json(attendance);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// GET attendance summary
app.get('/api/attendance/summary/:student_id', authenticateToken, async (req, res) => {
    try {
        const { academic_year } = req.query;
        const studentId = req.params.student_id;

        const [summary] = await pool.query(
            `SELECT 
                COUNT(*) as total_days,
                SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present_days,
                SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent_days,
                SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) as late_days,
                SUM(CASE WHEN status = 'excused' THEN 1 ELSE 0 END) as excused_days
             FROM attendance
             WHERE student_id = ? ${academic_year ? 'AND YEAR(date) = ?' : ''}`,
            academic_year ? [studentId, academic_year.split('-')[0]] : [studentId]
        );

        const stats = summary[0];
        stats.attendance_percentage = stats.total_days > 0 
            ? ((stats.present_days / stats.total_days) * 100).toFixed(2) 
            : 0;

        res.json(stats);
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

        const [result] = await pool.query(
            `INSERT INTO attendance (student_id, class_id, date, status, remarks)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE status = VALUES(status), remarks = VALUES(remarks)`,
            [student_id, class_id, date, status, remarks || null]
        );

        res.status(201).json({ message: 'Attendance recorded successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// POST bulk attendance
app.post('/api/attendance/bulk', authenticateToken, authorizeRoles('admin', 'teacher'), [
    body('class_id').isInt(),
    body('date').isISO8601(),
    body('attendance').isArray(),
    handleValidationErrors
], async (req, res) => {
    try {
        const { class_id, date, attendance } = req.body;
        
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            for (const record of attendance) {
                await connection.query(
                    `INSERT INTO attendance (student_id, class_id, date, status, remarks)
                     VALUES (?, ?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE status = VALUES(status)`,
                    [record.student_id, class_id, date, record.status, record.remarks || null]
                );
            }

            await connection.commit();
            res.json({ message: 'Bulk attendance recorded successfully' });
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// ===============================
// FEES ROUTES
// ===============================

// GET fees
app.get('/api/fees', authenticateToken, async (req, res) => {
    try {
        const { student_id, academic_year, status } = req.query;
        
        let sql = `
            SELECT f.*, s.first_name, s.last_name, s.admission_number
            FROM fees f
            JOIN students s ON f.student_id = s.student_id
            WHERE 1=1
        `;
        const params = [];

        if (student_id) {
            sql += ' AND f.student_id = ?';
            params.push(student_id);
        }
        if (academic_year) {
            sql += ' AND f.academic_year = ?';
            params.push(academic_year);
        }
        if (status) {
            sql += ' AND f.payment_status = ?';
            params.push(status);
        }

        sql += ' ORDER BY f.due_date';

        const [fees] = await pool.query(sql, params);
        res.json(fees);
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
        const { student_id, fee_type, amount, due_date, academic_year } = req.body;

        const [result] = await pool.query(
            'INSERT INTO fees (student_id, fee_type, amount, due_date, academic_year) VALUES (?, ?, ?, ?, ?)',
            [student_id, fee_type, amount, due_date, academic_year || '2024-2025']
        );

        res.status(201).json({ message: 'Fee created successfully', fee_id: result.insertId });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT update fee payment
app.put('/api/fees/:id/pay', authenticateToken, authorizeRoles('admin'), [
    body('paid_amount').isFloat({ min: 0 }),
    handleValidationErrors
], async (req, res) => {
    try {
        const { paid_amount } = req.body;

        const [fees] = await pool.query('SELECT amount FROM fees WHERE fee_id = ?', [req.params.id]);
        if (fees.length === 0) {
            return res.status(404).json({ error: 'Fee not found' });
        }

        const totalAmount = fees[0].amount;
        const newPaid = paid_amount;
        let status = 'partial';
        if (newPaid >= totalAmount) status = 'paid';
        if (newPaid > totalAmount) newPaid = totalAmount;

        await pool.query(
            'UPDATE fees SET paid_amount = ?, payment_status = ? WHERE fee_id = ?',
            [newPaid, status, req.params.id]
        );

        res.json({ message: 'Payment recorded successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// ===============================
// DASHBOARD/REPORTS ROUTES
// ===============================

// GET dashboard stats
app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
    try {
        const [[studentCount]] = await pool.query('SELECT COUNT(*) as count FROM students WHERE status = "active"');
        const [[teacherCount]] = await pool.query('SELECT COUNT(*) as count FROM teachers WHERE status = "active"');
        const [[classCount]] = await pool.query('SELECT COUNT(*) as count FROM classes');
        const [[feePending]] = await pool.query(
            'SELECT SUM(amount - paid_amount) as total FROM fees WHERE payment_status IN ("pending", "partial")'
        );

        // Today's attendance
        const today = new Date().toISOString().split('T')[0];
        const [[attendanceStats]] = await pool.query(
            `SELECT 
                SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present,
                SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent
             FROM attendance WHERE date = ?`,
            [today]
        );

        res.json({
            students: studentCount.count,
            teachers: teacherCount.count,
            classes: classCount.count,
            pending_fees: feePending.total || 0,
            attendance_today: attendanceStats
        });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// ===============================
// TEST ROUTE
// ===============================

app.get('/', (req, res) => {
    res.json({
        message: 'School Management System API',
        version: '1.0.0',
        endpoints: {
            auth: '/api/auth/*',
            students: '/api/students*',
            teachers: '/api/teachers*',
            classes: '/api/classes*',
            subjects: '/api/subjects*',
            assignments: '/api/assignments*',
            grades: '/api/grades*',
            attendance: '/api/attendance*',
            fees: '/api/fees*',
            dashboard: '/api/dashboard*'
        },
        note: 'Most endpoints require authentication. Register at /api/auth/register or login at /api/auth/login'
    });
});

// Public test endpoint - no auth required
app.get('/api/test', async (req, res) => {
    try {
        const [classes] = await pool.query('SELECT * FROM classes LIMIT 5');
        const [students] = await pool.query('SELECT * FROM students LIMIT 5');
        const [teachers] = await pool.query('SELECT * FROM teachers LIMIT 5');
        res.json({ classes, students, teachers });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ===============================
// FILE UPLOAD CONFIG
// ===============================

// Create uploads directory if not exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) {
            return cb(null, true);
        }
        cb(new Error('Only image and document files are allowed!'));
    }
});

// Upload single file
app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    res.json({
        message: 'File uploaded successfully',
        filename: req.file.filename,
        path: `/uploads/${req.file.filename}`,
        originalName: req.file.originalname,
        size: req.file.size
    });
});

// Serve uploaded files
app.use('/uploads', express.static(uploadsDir));

// Get list of uploaded files
app.get('/api/uploads', (req, res) => {
    fs.readdir(uploadsDir, (err, files) => {
        if (err) {
            return res.status(500).json({ error: 'Unable to scan files' });
        }
        const fileList = files.map(file => ({
            name: file,
            url: `/uploads/${file}`
        }));
        res.json(fileList);
    });
});

// Delete uploaded file
app.delete('/api/uploads/:filename', (req, res) => {
    const filePath = path.join(uploadsDir, req.params.filename);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        res.json({ message: 'File deleted successfully' });
    } else {
        res.status(404).json({ error: 'File not found' });
    }
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    initDatabase();
});

module.exports = app;
