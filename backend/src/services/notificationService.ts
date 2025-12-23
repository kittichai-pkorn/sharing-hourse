import prisma from '../utils/prisma.js';
import { NotificationType } from '@prisma/client';

interface CreateNotificationParams {
  tenantId: number;
  userId: number;
  type: NotificationType;
  title: string;
  message: string;
  referenceId?: number;
  referenceType?: string;
}

export async function createNotification(params: CreateNotificationParams) {
  return prisma.notification.create({
    data: {
      tenantId: params.tenantId,
      userId: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      referenceId: params.referenceId,
      referenceType: params.referenceType,
    },
  });
}

// Notify host when round is approaching (1 day before)
export async function notifyRoundUpcoming(round: {
  id: number;
  roundNumber: number;
  shareGroup: {
    id: number;
    name: string;
    tenantId: number;
    hostId: number;
  };
}) {
  return createNotification({
    tenantId: round.shareGroup.tenantId,
    userId: round.shareGroup.hostId,
    type: 'ROUND_UPCOMING',
    title: 'งวดใกล้ถึงกำหนด',
    message: `งวดที่ ${round.roundNumber} ของ "${round.shareGroup.name}" ถึงกำหนดพรุ่งนี้`,
    referenceId: round.id,
    referenceType: 'round',
  });
}

// Notify host when round is due (needs winner)
export async function notifyRoundDue(round: {
  id: number;
  roundNumber: number;
  shareGroup: {
    id: number;
    name: string;
    tenantId: number;
    hostId: number;
  };
}) {
  return createNotification({
    tenantId: round.shareGroup.tenantId,
    userId: round.shareGroup.hostId,
    type: 'ROUND_DUE',
    title: 'ถึงกำหนดงวด',
    message: `งวดที่ ${round.roundNumber} ของ "${round.shareGroup.name}" ถึงกำหนดแล้ว`,
    referenceId: round.id,
    referenceType: 'round',
  });
}

// Notify host about pending winner (reminder)
export async function notifyWinnerPending(round: {
  id: number;
  roundNumber: number;
  shareGroup: {
    id: number;
    name: string;
    tenantId: number;
    hostId: number;
  };
}) {
  return createNotification({
    tenantId: round.shareGroup.tenantId,
    userId: round.shareGroup.hostId,
    type: 'WINNER_PENDING',
    title: 'รอบันทึกผู้ชนะ',
    message: `รอบันทึกผู้ชนะงวดที่ ${round.roundNumber} ของ "${round.shareGroup.name}"`,
    referenceId: round.id,
    referenceType: 'round',
  });
}

// Notify host when winner is recorded
export async function notifyWinnerRecorded(round: {
  id: number;
  roundNumber: number;
  shareGroup: {
    id: number;
    name: string;
    tenantId: number;
    hostId: number;
  };
  winnerName: string;
}) {
  return createNotification({
    tenantId: round.shareGroup.tenantId,
    userId: round.shareGroup.hostId,
    type: 'WINNER_RECORDED',
    title: 'บันทึกผู้ชนะแล้ว',
    message: `${round.winnerName} ชนะงวดที่ ${round.roundNumber} ของ "${round.shareGroup.name}"`,
    referenceId: round.id,
    referenceType: 'round',
  });
}

// Notify host when group is opened
export async function notifyGroupOpened(shareGroup: {
  id: number;
  name: string;
  tenantId: number;
  hostId: number;
}) {
  return createNotification({
    tenantId: shareGroup.tenantId,
    userId: shareGroup.hostId,
    type: 'GROUP_OPENED',
    title: 'เปิดวงแล้ว',
    message: `วง "${shareGroup.name}" เปิดเรียบร้อยแล้ว`,
    referenceId: shareGroup.id,
    referenceType: 'shareGroup',
  });
}

// Notify host when group is completed
export async function notifyGroupCompleted(shareGroup: {
  id: number;
  name: string;
  tenantId: number;
  hostId: number;
}) {
  return createNotification({
    tenantId: shareGroup.tenantId,
    userId: shareGroup.hostId,
    type: 'GROUP_COMPLETED',
    title: 'วงเสร็จสิ้น',
    message: `วง "${shareGroup.name}" เสร็จสิ้นแล้ว`,
    referenceId: shareGroup.id,
    referenceType: 'shareGroup',
  });
}

// Check and create notifications for upcoming/due rounds (called by cron job or API)
export async function checkAndNotifyRounds() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  const dayAfterTomorrow = new Date(tomorrow);
  dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  // Find rounds due tomorrow (for ROUND_UPCOMING)
  const upcomingRounds = await prisma.round.findMany({
    where: {
      status: 'PENDING',
      dueDate: {
        gte: tomorrow,
        lt: dayAfterTomorrow,
      },
    },
    include: {
      shareGroup: {
        select: {
          id: true,
          name: true,
          tenantId: true,
          hostId: true,
        },
      },
    },
  });

  // Find rounds due today but not completed (for ROUND_DUE and WINNER_PENDING)
  const dueRounds = await prisma.round.findMany({
    where: {
      status: 'PENDING',
      dueDate: {
        gte: today,
        lt: tomorrow,
      },
      winnerId: null,
    },
    include: {
      shareGroup: {
        select: {
          id: true,
          name: true,
          tenantId: true,
          hostId: true,
        },
      },
    },
  });

  // Find overdue rounds without winner (for WINNER_PENDING reminder)
  const overdueRounds = await prisma.round.findMany({
    where: {
      status: 'PENDING',
      dueDate: {
        lt: today,
      },
      winnerId: null,
    },
    include: {
      shareGroup: {
        select: {
          id: true,
          name: true,
          tenantId: true,
          hostId: true,
        },
      },
    },
  });

  const notifications: any[] = [];

  // Create ROUND_UPCOMING notifications
  for (const round of upcomingRounds) {
    // Check if notification already exists for today
    const existingNotification = await prisma.notification.findFirst({
      where: {
        type: 'ROUND_UPCOMING',
        referenceId: round.id,
        referenceType: 'round',
        createdAt: {
          gte: today,
        },
      },
    });

    if (!existingNotification) {
      const notification = await notifyRoundUpcoming(round);
      notifications.push(notification);
    }
  }

  // Create ROUND_DUE notifications
  for (const round of dueRounds) {
    const existingNotification = await prisma.notification.findFirst({
      where: {
        type: 'ROUND_DUE',
        referenceId: round.id,
        referenceType: 'round',
        createdAt: {
          gte: today,
        },
      },
    });

    if (!existingNotification) {
      const notification = await notifyRoundDue(round);
      notifications.push(notification);
    }
  }

  // Create WINNER_PENDING reminders for overdue rounds (once per day)
  for (const round of overdueRounds) {
    const existingNotification = await prisma.notification.findFirst({
      where: {
        type: 'WINNER_PENDING',
        referenceId: round.id,
        referenceType: 'round',
        createdAt: {
          gte: today,
        },
      },
    });

    if (!existingNotification) {
      const notification = await notifyWinnerPending(round);
      notifications.push(notification);
    }
  }

  return {
    upcomingCount: upcomingRounds.length,
    dueCount: dueRounds.length,
    overdueCount: overdueRounds.length,
    notificationsCreated: notifications.length,
  };
}
