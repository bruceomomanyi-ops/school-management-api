-- School Management System Database Schema (PostgreSQL)
-- Run this in your PostgreSQL database

-- Create database
-- Note: Run CREATE DATABASE command via your database tool, then connect to it

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

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

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

CREATE INDEX IF NOT EXISTS idx_students_admission ON students(admission_number);
CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_id);
CREATE INDEX IF NOT EXISTS idx_students_status ON students(status);

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

CREATE INDEX IF NOT EXISTS idx_teachers_email ON teachers(email);
CREATE INDEX IF NOT EXISTS idx_teachers_status ON teachers(status);

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

CREATE INDEX IF NOT EXISTS idx_classes_grade ON classes(grade_level);
CREATE INDEX IF NOT EXISTS idx_classes_teacher ON classes(class_teacher_id);

-- Add foreign keys after all tables are created
ALTER TABLE students ADD CONSTRAINT IF NOT EXISTS fk_students_class 
    FOREIGN KEY (class_id) REFERENCES classes(class_id) ON DELETE SET NULL;
ALTER TABLE students ADD CONSTRAINT IF NOT EXISTS fk_students_parent 
    FOREIGN KEY (parent_id) REFERENCES users(user_id) ON DELETE SET NULL;
ALTER TABLE classes ADD CONSTRAINT IF NOT EXISTS fk_classes_teacher 
    FOREIGN KEY (class_teacher_id) REFERENCES teachers(teacher_id) ON DELETE SET NULL;

-- Subjects table
CREATE TABLE IF NOT EXISTS subjects (
    subject_id SERIAL PRIMARY KEY,
    subject_name VARCHAR(100) NOT NULL,
    subject_code VARCHAR(50) NULL,
    description TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_subjects_name ON subjects(subject_name);

-- Teacher Subjects (assignments) table
CREATE TABLE IF NOT EXISTS teacher_subjects (
    assignment_id SERIAL PRIMARY KEY,
    teacher_id INTEGER NOT NULL,
    subject_id INTEGER NOT NULL,
    class_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(teacher_id, subject_id, class_id)
);

CREATE INDEX IF NOT EXISTS idx_teacher_subjects_teacher ON teacher_subjects(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_subjects_subject ON teacher_subjects(subject_id);
CREATE INDEX IF NOT EXISTS idx_teacher_subjects_class ON teacher_subjects(class_id);

ALTER TABLE teacher_subjects ADD CONSTRAINT IF NOT EXISTS fk_ts_teacher 
    FOREIGN KEY (teacher_id) REFERENCES teachers(teacher_id) ON DELETE CASCADE;
ALTER TABLE teacher_subjects ADD CONSTRAINT IF NOT EXISTS fk_ts_subject 
    FOREIGN KEY (subject_id) REFERENCES subjects(subject_id) ON DELETE CASCADE;
ALTER TABLE teacher_subjects ADD CONSTRAINT IF NOT EXISTS fk_ts_class 
    FOREIGN KEY (class_id) REFERENCES classes(class_id) ON DELETE CASCADE;

-- Grades/Results table
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

CREATE INDEX IF NOT EXISTS idx_grades_student ON grades(student_id);
CREATE INDEX IF NOT EXISTS idx_grades_subject ON grades(subject_id);
CREATE INDEX IF NOT EXISTS idx_grades_class ON grades(class_id);
CREATE INDEX IF NOT EXISTS idx_grades_teacher ON grades(teacher_id);

ALTER TABLE grades ADD CONSTRAINT IF NOT EXISTS fk_grades_student 
    FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE;
ALTER TABLE grades ADD CONSTRAINT IF NOT EXISTS fk_grades_subject 
    FOREIGN KEY (subject_id) REFERENCES subjects(subject_id) ON DELETE CASCADE;
ALTER TABLE grades ADD CONSTRAINT IF NOT EXISTS fk_grades_class 
    FOREIGN KEY (class_id) REFERENCES classes(class_id) ON DELETE CASCADE;
ALTER TABLE grades ADD CONSTRAINT IF NOT EXISTS fk_grades_teacher 
    FOREIGN KEY (teacher_id) REFERENCES teachers(teacher_id) ON DELETE CASCADE;

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

CREATE INDEX IF NOT EXISTS idx_attendance_student_date ON attendance(student_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_class_date ON attendance(class_id, date);

ALTER TABLE attendance ADD CONSTRAINT IF NOT EXISTS fk_attendance_student 
    FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE;
ALTER TABLE attendance ADD CONSTRAINT IF NOT EXISTS fk_attendance_class 
    FOREIGN KEY (class_id) REFERENCES classes(class_id) ON DELETE CASCADE;

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

CREATE INDEX IF NOT EXISTS idx_fees_student ON fees(student_id);
CREATE INDEX IF NOT EXISTS idx_fees_status ON fees(status);
CREATE INDEX IF NOT EXISTS idx_fees_due ON fees(due_date);

ALTER TABLE fees ADD CONSTRAINT IF NOT EXISTS fk_fees_student 
    FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE;

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

CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date);

ALTER TABLE events ADD CONSTRAINT IF NOT EXISTS fk_events_creator 
    FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL;

-- Insert sample subjects
INSERT INTO subjects (subject_name, subject_code, description) VALUES
('Mathematics', 'MATH', 'Basic mathematics'),
('English', 'ENG', 'English language and literature'),
('Science', 'SCI', 'General science'),
('Social Studies', 'SST', 'Social studies and geography'),
('Physics', 'PHY', 'Physics'),
('Chemistry', 'CHEM', 'Chemistry'),
('Biology', 'BIO', 'Biology'),
('History', 'HIST', 'World history')
ON CONFLICT DO NOTHING;

-- Insert sample classes
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
