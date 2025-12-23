import { Router } from 'express';
import prisma from '../utils/prisma.js';
import { authMiddleware } from '../middlewares/auth.js';

const router = Router();

// GET /api/deductions/round/:roundId - Get deductions for a round
router.get('/round/:roundId', authMiddleware, async (req, res) => {
  try {
    const { roundId } = req.params;
    const tenantId = req.user!.tenantId;

    // Verify round belongs to tenant
    const round = await prisma.round.findFirst({
      where: {
        id: parseInt(roundId),
        shareGroup: { tenantId },
      },
    });

    if (!round) {
      return res.status(404).json({ success: false, message: 'Round not found' });
    }

    const deductions = await prisma.deduction.findMany({
      where: { roundId: parseInt(roundId) },
      orderBy: { createdAt: 'asc' },
    });

    return res.json({
      success: true,
      data: deductions,
    });
  } catch (error) {
    console.error('Get round deductions error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// POST /api/deductions/round/:roundId - Save deductions for a round
router.post('/round/:roundId', authMiddleware, async (req, res) => {
  try {
    const { roundId } = req.params;
    const { deductions } = req.body; // Array of { name, amount }
    const tenantId = req.user!.tenantId;

    if (!Array.isArray(deductions)) {
      return res.status(400).json({ success: false, message: 'Invalid deductions format' });
    }

    // Verify round belongs to tenant
    const round = await prisma.round.findFirst({
      where: {
        id: parseInt(roundId),
        shareGroup: { tenantId },
      },
    });

    if (!round) {
      return res.status(404).json({ success: false, message: 'Round not found' });
    }

    // Delete existing deductions and create new ones
    await prisma.$transaction(async (tx) => {
      // Delete all existing deductions for this round
      await tx.deduction.deleteMany({
        where: { roundId: parseInt(roundId) },
      });

      // Create new deductions
      if (deductions.length > 0) {
        await tx.deduction.createMany({
          data: deductions.map((d: { name: string; amount: number }) => ({
            roundId: parseInt(roundId),
            type: 'OTHER' as const,
            amount: d.amount,
            note: d.name,
          })),
        });
      }
    });

    return res.json({
      success: true,
      message: 'Deductions saved successfully',
    });
  } catch (error) {
    console.error('Save round deductions error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

export default router;
