import esbuild from 'esbuild'
import fs from 'fs'
import path from 'path'

const isServe = !process.argv.includes('--build')

const config = {
  entryPoints: ['src/main.tsx'],
  bundle: true,
  outdir: isServe ? 'public/dist' : 'dist',
  format: 'esm',
  splitting: true,
  sourcemap: true,
  minify: !isServe,
  target: ['es2020'],
  loader: {
    '.tsx': 'tsx',
    '.ts': 'ts',
    '.css': 'css',
  },
  jsx: 'automatic',
  define: {
    'process.env.NODE_ENV': JSON.stringify(isServe ? 'development' : 'production'),
  },
}

if (isServe) {
  const ctx = await esbuild.context(config)
  const { host, port } = await ctx.serve({
    servedir: 'public',
    fallback: 'public/index.html',
  })
  console.log(`Dev server running at http://localhost:${port}`)
} else {
  await esbuild.build(config)
  fs.copyFileSync('public/index.html', 'dist/index.html')
  console.log('Build complete')
}
