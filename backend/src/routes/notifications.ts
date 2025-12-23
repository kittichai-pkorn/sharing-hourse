import { Router } from 'express';
import prisma from '../utils/prisma.js';
import { authMiddleware, adminMiddleware } from '../middlewares/auth.js';
import { checkAndNotifyRounds } from '../services/notificationService.js';

const router = Router();

// GET /api/notifications - Get all notifications for current user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: {
        tenantId: req.user!.tenantId,
        userId: req.user!.userId,
      },
      orderBy: { createdAt: 'desc' },
      take: 50, // Limit to 50 recent notifications
    });

    const unreadCount = await prisma.notification.count({
      where: {
        tenantId: req.user!.tenantId,
        userId: req.user!.userId,
        isRead: false,
      },
    });

    res.json({
      success: true,
      data: notifications,
      unreadCount,
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาด',
    });
  }
});

// GET /api/notifications/unread-count - Get unread count only
router.get('/unread-count', authMiddleware, async (req, res) => {
  try {
    const unreadCount = await prisma.notification.count({
      where: {
        tenantId: req.user!.tenantId,
        userId: req.user!.userId,
        isRead: false,
      },
    });

    res.json({
      success: true,
      data: { unreadCount },
    });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาด',
    });
  }
});

// PUT /api/notifications/:id/read - Mark notification as read
router.put('/:id/read', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await prisma.notification.findFirst({
      where: {
        id: parseInt(id),
        tenantId: req.user!.tenantId,
        userId: req.user!.userId,
      },
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        error: 'ไม่พบการแจ้งเตือน',
      });
    }

    const updated = await prisma.notification.update({
      where: { id: parseInt(id) },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาด',
    });
  }
});

// PUT /api/notifications/read-all - Mark all notifications as read
router.put('/read-all', authMiddleware, async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: {
        tenantId: req.user!.tenantId,
        userId: req.user!.userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    res.json({
      success: true,
      message: 'อ่านทั้งหมดแล้ว',
    });
  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาด',
    });
  }
});

// DELETE /api/notifications/:id - Delete a notification
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await prisma.notification.findFirst({
      where: {
        id: parseInt(id),
        tenantId: req.user!.tenantId,
        userId: req.user!.userId,
      },
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        error: 'ไม่พบการแจ้งเตือน',
      });
    }

    await prisma.notification.delete({
      where: { id: parseInt(id) },
    });

    res.json({
      success: true,
      message: 'ลบการแจ้งเตือนแล้ว',
    });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาด',
    });
  }
});

// POST /api/notifications/check-rounds - Check and create notifications for upcoming/due rounds
// This can be called by a cron job or scheduled task
router.post('/check-rounds', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const result = await checkAndNotifyRounds();

    res.json({
      success: true,
      data: result,
      message: `สร้างการแจ้งเตือน ${result.notificationsCreated} รายการ`,
    });
  } catch (error) {
    console.error('Check rounds error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาด',
    });
  }
});

export default router;
