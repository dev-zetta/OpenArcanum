import { setComponentTemplate } from '@ember/component'
import template from './layout.hbs'
import GuiWidget from '../gui-widget'



import { action, computed } from '@ember/object'
import { service } from '@ember/service'

// TODO https://github.com/youtube/api-samples/blob/master/javascript/upload_video.js

class GuiScreenRecord extends GuiWidget {

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

  @computed('uploading', 'youTube', 'localVideoPath')
  get uploadDisabled() {
    return this.uploading || !this.youTube || !this.localVideoPath
  }

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
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: 15 }, audio: false
    })
    this.handleStream(stream)
    return stream
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
    }).catch(error => this.handleError(error))
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
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    this.set('videoName', `OpenArcanum-${timestamp}.webm`)
    this.mediaStream = stream
    this.mediaRecorder = new MediaRecorder(stream)
    this.chunks = []
    this.mediaRecorder.ondataavailable = event => {
      if (event.data.size) this.chunks.push(event.data)
    }
    this.mediaRecorder.onstop = () => {
      if (this.downloadUrl) URL.revokeObjectURL(this.downloadUrl)
      const blob = new Blob(this.chunks, { type: this.mediaRecorder.mimeType })
      this.set('downloadUrl', URL.createObjectURL(blob))
      stream.getTracks().forEach(track => track.stop())
    }
  }

  willDestroyElement() {
    clearInterval(this.intervalObj)
    if (this.mediaRecorder?.state === 'recording') this.mediaRecorder.stop()
    this.mediaStream?.getTracks().forEach(track => track.stop())
    if (this.downloadUrl) URL.revokeObjectURL(this.downloadUrl)
    super.willDestroyElement(...arguments)
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

export default setComponentTemplate(template, GuiScreenRecord)
