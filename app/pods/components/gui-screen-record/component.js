import GuiWidget from '../gui-widget'

const { desktopCapturer } = require(`electron`)
const fs = require(`fs`)

import moment from 'moment'

import {action} from '@ember/object'
import {inject as service} from '@ember/service'

// TODO https://github.com/youtube/api-samples/blob/master/javascript/upload_video.js

class GuiScreenRecord extends GuiWidget {
  @service
  moment

  @service
  google

  //@attribute
  recording = false
  recordTime = 0
  uploading = false
  uploadProgress = 0
  downloadUrl = ``
  downloadName = ``
  authUrl = ``

  default = {
    size: [`100%`, `100%`]
  }

  constructor() {
    super(...arguments)
  }

  didInsertElement() {
    super.didInsertElement(...arguments)

    let google = this.get(`google`).api
    if (google) {
      this.youTube = google.getService(`youtube`)

      google.getAuthUrl(this.youTube).then((authUrl) => {
        this.set(`authUrl`, authUrl)
      }).catch((e) => {
        console.log(e)
      })
    }
  }

  async initRecorder() {
    return new Promise((resolve, reject) => {
      desktopCapturer.getSources(
        {types: [`window`, `screen`]},
        (error, sources) => {
          if (error) {
            throw error
          }
          for (let i = 0; i < sources.length; ++i) {
            if (sources[i].name === `OpenArcanum`) {
              let supportedConstraints = navigator.mediaDevices.getSupportedConstraints()
              console.log(supportedConstraints)

              navigator.mediaDevices
                .getUserMedia({
                  audio: false /*{
                    mandatory: {
                      chromeMediaSource: `desktop`,
                      chromeMediaSourceId: sources[i].id,
                      //channelCount: 1,
                     // sampleRate: Math.round(44100 / 4)
                    }
                  },*/,
                  video: {
                    mandatory: {
                      //idealFramerate: 10,
                      maxFrameRate: 15,
                      chromeMediaSource: `desktop`,
                      chromeMediaSourceId: sources[i].id,
                      minWidth: 1280,
                      maxWidth: 1280,
                      minHeight: 720,
                      maxHeight: 720
                    }
                  }
                })
                .then((stream) => {
                  this.handleStream(stream)
                  resolve(stream)
                })
                .catch((e) => {
                  this.handleError(e)
                  reject(e)
                })
              return
            }
          }
        }
      )
    })
  }

  start() {
    this.initRecorder().then((stream) => {
      this.set(`recording`, true)
      this.set(`recordTime`, 0)

      this.mediaRecorder.start()

      const startDate = new Date()
      this.intervalObj = setInterval(() => {
        let endDate = new Date()
        let seconds = (endDate.getTime() - startDate.getTime()) / 1000
        this.set(`recordTime`, seconds.toFixed(2))
      }, 500)

      console.log(this.mediaRecorder.state)
    })
  }

  stop() {
    this.mediaRecorder.stop()
    clearInterval(this.intervalObj)
    this.set(`recording`, false)
    console.log(this.mediaRecorder.state)
  }

  toggle() {
    if (this.get(`recording`)) {
      this.stop()
    } else {
      this.start()
    }
  }

  handleStream(stream) {
    this.set(`videoName`, `OpenArcanum-${moment().format(`YMMDD-HHmm`)}`)
    this.set(`localVideoPath`, `/home/maxli/${this.videoName}.mp4`)

    this.mediaRecorder = new MediaRecorder(stream)
    this.chunks = []

    this.mediaRecorder.onstart = (e) => {
      this.streamBuffer = fs.createWriteStream(this.localVideoPath)
      this.streamBuffer.on(`finish`, (e) => {})

      this.fileReader = new FileReader()
      this.fileReader.addEventListener(`loadend`, e2 => {
        let data = new Uint8Array(this.fileReader.result)
        this.streamBuffer.write(data)

        if (this.mediaRecorder.state === `inactive`) {
          this.streamBuffer.end()
          this.fileReader = null
          this.streamBuffer = null
        }
      })
    }

    this.mediaRecorder.onstop = (e) => {
      let blob = new Blob(this.chunks, {type: `video/mp4` })
      let url = window.URL.createObjectURL(blob)
      this.set(`downloadUrl`, url)

      //TODO window.URL.revokeObjectURL(url);
    }

    this.mediaRecorder.ondataavailable = (e) => {
      this.chunks.push(e.data)

      if (this.streamBuffer) {
        this.fileReader.readAsArrayBuffer(e.data)
      }
    }
  }

  handleError(e) {
    console.log(e)
  }

  @action
  startRecorder() {
    this.start()
  }

  @action
  stopRecorder() {
    this.stop()
  }

  @action
  toggleRecorder() {
    this.toggle()
  }

  @action
  onAuthCode(code) {
    this.youTube.getNewToken(code).then((result) => {})
  }

  @action
  upload() {
    this.set(`uploading`, true)
    this.youTube.upload(
      {
        params: {part: `snippet,status` },
        properties: {
          'snippet.categoryId': `22`,
          'snippet.defaultLanguage': ``,
          'snippet.description': `Description of uploaded video.`,
          'snippet.tags[]': ``,
          'snippet.title': `Test video upload`,
          'status.embeddable': ``,
          'status.license': ``,
          'status.privacyStatus': `private`,
          'status.publicStatsViewable': ``
        },
        mediaFilename: this.get(`localVideoPath`)
      },
      (stats) => {
        if (stats.percentComplete === 100) {
          this.set(`uploading`, false)
        } else {
        }

        this.set(`uploadProgress`, stats.percentComplete)
      }
    )
  }
}

export default GuiScreenRecord
