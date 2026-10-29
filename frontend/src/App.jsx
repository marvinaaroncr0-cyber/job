import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getOutturnHistory } from './services/energyApi'
import './App.css'

function App() {
  const navigate = useNavigate()

  const [history, setHistory] = useState([])
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const [historySearched, setHistorySearched] = useState(false)

 async function loadHistory(start, end) {
  setHistoryLoading(true)
  setHistoryError('')
  setHistorySearched(true)
  setHistory([])

  try {
    const data = await getOutturnHistory(start, end)

    const records = Array.isArray(data)
      ? data
      : data.results ?? data.history ?? []

    const sortedRecords = [...records].sort((a, b) => {
      const dateA =
        a.settlementDate ?? a.settlement_date ?? ''
      const dateB =
        b.settlementDate ?? b.settlement_date ?? ''

      const timeA = a.startTime ?? a.start_time ?? ''
      const timeB = b.startTime ?? b.start_time ?? ''

      return `${dateA} ${timeA}`.localeCompare(
        `${dateB} ${timeB}`
      )
    })

    setHistory(sortedRecords)
  } catch (error) {
    setHistoryError(
      error.response?.data?.detail ||
      'Unable to load historical outturn data. Please try again.'
    )
  } finally {
    setHistoryLoading(false)
  }
}

async function handleHistorySearch(event) {
  event.preventDefault()

  if (!startDate || !endDate) {
    setHistoryError('Please select both dates.')
    return
  }

  if (startDate > endDate) {
    setHistoryError('Start date cannot be after end date.')
    return
  }

  await loadHistory(startDate, endDate)
}

async function handleLastMonth() {
  const today = new Date()
  const end = today.toISOString().slice(0, 10)

  const monthAgo = new Date(today)
  monthAgo.setMonth(monthAgo.getMonth() - 1)

  const start = monthAgo.toISOString().slice(0, 10)

  setStartDate(start)
  setEndDate(end)

  await loadHistory(start, end)
}

  return (
    <section id="center" className="app-container">
      <h1>Wind Energy Dashboard</h1>

      <p className="welcome-message">
        Welcome to the Wind Energy Dashboard! This application
        provides real-time data and forecasts for wind energy
        generation in Great Britain.
      </p>

      <button
        onClick={() => navigate('/wind-generation')}
        className="load-button"
      >
        Load Wind Generation
      </button>

      

      <section className="history-section">
        <h1>
                   Outturn History
        </h1>
       
          <p className="history-instructions">
          Explore historical wind generation for a selected date range.
          </p>
       
        

        <form className="history-form" onSubmit={handleHistorySearch}>
          <div className="history-field">
            <label htmlFor="start-date">Start Date:</label>
            <input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              required
            />
          </div>

          <div className="history-field">
            <label htmlFor="end-date">End Date:</label>
            <input
              id="end-date"
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              min={startDate || undefined}
              required
            />
          </div>
          <div className="history-buttons">
          <button
            type="submit"
            className="history-search-button"
            disabled={historyLoading}
          >
            {historyLoading ? 'Loading...' : 'Search History'}
          </button>

          <button
            type="button"
            className="history-search-button"
            onClick={handleLastMonth}
            disabled={historyLoading}
          >
            Last 1 Month
          </button>
          </div>
        </form>

        {historyError && (
          <p className="history-error" role="alert">
            {historyError}
          </p>
        )}

        {history.length > 0 && (
  <div className="history-chart">
    <h1 className="chart-title">
      Wind Generation Over Time
    </h1>

    <ResponsiveContainer width="100%" height={350}>
      <LineChart
        data={history}
        margin={{
          top: 10,
          right: 25,
          left: 10,
          bottom: 10,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" />

        <XAxis
          dataKey={(item) =>
            `${item.settlementDate ?? item.settlement_date ?? ''} ${
              item.startTime ?? item.start_time ?? ''
            }`
          }
          tick={false}
          label={{
            value: 'Date and time (hover to inspect)',
            position: 'insideBottom',
            offset: 5,
          }}
        />

        <YAxis
          type="number"
          domain={['auto', 'auto']}
          label={{
            angle: -90,
            position: 'insideLeft',
          }}
        />

        <Tooltip />
        <Legend />

        <Line
          type="monotone"
          dataKey="generation"
          name="Wind Generation (MW)"
          stroke="#2563eb"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 5 }}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  </div>
)}

        {historySearched && !historyLoading && !historyError && (
          <p className="history-result-count">
            {history.length} historical record(s) found
          </p>
        )}

        {history.length > 0 && (
          <div className="table-container">
            <table className="outturn-table">
              <thead>
                <tr>
                  <th className="date-column">Date</th>
                  <th className="time-column">Time</th>
                  <th className="generation-column">Generation (MW)</th>
                </tr>
              </thead>

              <tbody>
                {history.map((item, index) => (
                  <tr
                    key={`${item.settlementDate ?? item.settlement_date}-${item.settlementperiod ?? index}-${index}`}
                  >
                    <td className="date-column">
                      {item.settlementDate ?? item.settlement_date ?? '—'}
                    </td>
                    <td className="time-column">
                      {item.startTime ?? item.start_time ?? '—'}
                    </td>
                    <td className="generation-column">
                      {item.generation ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {historySearched &&
          !historyLoading &&
          !historyError &&
          history.length === 0 && (
            <p className="history-empty">
              No historical records found for the selected dates.
            </p>
          )}
      </section>
    </section>
  )
}

export default App
