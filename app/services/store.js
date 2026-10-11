import { useLegacyStore } from '@warp-drive/legacy'
import { JSONAPICache } from '@warp-drive/json-api'

// Keep the authored GUI Model records and local adapter while using the
// current WarpDrive cache, request manager, schema and record lifecycle.
export default useLegacyStore({
  linksMode: false,
  legacyRequests: true,
  cache: JSONAPICache
})
