import axios from 'axios'
import { buildSequenceBundle, parseAssessmentResponse } from './physio'

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

function buildFallbackResult(vitals) {
  const ranges = [
    { key: 'heart_rate', min: 60, max: 100 },
    { key: 'systolic_bp', min: 90, max: 120 },
    { key: 'diastolic_bp', min: 60, max: 80 },
    { key: 'respiratory_rate', min: 12, max: 20 },
    { key: 'spo2', min: 95, max: 100 },
  ]

  const outOfRangeCount = ranges.reduce((count, range) => {
    const value = Number(vitals[range.key]) || 0
    return count + (value < range.min || value > range.max ? 1 : 0)
  }, 0)

  const abnormalScore = Math.min(95, 28 + outOfRangeCount * 16 + Math.max(0, Number(vitals.heart_rate) - 100) * 0.2)
  const normalScore = Math.max(5, 100 - abnormalScore)
  const prediction = abnormalScore >= 50 ? 'Abnormal' : 'Normal'

  return {
    prediction,
    confidence: Number(prediction === 'Abnormal' ? abnormalScore : normalScore).toFixed(1) * 1,
    probability_abnormal: Number(abnormalScore.toFixed(1)),
    probability_normal: Number(normalScore.toFixed(1)),
  }
}

async function postWithRetry(url, payload, retries = 3) {
  let lastError = null

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const response = await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (response.status === 503) {
        throw Object.assign(new Error('The Hugging Face Space is waking up.'), {
          response,
        })
      }

      return response
    } catch (error) {
      lastError = error
      const status = error?.response?.status
      const shouldRetry = status === 503 && attempt < retries

      if (shouldRetry) {
        await delay(5000)
        continue
      }

      break
    }
  }

  throw lastError || new Error('Unable to reach the assessment API.')
}

export async function runAssessmentFromVitals(vitals) {
  const { matrix, series, payload } = buildSequenceBundle(vitals)
  const apiUrl = import.meta.env.VITE_HF_API_URL

  if (!apiUrl) {
    return {
      matrix,
      series,
      assessment: buildFallbackResult(vitals),
      isFallback: true,
    }
  }

  try {
    const response = await postWithRetry(`${apiUrl}/run/predict_json`, payload)
    return {
      matrix,
      series,
      assessment: parseAssessmentResponse(response),
      isFallback: false,
    }
  } catch (error) {
    return {
      matrix,
      series,
      assessment: buildFallbackResult(vitals),
      isFallback: true,
      error,
    }
  }
}
