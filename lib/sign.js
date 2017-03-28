'use strict'

const path = require('path')
const chalk = require('chalk')

const utils = require('./utils')

function makeCert (publisherName, certFilePath, program) {
  utils.log(chalk.yellow('DEPRECATION: Access to makeCert should be done through the cert module instead of the sign module.'))

  return require('./cert').makeCert({
    publisherName: publisherName,
    certFilePath: certFilePath,
    certFileName: publisherName,
    windowsKit: program.windowsKit
  }).then(pfx => {
    program.devCert = pfx
  })
}

function signAppx (program) {
  return new Promise((resolve, reject) => {
    if (!program.devCert) {
      utils.debug(`Error: Tried to call signAppx, but program.devCert was undefined`)
      reject(new Error('No developer certificate specified!'))
    }

    const pfxFile = program.devCert
    const appxFile = path.join(program.outputDirectory, `${program.packageName}.appx`)
    const params = ['sign', '-f', pfxFile, '-fd', 'SHA256', '-v'].concat(program.signtoolParams || [])

    utils.debug(`Using PFX certificate from: ${pfxFile}`)
    utils.debug(`Signing appx package: ${appxFile}`)
    utils.debug(`Using the following parameters for signtool.exe: ${JSON.stringify(params)}`)

    params.push(appxFile)

    utils.executeChildProcess(path.join(program.windowsKit, 'signtool.exe'), params)
      .then(() => resolve())
      .catch((err) => reject(err))
  })
}

module.exports = {
  makeCert,
  signAppx
}
