# TeamFlow — Team Task Manager

A full-stack web application for team project management with role-based access control. Create projects, assign tasks to multiple members, track progress, and collaborate with your team — all with a sleek dark UI.

![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=nodedotjs&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-4169E1?logo=postgresql&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![Railway](https://img.shields.io/badge/Deployed_on-Railway-0B0D0E?logo=railway)

## 🚀 Live Demo
## Use a VPN if the link does not open.
**Live URL**: [https://team-task-manager-production-1d9f.up.railway.app](https://team-task-manager-production-1d9f.up.railway.app)

## ✨ Features

### Authentication & Security
- Email **OTP verification** on signup (6-digit code, 10-min expiry via Resend API)
- Accounts are only created after OTP verification (stored in temporary `signup_otps` table)
- Strong password enforcement (8+ chars, letters, numbers, symbols)
- Real-time password strength indicator
- **Forgot Password** flow (email → OTP → new password) — available on login page and in settings
- **Change Password** in account settings (with current password verification)
- JWT token-based sessions with bcryptjs hashing
- Protected routes & auto-redirect

### Project Management
- Create, **edit**, and delete projects
- Add team members by email with role selection (Admin / Member)
- **Remove any member** including other admins (can't remove yourself if you're the last admin)
- Project creator automatically becomes admin

### Task Management
- Create, edit, and delete tasks
- **Assign tasks to multiple members** with a checklist UI
- Status tracking: To Do → In Progress → Done
- Priority levels: Low, Medium, High
- Due date tracking with overdue alerts
- **Expandable task rows** — click to see full details (status, priority, assignees, due date, description, created date)
- **Inline status update** — all members can change status with one click directly in the expanded view

### Dashboard
- Clickable **Total Projects** and **Total Tasks** cards — navigate to projects
- Task completion rate
- Overdue task alerts
- Tasks assigned to you
- Recent activity feed with assignee names

### Account Settings
- Edit profile name
- Change password (with current password)
- **Reset password via email** (forgot password OTP flow, available within settings)

### Role-Based Access Control

| Action | Admin | Member |
|---|:---:|:---:|
| Create / Delete project | ✅ | ❌ |
| Edit project name & description | ✅ | ❌ |
| Add / Remove members | ✅ | ❌ |
| Create / Edit / Delete tasks | ✅ | ❌ |
| Assign tasks to members | ✅ | ❌ |
| Change task status | ✅ | ✅ |
| View project & tasks | ✅ | ✅ |
| Expand tasks to see details | ✅ | ✅ |

> **Note**: There is no "Admin" or "Member" account type at signup. All users sign up as regular users. When you **create a project**, you automatically become the **admin** of that project. You can then add other users and assign them roles per-project.

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, React Router v6, Vanilla CSS (dark theme) |
| Backend | Node.js, Express.js |
| Database | PostgreSQL |
| Auth | JWT + bcryptjs |
| Email | Resend HTTPS API (transactional OTP emails) |
| Deployment | Railway |

## 📁 Project Structure

```
├── server/
│   ├── config/db.js                          # PostgreSQL pool + migration runner
│   ├── middleware/auth.js                     # JWT authentication
│   ├── middleware/role.js                     # Project-level role checks
│   ├── routes/auth.js                        # Signup, Login, OTP, Forgot/Reset Password
│   ├── routes/projects.js                    # Projects CRUD + members
│   ├── routes/tasks.js                       # Tasks CRUD + multi-assignee
│   ├── routes/dashboard.js                   # Aggregated stats
│   ├── migrations/
│   │   ├── 001_init.sql                      # Core schema (users, projects, tasks)
│   │   ├── 002_account_type.sql              # Account type column
│   │   ├── 003_signup_otps_and_forgot_password.sql  # OTP & password reset tables
│   │   └── 004_multi_assignees.sql           # Multi-assignee junction table
│   ├── utils/mailer.js                       # Resend email helper
│   ├── utils/validators.js                   # Input validation
│   └── index.js                              # Express entry point
├── client/
│   ├── src/
│   │   ├── context/AuthContext.jsx            # Auth state management
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx                 # Stats & overview
│   │   │   ├── Projects.jsx                  # Project list
│   │   │   ├── ProjectDetail.jsx             # Tasks, members, expandable UI
│   │   │   ├── Login.jsx                     # Login form
│   │   │   ├── Signup.jsx                    # Registration form
│   │   │   ├── VerifyOTP.jsx                 # OTP verification
│   │   │   ├── ForgotPassword.jsx            # Forgot password flow
│   │   │   ├── ResetPassword.jsx             # Password reset with OTP
│   │   │   └── Settings.jsx                  # Profile, password, reset via email
│   │   ├── components/
│   │   │   ├── Layout.jsx                    # Sidebar + main content
│   │   │   └── Modal.jsx                     # Reusable modal component
│   │   ├── utils/api.js                      # Fetch wrapper with JWT
│   │   └── index.css                         # Full design system (dark theme)
│   └── vite.config.js
├── package.json                              # Root scripts
├── railway.json                              # Railway deployment config
└── README.md
```

## 🏁 Local Development Setup

### Prerequisites
- Node.js 18+
- PostgreSQL database (local or cloud)
- [Resend](https://resend.com) API key (for OTP emails)

### 1. Clone the repo
```bash
git clone https://github.com/yuvrajgovindrao/team-task-manager.git
cd team-task-manager
```

### 2. Set up environment variables
Create a `.env` file in the root:
```env
DATABASE_URL=postgresql://user:password@localhost:5432/team_task_manager
JWT_SECRET=your-secret-key-change-this
RESEND_API_KEY=re_your_resend_api_key
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
git add .
git commit -m "Initial commit"
git push origin master
```

### 2. Deploy on Railway
1. Go to [railway.app](https://railway.app) and log in
2. Click **"New Project"** → **"Deploy from GitHub Repo"**
3. Select your `team-task-manager` repository
4. Railway will auto-detect and start building

### 3. Add PostgreSQL
1. In your Railway project, click **"+ New"** → **"Database"** → **"PostgreSQL"**
2. The `DATABASE_URL` is automatically available to your service

### 4. Set Environment Variables
In your service's **Variables** tab, add:
- `JWT_SECRET` = (generate a random string)
- `RESEND_API_KEY` = (your Resend API key)
- `NODE_ENV` = `production`

The `DATABASE_URL` is auto-configured by Railway's PostgreSQL plugin.

### 5. Generate Domain
1. Go to your service's **Settings** tab
2. Under **Networking**, click **"Generate Domain"**
3. Your app is now live! 🎉

## 📡 API Endpoints

### Auth
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/signup` | Register (sends OTP) |
| `POST` | `/api/auth/verify-otp` | Verify signup OTP |
| `POST` | `/api/auth/resend-otp` | Resend signup OTP |
| `POST` | `/api/auth/login` | Login |
| `GET` | `/api/auth/me` | Current user |
| `PUT` | `/api/auth/profile` | Update profile |
| `PUT` | `/api/auth/password` | Change password |
| `POST` | `/api/auth/forgot-password` | Send reset OTP |
| `POST` | `/api/auth/reset-password` | Reset with OTP |

### Projects
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/projects` | List my projects |
| `POST` | `/api/projects` | Create project |
| `GET` | `/api/projects/:id` | Project details + members |
| `PUT` | `/api/projects/:id` | Update project (Admin) |
| `DELETE` | `/api/projects/:id` | Delete project (Admin) |
| `POST` | `/api/projects/:id/members` | Add member (Admin) |
| `DELETE` | `/api/projects/:id/members/:userId` | Remove member (Admin) |

### Tasks
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/projects/:id/tasks` | List tasks (filterable) |
| `POST` | `/api/projects/:id/tasks` | Create task with multi-assignee (Admin) |
| `GET` | `/api/tasks/:id` | Get task with assignees |
| `PUT` | `/api/tasks/:id` | Update task (Admin: all, Member: status) |
| `DELETE` | `/api/tasks/:id` | Delete task (Admin) |

### Dashboard
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/dashboard` | Aggregated stats |

## 📝 License

MIT
