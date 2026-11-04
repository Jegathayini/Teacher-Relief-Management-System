
import { useState } from "react"
import { fetchCloudTeachers } from "../services/api"

export default function CloudConnectionTest() {
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(false)

  async function testConnection() {
    setLoading(true)
    setMessage("Connecting to cloud database...")

    try {
      const teachers = await fetchCloudTeachers()

      setMessage(
        `Success! Cloud connection working. Teachers found: ${teachers.length}`
      )
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Cloud connection failed."
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mb-6 rounded-xl border border-slate-700 bg-slate-800 p-4">
      <h2 className="font-semibold text-cyan-400">
        Supabase Cloud Connection Test
      </h2>

      <button
        type="button"
        onClick={() => { void testConnection() }}
        disabled={loading}
        className="mt-3 rounded-lg bg-cyan-500 px-4 py-2 font-semibold text-slate-950 disabled:opacity-50"
      >
        {loading ? "Testing..." : "Test Cloud Connection"}
      </button>

      {message && (
        <p role="status" className="mt-3 text-sm text-slate-300">
          {message}
        </p>
      )}
    </div>
  )
}
