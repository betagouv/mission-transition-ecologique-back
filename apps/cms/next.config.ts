import type { NextConfig } from 'next'
import { composePlugins, withNx } from '@nx/next'
import { withPayload } from '@payloadcms/next/withPayload'

const nextConfig: NextConfig = {
  // @ts-expect-error — NX-specific option
  nx: {},
  // Your Next.js config here
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

export default composePlugins(...plugins)(nextConfig, { devBundleServerPackages: false })
