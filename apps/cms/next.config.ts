import type { NextConfig } from 'next'
import { composePlugins, withNx } from '@nx/next'
import { withPayload } from '@payloadcms/next/withPayload'

const nextConfig: NextConfig = {
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
