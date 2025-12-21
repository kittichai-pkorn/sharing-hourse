import { Router } from 'express';
import prisma from '../utils/prisma.js';
import { authMiddleware } from '../middlewares/auth.js';

const router = Router();

// GET /api/dashboard/summary - Get dashboard summary statistics
router.get('/summary', authMiddleware, async (req, res) => {
  try {
    const tenantId = req.user!.tenantId;

    // Get all groups for this tenant
    const groups = await prisma.shareGroup.findMany({
      where: { tenantId },
      include: {
        rounds: {
          where: {
            status: {
              in: ['PENDING', 'ACTIVE', 'BIDDING'],
            },
          },
        },
      },
    });

    // Calculate statistics
    const totalGroups = groups.length;
    const inProgressGroups = groups.filter(g => g.status === 'IN_PROGRESS' || g.status === 'OPEN').length;

    // Count pending rounds (rounds that need action)
    const pendingRounds = groups.reduce((acc, group) => {
      return acc + group.rounds.filter(r => r.status === 'PENDING' || r.status === 'ACTIVE').length;
    }, 0);

    // Count rounds waiting for collection (bidding completed, need to collect money)
    const waitingCollection = groups.reduce((acc, group) => {
      return acc + group.rounds.filter(r => r.status === 'BIDDING').length;
    }, 0);

    res.json({
      success: true,
      data: {
        totalGroups,
        inProgressGroups,
        pendingRounds,
        waitingCollection,
      },
    });
  } catch (error) {
    console.error('Get dashboard summary error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาด',
    });
  }
});

export default router;
