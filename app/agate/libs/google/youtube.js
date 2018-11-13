import {GoogleAuth, google} from './auth'

const fs = requireNode(`fs`)
//const path = requireNode(`path`)
const stream = requireNode(`stream`)
const mime = requireNode(`mime`)
const youtube = google.youtube(`v3`)

const SCOPES = [
  `https://www.googleapis.com/auth/youtube`,
  `https://www.googleapis.com/auth/youtube.upload`
]

export default class YoutubeApi extends GoogleAuth {
  constructor() {
    super({scopes: SCOPES})
  }

  /**
   * Remove parameters that do not have values.
   *
   * @param {Object} params A list of key-value pairs representing request
   *                        parameters and their values.
   * @return {Object} The params object minus parameters with no values set.
   */
  removeEmptyParameters(params) {
    for (let p in params) {
      if (!params[p] || params[p] == `undefined`) {
        delete params[p]
      }
    }
    return params
  }

  /**
   * Create a JSON object, representing an API resource, from a list of
   * properties and their values.
   *
   * @param {Object} properties A list of key-value pairs representing resource
   *                            properties and their values.
   * @return {Object} A JSON object. The function nests properties based on
   *                  periods (.) in property names.
   */
  createResource(properties) {
    let resource = {}
    let normalizedProps = properties
    for (let p in properties) {
      let value = properties[p]
      if (p && p.substr(-2, 2) == `[]`) {
        let adjustedName = p.replace(`[]`, ``)
        if (value) {
          normalizedProps[adjustedName] = value.split(`,`)
        }
        delete normalizedProps[p]
      }
    }
    for (let p in normalizedProps) {
      // Leave properties that don't have values out of inserted resource.
      if (normalizedProps.hasOwnProperty(p) && normalizedProps[p]) {
        let propArray = p.split(`.`)
        let ref = resource
        for (let pa = 0; pa < propArray.length; pa++) {
          let key = propArray[pa]
          if (pa == propArray.length - 1) {
            ref[key] = normalizedProps[p]
          } else {
            ref = ref[key] = ref[key] || {}
          }
        }
      }
    }
    return resource
  }

  upload(requestData, callback) {
    let videoStream, mimeType, fileSize

    let pathOrStream = requestData[`mediaFilename`]
    if (pathOrStream instanceof stream.Readable) {
      videoStream = pathOrStream //pass mediaType in params
    } else {
      fileSize = fs.statSync(pathOrStream).size

      videoStream = fs.createReadStream(pathOrStream)
      mimeType = mime.lookup(pathOrStream)
    }

    let parameters = this.removeEmptyParameters(requestData[`params`])
    parameters[`auth`] = this.oauth
    parameters[`media`] = { body: videoStream }
    parameters[`notifySubscribers`] = false
    parameters[`resource`] = this.createResource(requestData[`properties`])

    let req = this._command(`insert`, parameters, (err, data) => {
      if (err) {
        console.log(`The API returned an error: ` + err)
      }
      if (data) {
        console.log(data)

        // show some progress
        if (fileSize && callback) {
          let intervalId = setInterval(function() {
            console.log(req)

            let uploadedBytes = data.request.connection._bytesDispatched
            let uploadedMBytes = uploadedBytes / 1000000
            let progress =
              uploadedBytes > fileSize ? 100 : (uploadedBytes / fileSize) * 100

            console.log(progress, uploadedBytes, fileSize )

            callback({ uploadedMB: uploadedMBytes, percentComplete: progress })

            if (Math.round(progress) === 100) {
              clearInterval(intervalId)
            }
          }, 250)
        }
      }
    })

    return req
  }

  remove(id, callback) {
    return this._command(`delete`, { id: id }, callback)
  }

  list(params, callback) {
    const options = Object.assign(
      {},
      { part: `status,snippet` },
      this.opts.video,
      params
    )
    return this._command(`list`, options, callback)
  }

  updatefunction(params, callback) {
    const options = Object.assign(
      {},
      { part: `status,snippet`},
      this.opts.video,
      params
    )
    return this._command(`update`, options, callback)
  }

  getRating(id, callback) {
    return this._command(`getRating`, { id: id }, callback)
  }

  rate(id, rating, callback) {
    return this._command(`rate`, { id: id, rating: rating }, callback)
  }

  thumbnails(id, media, callback) {
    const params = Object.assign(
      { auth: this.oauth },
      { videoId: id, media: media }
    )
    return youtube.thumbnails.set(params, callback)
  }

  _command(action, params, callback) {
    if (!this._authenticated) {
      return this.missingAuthentication(callback)
    }
    const options = Object.assign({ auth: this.oauth }, params)
    return youtube.videos[action](options, callback)
  }
}
