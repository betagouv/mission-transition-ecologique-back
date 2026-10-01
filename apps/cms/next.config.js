import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const nextConfig = {
redirects: async () => [{ source: '/', destination: '/admin', permanent: false }],
  // Nothing uses next/image; disabling the optimizer closes the public /_next/image
  // endpoint (AVIF RCE, GHSA-2xp9-vwfh-vxw4) until Next 16.3.3.
  images: { unoptimized: true },
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    return webpackConfig
  },
}

export default withPayload(nextConfig)
