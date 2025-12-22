import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import superadminRoutes from './routes/superadmin.js';
import usersRoutes from './routes/users.js';
import shareGroupsRoutes from './routes/share-groups.js';
import membersRoutes from './routes/members.js';
import dashboardRoutes from './routes/dashboard.js';
import roundsRoutes from './routes/rounds.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/superadmin', superadminRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/share-groups', shareGroupsRoutes);
app.use('/api/members', membersRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/rounds', roundsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
