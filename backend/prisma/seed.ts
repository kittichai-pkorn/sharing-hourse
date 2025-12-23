import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Create SuperAdmin
  const hashedPassword = await bcrypt.hash('admin123', 10);

  const superAdmin = await prisma.superAdmin.upsert({
    where: { email: 'admin@platform.com' },
    update: {},
    create: {
      email: 'admin@platform.com',
      password: hashedPassword,
    },
  });

  console.log('SuperAdmin created:', superAdmin.email);

  // Create sample tenant with admin for testing
  const tenantPassword = await bcrypt.hash('password123', 10);

  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo-share' },
    update: {},
    create: {
      name: 'วงแชร์ทดสอบ',
      slug: 'demo-share',
      status: 'ACTIVE',
    },
  });

  const admin = await prisma.user.upsert({
    where: {
      tenantId_phone: {
        tenantId: tenant.id,
        phone: '0891234567',
      },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      firstName: 'สมชาย',
      lastName: 'ใจดี',
      phone: '0891234567',
      email: 'somchai@demo.com',
      password: tenantPassword,
      role: 'ADMIN',
    },
  });

  console.log('Demo Tenant created:', tenant.slug);
  console.log('Demo Admin created:', admin.phone);

  // Delete old members first
  await prisma.member.deleteMany({
    where: { tenantId: tenant.id },
  });
  console.log('Old members deleted');

  // Create sample Members (ลูกแชร์)
  const membersData = [
    { memberCode: 'A001', nickname: 'พี่เอ', phone: '0891111111', lineId: 'line_a' },
    { memberCode: 'A002', nickname: 'น้องบี', phone: '0892222222', lineId: null },
    { memberCode: 'A003', nickname: 'ลุงซี', phone: '0893333333', lineId: 'line_c' },
    { memberCode: 'A004', nickname: 'ป้าดี', phone: null, lineId: 'line_d' },
    { memberCode: 'A005', nickname: 'น้าอี', phone: '0895555555', lineId: null },
  ];

  for (const data of membersData) {
    await prisma.member.upsert({
      where: {
        tenantId_memberCode: {
          tenantId: tenant.id,
          memberCode: data.memberCode,
        },
      },
      update: {},
      create: {
        tenantId: tenant.id,
        memberCode: data.memberCode,
        nickname: data.nickname,
        phone: data.phone,
        lineId: data.lineId,
      },
    });
  }

  console.log('Sample Members created:', membersData.length);

  // Delete old share groups first
  await prisma.shareGroup.deleteMany({
    where: { tenantId: tenant.id },
  });
  console.log('Old share groups deleted');

  // Get created members
  const members = await prisma.member.findMany({
    where: { tenantId: tenant.id },
    orderBy: { memberCode: 'asc' },
  });

  // ==================== วงที่ 1: STEP_INTEREST (ดอกขั้นบันได) - DRAFT พร้อมเปิด ====================
  // ทดสอบ: ดอกเบี้ย = interestRate × งวดที่ (งวด 1 = 100, งวด 2 = 200, ...)
  // เงินต้น 10,000 × 5 คน = 50,000 บาท/งวด
  const group1 = await prisma.shareGroup.create({
    data: {
      tenantId: tenant.id,
      hostId: admin.id,
      name: 'วงดอกขั้นบันได (STEP)',
      type: 'STEP_INTEREST',
      maxMembers: 5,
      principalAmount: 10000, // คนละ 10,000 บาท
      managementFee: 500, // ค่าดูแลวง 500 บาท
      interestRate: 100, // ดอก 100 บาท × งวดที่
      cycleType: 'MONTHLY',
      cycleDays: 0,
      startDate: new Date('2025-01-15'),
      status: 'DRAFT',
    },
  });

  // Template: หักท้ายท้าว (นอกเหนือจาก managementFee)
  await prisma.groupDeductionTemplate.createMany({
    data: [
      { shareGroupId: group1.id, name: 'หักท้ายท้าว', amount: 200 },
    ],
  });

  // Host = งวดแรก (ไม่เสียดอก)
  const host1 = await prisma.groupMember.create({
    data: { shareGroupId: group1.id, userId: admin.id, nickname: 'ท้าวแชร์ (สมชาย)' },
  });

  // สมาชิก 4 คน
  const group1Members = [host1];
  for (let i = 0; i < 4; i++) {
    const gm = await prisma.groupMember.create({
      data: { shareGroupId: group1.id, memberId: members[i].id, nickname: members[i].nickname },
    });
    group1Members.push(gm);
  }

  // สร้างงวด (งวด 1 = host ได้ก่อน)
  let date1 = new Date('2025-01-15');
  for (let i = 1; i <= 5; i++) {
    await prisma.round.create({
      data: {
        shareGroupId: group1.id,
        roundNumber: i,
        dueDate: new Date(date1),
        status: 'PENDING',
        winnerId: i === 1 ? host1.id : null, // งวดแรก host ได้
      },
    });
    date1.setMonth(date1.getMonth() + 1);
  }
  console.log('Group 1 (STEP_INTEREST - DRAFT):', group1.name);

  // ==================== วงที่ 2: BID_INTEREST (ประมูลดอก) - OPEN กำลังดำเนินการ ====================
  // ทดสอบ: ไม่มี managementFee - ค่าดูแลวงไม่ควร auto-fill
  // เงินต้น 5,000 × 5 คน = 25,000 บาท/งวด
  const group2 = await prisma.shareGroup.create({
    data: {
      tenantId: tenant.id,
      hostId: admin.id,
      name: 'วงประมูลดอก (BID)',
      type: 'BID_INTEREST',
      maxMembers: 5,
      principalAmount: 5000, // คนละ 5,000 บาท
      // ไม่มี managementFee - ทดสอบว่าไม่ auto-fill ค่าดูแลวง
      cycleType: 'MONTHLY',
      cycleDays: 0,
      startDate: new Date('2024-11-01'),
      status: 'OPEN',
    },
  });

  // Host
  const host2 = await prisma.groupMember.create({
    data: { shareGroupId: group2.id, userId: admin.id, nickname: 'ท้าวแชร์ (สมชาย)' },
  });

  // สมาชิก 4 คน
  const group2Members = [host2];
  for (let i = 0; i < 4; i++) {
    const gm = await prisma.groupMember.create({
      data: { shareGroupId: group2.id, memberId: members[i].id, nickname: members[i].nickname },
    });
    group2Members.push(gm);
  }

  // สร้างงวด - งวด 1-2 เสร็จแล้ว
  let date2 = new Date('2024-11-01');
  for (let i = 1; i <= 5; i++) {
    const isCompleted = i <= 2;
    // งวด 1: host ได้ (ประมูล 0), งวด 2: พี่เอ ได้ (ประมูล 500)
    const winningBidAmount = i === 1 ? 0 : (i === 2 ? 500 : 0);
    // เงินกองกลาง = 5,000 × 5 = 25,000
    // หัก: ดอกประมูลเท่านั้น (ไม่มีค่าดูแลวง)
    const poolAmount = 5000 * 5; // 25,000
    const payoutAmt = isCompleted ? poolAmount - winningBidAmount : null;

    const round = await prisma.round.create({
      data: {
        shareGroupId: group2.id,
        roundNumber: i,
        dueDate: new Date(date2),
        status: isCompleted ? 'COMPLETED' : 'PENDING',
        winnerId: isCompleted ? group2Members[i - 1].id : (i === 1 ? host2.id : null),
        winningBid: winningBidAmount,
        payoutAmount: payoutAmt,
      },
    });

    // บันทึกรายการหักสำหรับงวดที่เสร็จ (เฉพาะดอกประมูล ไม่มีค่าดูแลวง)
    if (isCompleted && winningBidAmount > 0) {
      await prisma.deduction.create({
        data: { roundId: round.id, type: 'INTEREST', amount: winningBidAmount, note: 'ดอกประมูล' },
      });
    }

    date2.setMonth(date2.getMonth() + 1);
  }
  console.log('Group 2 (BID_INTEREST - OPEN):', group2.name);

  // ==================== วงที่ 3: FIXED_INTEREST (ดอกคงที่) - OPEN กำลังดำเนินการ ====================
  // ทดสอบ: ดอกเบี้ย = interestRate คงที่ทุกงวด (ยกเว้นงวดแรก)
  // เงินต้น 20,000 × 5 คน = 100,000 บาท/งวด
  const group3 = await prisma.shareGroup.create({
    data: {
      tenantId: tenant.id,
      hostId: admin.id,
      name: 'วงดอกคงที่ (FIXED)',
      type: 'FIXED_INTEREST',
      maxMembers: 5,
      principalAmount: 20000, // คนละ 20,000 บาท
      managementFee: 1000, // ค่าดูแลวง 1,000 บาท
      interestRate: 2000, // ดอกคงที่ 2,000 บาท/งวด
      cycleType: 'MONTHLY',
      cycleDays: 0,
      startDate: new Date('2024-10-01'),
      status: 'OPEN',
    },
  });

  // Template: หักอื่นๆ
  await prisma.groupDeductionTemplate.createMany({
    data: [
      { shareGroupId: group3.id, name: 'ค่าน้ำชา', amount: 500 },
    ],
  });

  // Host
  const host3 = await prisma.groupMember.create({
    data: { shareGroupId: group3.id, userId: admin.id, nickname: 'ท้าวแชร์ (สมชาย)' },
  });

  // สมาชิก 4 คน
  const group3Members = [host3];
  for (let i = 0; i < 4; i++) {
    const gm = await prisma.groupMember.create({
      data: { shareGroupId: group3.id, memberId: members[i].id, nickname: members[i].nickname },
    });
    group3Members.push(gm);
  }

  // สร้างงวด - งวด 1-3 เสร็จแล้ว
  let date3 = new Date('2024-10-01');
  for (let i = 1; i <= 5; i++) {
    const isCompleted = i <= 3;
    // เงินกองกลาง = 20,000 × 5 = 100,000
    // หัก: ค่าดูแลวง 1,000 + ดอก 2,000 (งวด 2+) + ค่าน้ำชา 500
    const poolAmount = 20000 * 5; // 100,000
    const interestAmt = i === 1 ? 0 : 2000;
    const payoutAmt = isCompleted ? poolAmount - 1000 - interestAmt - 500 : null;

    const round = await prisma.round.create({
      data: {
        shareGroupId: group3.id,
        roundNumber: i,
        dueDate: new Date(date3),
        status: isCompleted ? 'COMPLETED' : 'PENDING',
        winnerId: isCompleted ? group3Members[i - 1].id : null,
        winningBid: 0, // FIXED ไม่มีประมูล
        payoutAmount: payoutAmt,
      },
    });

    // บันทึกรายการหักสำหรับงวดที่เสร็จ
    if (isCompleted) {
      await prisma.deduction.create({
        data: { roundId: round.id, type: 'OTHER', amount: 1000, note: 'ค่าดูแลวง' },
      });
      if (interestAmt > 0) {
        await prisma.deduction.create({
          data: { roundId: round.id, type: 'INTEREST', amount: interestAmt, note: 'ดอกเบี้ย' },
        });
      }
      await prisma.deduction.create({
        data: { roundId: round.id, type: 'OTHER', amount: 500, note: 'ค่าน้ำชา' },
      });
    }

    date3.setMonth(date3.getMonth() + 1);
  }
  console.log('Group 3 (FIXED_INTEREST - OPEN):', group3.name);

  // ==================== วงที่ 4: STEP_INTEREST - COMPLETED (เสร็จสิ้น) ====================
  // วงเล็ก 3 คน เสร็จแล้ว - ไม่มีค่าดูแลวง
  const group4 = await prisma.shareGroup.create({
    data: {
      tenantId: tenant.id,
      hostId: admin.id,
      name: 'วงขั้นบันไดเสร็จแล้ว',
      type: 'STEP_INTEREST',
      maxMembers: 3,
      principalAmount: 3000, // คนละ 3,000 บาท
      // ไม่มี managementFee
      interestRate: 50, // ดอก 50 บาท × งวดที่
      cycleType: 'WEEKLY',
      cycleDays: 0,
      startDate: new Date('2024-06-01'),
      status: 'COMPLETED',
    },
  });

  // Host
  const host4 = await prisma.groupMember.create({
    data: { shareGroupId: group4.id, userId: admin.id, nickname: 'ท้าวแชร์ (สมชาย)' },
  });

  // สมาชิก 2 คน
  const group4Members = [host4];
  for (let i = 0; i < 2; i++) {
    const gm = await prisma.groupMember.create({
      data: { shareGroupId: group4.id, memberId: members[i].id, nickname: members[i].nickname },
    });
    group4Members.push(gm);
  }

  // ทุกงวดเสร็จ - ไม่มีค่าดูแลวง หักเฉพาะดอกเบี้ย
  let date4 = new Date('2024-06-01');
  for (let i = 1; i <= 3; i++) {
    // เงินกองกลาง = 3,000 × 3 = 9,000
    // หัก: ดอก (50 × งวดที่) เท่านั้น ไม่มีค่าดูแลวง
    const poolAmount = 3000 * 3; // 9,000
    const interestAmt = i === 1 ? 0 : 50 * i; // งวด 1=0, งวด 2=100, งวด 3=150
    const payoutAmt = poolAmount - interestAmt;

    const round = await prisma.round.create({
      data: {
        shareGroupId: group4.id,
        roundNumber: i,
        dueDate: new Date(date4),
        status: 'COMPLETED',
        winnerId: group4Members[i - 1].id,
        winningBid: 0,
        payoutAmount: payoutAmt,
      },
    });

    // บันทึกรายการหัก - เฉพาะดอกเบี้ย (ไม่มีค่าดูแลวง)
    if (interestAmt > 0) {
      await prisma.deduction.create({
        data: { roundId: round.id, type: 'INTEREST', amount: interestAmt, note: `ดอกเบี้ย (50×${i})` },
      });
    }

    date4.setDate(date4.getDate() + 7);
  }
  console.log('Group 4 (STEP_INTEREST - COMPLETED):', group4.name);

  // ==================== วงที่ 5: DRAFT สมาชิกไม่ครบ (ทดสอบ validation) ====================
  const group5 = await prisma.shareGroup.create({
    data: {
      tenantId: tenant.id,
      hostId: admin.id,
      name: 'วงใหม่ (สมาชิกไม่ครบ)',
      type: 'BID_INTEREST',
      maxMembers: 10,
      principalAmount: 5000,
      managementFee: 200,
      cycleType: 'MONTHLY',
      cycleDays: 0,
      startDate: new Date('2025-03-01'),
      status: 'DRAFT',
    },
  });

  // เฉพาะ host + 2 สมาชิก (3/10)
  const host5 = await prisma.groupMember.create({
    data: { shareGroupId: group5.id, userId: admin.id, nickname: 'ท้าวแชร์ (สมชาย)' },
  });
  await prisma.groupMember.create({
    data: { shareGroupId: group5.id, memberId: members[0].id, nickname: members[0].nickname },
  });
  await prisma.groupMember.create({
    data: { shareGroupId: group5.id, memberId: members[1].id, nickname: members[1].nickname },
  });

  // สร้างงวด
  let date5 = new Date('2025-03-01');
  for (let i = 1; i <= 10; i++) {
    await prisma.round.create({
      data: {
        shareGroupId: group5.id,
        roundNumber: i,
        dueDate: new Date(date5),
        status: 'PENDING',
        winnerId: i === 1 ? host5.id : null,
      },
    });
    date5.setMonth(date5.getMonth() + 1);
  }
  console.log('Group 5 (BID_INTEREST - DRAFT incomplete):', group5.name);

  // ==================== Sample Notifications ====================
  // Delete old notifications
  await prisma.notification.deleteMany({
    where: { tenantId: tenant.id },
  });

  // Create sample notifications for the admin
  const round3_4 = await prisma.round.findFirst({
    where: { shareGroupId: group3.id, roundNumber: 4 },
  });

  await prisma.notification.createMany({
    data: [
      {
        tenantId: tenant.id,
        userId: admin.id,
        type: 'ROUND_UPCOMING',
        title: 'งวดใกล้ถึงกำหนด',
        message: `งวดที่ 4 ของ "${group3.name}" ถึงกำหนดพรุ่งนี้`,
        isRead: false,
        referenceId: round3_4?.id,
        referenceType: 'round',
        createdAt: new Date(),
      },
      {
        tenantId: tenant.id,
        userId: admin.id,
        type: 'WINNER_PENDING',
        title: 'รอบันทึกผู้ชนะ',
        message: `รอบันทึกผู้ชนะงวดที่ 3 ของ "${group2.name}"`,
        isRead: false,
        referenceId: (await prisma.round.findFirst({ where: { shareGroupId: group2.id, roundNumber: 3 } }))?.id,
        referenceType: 'round',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
      },
      {
        tenantId: tenant.id,
        userId: admin.id,
        type: 'WINNER_RECORDED',
        title: 'บันทึกผู้ชนะแล้ว',
        message: `พี่เอ ชนะงวดที่ 2 ของ "${group2.name}" (ประมูล 500 บาท)`,
        isRead: true,
        referenceId: (await prisma.round.findFirst({ where: { shareGroupId: group2.id, roundNumber: 2 } }))?.id,
        referenceType: 'round',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
        readAt: new Date(Date.now() - 1000 * 60 * 60 * 23),
      },
      {
        tenantId: tenant.id,
        userId: admin.id,
        type: 'GROUP_COMPLETED',
        title: 'วงเสร็จสิ้น',
        message: `วง "${group4.name}" เสร็จสิ้นแล้ว`,
        isRead: true,
        referenceId: group4.id,
        referenceType: 'shareGroup',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3), // 3 days ago
        readAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
      },
    ],
  });
  console.log('Sample notifications created');

  console.log('\n========================================');
  console.log('--- Login Credentials ---');
  console.log('SuperAdmin: admin@platform.com / admin123');
  console.log('Tenant Admin: demo-share / 0891234567 / password123');
  console.log('\n--- Test Share Groups ---');
  console.log('1. วงดอกขั้นบันได (STEP) - DRAFT พร้อมเปิด');
  console.log('   - สมาชิกครบ 5/5 คน, เงินต้น 10,000 บาท/คน = 50,000/งวด');
  console.log('   - ดอก 100×งวดที่, ค่าดูแล 500 ✓, หักท้ายท้าว 200');
  console.log('');
  console.log('2. วงประมูลดอก (BID) - OPEN กำลังดำเนินการ');
  console.log('   - เสร็จ 2/5 งวด, เงินต้น 5,000 บาท/คน = 25,000/งวด');
  console.log('   - ดอกจากประมูล, ไม่มีค่าดูแล ✗');
  console.log('');
  console.log('3. วงดอกคงที่ (FIXED) - OPEN กำลังดำเนินการ');
  console.log('   - เสร็จ 3/5 งวด, เงินต้น 20,000 บาท/คน = 100,000/งวด');
  console.log('   - ดอกคงที่ 2,000, ค่าดูแล 1,000 ✓, ค่าน้ำชา 500');
  console.log('');
  console.log('4. วงขั้นบันไดเสร็จแล้ว - COMPLETED');
  console.log('   - เสร็จ 3/3 งวด (รายสัปดาห์), ไม่มีค่าดูแล ✗');
  console.log('');
  console.log('5. วงใหม่ (สมาชิกไม่ครบ) - DRAFT');
  console.log('   - สมาชิก 3/10 คน, ค่าดูแล 200 ✓');
  console.log('');
  console.log('✓ = มี managementFee (auto-fill ค่าดูแลวง)');
  console.log('✗ = ไม่มี managementFee (ไม่ auto-fill)');
  console.log('========================================\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
