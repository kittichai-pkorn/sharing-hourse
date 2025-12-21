import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';

interface FormData {
  // Step 1
  name: string;
  type: string;
  // Step 2
  maxMembers: number;
  principalAmount: number;
  cycleType: string;
  cycleDays: number;
  startDate: string;
  managementFee: number | null;
  interestRate: number | null;
}

const typeLabels: Record<string, { label: string; description: string }> = {
  STEP_INTEREST: { label: 'ขั้นบันได', description: 'ดอกเบี้ยคงที่ + จับฉลาก' },
  BID_INTEREST: { label: 'บิทดอกตาม', description: 'ประมูลดอก คนใส่น้อยสุดชนะ' },
  FIXED_INTEREST: { label: 'ดอกตาม', description: 'ดอกเบี้ยคงที่ + จับฉลาก' },
  BID_PRINCIPAL: { label: 'บิทลดต้น (หักดอกท้าย)', description: 'ประมูล + ลดเงินต้นงวดถัดไป' },
  BID_PRINCIPAL_FIRST: { label: 'บิทลดต้น (หักดอกหน้า)', description: 'ประมูล + ลดเงินต้นทันที' },
};

const cycleTypeLabels: Record<string, string> = {
  DAILY: 'รายวัน',
  WEEKLY: 'รายสัปดาห์',
  MONTHLY: 'รายเดือน',
};

export default function CreateShareGroupPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState<FormData>({
    name: '',
    type: 'STEP_INTEREST',
    maxMembers: 5,
    principalAmount: 1000,
    cycleType: 'MONTHLY',
    cycleDays: 0,
    startDate: new Date().toISOString().split('T')[0],
    managementFee: null,
    interestRate: null,
  });

  const totalPool = formData.maxMembers * formData.principalAmount;

  const validateStep = (currentStep: number): boolean => {
    setError('');
    switch (currentStep) {
      case 1:
        if (!formData.name.trim()) {
          setError('กรุณากรอกชื่อวง');
          return false;
        }
        return true;
      case 2:
        if (formData.maxMembers < 2) {
          setError('ต้องมีสมาชิกอย่างน้อย 2 คน');
          return false;
        }
        if (formData.principalAmount < 100) {
          setError('เงินต้นต้องไม่น้อยกว่า 100 บาท');
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const nextStep = () => {
    if (validateStep(step)) {
      setStep(step + 1);
    }
  };

  const prevStep = () => {
    setStep(step - 1);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError('');

    try {
      const response = await api.post('/share-groups', {
        name: formData.name,
        type: formData.type,
        maxMembers: formData.maxMembers,
        principalAmount: formData.principalAmount,
        cycleType: formData.cycleType,
        cycleDays: formData.cycleDays,
        startDate: formData.startDate,
        managementFee: formData.managementFee,
        interestRate: formData.interestRate,
      });

      navigate(`/share-groups/${response.data.data.id}`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'เกิดข้อผิดพลาด');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">สร้างวงแชร์ใหม่</h1>
      </div>

      {/* Stepper - 3 steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {['ข้อมูลพื้นฐาน', 'ตั้งค่าวง', 'ตรวจสอบ'].map((label, index) => (
            <div key={index} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step > index + 1
                    ? 'bg-green-500 text-white'
                    : step === index + 1
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                {step > index + 1 ? '✓' : index + 1}
              </div>
              <span className={`ml-2 text-sm hidden sm:block ${step === index + 1 ? 'font-medium' : 'text-gray-500'}`}>
                {label}
              </span>
              {index < 2 && <div className={`w-16 h-0.5 mx-2 ${step > index + 1 ? 'bg-green-500' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Step Content */}
      <div className="bg-white shadow rounded-lg p-6">
        {/* Step 1: Basic Info */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">ชื่อวงแชร์ *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="เช่น วงแชร์พนักงาน มกราคม 2568"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">รูปแบบวงแชร์ *</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                {Object.entries(typeLabels).map(([value, { label }]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <p className="mt-1 text-sm text-gray-500">
                {typeLabels[formData.type]?.description}
              </p>
            </div>
          </div>
        )}

        {/* Step 2: Settings */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">จำนวนสมาชิก *</label>
                <input
                  type="number"
                  min={2}
                  value={formData.maxMembers}
                  onChange={(e) => setFormData({ ...formData, maxMembers: parseInt(e.target.value) || 0 })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">เงินต้นต่องวด (บาท) *</label>
                <input
                  type="number"
                  min={100}
                  value={formData.principalAmount}
                  onChange={(e) => setFormData({ ...formData, principalAmount: parseInt(e.target.value) || 0 })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
              <p className="text-sm text-blue-800">
                เงินกองกลาง = {formData.principalAmount.toLocaleString()} x {formData.maxMembers} = <strong>{totalPool.toLocaleString()}</strong> บาท
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">รอบการชำระ *</label>
              <div className="mt-2 flex gap-4">
                {Object.entries(cycleTypeLabels).map(([value, label]) => (
                  <label key={value} className="flex items-center">
                    <input
                      type="radio"
                      name="cycleType"
                      value={value}
                      checked={formData.cycleType === value}
                      onChange={(e) => setFormData({ ...formData, cycleType: e.target.value })}
                      className="mr-2"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">วันที่เริ่มต้น *</label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">ค่าดูแลวง (บาท)</label>
                <input
                  type="number"
                  min={0}
                  value={formData.managementFee || ''}
                  onChange={(e) => setFormData({ ...formData, managementFee: e.target.value ? parseInt(e.target.value) : null })}
                  placeholder="ไม่บังคับ"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              {(formData.type === 'STEP_INTEREST' || formData.type === 'FIXED_INTEREST') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">ดอกเบี้ยคงที่ (บาท)</label>
                  <input
                    type="number"
                    min={0}
                    value={formData.interestRate || ''}
                    onChange={(e) => setFormData({ ...formData, interestRate: e.target.value ? parseInt(e.target.value) : null })}
                    placeholder="ไม่บังคับ"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Review */}
        {step === 3 && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium">ตรวจสอบข้อมูล</h3>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">ชื่อวง:</span>
                <span className="ml-2 font-medium">{formData.name}</span>
              </div>
              <div>
                <span className="text-gray-500">รูปแบบ:</span>
                <span className="ml-2 font-medium">{typeLabels[formData.type]?.label}</span>
              </div>
              <div>
                <span className="text-gray-500">สมาชิก:</span>
                <span className="ml-2 font-medium">{formData.maxMembers} คน</span>
              </div>
              <div>
                <span className="text-gray-500">เงินต้น:</span>
                <span className="ml-2 font-medium">{formData.principalAmount.toLocaleString()} บาท</span>
              </div>
              <div>
                <span className="text-gray-500">เงินกองกลาง:</span>
                <span className="ml-2 font-medium">{totalPool.toLocaleString()} บาท</span>
              </div>
              <div>
                <span className="text-gray-500">รอบชำระ:</span>
                <span className="ml-2 font-medium">{cycleTypeLabels[formData.cycleType]}</span>
              </div>
              <div>
                <span className="text-gray-500">เริ่มต้น:</span>
                <span className="ml-2 font-medium">{new Date(formData.startDate).toLocaleDateString('th-TH')}</span>
              </div>
              {formData.managementFee && (
                <div>
                  <span className="text-gray-500">ค่าดูแลวง:</span>
                  <span className="ml-2 font-medium">{formData.managementFee.toLocaleString()} บาท</span>
                </div>
              )}
              {formData.fixedInterest && (
                <div>
                  <span className="text-gray-500">ดอกเบี้ยคงที่:</span>
                  <span className="ml-2 font-medium">{formData.fixedInterest.toLocaleString()} บาท</span>
                </div>
              )}
            </div>

            <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-md p-3">
              <p className="text-sm text-yellow-800">
                หลังบันทึกแล้วจะแก้ไขบางข้อมูลไม่ได้
              </p>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="mt-6 flex justify-between">
          {step > 1 ? (
            <button
              type="button"
              onClick={prevStep}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              ← ก่อนหน้า
            </button>
          ) : (
            <button
              type="button"
              onClick={() => navigate('/share-groups')}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              ยกเลิก
            </button>
          )}

          {step < 3 ? (
            <button
              type="button"
              onClick={nextStep}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              ถัดไป →
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              {isSubmitting ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
