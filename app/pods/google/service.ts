import Service from '@ember/service'

export interface YouTubeService {
  getNewToken(code: string): Promise<unknown>
  upload(options: { params: { part: string }; properties: Record<string, string>; mediaFilename: string }, progress: (stats: { percentComplete: number }) => void): void
}
export interface GoogleApi {
  getService(name: 'youtube'): YouTubeService
  getAuthUrl(service: YouTubeService): Promise<string>
}

// Optional integration: the desktop runtime does not currently provide this API.
export default class GoogleService extends Service {
  declare api?: GoogleApi
}
