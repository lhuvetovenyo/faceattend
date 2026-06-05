const SERVICE_ACCOUNT_EMAIL = "face-attendance@face-attendance-496305.iam.gserviceaccount.com";
const PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDXaK3RY9amRjeH
b0Fcd5lhkfpM0Cy2tzKUG0xIdgrjmtGrIyOcSM+hSQizv0OSVKrraBm9Nwhd17kz
psACv4W0E52CV5PnsExroM2/0La0pX5ln8oOz0WbVjosUqQoRdUX6XeDSqtXqanI
iEKIbQ0ub1W1314SDuoSB169VZ/ChgEqXePZzhlFMlRk2lN/9X1v6G4cue21MM1X
Se2BgxsZBiDAw4rZ4KxVrQKVlfRgi4tHXvzJ6Z1rDpmJIRv277dQ7PLQ1FzBpOGG
V0v6S2IGgocsgI+OOSflhFSrgUOBlGZImIII05YX/QO9PP/V+FT9Sl31Ct+fxggB
ZUCcUKZFAgMBAAECggEAALyiWVB3oevgZurzQqM7Owl2lNhilwnAF0rGacb5ulOw
d57qxI0LAsgt5EqVFb2+GojP+mT4ctbuUqt+CgVvIZol6JoVhlJzv6ui5d/+lRIL
ydM9J6gMJ6iGq0AcpzW/aPpyWxAJAoMbnVuC5p6JR2PmzrTYN3wHzz+ttJHdVEop
a5TftbDc2OZqEaEifTjvgoocp4gm9Q8f8BOr80NZwklhQ3JR9M4JvnIlGzLCjt35
m+9yTmmm30vsEKIeYiX9lXlXsgN3V3vYvWHA2c4kQnMIP7RMMCrGD4tkINvGMnqx
vQnnZhVg8xoMMei5/ytXmB4suSOVlyC0yyBR1b6rIQKBgQDtWfEW9REODvqT3uK0
hT2b+a7y37T+eolppW8GksdgrdUKe3gJeJKF8kxDz6I6619EEUl/BT9NA7J0ERe9
AXewYAzVT08IYpGnCeQyM1k5CIbMFj096Ru/dM4PYO1Yk++CK/A/fg9MsfR6ENCl
H6mOqGJSkuHrDFSXOuQRCH9zoQKBgQDoVWO7Z7+bjibPmpMq7tBlJ2gsh2hySjk8
S+18ByaCyJg9lGRNCFFjBgnXrMXtFGoQdpic0WhPIWKzAQdkP9GX1ZKEv3AaUt6s
UoLIq/x1ZaQlvSizpKnjyQTAcralCeW7Zx6O83f8zEHxMz2fvv+8/pfy5IB4IXHy
/l4ilL7wJQKBgQDECDUHMQEVC2oKF1xGnIV1/ZJxJjLmu24iw3Afjbr+LpR2Q+Ow
btUVrDkxCJyE7UGRhnWdY0gU46jQFA33HO8tzSbMRuSPmFmUDKdcjuxyHoi2pueN
6qnwRxipuvRM5GI8sO2MgyE/xvqUlq68spnoKUqLyKSu7VAwV4NmTg52AQKBgDdA
54EQQW9bNTu2RT22ofUMlCfS5DIaGNaQMCCJCs2bqykp+1iem8xzCTAztLaXXkog
CldxLd9zzydHHVzoGI6FilzrsltwTeipjtTuohHBZHJdNCrVBFpZ2jlyjqFdYzdY
ZNoWaPjEEwKr7wHoyKVH3xcy5KKtQY5KlFShD2/JAoGBAJFZYWs5qiQ4DTEMlyLe
2ReWxLuhRGIASp62BbqnglUUya6MJlh8Kmb9ZZOqUEuCTgMt2zKybn99jTBFGydY
ecNK0N8A9SWEo5KY5L+PeHIlCTOiluWC/au26ZRFpajjd2phQft+HElpQNt/EdIe
oiCzh5hyyiW00mWLQqKeLezW
-----END PRIVATE KEY-----`;
function base64url(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function importPrivateKey() {
  const key = PRIVATE_KEY.replace(/\\n/g, "\n");
  const stripped = key.replace(/-----BEGIN PRIVATE KEY-----/g, "").replace(/-----END PRIVATE KEY-----/g, "").replace(/\s/g, "");
  const binaryStr = atob(stripped);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
  return crypto.subtle.importKey(
    "pkcs8",
    bytes.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
}
async function createSignedJwt() {
  const privateKey = await importPrivateKey();
  const now = Math.floor(Date.now() / 1e3);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: SERVICE_ACCOUNT_EMAIL,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now
  };
  const enc = new TextEncoder();
  const hdr64 = base64url(
    enc.encode(JSON.stringify(header)).buffer
  );
  const pay64 = base64url(
    enc.encode(JSON.stringify(payload)).buffer
  );
  const sigInput = `${hdr64}.${pay64}`;
  const signature = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    privateKey,
    enc.encode(sigInput).buffer
  );
  return `${sigInput}.${base64url(signature)}`;
}
export {
  createSignedJwt
};
