# TeamFlow — Team Task Manager

A full-stack web application for team project management with role-based access control. Create projects, assign tasks, track progress, and collaborate with your team.

![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=nodedotjs&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-4169E1?logo=postgresql&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![Railway](https://img.shields.io/badge/Deployed_on-Railway-0B0D0E?logo=railway)

## 🚀 Live Demo

**Live URL**: _[Add your Railway URL here after deployment]_

## ✨ Features

### Authentication
- User signup & login with JWT tokens
- Password hashing with bcryptjs
- Protected routes & auto-redirect

### Project Management
- Create, edit, and delete projects
- Add team members by email
- Role-based access (Admin / Member)

### Task Management
- Create, assign, and track tasks
- Status tracking: To Do → In Progress → Done
- Priority levels: Low, Medium, High
- Due date tracking with overdue alerts

### Dashboard
- Project & task statistics
- Task completion rate
- Overdue task alerts
- Tasks assigned to you
- Recent activity feed

### Role-Based Access Control
| Action | Admin | Member |
|---|:---:|:---:|
| Create/Delete project | ✅ | ❌ |
| Edit project details | ✅ | ❌ |
| Add/Remove members | ✅ | ❌ |
| Create/Delete tasks | ✅ | ❌ |
| Edit task (full) | ✅ | ❌ |
| Change task status | ✅ | ✅ |
| View project & tasks | ✅ | ✅ |

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, React Router v6, Vanilla CSS |
| Backend | Node.js, Express.js |
| Database | PostgreSQL |
| Auth | JWT + bcryptjs |
| Deployment | Railway |

## 📁 Project Structure

```
├── server/
│   ├── config/db.js           # PostgreSQL connection + migrations
│   ├── middleware/auth.js      # JWT authentication
│   ├── middleware/role.js      # Role-based access control
│   ├── routes/auth.js          # Signup, Login, Me
│   ├── routes/projects.js      # Projects CRUD + members
│   ├── routes/tasks.js         # Tasks CRUD + status
│   ├── routes/dashboard.js     # Aggregated stats
│   ├── migrations/001_init.sql # Database schema
│   ├── utils/validators.js     # Input validation
│   └── index.js                # Express entry point
├── client/
│   ├── src/
│   │   ├── context/AuthContext.jsx
│   │   ├── pages/              # Dashboard, Projects, Login, etc.
│   │   ├── components/         # Layout, Modal
│   │   ├── utils/api.js        # API wrapper
│   │   └── index.css           # Design system
│   └── vite.config.js
├── package.json                # Root scripts
├── railway.json                # Railway deployment config
└── README.md
```

## 🏁 Local Development Setup

### Prerequisites
- Node.js 18+
- PostgreSQL database (local or cloud)

### 1. Clone the repo
```bash
git clone https://github.com/YOUR_USERNAME/team-task-manager.git
cd team-task-manager
```

### 2. Set up environment variables
```bash
cp .env.example .env
```

Edit `.env` with your PostgreSQL connection string:
```env
DATABASE_URL=postgresql://user:password@localhost:5432/team_task_manager
JWT_SECRET=your-secret-key-change-this
NODE_ENV=development
PORT=5000
```

### 3. Install dependencies
```bash
npm install
npm run install:client
```

### 4. Run the app
```bash
npm run dev
```

- Backend runs on `http://localhost:5000`
- Frontend runs on `http://localhost:3000` (with API proxy)

## 🚀 Deployment (Railway)

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/team-task-manager.git
git push -u origin main
```

### 2. Deploy on Railway
1. Go to [railway.app](https://railway.app) and log in
2. Click **"New Project"** → **"Deploy from GitHub Repo"**
3. Select your `team-task-manager` repository
4. Railway will auto-detect the project and start building

### 3. Add PostgreSQL
1. In your Railway project, click **"+ New"** → **"Database"** → **"PostgreSQL"**
2. The `DATABASE_URL` is automatically available to your service

### 4. Set Environment Variables
In your service's **Variables** tab, add:
- `JWT_SECRET` = (generate a random string)
- `NODE_ENV` = `production`

The `DATABASE_URL` is auto-configured by Railway's PostgreSQL plugin.

### 5. Generate Domain
1. Go to your service's **Settings** tab
2. Under **Networking**, click **"Generate Domain"**
3. Your app is now live! 🎉

## 📡 API Endpoints

### Auth
- `POST /api/auth/signup` — Register
- `POST /api/auth/login` — Login
- `GET /api/auth/me` — Current user

### Projects
- `GET /api/projects` — List my projects
- `POST /api/projects` — Create project
- `GET /api/projects/:id` — Project details
- `PUT /api/projects/:id` — Update (Admin)
- `DELETE /api/projects/:id` — Delete (Admin)
- `POST /api/projects/:id/members` — Add member (Admin)
- `DELETE /api/projects/:id/members/:userId` — Remove member (Admin)

### Tasks
- `GET /api/projects/:id/tasks` — List tasks
- `POST /api/projects/:id/tasks` — Create task (Admin)
- `GET /api/tasks/:id` — Get task
- `PUT /api/tasks/:id` — Update task (Admin: all, Member: status only)
- `DELETE /api/tasks/:id` — Delete (Admin)

### Dashboard
- `GET /api/dashboard` — Aggregated stats

## 📝 License

MIT
