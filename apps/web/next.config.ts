import type { NextConfig } from "next"
import createNextIntlPlugin from "next-intl/plugin"

// Use a direct service address here. Routing an internal rewrite back through
// the public development hostname can preserve the original Host header and
// send the request to an older/circular web route instead of the API process.
const apiUrl = process.env.API_INTERNAL_URL ?? "http://127.0.0.1:4000"

const nextConfig: NextConfig = {
  transpilePackages: [
    "@workspace/auth",
    "@workspace/core",
    "@workspace/data-table",
    "@workspace/i18n",
    "@workspace/services",
    "@workspace/ui",
  ],
  allowedDevOrigins: ["avxtube.com", "avxtube.org"],
  devIndicators: false,
  rewrites: async () => {
    return [
      {
        source: "/api/auth/:path*",
        destination: `${apiUrl}/api/auth/:path*`,
      },
      {
        source: "/api/v1/:path*",
        destination: `${apiUrl}/v1/:path*`,
      },
    ]
  },
}

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts")

export default withNextIntl(nextConfig)
