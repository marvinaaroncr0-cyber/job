
import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 20000,
})


// Fetch actual wind generation
export async function getOutturn() {
  const response = await api.get('/outturn')
  return response.data
}

// Fetch forecast wind generation
export async function getForecast() {
  const response = await api.get('/forecast')
  return response.data
}

// Fetch historical wind generation
export async function getOutturnHistory(startDate, endDate) {
  const response = await api.get('/outturn/history', {
    params: {
      start_date: startDate,
      end_date: endDate,
    },
  })

  return response.data
}
