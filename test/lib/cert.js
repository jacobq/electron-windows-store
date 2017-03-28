'use strict'

const path = require('path')
const mockery = require('mockery')
const fs = require('fs-extra')

const ChildProcessMock = require('../fixtures/child_process')
const cert = require('../../lib/cert')
const utils = require('../../lib/utils')


describe('Cert', () => {
  const tmpDir = path.join(require('os').tmpDir(), 'electron-windows-store-cert-test')

  before(() => {
    fs.ensureDirSync(tmpDir)
  })

  after(() => {
    fs.removeSync(tmpDir)
  })

  const cpMock = {
    spawn(_process, _args) {
      passedProcess = _process
      passedArgs = _args

      return new ChildProcessMock()
    }
  }

  let passedArgs
  let passedProcess

  afterEach(() => {
    mockery.deregisterAll()
    passedArgs = undefined
    passedProcess = undefined
  })

  describe.skip('makecert()', () => {
    it('', function (done) {
      const programMock = {
        inputDirectory: '/fakepath/to/input',
        outputDirectory: '/fakepath/to/output',
        windowsKit: '/fakepath/to/windows/kit/bin',
        packageName: 'testapp',
        devCert: 'fakepath/to/devcert.pfx'
      }

      mockery.registerMock('child_process', cpMock)

      sign.signAppx(programMock)
        .then(() => {
          const expectedScript = path.join(programMock.windowsKit, 'signtool.exe')
          const expectedPfxFile = programMock.devCert
          const expectedAppx = path.join(programMock.outputDirectory, `${programMock.packageName}.appx`)
          const expectedParams = ['sign', '-f', expectedPfxFile, '-fd', 'SHA256', '-v', expectedAppx]

          passedProcess.should.equal(expectedScript)
          passedArgs.should.deep.equal(expectedParams)
          done()
        })
    })
  })

  describe.only('isValidPublisherName()', () => {
    const windowsSdkPath = process.arch === 'x64' ?
      'C:\\Program Files (x86)\\Windows Kits\\10\\bin\\x64' :
      'C:\\Program Files\\Windows Kits\\10\\bin\\x64';
    const makecertExe = path.join(windowsSdkPath, 'makecert.exe')
    const pvkFileName = path.resolve(__dirname, 'bogus-private-key.pvk');
    if (process.platform === 'win32' && !fs.existsSync(pvkFileName))
      throw new Error(`Could not find private key file to use for makecert.exe tests: ${pvkFileName}`)

    const scenarios = [{
      publisherName: 'CN='
    }, {
      publisherName: 'CN=-'
    }, {
      publisherName: 'cn=lower, ou=case'
    }, {
      publisherName: 'CN=first.last'
    }, {
      publisherName: 'CN="Pointlessly quoted"'
    }, {
      publisherName: 'CN=no,o=spaces'
    }, {
      publisherName: 'CN=" Leading and Trailing Spaces "'
    }, {
      publisherName: 'CN=Common Name,O=Some organization'
    }, {
      publisherName: 'O="Quoted comma, Inc."'
    }, {
      publisherName: 'CN=!@#$^&*()[]{}<>|\/.~\'-=,O="Symbols are Cool, LLC"'
    }, {
      publisherName: 'OU=Sales+CN=J. Smith,O=Multi-valued'
    }, {
      publisherName: 'CN=Duplicate+CN=Attribute'
    }, {
      publisherName: 'OU=Trailing plus+',
    }, {
      publisherName: 'CN=trailing comma,',
    }, {
      publisherName: 'CN="Escaped\ and\ quoted\ spaces"'
    }, {
      publisherName: 'CN=First M Last, O="Acme, Inc."'
    }, {
      publisherName: 'CN=Marshall T. Rose, O=Dover Beach Consulting, L=Santa Clara,ST=California, C=US'
    }, {
      publisherName: 'CN=FTAM Service, CN=Bells, OU=Computer Science,\nO=University College London, C=GB'
    }, {
      publisherName: 'CN=Markus Kuhn, O=University of Erlangen, T=Mr., C=DE'
    }, {
      publisherName: 'CN=Steve Kille,\n O=ISODE Consortium,\n C=GB'
    }, {
      publisherName: 'CN=Christian Huitema; O=INRIA; C=FR'
    }, {
      publisherName: 'CN=L. Eagle, O="Sue, Grabbit and Runn", C=GB'
    }, {
      publisherName: 'O=No CN'
    }, {
      publisherName: 'DC=A,CN=B,OU=C,O=D,STREET=123 Main St.,L=Big City,ST=Nowhere,C=XX,SN=Surname,GN=Given name,E=nobody@example.com,S=E,T=F,G=G,I=1.2.3.4'
    }, {
      publisherName: 'CN="+"',
    }, {
      publisherName: 'CN=X+'
    }, {
      publisherName: 'X',
      expectInvalid: true
    }, {
      publisherName: 'CN=X,UID=userId',
      expectInvalid: true
    }, {
      publisherName: 'CN=\ Escaped leading space"',
      expectInvalid: true
    }, {
      publisherName: 'CN="Quotation \\" Mark"',
      expectInvalid: true
    }, {
      publisherName: 'CN=X,DNQ=qualifier',
	  expectInvalid: true
    }, {
      // According to RFC1779 and RFC2243 this should be legal but MakeCert.exe does not seem to accept it
      publisherName: 'CN=Sue\\, Grabbit and Runn',
      expectInvalid: true
    }]

    scenarios.forEach((scenario) => {
      const actualResult = cert.isValidPublisherName(scenario.publisherName)
	  const nameToPrint = scenario.publisherName.replace(/\n/g, '\\n')
      // Compare pre-determined checks (previously confirmed with makecert.exe)
      it(`return ${scenario.expectInvalid ? 'false' : 'true'} for ${nameToPrint}`, () => {
        actualResult.should.equal(!scenario.expectInvalid, scenario.publisherName)
      })

      // Run makecert and check whether or not it fails with this publisherName
      if (process.platform === 'win32') {
        const rnd = Date.now() + '-' + Math.floor(Math.random()*10000)
        const crtFileName = path.join(tmpDir, `makecert-${rnd}.crt`)
        const makecertArgs = ['-r', '-h', '0', '-n', scenario.publisherName, '-eku', '1.3.6.1.5.5.7.3.3', '-pe', '-sv', pvkFileName, crtFileName]

        it(`makecert.exe ${scenario.expectInvalid ? 'fails' : 'succeeds'}: ${nameToPrint}`, () => {
          return utils.executeChildProcess(makecertExe, makecertArgs)
          .then((output) => { return true })
          .catch((...args) => { return false })
          .should.eventually.equal(!scenario.expectInvalid)
        })
      }
    })
  })
})
