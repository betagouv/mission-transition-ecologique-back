import { composePlugins, withNx } from '@nx/next'
import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const nextConfig = {
  nx: {},
  redirects: async () => [{ source: '/', destination: '/admin', permanent: false }],
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    return webpackConfig
  },
}

const plugins = [withNx, withPayload]

export default composePlugins(...plugins)(nextConfig)
