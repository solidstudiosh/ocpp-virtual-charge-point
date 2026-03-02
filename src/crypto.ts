import * as forge from 'node-forge';

export interface CSRResult {
    privateKey: string;
    csr: string;
}

export function generateCSR(commonName: string, orgName: string): Promise<CSRResult> {
    return new Promise((resolve, reject) => {
        // Generate a keypair
        forge.pki.rsa.generateKeyPair({ bits: 2048, workers: -1 }, (err, keypair) => {
            if (err) return reject(err);

            // Create a Certificate Signing Request (CSR)
            const csr = forge.pki.createCertificationRequest();
            csr.publicKey = keypair.publicKey;

            csr.setSubject([
                { name: 'commonName', value: commonName },
                { name: 'organizationName', value: orgName },
                { shortName: 'C', value: 'US' },
                { shortName: 'ST', value: 'CA' }
            ]);

            // Sign the CSR
            csr.sign(keypair.privateKey, forge.md.sha256.create());

            // Convert to PEM
            const pemCsr = forge.pki.certificationRequestToPem(csr);
            const pemPrivateKey = forge.pki.privateKeyToPem(keypair.privateKey);

            resolve({
                csr: pemCsr,
                privateKey: pemPrivateKey
            });
        });
    });
}
