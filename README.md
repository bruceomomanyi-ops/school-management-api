# School Management API

A backend API for managing school operations including students, teachers, courses, grades, and more.

## 🚀 Features

- RESTful API architecture
- Database integration
- File upload support
- Secure password hashing
- Environment variable configuration

## 📋 Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Database (MySQL/PostgreSQL)

## 🛠️ Installation

1. Clone the repository:
```bash
git clone https://github.com/bruceomomanyi-ops/school-management-api.git
cd school-management-api
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your database and configuration settings
```

4. Initialize the database:
```bash
# Run the database schema
mysql -u your_username -p your_database_name < database/schema.sql
```

5. Start the server:
```bash
npm start
# OR for development
node index.js
```

## 📁 Project Structure

```
school-management-api/
├── database/
│   └── schema.sql          # Database schema
├── uploads/                # Uploaded files
├── index.js               # Main entry point
├── package.json           # Dependencies
├── .env.example           # Environment variables template
├── .gitignore             # Git ignore rules
└── README.md              # This file
```

## 🔧 Environment Variables

Create a `.env` file with the following variables:

```
DB_HOST=localhost
DB_USER=your_username
DB_PASSWORD=your_password
DB_NAME=school_management
PORT=3000
```

## 📚 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/... | Retrieve data |
| POST | /api/... | Create new data |
| PUT | /api/... | Update data |
| DELETE | /api/... | Delete data |

## 👤 Author

- GitHub: [@bruceomomanyi-ops](https://github.com/bruceomomanyi-ops)
- Email: bruceomomanyi@gmail.com

## 📄 License

This project is licensed under the MIT License.
