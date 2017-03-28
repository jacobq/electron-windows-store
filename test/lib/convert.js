'use strict'

const fs = require('fs-extra')
const path = require('path')

const denodeify = require('denodeify')
const readFile = denodeify(fs.readFile);

const convert = require('../../lib/convert')

describe('Convert', () => {
  const tmpDir = path.join(require('os').tmpdir(), `electron-windows-store-convert-${Date.now()}`)
  beforeEach(() => {
    fs.ensureDirSync(tmpDir)
  })

  afterEach(() => {
    fs.removeSync(tmpDir)
  })

  describe('convertWithFileCopy()', () => {
    it.only('should escape input to manifest template', function () {
      const options = {
        containerVirtualization: false,
        outputDirectory: tmpDir,
        publisher: 'CN="1337 h4x0r"',
        publisherDisplayName: 'Kyle "The Yellow Dart" Smith',
        identityName: 'My identity',
        logo: ['44x44', '50x50', '150x150', '310x150'].reduce((logo, size) => {
          logo[size] = path.join('assets', `custom.${size}.png`)
          return logo
        }, {}),
        packageVersion: '1.2.3',
        packageName: 'test-package',
        packageExecutable: path.join('app', 'custom-exec.exe'),
        packageDisplayName: 'Dummy Test Package',
        packageDescription: 'Here\'s a description with "quotation marks" in it.\nAnd a new line.',
        packageBackgroundColor: '#123456'
      }

      return convert(options)
      .then(() => {
        return Promise.all([
          Promise.resolve(''), //readFile(path.resolve(__dirname, '..', 'fixtures', 'expected-manifest.xml'), { encoding: 'UTF-8' }),
          Promise.resolve('') //readFile(path.join(tmpDir, 'pre-appx', 'appxmanifest.xml'), { encoding: 'UTF-8' })
        ])
      })
      .then((results) => {
        let expected = results[0]
        let actual = results[1]
        console.log(`expected = ${expected}, actual = ${actual}, path = ${path.join(tmpDir, 'pre-appx', 'appxmanifest.xml')}`)
        expected.should.equal(actual)
      })
    })
  })
})
