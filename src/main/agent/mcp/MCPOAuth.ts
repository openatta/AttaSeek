/**
 * MCPOAuth — lightweight OAuth 2.0 Authorization Code Grant for MCP servers.
 *
 * Supports the most common OAuth flow used by MCP servers:
 *   1. Authorization Code Grant (server → browser → callback → token exchange)
 *   2. Token refresh via refresh_token
 *   3. Token persistence to disk (~/.atta/seek/mcp-tokens.json)
 *
 * This is a lightweight implementation (~150 lines). For full OAuth 2.0
 * (Device Code, Client Credentials, PKCE, etc.), use a dedicated library.
 *
 * Inspired by Claude Code's MCP OAuth (src/services/mcp/auth.ts, 88KB).
 * Phase D: lightweight, Authorization Code Grant only.
 */

import * as fs from 'fs'
import * as path from 'path'
import * as http from 'http'
import { dataDir } from '../../store/paths'

// ── Types ──

export interface MCPOAuthConfig {
  /** OAuth authorization endpoint URL */
  authorizationUrl: string
  /** OAuth token endpoint URL */
  tokenUrl: string
  /** OAuth client ID */
  clientId: string
  /** OAuth client secret (optional, may be empty for public clients) */
  clientSecret?: string
  /** OAuth scopes (space-separated) */
  scope?: string
  /** Redirect URI (default: http://localhost:{port}/callback) */
  redirectUri?: string
  /** Local port for the callback server (default: 18923) */
  callbackPort?: number
}

export interface MCPOAuthTokens {
  accessToken: string
  refreshToken?: string
  expiresAt?: number // epoch ms
  tokenType?: string
}

// ── Token storage ──

const TOKENS_FILE = path.join(dataDir(), 'mcp-tokens.json')

function loadTokens(): Record<string, MCPOAuthTokens> {
  try {
    if (fs.existsSync(TOKENS_FILE)) {
      return JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf-8'))
    }
  } catch { /* file missing or corrupt */ }
  return {}
}

function saveTokens(serverId: string, tokens: MCPOAuthTokens): void {
  const all = loadTokens()
  all[serverId] = tokens
  try {
    const dir = path.dirname(TOKENS_FILE)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(TOKENS_FILE, JSON.stringify(all, null, 2), 'utf-8')
  } catch { /* best effort */ }
}

// ── Authorization flow ──

/**
 * Start the OAuth 2.0 Authorization Code Grant flow.
 *
 * 1. Opens the browser for user to authorize
 * 2. Starts a local HTTP server to receive the callback
 * 3. Exchanges the authorization code for tokens
 * 4. Persists tokens to disk
 *
 * @param serverId — MCP server identifier (for token storage)
 * @param config — OAuth configuration
 * @returns the tokens, or null if the flow failed or was cancelled
 */
export async function startOAuthFlow(
  serverId: string,
  config: MCPOAuthConfig,
): Promise<MCPOAuthTokens | null> {
  const port = config.callbackPort ?? 18923
  const redirectUri = config.redirectUri ?? `http://localhost:${port}/callback`
  const scopeParam = config.scope ? `&scope=${encodeURIComponent(config.scope)}` : ''

  const authUrl = `${config.authorizationUrl}?response_type=code&client_id=${encodeURIComponent(config.clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}${scopeParam}`

  // Open browser for user authorization
  try {
    const { exec } = await import('child_process')
    const cmd = process.platform === 'darwin'
      ? `open "${authUrl}"`
      : process.platform === 'win32'
        ? `start "" "${authUrl}"`
        : `xdg-open "${authUrl}"`
    exec(cmd)
  } catch { /* browser open failed — user can copy the URL manually */ }

  // Start local callback server
  const code = await new Promise<string | null>((resolve) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url || '/', `http://localhost:${port}`)
      if (url.pathname === '/callback') {
        const codeParam = url.searchParams.get('code')
        const errorParam = url.searchParams.get('error')

        if (codeParam) {
          res.writeHead(200, { 'Content-Type': 'text/html' })
          res.end('<html><body><h1>Authorization successful</h1><p>You may close this window.</p></body></html>')
          server.close()
          resolve(codeParam)
        } else if (errorParam) {
          res.writeHead(200, { 'Content-Type': 'text/html' })
          res.end(`<html><body><h1>Authorization failed</h1><p>${errorParam}</p></body></html>`)
          server.close()
          resolve(null)
        } else {
          res.writeHead(200, { 'Content-Type': 'text/html' })
          res.end('<html><body><h1>MCP OAuth Callback</h1><p>Waiting for authorization...</p></body></html>')
        }
      }
    })

    server.on('error', () => resolve(null))
    server.listen(port, '127.0.0.1')

    // Timeout after 5 minutes
    setTimeout(() => {
      server.close()
      resolve(null)
    }, 300_000)
  })

  if (!code) return null

  // Exchange code for tokens
  return exchangeCodeForTokens(serverId, code, config, redirectUri)
}

/**
 * Exchange an authorization code for access/refresh tokens.
 */
async function exchangeCodeForTokens(
  serverId: string,
  code: string,
  config: MCPOAuthConfig,
  redirectUri: string,
): Promise<MCPOAuthTokens | null> {
  try {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: config.clientId,
    })
    if (config.clientSecret) body.set('client_secret', config.clientSecret)

    const resp = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })

    if (!resp.ok) {
      console.warn(`[MCPOAuth] token exchange failed: HTTP ${resp.status}`)
      return null
    }

    const data = await resp.json() as {
      access_token: string
      refresh_token?: string
      expires_in?: number
      token_type?: string
    }

    const tokens: MCPOAuthTokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
      tokenType: data.token_type,
    }

    saveTokens(serverId, tokens)
    return tokens
  } catch (err) {
    console.warn(`[MCPOAuth] token exchange error:`, (err as Error).message)
    return null
  }
}

/**
 * Refresh an expired access token using a refresh_token.
 *
 * @param serverId — MCP server identifier
 * @param config — OAuth configuration (needs tokenUrl + clientId)
 * @returns updated tokens, or null if refresh failed
 */
export async function refreshOAuthToken(
  serverId: string,
  config: Pick<MCPOAuthConfig, 'tokenUrl' | 'clientId' | 'clientSecret'>,
): Promise<MCPOAuthTokens | null> {
  const stored = getStoredTokens(serverId)
  if (!stored?.refreshToken) return null

  try {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: stored.refreshToken,
      client_id: config.clientId,
    })
    if (config.clientSecret) body.set('client_secret', config.clientSecret)

    const resp = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })

    if (!resp.ok) return null

    const data = await resp.json() as {
      access_token: string
      refresh_token?: string
      expires_in?: number
      token_type?: string
    }

    const tokens: MCPOAuthTokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? stored.refreshToken,
      expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
      tokenType: data.token_type,
    }

    saveTokens(serverId, tokens)
    return tokens
  } catch {
    return null
  }
}

/**
 * Get stored tokens for a server.
 */
export function getStoredTokens(serverId: string): MCPOAuthTokens | null {
  const all = loadTokens()
  const tokens = all[serverId]
  if (!tokens) return null

  // Check if expired
  if (tokens.expiresAt && Date.now() > tokens.expiresAt) return null

  return tokens
}

/**
 * Remove stored tokens for a server.
 */
export function clearStoredTokens(serverId: string): void {
  const all = loadTokens()
  delete all[serverId]
  try {
    fs.writeFileSync(TOKENS_FILE, JSON.stringify(all, null, 2), 'utf-8')
  } catch { /* best effort */ }
}
