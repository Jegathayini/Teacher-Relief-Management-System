
import { useState } from "react"
import type { FormEvent } from "react"
import { supabase } from "../lib/supabase"

export default function Login() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setSuccess("")
    setLoading(true)

    try {
      const { error: loginError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })

      if (loginError) {
        throw loginError
      }

      setSuccess("Signed in successfully!")
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to sign in."
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-8 shadow-xl">

        {/* Branding */}
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-cyan-400">
            ReliefMS
          </h1>

          <p className="mt-2 text-sm text-slate-400">
            Teacher Relief Management System
          </p>

          <p className="mt-4 text-sm font-medium text-slate-300">
            School Administrator Sign In
          </p>
        </div>

        {/* Administrator Login */}
        <form onSubmit={handleLogin} className="mt-7 space-y-5">
          <div>
            <label
              htmlFor="email"
              className="mb-2 block text-sm text-slate-300"
            >
              Email
            </label>

            <input
              id="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 p-3 text-white outline-none focus:border-cyan-400"
              placeholder="Administrator email"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-sm text-slate-300"
            >
              Password
            </label>

            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 p-3 text-white outline-none focus:border-cyan-400"
              placeholder="Enter password"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-400">
              {error}
            </p>
          )}

          {success && (
            <p role="status" className="text-sm text-green-400">
              {success}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-cyan-500 p-3 font-semibold text-slate-950 transition-colors hover:bg-cyan-400 disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        {/* Divider */}
        <div className="my-7 flex items-center gap-4">
          <div className="h-px flex-1 bg-slate-700" />
          <span className="text-xs uppercase tracking-wider text-slate-500">
            Or explore
          </span>
          <div className="h-px flex-1 bg-slate-700" />
        </div>

        {/* Guest Demo */}
        <a
          href="/demo/index.html"
          className="flex w-full items-center justify-center gap-3 rounded-lg border border-cyan-500/60 bg-cyan-500/10 px-4 py-3 font-semibold text-cyan-300 transition-all duration-200 hover:border-cyan-400 hover:bg-cyan-500/20 hover:text-cyan-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
        >
          <span aria-hidden="true">👁</span>
          Explore Guest Demo
          <span aria-hidden="true">→</span>
        </a>

        <p className="mt-3 text-center text-xs leading-5 text-slate-400">
          No account required.
          <br />
          Explore fictional school data in read-only mode.
        </p>

        {/* Footer */}
        <div className="mt-8 border-t border-slate-800 pt-5 text-center">
          <p className="text-xs text-slate-500">
            ReliefMS · Smart Teacher Relief Management
          </p>
        </div>
      </div>
    </main>
  )
}
