// RSA + ECDH crypto helper functions
export async function generateRSAKeyPair() {
    const keyPair = await crypto.subtle.generateKey(
        { name: "RSA-OAEP", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
        true,
        ["encrypt", "decrypt"]
    );
    const publicKeySpki = await crypto.subtle.exportKey("spki", keyPair.publicKey);
    const privateKeyPkcs8 = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
    return {
        publicKeySpkiBase64: arrayBufferToBase64(publicKeySpki),
        privateKeyPkcs8Base64: arrayBufferToBase64(privateKeyPkcs8),
    };
}

export async function importRSAKeyPair(privateBase64) {
    const priv = await crypto.subtle.importKey(
        "pkcs8",
        base64ToArrayBuffer(privateBase64),
        { name: "RSA-OAEP", hash: "SHA-256" },
        true,
        ["decrypt"]
    );
    return { privateKey: priv };
}

export async function encryptRSA(plainText, publicKeyBase64) {
    const publicKey = await crypto.subtle.importKey(
        "spki",
        base64ToArrayBuffer(publicKeyBase64),
        { name: "RSA-OAEP", hash: "SHA-256" },
        true,
        ["encrypt"]
    );
    const encoded = new TextEncoder().encode(plainText);
    const ciphertext = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, publicKey, encoded);
    return arrayBufferToBase64(ciphertext);
}

export async function decryptRSA(cipherBase64, privateKey) {
    const ciphertext = base64ToArrayBuffer(cipherBase64);
    const plaintext = await crypto.subtle.decrypt({ name: "RSA-OAEP" }, privateKey, ciphertext);
    return new TextDecoder().decode(plaintext);
}

// --- ECDH (DH variant) ---
export async function generateEcdhKeyPair() {
    const keyPair = await crypto.subtle.generateKey(
        { name: "ECDH", namedCurve: "P-256" },
        true,
        ["deriveKey"]
    );
    const pubRaw = await crypto.subtle.exportKey("raw", keyPair.publicKey);
    const privPkcs8 = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
    return {
        publicKeyRawBase64: arrayBufferToBase64(pubRaw),
        privateKeyPkcs8Base64: arrayBufferToBase64(privPkcs8),
    };
}

export async function importEcdhKeyPair(privateBase64) {
    const priv = await crypto.subtle.importKey(
        "pkcs8",
        base64ToArrayBuffer(privateBase64),
        { name: "ECDH", namedCurve: "P-256" },
        true,
        ["deriveKey"]
    );
    return { privateKey: priv };
}

export async function encryptWithDH(plainText, senderPrivKey, recipientPubBase64) {
    const recipientPub = await crypto.subtle.importKey(
        "raw",
        base64ToArrayBuffer(recipientPubBase64),
        { name: "ECDH", namedCurve: "P-256" },
        true,
        []
    );

    // derive symmetric key
    const symKey = await crypto.subtle.deriveKey(
        { name: "ECDH", public: recipientPub },
        senderPrivKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt"]
    );

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plainText);
    const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, symKey, encoded);

    // export sender public
    const senderPubRaw = await crypto.subtle.exportKey("raw", await crypto.subtle.deriveBits(
        { name: "ECDH", public: recipientPub },
        senderPrivKey,
        256
    ));

    return {
        ciphertextBase64: arrayBufferToBase64(ciphertext),
        ivBase64: arrayBufferToBase64(iv),
        senderEcdhPublicRawBase64: arrayBufferToBase64(senderPubRaw),
    };
}

export async function decryptWithDH(cipherBase64, receiverPrivKey, senderPubBase64, ivBase64) {
    const senderPub = await crypto.subtle.importKey(
        "raw",
        base64ToArrayBuffer(senderPubBase64),
        { name: "ECDH", namedCurve: "P-256" },
        true,
        []
    );

    const symKey = await crypto.subtle.deriveKey(
        { name: "ECDH", public: senderPub },
        receiverPrivKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["decrypt"]
    );

    const ciphertext = base64ToArrayBuffer(cipherBase64);
    const iv = base64ToArrayBuffer(ivBase64);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, symKey, ciphertext);
    return new TextDecoder().decode(plain);
}

// --- helpers ---
function arrayBufferToBase64(buf) {
    const bin = String.fromCharCode(...new Uint8Array(buf));
    return btoa(bin);
}
function base64ToArrayBuffer(base64) {
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
}
