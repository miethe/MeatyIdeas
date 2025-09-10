/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    // Enable using the Next dev server directly on :3000 by proxying /api
    // to the API container. When served behind Caddy on :8081, the browser
    // will hit same-origin /api and this rewrite won't be used.
    if (process.env.NEXT_PUBLIC_API_BASE) return []
    return [
      {
        source: '/api/:path*',
        destination: 'http://api:8000/api/:path*',
      },
    ]
  },
}

export default nextConfig
