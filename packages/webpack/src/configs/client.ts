import querystring from 'node:querystring'
import { pathToFileURL } from 'node:url'
import { resolve } from 'pathe'
import webpack from 'webpack'
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer'
import { logger, tryResolveModule } from '@nuxt/kit'
import { joinURL } from 'ufo'
import ForkTSCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin'

import type { WebpackConfigContext } from '../utils/config'
import { applyPresets } from '../utils/config'
import { nuxt } from '../presets/nuxt'

export async function client (ctx: WebpackConfigContext) {
  ctx.name = 'client'
  ctx.isClient = true

  await applyPresets(ctx, [
    nuxt,
    clientPlugins,
    clientOptimization,
    clientDevtool,
    clientPerformance,
    clientHMR
  ])
}

function clientDevtool (ctx: WebpackConfigContext) {
  if (!ctx.nuxt.options.sourcemap.client) {
    ctx.config.devtool = false
    return
  }

  if (!ctx.isDev) {
    ctx.config.devtool = 'source-map'
    return
  }

  ctx.config.devtool = 'eval-cheap-module-source-map'
}

function clientPerformance (ctx: WebpackConfigContext) {
  ctx.config.performance = {
    maxEntrypointSize: 1000 * 1024,
    hints: ctx.isDev ? false : 'warning',
    ...ctx.config.performance
  }
}

async function clientHMR (ctx: WebpackConfigContext) {
  if (!ctx.isDev) {
    return
  }

  const clientOptions = ctx.userConfig.hotMiddleware?.client || {}
  const hotMiddlewareClientOptions = {
    reload: true,
    timeout: 30000,
    path: joinURL(ctx.options.app.baseURL, '__webpack_hmr', ctx.name),
    ...clientOptions,
    ansiColors: JSON.stringify(clientOptions.ansiColors || {}),
    overlayStyles: JSON.stringify(clientOptions.overlayStyles || {}),
    name: ctx.name
  }
  const hotMiddlewareClientOptionsStr = querystring.stringify(hotMiddlewareClientOptions)

  // Add HMR support
  const app = (ctx.config.entry as any).app as any
  const hotMiddlewarePath = await tryResolveModule('webpack-hot-middleware/client', import.meta.url) || 'webpack-hot-middleware/client'
  app.unshift(
    // https://github.com/glenjamin/webpack-hot-middleware#config
    `${pathToFileURL(hotMiddlewarePath)}?${hotMiddlewareClientOptionsStr}`
  )

  ctx.config.plugins = ctx.config.plugins || []
  ctx.config.plugins.push(new webpack.HotModuleReplacementPlugin())
}

function clientOptimization (_ctx: WebpackConfigContext) {
  // TODO: Improve optimization.splitChunks.cacheGroups
}

function clientPlugins (ctx: WebpackConfigContext) {
  // webpack Bundle Analyzer
  // https://github.com/webpack-contrib/webpack-bundle-analyzer
  if (!ctx.isDev && ctx.name === 'client' && ctx.userConfig.analyze) {
    const statsDir = resolve(ctx.options.analyzeDir)

    ctx.config.plugins!.push(new BundleAnalyzerPlugin({
      analyzerMode: 'static',
      defaultSizes: 'gzip',
      generateStatsFile: true,
      openAnalyzer: true,
      reportFilename: resolve(statsDir, `${ctx.name}.html`),
      statsFilename: resolve(statsDir, `${ctx.name}.json`),
      ...ctx.userConfig.analyze === true ? {} : ctx.userConfig.analyze
    }))
  }

  // Normally type checking runs in server config, but in `ssr: false` there is
  // no server build, so we inject here instead.
  if (!ctx.nuxt.options.ssr) {
    if (ctx.nuxt.options.typescript.typeCheck === true || (ctx.nuxt.options.typescript.typeCheck === 'build' && !ctx.nuxt.options.dev)) {
      ctx.config.plugins!.push(new ForkTSCheckerWebpackPlugin({
        logger
      }))
    }
  }
}
