export const VITALS = [
  {
    key: 'heart_rate',
    label: 'Heart Rate',
    shortLabel: 'HR',
    unit: 'bpm',
    placeholder: 'e.g. 72',
    min: 60,
    max: 100,
    color: '#7CFFB2',
  },
  {
    key: 'systolic_bp',
    label: 'Systolic Blood Pressure',
    shortLabel: 'SBP',
    unit: 'mmHg',
    placeholder: 'e.g. 120',
    min: 90,
    max: 120,
    color: '#8DD3FF',
  },
  {
    key: 'diastolic_bp',
    label: 'Diastolic Blood Pressure',
    shortLabel: 'DBP',
    unit: 'mmHg',
    placeholder: 'e.g. 80',
    min: 60,
    max: 80,
    color: '#FFC36F',
  },
  {
    key: 'respiratory_rate',
    label: 'Respiratory Rate',
    shortLabel: 'RR',
    unit: 'breaths/min',
    placeholder: 'e.g. 16',
    min: 12,
    max: 20,
    color: '#B3A4FF',
  },
  {
    key: 'spo2',
    label: 'Oxygen Saturation',
    shortLabel: 'SpO2',
    unit: '%',
    placeholder: 'e.g. 98',
    min: 95,
    max: 100,
    color: '#FF8E9B',
  },
]

export const PATIENT_STATUSES = ['Pending', 'Normal', 'Abnormal']

export function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

export function toNumber(value) {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function generateSequence(value, steps = 24, spread = 0.03) {
  const numericValue = toNumber(value)
  return Array.from({ length: steps }, () => {
    const variation = numericValue * (Math.random() * (spread * 2) - spread)
    return Number.parseFloat((numericValue + variation).toFixed(1))
  })
}

export function buildSequenceBundle(values) {
  const sequences = {
    heartRateSeq: generateSequence(values.heart_rate),
    systolicSeq: generateSequence(values.systolic_bp),
    diastolicSeq: generateSequence(values.diastolic_bp),
    respiratorySeq: generateSequence(values.respiratory_rate),
    spo2Seq: generateSequence(values.spo2),
  }

  const matrix = Array.from({ length: 24 }, (_, timeIndex) => [
    sequences.heartRateSeq[timeIndex],
    sequences.systolicSeq[timeIndex],
    sequences.diastolicSeq[timeIndex],
    sequences.respiratorySeq[timeIndex],
    sequences.spo2Seq[timeIndex],
  ])

  return { ...sequences, matrix }
}

export function buildAssessmentPayload(values) {
  const { matrix, ...series } = buildSequenceBundle(values)

  return {
    matrix,
    series,
    payload: {
      data: [JSON.stringify({ sequences: [matrix] })],
    },
  }
}

export function parseAssessmentResponse(response) {
  const rawPayload = response?.data?.data?.[0]
  if (!rawPayload) {
    throw new Error('Invalid AI response payload.')
  }

  const parsedPayload = JSON.parse(rawPayload)
  const assessment = parsedPayload?.results?.[0]

  if (!assessment) {
    throw new Error('No assessment result returned from the AI model.')
  }

  return assessment
}

export function formatWatTimestamp(value = new Date()) {
  return new Intl.DateTimeFormat('en-NG', {
    timeZone: 'Africa/Lagos',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function formatWatDateTime(value = new Date()) {
  return new Intl.DateTimeFormat('en-NG', {
    timeZone: 'Africa/Lagos',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

export function formatWatDateKey(value = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value))
}

export function getAge(dateOfBirth) {
  if (!dateOfBirth) return null

  const today = new Date()
  const birth = new Date(dateOfBirth)
  let age = today.getFullYear() - birth.getFullYear()
  const monthDifference = today.getMonth() - birth.getMonth()

  if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birth.getDate())) {
    age -= 1
  }

  return age
}

export function initialsFromName(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

export function getRiskBand(confidence = 0) {
  if (confidence >= 80) return 'High Risk'
  if (confidence >= 65) return 'Medium Risk'
  if (confidence >= 50) return 'Low Risk'
  return 'Stable'
}

export function getVitalStatus(value, vital) {
  if (value < vital.min) return 'Low'
  if (value > vital.max) return 'High'
  return 'Normal'
}

export function statusTone(status) {
  if (status === 'Normal') return 'success'
  if (status === 'Abnormal') return 'danger'
  return 'muted'
}

export function buildChartSeries(sequenceData) {
  if (!Array.isArray(sequenceData?.matrix)) return []

  return sequenceData.matrix.map((row, index) => ({
    step: index + 1,
    heart_rate: row[0],
    systolic_bp: row[1],
    diastolic_bp: row[2],
    respiratory_rate: row[3],
    spo2: row[4],
  }))
}

export function asCurrencySafeNumber(value) {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function buildAgeGroups(patients = []) {
  const buckets = {
    '0-20': 0,
    '21-40': 0,
    '41-60': 0,
    '61-80': 0,
    '80+': 0,
  }

  patients.forEach((patient) => {
    const age = Number(patient.age) || 0
    if (age <= 20) buckets['0-20'] += 1
    else if (age <= 40) buckets['21-40'] += 1
    else if (age <= 60) buckets['41-60'] += 1
    else if (age <= 80) buckets['61-80'] += 1
    else buckets['80+'] += 1
  })

  return Object.entries(buckets).map(([group, count]) => ({ group, count }))
}

export function buildRiskBatches(assessments = []) {
  const buckets = {
    'Low Risk': 0,
    'Medium Risk': 0,
    'High Risk': 0,
  }

  assessments.forEach((assessment) => {
    const confidence = Number(assessment.confidence) || 0
    if (confidence >= 80) buckets['High Risk'] += 1
    else if (confidence >= 65) buckets['Medium Risk'] += 1
    else if (confidence >= 50) buckets['Low Risk'] += 1
  })

  return Object.entries(buckets).map(([bucket, count]) => ({ bucket, count }))
}

export function buildAssessmentTrend(assessments = []) {
  const dates = Array.from({ length: 7 }, (_, index) => {
    const date = new Date()
    date.setDate(date.getDate() - (6 - index))
    return date.toISOString().slice(0, 10)
  })

  return dates.map((day) => ({
    day,
    assessments: assessments.filter((assessment) => String(assessment.assessed_at || '').slice(0, 10) === day).length,
  }))
}

export function buildStatusBreakdown(patients = []) {
  const counts = patients.reduce(
    (accumulator, patient) => {
      const status = patient.status || 'Pending'
      accumulator[status] = (accumulator[status] || 0) + 1
      return accumulator
    },
    { Normal: 0, Abnormal: 0, Pending: 0 },
  )

  return [
    { name: 'Normal', value: counts.Normal },
    { name: 'Abnormal', value: counts.Abnormal },
    { name: 'Pending', value: counts.Pending },
  ]
}
