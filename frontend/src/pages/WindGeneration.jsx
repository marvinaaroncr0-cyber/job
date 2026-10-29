
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getOutturn,
  getForecast,
} from '../services/energyApi'

function WindGeneration() {
  const [outturn, setOutturn] = useState([])
  const [forecast, setForecast] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const navigate = useNavigate()

  useEffect(() => {
    async function loadEnergyData() {
      try {
        const [outturnData, forecastData] = await Promise.all([
          getOutturn(),
          getForecast(),
        ])

        setOutturn(outturnData)
        setForecast(forecastData)
      } catch (err) {
        setError(
          err.response?.data?.detail ||
          'Unable to load wind generation data.'
        )
      } finally {
        setLoading(false)
      }
    }

    loadEnergyData()
  }, [])

  return (
    <main className="generation-page">
    <div className="back-button-container">
        <button onClick={() => navigate('/')} className="back-button">
        ← Back
      </button>
    </div>
      

      <h1>Wind Generation</h1>

      {loading && <p>Loading energy data...</p>}
      {error && <p className="error">{error}</p>}

      {!loading && !error && (
        <>
          <section>
            <h2 className="section-title">
                <span className="title-icon">⚡</span>
                Wind Generation Outturn
            </h2>

            {outturn.length === 0 ? (
              <p>No actual readings available.</p>
            ) : (
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
                    {outturn.map((item, index) => (
                        <tr
                        key={`${item.settlementDate}-${item.settlementperiod}-${index}`}
                        >
                        <td className="date-column">{item.settlementDate}</td>
                        <td className="time-column">{item.startTime}</td>
                        <td className="generation-column">
                            {item.generation ?? '—'}
                        </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
                </div>
            )}
          </section>

          <section>
           <h2 className="section-title">
                <span className="title-icon">🌬️</span>
                Wind Generation Forecast
            </h2>

            {forecast.length === 0 ? (
              <p>No forecast readings available.</p>
            ) : (
              <div className="table-container">
                <div className="table-container">
                <table className="forecast-table">
                    <thead>
                    <tr>
                        <th className="forecast-date">Forecast Date</th>
                        <th className="forecast-time">Forecast Time</th>
                        <th className="forecast-generation">Generation (MW)</th>
                        <th className="published-date">Published Date</th>
                        <th className="published-time">Published Time</th>
                    </tr>
                    </thead>

                    <tbody>
                    {forecast.map((item, index) => (
                        <tr key={`${item.startdate}-${item.startTime}-${index}`}>
                        <td className="forecast-date">{item.startdate}</td>
                        <td className="forecast-time">{item.startTime}</td>
                        <td className="forecast-generation">
                            {item.generation ?? '—'}
                        </td>
                        <td className="published-date">{item.publishdate}</td>
                        <td className="published-time">{item.publishTime}</td>
                        </tr>
                    ))}
                    </tbody>
                </table>
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  )
}

export default WindGeneration
