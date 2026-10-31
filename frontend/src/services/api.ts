
const API_BASE_URL = "http://127.0.0.1:5000"

export interface HealthResponse {
  status: string
  message: string
}

export async function checkBackendHealth(): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE_URL}/api/health`)

  if (!response.ok) {
    throw new Error(
      `Backend request failed: ${response.status}`
    )
  }

  return (await response.json()) as HealthResponse
}
