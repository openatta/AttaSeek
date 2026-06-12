/**
 * UpdateSource — dual-source strategy for fetching update manifests.
 *
 * Primary: GitHub Releases API (free, no auth for public repos)
 * Fallback: AttaCloud update endpoint
 *
 * Both sources implement IUpdateSource, returning a unified UpdateManifest.
 */

import { get } from 'https'
import type { UpdateManifest, UpdateChannel } from '../../shared/types/update'

// ── Interface ──

export interface IUpdateSource {
  fetch(
    currentVersion: string,
    platform: string,
    arch: string,
    channel: UpdateChannel,
  ): Promise<UpdateManifest | null>
}

// ── Helpers ──

function httpsGetJson<T>(url: string, headers?: Record<string, string>): Promise<T> {
  return new Promise((resolve, reject) => {
    get(url, { headers }, (res) => {
      // Follow redirects (GitHub Releases may redirect to S3)
      if (res.statusCode === 301 || res.statusCode === 302) {
        const redirectUrl = res.headers.location
        if (redirectUrl) return httpsGetJson<T>(redirectUrl, headers).then(resolve, reject)
      }
      if (res.statusCode === 204) return resolve(null as T)
      if (res.statusCode && res.statusCode >= 400) {
        return reject(new Error(`HTTP ${res.statusCode}`))
      }
      let data = ''
      res.on('data', (chunk: Buffer) => (data += chunk.toString()))
      res.on('end', () => {
        try {
          resolve(JSON.parse(data) as T)
        } catch (err) {
          reject(new Error(`JSON parse error: ${err instanceof Error ? err.message : 'unknown'}`))
        }
      })
    }).on('error', reject).setTimeout(15_000, () => reject(new Error('Request timeout')))
  })
}

function buildPlatformTag(platform: string, arch: string): string {
  const platMap: Record<string, string> = {
    darwin: 'macOS', win32: 'Windows', linux: 'Linux',
  }
  const archMap: Record<string, string> = {
    x64: 'x64', arm64: 'arm64',
  }
  return `${platMap[platform] || platform}-${archMap[arch] || arch}`
}

// ── GitHub Release Source ──

const GITHUB_REPO = process.env.ATTASEEK_UPDATE_REPO || 'Atta/AttaSeek'
const GITHUB_API = `https://api.github.com/repos/${GITHUB_REPO}/releases`

interface GitHubRelease {
  tag_name: string
  published_at: string
  html_url: string
  body: string
  assets: GitHubAsset[]
}

interface GitHubAsset {
  name: string
  browser_download_url: string
  size: number
  content_type: string
}

export class GitHubReleaseSource implements IUpdateSource {
  async fetch(
    _currentVersion: string,
    platform: string,
    arch: string,
    channel: UpdateChannel,
  ): Promise<UpdateManifest | null> {
    // Map channel to GitHub release strategy
    if (channel !== 'stable') return null // beta/nightly not on GitHub Releases for now

    try {
      const release = await httpsGetJson<GitHubRelease>(
        `${GITHUB_API}/latest`,
        { 'User-Agent': 'AttaSeek-Update/1.0', Accept: 'application/vnd.github.v3+json' },
      )
      if (!release || !release.assets.length) return null

      const tag = release.tag_name.replace(/^v/, '')
      const platformTag = buildPlatformTag(platform, arch)

      // Match asset by platform+arch in filename (e.g., "AttaSeek-0.2.0-macOS-arm64.dmg")
      const asset = release.assets.find(
        (a) =>
          a.name.includes(platformTag) ||
          a.name.includes(`${platform}-${arch}`) ||
          (platform === 'darwin' && a.name.endsWith('.dmg') && a.name.includes(arch)) ||
          (platform === 'win32' && a.name.endsWith('.exe') && a.name.includes(arch)) ||
          (platform === 'linux' && a.name.endsWith('.AppImage') && a.name.includes(arch)),
      )

      if (!asset) return null

      // Extract SHA256 from release body (convention: `sha256: <hex>` or `SHA256: <hex>`)
      let sha256 = ''
      const shaMatch = release.body.match(/[Ss][Hh][Aa]256[:\s]+`?([a-fA-F0-9]{64})`?/)
      if (shaMatch) sha256 = shaMatch[1]

      return {
        version: tag,
        platform: `${platform}-${arch}`,
        url: asset.browser_download_url,
        size: asset.size,
        sha256,
        changelogUrl: release.html_url,
        publishedAt: new Date(release.published_at).getTime(),
        urgency: 'latest',
      }
    } catch {
      return null
    }
  }
}

// ── AttaCloud Source ──

const CLOUD_HOST = process.env.ATTASEEK_CLOUD_HOST || 'https://cloud.atta.example'

interface CloudUpdateResponse {
  version: string
  url: string
  size: number
  sha256: string
  changelog_url: string
  published_at: string
  urgency: 'latest' | 'recommended' | 'critical'
  min_upgradable_version?: string
}

export class AttaCloudSource implements IUpdateSource {
  async fetch(
    currentVersion: string,
    platform: string,
    arch: string,
    channel: UpdateChannel,
  ): Promise<UpdateManifest | null> {
    try {
      const params = new URLSearchParams({
        version: currentVersion,
        platform,
        arch,
        channel,
      })
      const data = await httpsGetJson<CloudUpdateResponse>(
        `${CLOUD_HOST}/api/v1/update/check?${params.toString()}`,
      )
      if (!data) return null

      return {
        version: data.version,
        platform: `${platform}-${arch}`,
        url: data.url,
        size: data.size,
        sha256: data.sha256,
        changelogUrl: data.changelog_url,
        publishedAt: new Date(data.published_at).getTime(),
        urgency: data.urgency,
        minUpgradableVersion: data.min_upgradable_version,
      }
    } catch {
      return null
    }
  }
}

// ── Composite Source ──

/**
 * CompositeUpdateSource tries the primary source first,
 * falls back to the secondary source on failure.
 */
export class CompositeUpdateSource implements IUpdateSource {
  constructor(
    private primary: IUpdateSource,
    private fallback: IUpdateSource,
  ) {}

  async fetch(
    currentVersion: string,
    platform: string,
    arch: string,
    channel: UpdateChannel,
  ): Promise<UpdateManifest | null> {
    const result = await this.primary.fetch(currentVersion, platform, arch, channel)
    if (result) return result
    console.log('[update] primary source returned null, trying fallback')
    return this.fallback.fetch(currentVersion, platform, arch, channel)
  }
}
