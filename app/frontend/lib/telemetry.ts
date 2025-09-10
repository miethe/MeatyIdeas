export function span(name: string, attrs?: Record<string, any>) {
  try {
    // Hook point for OTel; send to backend later
    console.log(`[telemetry] ${name}`, attrs || {})
  } catch {}
}

