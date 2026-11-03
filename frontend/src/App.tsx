
import { useEffect, useState } from "react"
import type { Session } from "@supabase/supabase-js"
import CloudConnectionTest from "./components/CloudConnectionTest"
import { supabase } from "./lib/supabase"
import Login from "./pages/Login"

import Dashboard from "./pages/Dashboard"
import Teachers from "./pages/Teachers"
import Timetables from "./pages/Timetables"
import Absences from "./pages/Absences"
import ReliefAssignments from "./pages/ReliefAssignments"

type Page =
  | "dashboard"
  | "teachers"
  | "timetables"
  | "absences"
  | "relief"

const navigation: {
  id: Page
  label: string
  icon: string
}[] = [
  { id: "dashboard", label: "Dashboard", icon: "📊" },
  { id: "teachers", label: "Teachers", icon: "👩‍🏫" },
  { id: "timetables", label: "Timetables", icon: "📅" },
  { id: "absences", label: "Absences", icon: "📋" },
  { id: "relief", label: "Relief Assignments", icon: "🔄" }
]

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [checkingSession, setCheckingSession] = useState(true)

  const [currentPage, setCurrentPage] =
    useState<Page>("dashboard")

  const [menuOpen, setMenuOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    let mounted = true

    async function loadSession() {
      const { data, error } = await supabase.auth.getSession()

      if (!mounted) return

      if (error) {
        console.error("Session check failed:", error.message)
        setSession(null)
      } else {
        setSession(data.session)
      }

      setCheckingSession(false)
    }

    void loadSession()

    const { data: listener } =
      supabase.auth.onAuthStateChange((_event, newSession) => {
        if (!mounted) return

        setSession(newSession)
        setCheckingSession(false)
      })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  function changePage(page: Page) {
    setCurrentPage(page)
    setMenuOpen(false)
  }

  async function handleSignOut() {
    setSigningOut(true)

    const { error } = await supabase.auth.signOut()

    if (error) {
      window.alert("Sign out failed: " + error.message)
    } else {
      setSession(null)
      setCurrentPage("dashboard")
      setMenuOpen(false)
    }

    setSigningOut(false)
  }

  function renderPage() {
    switch (currentPage) {
      case "dashboard":
        return <Dashboard />
      case "teachers":
        return <Teachers />
      case "timetables":
        return <Timetables />
      case "absences":
        return <Absences />
      case "relief":
        return <ReliefAssignments />
      default:
        return <Dashboard />
    }
  }

  if (checkingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-cyan-400">
            ReliefMS
          </h1>
          <p className="mt-3 text-sm text-slate-400">
            Checking your session...
          </p>
        </div>
      </main>
    )
  }

  if (!session) {
    return <Login />
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Mobile header */}
      <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-5 py-4 lg:hidden">
        <div>
          <h1 className="text-xl font-bold text-cyan-400">
            ReliefMS
          </h1>
          <p className="text-xs text-slate-400">
            Teacher Relief Management
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => { void handleSignOut() }}
            disabled={signingOut}
            className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 disabled:opacity-50"
          >
            Sign Out
          </button>

          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle navigation"
            aria-expanded={menuOpen}
            className="rounded-lg bg-slate-800 px-4 py-2 text-white"
          >
            {menuOpen ? "✕" : "☰"}
          </button>
        </div>
      </header>

      <div className="lg:flex">
        {/* Sidebar */}
        <aside
          className={`
            ${menuOpen ? "block" : "hidden"}
            w-full border-b border-slate-800 bg-slate-900
            lg:sticky lg:top-0 lg:block lg:h-screen lg:w-64
            lg:shrink-0 lg:border-b-0 lg:border-r
          `}
        >
          <div className="hidden border-b border-slate-800 p-6 lg:block">
            <h1 className="text-2xl font-bold tracking-tight text-cyan-400">
              ReliefMS
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Teacher Relief Management
            </p>
          </div>

          <nav
            aria-label="Main navigation"
            className="space-y-2 p-4"
          >
            {navigation.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => changePage(item.id)}
                aria-current={
                  currentPage === item.id ? "page" : undefined
                }
                className={`
                  flex w-full items-center gap-3 rounded-xl
                  px-4 py-3 text-left text-sm font-medium
                  transition-colors
                  ${
                    currentPage === item.id
                      ? "bg-cyan-500 text-slate-950"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  }
                `}
              >
                <span aria-hidden="true" className="text-lg">
                  {item.icon}
                </span>
                {item.label}
              </button>
            ))}
          </nav>

          <div className="hidden px-6 py-4 lg:block">
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
              <p className="text-sm font-semibold text-cyan-300">
                System Information
              </p>
              <p className="mt-2 text-xs leading-5 text-slate-400">
                Daily relief assignments are managed separately
                from permanent weekly timetables.
              </p>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <div className="min-w-0 flex-1">
          <div className="hidden items-center justify-between border-b border-slate-800 bg-slate-900/60 px-8 py-5 lg:flex">
            <p className="text-sm text-slate-400">
              School Administration Portal
            </p>

            <div className="flex items-center gap-3">
              <span className="max-w-56 truncate text-xs text-slate-400">
                {session.user.email}
              </span>

              <button
                type="button"
                onClick={() => { void handleSignOut() }}
                disabled={signingOut}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50"
              >
                {signingOut ? "Signing Out..." : "Sign Out"}
              </button>
            </div>
          </div>

          <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
            {currentPage === "dashboard" && <CloudConnectionTest />}
            {renderPage()}
          </main>

          <footer className="border-t border-slate-800 px-6 py-5 text-center text-xs text-slate-500">
            Teacher Relief Management System
          </footer>
        </div>
      </div>
    </div>
  )
}

export default App
