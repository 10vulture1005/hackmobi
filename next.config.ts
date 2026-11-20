import type { NextConfig } from 'next'

const config: NextConfig = {
  reactStrictMode: true,
  // Seed JSON is read from disk at request time in route handlers.
  outputFileTracingIncludes: { '/api/**': ['./data/seed/**'] },
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ]
  },
}

export default config
