const STORAGE_KEY = 'physiowatch.demo.state'

const demoDoctor = {
  id: 'demo-doctor',
  email: 'doctor@physiowatch.local',
  full_name: 'Dr. Ada Okafor',
  created_at: new Date().toISOString(),
}

function createPatient(name, age, gender, status, bloodType, wardRoom) {
  return {
    id: crypto.randomUUID(),
    doctor_id: demoDoctor.id,
    full_name: name,
    date_of_birth: null,
    age,
    gender,
    blood_type: bloodType,
    height_cm: 170,
    weight_kg: 72,
    medical_history: 'Type 2 diabetes, hypertension.',
    known_allergies: 'Penicillin',
    emergency_contact_name: 'Family Contact',
    emergency_contact_phone: '08030000000',
    admission_date: new Date(Date.now() - 86400000 * 2).toISOString().slice(0, 10),
    ward_room: wardRoom,
    status,
    created_at: new Date(Date.now() - Math.random() * 86400000 * 5).toISOString(),
  }
}

function createAssessment(patientId, doctorId, options) {
  const assessedAt = options.assessed_at || new Date(Date.now() - Math.random() * 86400000 * 7).toISOString()
  return {
    id: crypto.randomUUID(),
    patient_id: patientId,
    doctor_id: doctorId,
    heart_rate: options.heart_rate,
    systolic_bp: options.systolic_bp,
    diastolic_bp: options.diastolic_bp,
    respiratory_rate: options.respiratory_rate,
    spo2: options.spo2,
    sequence_data: options.sequence_data,
    prediction: options.prediction,
    confidence: options.confidence,
    probability_abnormal: options.probability_abnormal,
    probability_normal: options.probability_normal,
    assessed_at: assessedAt,
  }
}

function buildSeedState() {
  const patients = [
    createPatient('Chinedu Ibekwe', 42, 'Male', 'Normal', 'O+', 'ICU-02'),
    createPatient('Amina Bello', 63, 'Female', 'Abnormal', 'A+', 'ICU-04'),
    createPatient('Tariq Musa', 29, 'Male', 'Pending', 'B+', 'ICU-07'),
    createPatient('Grace Nwosu', 71, 'Female', 'Normal', 'AB-', 'ICU-10'),
    createPatient('Samuel Eze', 55, 'Male', 'Abnormal', 'O-', 'ICU-08'),
    createPatient('Zainab Yusuf', 34, 'Female', 'Normal', 'A-', 'ICU-05'),
  ]

  const assessments = [
    createAssessment(patients[0].id, demoDoctor.id, {
      heart_rate: 76,
      systolic_bp: 118,
      diastolic_bp: 76,
      respiratory_rate: 16,
      spo2: 98,
      sequence_data: {
        matrix: Array.from({ length: 24 }, (_, index) => [76 + Math.sin(index / 4), 118, 76, 16, 98]),
      },
      prediction: 'Normal',
      confidence: 91.4,
      probability_abnormal: 8.6,
      probability_normal: 91.4,
      assessed_at: new Date(Date.now() - 3600000).toISOString(),
    }),
    createAssessment(patients[1].id, demoDoctor.id, {
      heart_rate: 112,
      systolic_bp: 146,
      diastolic_bp: 92,
      respiratory_rate: 24,
      spo2: 90,
      sequence_data: {
        matrix: Array.from({ length: 24 }, (_, index) => [112, 146 - Math.sin(index / 3), 92, 24, 90]),
      },
      prediction: 'Abnormal',
      confidence: 86.8,
      probability_abnormal: 86.8,
      probability_normal: 13.2,
      assessed_at: new Date(Date.now() - 7200000).toISOString(),
    }),
    createAssessment(patients[3].id, demoDoctor.id, {
      heart_rate: 74,
      systolic_bp: 116,
      diastolic_bp: 70,
      respiratory_rate: 17,
      spo2: 97,
      sequence_data: {
        matrix: Array.from({ length: 24 }, (_, index) => [74, 116, 70, 17 + Math.sin(index / 6), 97]),
      },
      prediction: 'Normal',
      confidence: 89.2,
      probability_abnormal: 10.8,
      probability_normal: 89.2,
      assessed_at: new Date(Date.now() - 5400000).toISOString(),
    }),
    createAssessment(patients[4].id, demoDoctor.id, {
      heart_rate: 120,
      systolic_bp: 154,
      diastolic_bp: 96,
      respiratory_rate: 25,
      spo2: 88,
      sequence_data: {
        matrix: Array.from({ length: 24 }, (_, index) => [120, 154, 96, 25, 88 - Math.sin(index / 3)]),
      },
      prediction: 'Abnormal',
      confidence: 92.1,
      probability_abnormal: 92.1,
      probability_normal: 7.9,
      assessed_at: new Date(Date.now() - 1800000).toISOString(),
    }),
  ]

  return {
    profiles: [demoDoctor],
    patients,
    assessments,
    session: { user: demoDoctor },
  }
}

export function loadMockState() {
  if (typeof window === 'undefined') {
    return buildSeedState()
  }

  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (!stored) {
    const seed = buildSeedState()
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seed))
    return seed
  }

  try {
    return JSON.parse(stored)
  } catch {
    const seed = buildSeedState()
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seed))
    return seed
  }
}

export function saveMockState(state) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function clearMockSession() {
  if (typeof window === 'undefined') return
  const state = loadMockState()
  saveMockState({ ...state, session: null })
}

export function createMockSession(email) {
  const localState = loadMockState()
  return {
    user: {
      id: localState.profiles[0]?.id || demoDoctor.id,
      email,
    },
  }
}

export function getSeedDoctor() {
  return demoDoctor
}
