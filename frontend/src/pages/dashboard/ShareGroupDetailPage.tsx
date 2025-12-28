import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api/client';

interface Member {
  id: number;
  memberId: number | null;
  userId: number | null;
  contributionAmount: number;
  paymentAmount: number | null;
  nickname: string | null;
  isHost: boolean;
  member: {
    id: number;
    firstName: string;
    lastName: string;
    nickname: string | null;
    memberCode: string | null;
  } | null;
  user: {
    id: number;
    firstName: string;
    lastName: string;
  } | null;
  hasWon: boolean;
  wonRoundNumber: number | null;
}

interface Round {
  id: number;
  roundNumber: number;
  status: string;
  winnerId: number | null;
  winningBid: number | null;
  payoutAmount: number | null;
  dueDate: string | null;
}

interface Deduction {
  id: number;
  roundId: number;
  type: string;
  amount: number;
  note: string | null;
}

interface ShareGroup {
  id: number;
  name: string;
  type: string;
  maxMembers: number;
  principalAmount: number;
  contributionPerRound: number | null;
  fixedInterest: number | null;
  managementFee: number | null;
  tailDeductionRounds: number | null;
  status: string;
  startDate: string;
  hostId: number;
  members: Member[];
  rounds: Round[];
  summary: {
    wonCount: number;
    notWonCount: number;
    totalMembers: number;
    maxMembers: number;
  };
}

const typeLabels: Record<string, string> = {
  STEP_INTEREST: 'ขั้นบันได',
  BID_INTEREST: 'บิทดอกตาม',
  FIXED_INTEREST: 'ดอกตาม',
  BID_PRINCIPAL: 'บิทลดต้น (หักดอกท้าย)',
  BID_PRINCIPAL_FIRST: 'บิทลดต้น (หักดอกหน้า)',
};

const statusConfig: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'ร่าง', color: 'bg-gray-700 text-gray-300' },
  OPEN: { label: 'เปิดรับสมาชิก', color: 'bg-blue-900/50 text-blue-400' },
  IN_PROGRESS: { label: 'กำลังดำเนินการ', color: 'bg-green-900/50 text-green-400' },
  COMPLETED: { label: 'เสร็จสิ้น', color: 'bg-purple-900/50 text-purple-400' },
  CANCELLED: { label: 'ยกเลิก', color: 'bg-red-900/50 text-red-400' },
};

const roundStatusConfig: Record<string, { label: string; icon: string; color: string }> = {
  PENDING: { label: 'รอ', icon: '⏳', color: 'text-gray-400' },
  ACTIVE: { label: 'กำลังดำเนินการ', icon: '🔵', color: 'text-blue-400' },
  COMPLETED: { label: 'จบแล้ว', icon: '✅', color: 'text-green-400' },
};

export default function ShareGroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [group, setGroup] = useState<ShareGroup | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Deduction Modal State
  const [showDeductionModal, setShowDeductionModal] = useState(false);
  const [selectedRound, setSelectedRound] = useState<Round | null>(null);
  const [deductions, setDeductions] = useState<Array<{ name: string; amount: string; isSystem?: boolean }>>([
    { name: '', amount: '', isSystem: false },
  ]);
  const [existingDeductions, setExistingDeductions] = useState<Deduction[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const fetchGroup = useCallback(async () => {
    try {
      const response = await api.get(`/share-groups/${id}`);
      setGroup(response.data.data);
    } catch (err) {
      console.error('Failed to fetch group:', err);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchGroup();
  }, [fetchGroup]);

  // Fetch deductions for a round
  const fetchDeductions = async (roundId: number, round: Round) => {
    try {
      const response = await api.get(`/deductions/round/${roundId}`);
      setExistingDeductions(response.data.data);

      // Pre-fill the form with existing deductions
      const existingData = response.data.data.map((d: Deduction) => ({
        name: d.note || '',
        amount: d.amount.toString(),
        isSystem: d.type === 'TAIL_DEDUCTION' || d.type === 'MANAGEMENT_FEE',
      }));

      // For STEP_INTEREST: Auto-add "หักท้ายท้าว" if winner is not host and no existing deductions
      if (group?.type === 'STEP_INTEREST' && existingData.length === 0 && round.winnerId) {
        const winner = group.members.find(m => m.id === round.winnerId);
        if (winner && !winner.isHost) {
          const tailDeduction = winner.paymentAmount || winner.contributionAmount || 0;
          if (tailDeduction > 0) {
            existingData.push({
              name: 'หักท้ายท้าว',
              amount: tailDeduction.toString(),
              isSystem: true,
            });
          }
        }
      }

      // Ensure at least 1 empty row for adding new deductions
      if (existingData.length === 0 || !existingData.some((d: { name: string; amount: string }) => !d.name && !d.amount)) {
        existingData.push({ name: '', amount: '', isSystem: false });
      }

      setDeductions(existingData);
    } catch (err) {
      console.error('Failed to fetch deductions:', err);
    }
  };

  // Open deduction modal
  const openDeductionModal = (round: Round) => {
    setSelectedRound(round);
    setShowDeductionModal(true);
    fetchDeductions(round.id, round);
  };

  // Close deduction modal
  const closeDeductionModal = () => {
    setShowDeductionModal(false);
    setSelectedRound(null);
    setDeductions([{ name: '', amount: '', isSystem: false }]);
    setExistingDeductions([]);
  };

  // Handle deduction input change
  const handleDeductionChange = (index: number, field: 'name' | 'amount', value: string) => {
    const newDeductions = [...deductions];
    if (!newDeductions[index].isSystem) {
      newDeductions[index][field] = value;
      setDeductions(newDeductions);
    }
  };

  // Add more deduction rows
  const addDeductionRow = () => {
    setDeductions([...deductions, { name: '', amount: '', isSystem: false }]);
  };

  // Save deductions
  const saveDeductions = async () => {
    if (!selectedRound) return;

    setIsSaving(true);
    try {
      const validDeductions = deductions
        .filter(d => d.name.trim() && d.amount.trim())
        .map(d => ({
          name: d.name.trim(),
          amount: parseFloat(d.amount) || 0,
        }));

      await api.post(`/deductions/round/${selectedRound.id}`, {
        deductions: validDeductions,
      });

      closeDeductionModal();
      fetchGroup();
    } catch (err) {
      console.error('Failed to save deductions:', err);
      alert('บันทึกไม่สำเร็จ');
    } finally {
      setIsSaving(false);
    }
  };

  // Calculate total deductions
  const totalDeductions = deductions.reduce((sum, d) => {
    const amount = parseFloat(d.amount) || 0;
    return sum + amount;
  }, 0);

  // Get member name
  const getMemberName = (member: Member): string => {
    if (member.nickname) return member.nickname;
    if (member.isHost) {
      return member.user ? `${member.user.firstName} ${member.user.lastName}` : 'ท้าว';
    }
    if (member.member) {
      return member.member.nickname || `${member.member.firstName} ${member.member.lastName}`;
    }
    return 'ไม่ระบุ';
  };

  // Get member code
  const getMemberCode = (member: Member): string => {
    if (member.isHost) return '-';
    return member.member?.memberCode || '-';
  };

  // Get winner name for a round
  const getWinnerName = (round: Round): string => {
    if (!round.winnerId || !group) return '-';
    const winner = group.members.find(m => m.id === round.winnerId);
    return winner ? getMemberName(winner) : '-';
  };

  // Get winner member object
  const getWinnerMember = (round: Round): Member | null => {
    if (!round.winnerId || !group) return null;
    return group.members.find(m => m.id === round.winnerId) || null;
  };

  // Get host member
  const getHostMember = (): Member | null => {
    if (!group) return null;
    return group.members.find(m => m.isHost) || null;
  };

  // Check if round is auto-assigned (first round or tail deduction)
  const isAutoAssignRound = (roundNumber: number): { isAuto: boolean; reason: string } => {
    if (!group) return { isAuto: false, reason: '' };

    // First round is always for host
    if (roundNumber === 1) {
      return { isAuto: true, reason: 'งวดแรก' };
    }

    // Tail deduction rounds (last N rounds for host)
    if (group.tailDeductionRounds && group.tailDeductionRounds > 0) {
      const firstTailRound = group.maxMembers - group.tailDeductionRounds + 1;
      if (roundNumber >= firstTailRound) {
        return { isAuto: true, reason: 'หักท้าย' };
      }
    }

    return { isAuto: false, reason: '' };
  };

  // Get round method label
  const getRoundMethod = (round: Round): string => {
    const autoInfo = isAutoAssignRound(round.roundNumber);
    if (autoInfo.isAuto) return autoInfo.reason;
    if (round.winnerId) return 'กำหนดล่วงหน้า';
    return '-';
  };

  // Calculate collected amount for a round (sum of all non-winner contributions)
  const getCollectedAmount = (round: Round): number => {
    if (!group) return 0;

    // For STEP_INTEREST, sum all non-host member payments (they pay every round)
    if (group.type === 'STEP_INTEREST') {
      return group.members
        .filter(m => !m.isHost && m.id !== round.winnerId)
        .reduce((sum, m) => sum + (m.paymentAmount || m.contributionAmount || 0), 0);
    }

    // For other types, use principalAmount * (members - 1)
    return group.principalAmount * (group.members.length - 1);
  };

  // Assign winner to round (for STEP_INTEREST)
  const assignWinner = async (roundId: number, memberId: number | null) => {
    try {
      await api.put(`/rounds/${roundId}/assign`, { memberId });
      fetchGroup();
    } catch (err: any) {
      console.error('Failed to assign winner:', err);
      alert(err.response?.data?.error || 'ไม่สามารถกำหนดผู้เปียได้');
    }
  };

  // Get available members for assignment (non-host members who haven't won yet)
  const getAvailableMembers = (): Member[] => {
    if (!group) return [];
    return group.members.filter(m => !m.isHost && !m.hasWon);
  };

  if (isLoading) {
    return <div className="text-center py-8 text-gray-400">กำลังโหลด...</div>;
  }

  if (!group) {
    return <div className="text-center py-8 text-gray-400">ไม่พบข้อมูลวงแชร์</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/share-groups')}
          className="text-gray-400 hover:text-gray-100"
        >
          ← กลับ
        </button>
        <h1 className="text-2xl font-bold text-gray-100">{group.name}</h1>
        <span className={`px-2 py-1 rounded text-xs ${statusConfig[group.status]?.color}`}>
          {statusConfig[group.status]?.label}
        </span>
      </div>

      {/* Group Info Card - Updated with tailDeductionRounds */}
      <div className="bg-gray-800 shadow-lg rounded-lg p-6 border border-gray-700">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
          <div>
            <span className="text-gray-400">ประเภท:</span>
            <p className="font-medium text-gray-100">{typeLabels[group.type]}</p>
          </div>
          <div>
            <span className="text-gray-400">เงินต้น:</span>
            <p className="font-medium text-gray-100">{group.principalAmount.toLocaleString()} บาท</p>
          </div>
          <div>
            <span className="text-gray-400">สมาชิก:</span>
            <p className="font-medium text-gray-100">{group.summary.totalMembers}/{group.maxMembers} คน</p>
          </div>
          <div>
            <span className="text-gray-400">หักท้าย:</span>
            <p className="font-medium text-gray-100">
              {group.tailDeductionRounds && group.tailDeductionRounds > 0
                ? `${group.tailDeductionRounds} งวด`
                : '-'}
            </p>
          </div>
          <div>
            <span className="text-gray-400">งวด:</span>
            <p className="font-medium text-gray-100">
              {group.rounds.filter(r => r.status === 'COMPLETED').length}/{group.rounds.length} งวด
            </p>
          </div>
        </div>
      </div>

      {/* Rounds Table */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium text-gray-100">ตารางงวด ({group.rounds.length})</h2>
      </div>
      {(
        <div className="bg-gray-800 shadow-lg rounded-lg overflow-hidden border border-gray-700">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-gray-750">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">งวด</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">ผู้เปีย</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">ยอดส่ง</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">หักรับ</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {group.rounds.map((round) => {
                  const autoInfo = isAutoAssignRound(round.roundNumber);
                  const winner = getWinnerMember(round);
                  const hostMember = getHostMember();
                  const collectedAmount = getCollectedAmount(round);

                  // Calculate tail deduction for winner (หักท้ายท้าว)
                  const winnerTailDeduction = winner && !winner.isHost
                    ? (winner.paymentAmount || winner.contributionAmount || 0)
                    : 0;

                  // Get display winner name
                  const displayWinner = autoInfo.isAuto && !round.winnerId
                    ? (hostMember ? getMemberName(hostMember) : 'ท้าว')
                    : getWinnerName(round);

                  return (
                    <tr key={round.id} className="hover:bg-gray-750">
                      {/* งวด */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-medium text-gray-100">{round.roundNumber}</span>
                      </td>

                      {/* ผู้เปีย + วิธีการ */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          {group.type === 'STEP_INTEREST' && !autoInfo.isAuto && round.status !== 'COMPLETED' ? (
                            <select
                              value={round.winnerId || ''}
                              onChange={(e) => assignWinner(round.id, e.target.value ? parseInt(e.target.value) : null)}
                              className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="">เลือกผู้เปีย</option>
                              {group.members
                                .filter(m => !m.isHost)
                                .map((member) => (
                                  <option
                                    key={member.id}
                                    value={member.id}
                                    disabled={member.hasWon && member.wonRoundNumber !== round.roundNumber}
                                  >
                                    {getMemberName(member)}
                                    {member.hasWon && member.wonRoundNumber !== round.roundNumber && ' (เปียแล้ว)'}
                                  </option>
                                ))}
                            </select>
                          ) : (
                            <span className="text-sm text-gray-100">{displayWinner}</span>
                          )}
                          {/* วิธีการ badge */}
                          <span className={`inline-block w-fit px-2 py-0.5 rounded text-xs ${
                            autoInfo.isAuto
                              ? 'bg-purple-900/50 text-purple-400 border border-purple-700'
                              : round.winnerId
                                ? 'bg-blue-900/50 text-blue-400 border border-blue-700'
                                : 'bg-gray-700 text-gray-400'
                          }`}>
                            {getRoundMethod(round)}
                          </span>
                        </div>
                      </td>

                      {/* ยอดส่ง (ยอดเก็บ) */}
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <span className="text-sm text-gray-100">
                          {round.winnerId ? collectedAmount.toLocaleString() : '-'}
                        </span>
                      </td>

                      {/* หักรับ */}
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <span className="text-sm text-orange-400">
                          {round.winnerId ? winnerTailDeduction.toLocaleString() : '-'}
                        </span>
                      </td>

                      {/* จัดการ */}
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openDeductionModal(round)}
                            className="px-2 py-1 text-xs bg-orange-900/50 text-orange-400 rounded hover:bg-orange-900/70 border border-orange-700"
                          >
                            หักรับ
                          </button>
                          <button
                            className="px-2 py-1 text-xs bg-blue-900/50 text-blue-400 rounded hover:bg-blue-900/70 border border-blue-700"
                          >
                            ชำระ
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Deduction Modal */}
      {showDeductionModal && selectedRound && (() => {
        const winner = getWinnerMember(selectedRound);
        const collectedAmount = getCollectedAmount(selectedRound);
        const isExceedingLimit = totalDeductions > collectedAmount;
        const netPayout = collectedAmount - totalDeductions;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/70"
              onClick={closeDeductionModal}
            />

            <div className="relative bg-gray-800 w-full max-w-lg rounded-2xl p-6 max-h-[90vh] overflow-y-auto border border-gray-700 shadow-xl">
              {/* Header */}
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-100">
                    หักรับ - งวด {selectedRound.roundNumber}
                  </h2>
                  <p className="text-sm text-gray-400">
                    ผู้เปีย: {getWinnerName(selectedRound)}
                  </p>
                </div>
                <button
                  onClick={closeDeductionModal}
                  className="text-gray-400 hover:text-gray-100 text-xl"
                >
                  ✕
                </button>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="bg-gray-750 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-400 mb-1">ยอดเก็บ</p>
                  <p className="text-lg font-bold text-gray-100">{collectedAmount.toLocaleString()}</p>
                </div>
                <div className="bg-gray-750 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-400 mb-1">หักรับ</p>
                  <p className={`text-lg font-bold ${isExceedingLimit ? 'text-red-400' : 'text-orange-400'}`}>
                    {totalDeductions.toLocaleString()}
                  </p>
                </div>
                <div className="bg-gray-750 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-400 mb-1">ยอดรับสุทธิ</p>
                  <p className={`text-lg font-bold ${netPayout < 0 ? 'text-red-400' : 'text-green-400'}`}>
                    {netPayout.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Validation Warning */}
              {isExceedingLimit && (
                <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded-lg">
                  <p className="text-sm text-red-400">
                    ⚠️ ยอดหักรวมเกินยอดเก็บ ({totalDeductions.toLocaleString()} &gt; {collectedAmount.toLocaleString()})
                  </p>
                </div>
              )}

              {/* Deduction List */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-300 mb-2">รายการหักรับ</p>

                {deductions.map((deduction, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <div className="flex-1">
                      <input
                        type="text"
                        value={deduction.name}
                        onChange={(e) => handleDeductionChange(index, 'name', e.target.value)}
                        placeholder="รายละเอียด..."
                        disabled={deduction.isSystem}
                        className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          deduction.isSystem
                            ? 'bg-purple-900/30 border-purple-700 text-purple-300'
                            : 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-500'
                        }`}
                      />
                    </div>
                    <div className="w-28">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">฿</span>
                        <input
                          type="number"
                          value={deduction.amount}
                          onChange={(e) => handleDeductionChange(index, 'amount', e.target.value)}
                          placeholder="0"
                          disabled={deduction.isSystem}
                          className={`w-full pl-7 pr-3 py-2.5 border rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                            deduction.isSystem
                              ? 'bg-purple-900/30 border-purple-700 text-purple-300'
                              : 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-500'
                          }`}
                        />
                      </div>
                    </div>
                    {!deduction.isSystem && (
                      <button
                        onClick={() => {
                          const newDeductions = deductions.filter((_, i) => i !== index);
                          setDeductions(newDeductions.length > 0 ? newDeductions : [{ name: '', amount: '', isSystem: false }]);
                        }}
                        className="p-2 text-gray-500 hover:text-red-400"
                      >
                        🗑️
                      </button>
                    )}
                    {deduction.isSystem && (
                      <div className="w-8" />
                    )}
                  </div>
                ))}

                <button
                  onClick={addDeductionRow}
                  className="w-full py-2 border-2 border-dashed border-gray-600 rounded-lg text-sm text-gray-400 hover:border-gray-500 hover:text-gray-300"
                >
                  + เพิ่มรายการ
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={closeDeductionModal}
                  className="flex-1 py-3 border border-gray-600 text-gray-300 rounded-lg font-medium hover:bg-gray-700"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={saveDeductions}
                  disabled={isSaving || isExceedingLimit}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? 'กำลังบันทึก...' : 'บันทึก'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      <style>{`
        .bg-gray-750 {
          background-color: rgb(38, 42, 51);
        }
      `}</style>
    </div>
  );
}
