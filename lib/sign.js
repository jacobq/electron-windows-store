'use strict'

const path = require('path')
const fs = require('fs-extra')
const chalk = require('chalk')

const utils = require('./utils')

// MakeCert supports publisher strings matching the (X.500 distinguished name) regex below
// See https://msdn.microsoft.com/en-us/library/windows/apps/br211441.aspx
const validPublisherRegex = /(CN|L|O|OU|E|C|S|STREET|T|G|I|SN|DC|SERIALNUMBER|(OID\.(0|[1-9][0-9]*)(\.(0|[1-9][0-9]*))+))=(([^,+="<>#;])+|".*")(, ((CN|L|O|OU|E|C|S|STREET|T|G|I|SN|DC|SERIALNUMBER|(OID\.(0|[1-9][0-9]*)(\.(0|[1-9][0-9]*))+))=(([^,+="<>#;])+|".*")))*/

function isValidPublisher (publisherName) {
  return validPublisherRegex.test(publisherName)
}

// TODO: BREAKING CHANGE: Bump version from 0.9.x to 0.10.0
function makeCert (parameters) {
  parameters = parameters || {}
  let publisherName = parameters.publisherName
  if (typeof publisherName !== 'string') {
    throw new Error('publisherName must be a string')
  }

  let certFilePath = parameters.certFilePath
  let certFileName = parameters.certFileName || publisherName
  if (!isValidPublisher(publisherName)) {
    publisherName = `CN=${publisherName}`
  }

  const cer = path.join(certFilePath, `${certFileName}.cer`)
  const pvk = path.join(certFilePath, `${certFileName}.pvk`)
  const pfx = path.join(certFilePath, `${certFileName}.pfx`)

  let program = parameters.program
  const makecertExe = path.join(program.windowsKit, 'makecert.exe')
  const makecertArgs = ['-r', '-h', '0', '-n', publisherName, '-eku', '1.3.6.1.5.5.7.3.3', '-pe', '-sv', pvk, cer]

  const pk2pfx = path.join(program.windowsKit, 'pvk2pfx.exe')
  const pk2pfxArgs = ['-pvk', pvk, '-spc', cer, '-pfx', pfx]
  const installPfxArgs = ['Import-PfxCertificate', '-FilePath', pfx, '-CertStoreLocation', '"Cert:\\LocalMachine\\TrustedPeople"']

  // Ensure the target directory exists
  fs.ensureDirSync(certFilePath)

  // Inform the user about the password
  utils.log(chalk.green.bold('When asked to enter a password, please select "None".'))

  return utils.executeChildProcess(makecertExe, makecertArgs)
    .then(() => utils.executeChildProcess(pk2pfx, pk2pfxArgs))
    .then(() => utils.executeChildProcess('powershell.exe', installPfxArgs))
    .then(() => {
      program.devCert = pfx
      return pfx
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
  isValidPublisher,
  makeCert,
  signAppx
}
