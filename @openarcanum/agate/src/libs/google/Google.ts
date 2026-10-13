export interface OAuthTokens { access_token?: string; refresh_token?: string; expiry_date?: number; token_type?: string; scope?: string }
export interface OAuthClient {
  setCredentials(tokens: OAuthTokens): void
  getToken(code: string, callback: (error: Error | null, tokens?: OAuthTokens) => void): void
  generateAuthUrl(options: {access_type: string; prompt: string; scope: string}): string
}
export interface VideoResponse { request?: {connection?: {_bytesDispatched?: number}} }
export type GoogleCallback = (error: Error | null, data?: VideoResponse) => void
export type YouTubeAction = 'insert' | 'delete' | 'list' | 'update' | 'getRating' | 'rate'
export interface YouTubeProvider {
  videos: {[Action in YouTubeAction]: (params: Record<string, unknown>, callback?: GoogleCallback) => unknown}
  thumbnails: {set(params: Record<string, unknown>, callback?: GoogleCallback): unknown}
}
export interface GoogleProvider {
  createOAuthClient(clientId: string, clientSecret: string, redirectUrl: string): OAuthClient
  youtube(version: 'v3'): YouTubeProvider
}
let configured: GoogleProvider | undefined
export function configureGoogleProvider(provider: GoogleProvider | undefined): void { configured = provider }
export default function getGoogleProvider(): GoogleProvider {
  if (!configured) throw new Error('Legacy Google services require an explicitly configured SDK provider')
  return configured
}
