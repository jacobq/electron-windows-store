'use strict'

const path = require('path')
const fs = require('fs-extra')
const chalk = require('chalk')

const utils = require('./utils')

// MakeCert claims to support publisher strings matching this (RFC1779 / X.500 distinguished name )
// as long as the length of the string is between 1 and 8192.
// See https://msdn.microsoft.com/en-us/library/windows/apps/br211441.aspx
//    /(CN|L|O|OU|E|C|S|STREET|T|G|I|SN|DC|SERIALNUMBER|(OID\.(0|[1-9][0-9]*)(\.(0|[1-9][0-9]*))+))=(([^,+="<>#;])+|".*")
// (, ((CN|L|O|OU|E|C|S|STREET|T|G|I|SN|DC|SERIALNUMBER|(OID\.(0|[1-9][0-9]*)(\.(0|[1-9][0-9]*))+))=(([^,+="<>#;])+|".*")))*/
// However, in practice is it not this strict, e.g. does not require spaces between commas,
// doesn't require capitalized keys, etc. so we adapt this to match the observed behavior of makecert.exe.
const validPublisherNameRegex = /^(CN|L|O|OU|E|C|S|STREET|T|G|I|SN|DC|SERIALNUMBER|(OID\.(0|[1-9][0-9]*)(\.(0|[1-9][0-9]*))+))=(([^,+="<>#;])*|".*")(,\s*((CN|L|O|OU|E|C|S|STREET|T|G|I|SN|DC|SERIALNUMBER|(OID\.(0|[1-9][0-9]*)(\.(0|[1-9][0-9]*))+))=(([^,+="<>#;])+|".*")))$/ig

function isValidPublisherName (publisherName) {
  return typeof publisherName === 'string' &&
    publisherName.length >= 1 && publisherName.length <= 8192 &&
    validPublisherNameRegex.test(publisherName)
}

function makeCert (parameters) {
  let publisherName = parameters.publisherName
  if (typeof publisherName !== 'string' || publisherName.length < 1) {
    throw new Error('publisherName must be a non-empty string')
  }

  const certFilePath = parameters.certFilePath || '.'
  const certFileName = parameters.certFileName || publisherName
  const windowsKit = parameters.windowsKit || process.cwd()

  if (!isValidPublisherName(publisherName)) {
    publisherName = `CN=${publisherName}`
    if (!isValidPublisherName(publisherName)) {
      utils.debug(`Warning: publisherName did not appear valid even after prepending 'CN=': ${publisherName}`)
    }
  }

  const cer = path.join(certFilePath, `${certFileName}.cer`)
  const pvk = path.join(certFilePath, `${certFileName}.pvk`)
  const pfx = path.join(certFilePath, `${certFileName}.pfx`)

  const makecertExe = path.join(windowsKit, 'makecert.exe')
  const keyUsageCodeSigningOID = '1.3.6.1.5.5.7.3.3' // id-kp-3 -- see RFC 2459 / RFC3280
  const makecertArgs = [
    '-r',                           // root (self-signed) CA
    '-h', '0',                      // no CAs follow; next item in chain is the last
    '-n', publisherName,            // subject DN
    '-eku', keyUsageCodeSigningOID, // extended key usage: code signing
    '-pe',                          // mark generated private key file as exportable (not supported in Mono MakeCert v4.6.2.0)
    '-sv', pvk,                     // private key file (generated if non-existant)
    cer                             // output (certificate) file
  ]

  const pk2pfx = path.join(windowsKit, 'pvk2pfx.exe')
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
      return pfx
    })
}

module.exports = {
  isValidPublisherName,
  makeCert
}
