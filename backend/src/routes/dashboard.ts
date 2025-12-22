import { Router } from 'express';
import prisma from '../utils/prisma.js';
import { authMiddleware } from '../middlewares/auth.js';

const router = Router();

// GET /api/dashboard/summary - Get dashboard summary statistics
router.get('/summary', authMiddleware, async (req, res) => {
  try {
    const tenantId = req.user!.tenantId;

    // Get all groups for this tenant with counts
    const groups = await prisma.shareGroup.findMany({
      where: { tenantId },
    });

    // Get pending rounds count
    const pendingRoundsCount = await prisma.round.count({
      where: {
        shareGroup: { tenantId },
        status: 'PENDING',
      },
    });

    // Get in-progress rounds count
    const inProgressRoundsCount = await prisma.round.count({
      where: {
        shareGroup: { tenantId },
        status: 'IN_PROGRESS',
      },
    });

    // Calculate statistics
    const totalGroups = groups.length;
    const inProgressGroups = groups.filter(g => g.status === 'IN_PROGRESS' || g.status === 'OPEN').length;

    // Pending rounds are those that need action
    const pendingRounds = pendingRoundsCount + inProgressRoundsCount;

    // Waiting collection is for rounds in progress (bidding phase)
    const waitingCollection = inProgressRoundsCount;

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
