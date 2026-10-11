/** Preset inputs for the Readiness Scanner demo and tests. The certificate is a real, throwaway self-signed RSA-2048 cert. */

export interface ScanSample {
  id: string;
  label: string;
  filename: string;
  text: string;
}

export const SCAN_SAMPLES: ScanSample[] = [
  {
    id: "java-tls",
    label: "Java TLS config",
    filename: "application.properties",
    text: `# application.properties: UPI switch connector (Spring Boot / Tomcat)
server.port=8443
server.ssl.enabled=true
server.ssl.protocol=TLS
server.ssl.enabled-protocols=TLSv1.2,TLSv1.1
server.ssl.key-store=classpath:keystore/upi-gw.jks
server.ssl.key-store-type=JKS
server.ssl.key-alias=upi-gw-rsa
server.ssl.ciphers=TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384,TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256,TLS_RSA_WITH_AES_128_CBC_SHA,TLS_RSA_WITH_3DES_EDE_CBC_SHA
# JCE settings used by the message-signing filter
npci.signing.algorithm=SHA256withRSA
npci.keygen=KeyPairGenerator.getInstance("RSA").initialize(2048)
npci.payload.cipher=DESede/CBC/PKCS5Padding
npci.digest=SHA-1`,
  },
  {
    id: "openssl-cert",
    label: "OpenSSL RSA cert",
    filename: "upi-gw.crt",
    text: `$ openssl x509 -in upi-gw.crt -noout -text | head -n 14
Certificate:
    Data:
        Version: 3 (0x2)
        Serial Number: 7a:54:89:c7:76:9f:6a:b7:11:17:4e:fe:a2:4f:71:41:09:6f:8b:74
        Signature Algorithm: sha256WithRSAEncryption
        Issuer: C = IN, O = Bharat Bank (demo), CN = upi-gw.bharatbank.example
        Subject: C = IN, O = Bharat Bank (demo), CN = upi-gw.bharatbank.example
        Subject Public Key Info:
            Public Key Algorithm: rsaEncryption
                Public-Key: (2048 bit)

$ cat upi-gw.crt
-----BEGIN CERTIFICATE-----
MIIDfTCCAmWgAwIBAgIUelSJx3afarcRF07+ok9xQQlvi3QwDQYJKoZIhvcNAQEL
BQAwTjELMAkGA1UEBhMCSU4xGzAZBgNVBAoMEkJoYXJhdCBCYW5rIChkZW1vKTEi
MCAGA1UEAwwZdXBpLWd3LmJoYXJhdGJhbmsuZXhhbXBsZTAeFw0yNjEwMTEwNzU3
NDJaFw0yNzEwMTEwNzU3NDJaME4xCzAJBgNVBAYTAklOMRswGQYDVQQKDBJCaGFy
YXQgQmFuayAoZGVtbykxIjAgBgNVBAMMGXVwaS1ndy5iaGFyYXRiYW5rLmV4YW1w
bGUwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQCpuKcj/uk5Fm3BtgHf
y/m9UQ3heyMpLvvG4X8sKuqpa2Gu1xjOIP2+gyZcxbeAKFWqVw7YWjeqv/IK4rFV
6jWkI743tHe4bHJ/AAX/8o4JymkN1tFc/MlsPWDRaodDbyM/7jacoI7xs/1SlL+J
q47lB4gqQ+ChacIlZ/HMzFHV8KS11oUfucaxfpwnI8YGvLh9EcjkPlhw5Bb4wRTl
H8iz/2j81Jyh+yze6XGCmQ4qKQ5BMCW0UJblhxk0y0HOStJM26vuDS+d41QacMTg
kbh7IoRV/3d8wdKGI3KRg9hlYsxKmjYZ6jNc5Y7xxjtoXr+UXp01cvVWO65q6iry
PWwZAgMBAAGjUzBRMB0GA1UdDgQWBBTKul2eqN+odttV2cpTQE0vcIiKwzAfBgNV
HSMEGDAWgBTKul2eqN+odttV2cpTQE0vcIiKwzAPBgNVHRMBAf8EBTADAQH/MA0G
CSqGSIb3DQEBCwUAA4IBAQBF0WZWqfJG/UrK5kg5J1kPInvbrfWVIrfs3ecGxbhb
ByVP1nhvmPoyEg5j30xbdTa8q475qQecWH3OEcbBQXJ13YKMm7Wf0dKagEKqL4lB
ZdzCDa3h4Uq7dHwsaYOMpKgZPMyvmIWwRMBPiOI1K7w6J3IPEl8djY3Rj7xVOxPj
qzvnvUVE2ums07rIDTXEDMGBXEE/cnc/Y/wsiKBklWYOZKlBZYkMuVC8htCFlyYk
vftSgvj9QsNVVowVzV/1cV2zQov9zyPqCrngHedUuyUzNXAJIqC2fZiR48dd7Qj3
BArzeP3Hh0e1d3G/rtHqqMmbAIwoHOoEU6SP00HRGLG0
-----END CERTIFICATE-----`,
  },
  {
    id: "node-sign",
    label: "Node createSign",
    filename: "psp-signer.js",
    text: `// psp-signer.js: signs collect requests before they're sent to the switch
const crypto = require("node:crypto");

const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });

function signRequest(body) {
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(JSON.stringify(body));
  return signer.sign(privateKey, "base64");
}

function deriveSessionKey(peerPublicKey) {
  const ecdh = crypto.createECDH("prime256v1");
  ecdh.generateKeys();
  return crypto.createHash("sha1").update(ecdh.computeSecret(peerPublicKey)).digest();
}

module.exports = { signRequest, deriveSessionKey, publicKey };`,
  },
];
