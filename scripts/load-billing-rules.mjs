// The Firestore emulator only reads one rules file from firebase.json
// (PeraForm's). This loads the suite-wide databases' own rules into it
// (billing, suite), so local testing matches production. Run inside
// `firebase emulators:exec`.
import { readFileSync } from 'node:fs'

const host = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080'
for (const database of ['billing', 'suite']) {
  const name = `firestore.${database}.rules`
  const content = readFileSync(new URL(`../${name}`, import.meta.url), 'utf8')
  const res = await fetch(`http://${host}/emulator/v1/projects/quality-toolsx/databases/${database}:securityRules`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rules: { files: [{ name, content }] } }),
  })
  if (!res.ok) {
    console.error(`Couldn’t load the ${database} rules:`, res.status, await res.text())
    process.exit(1)
  }
}
console.log('Billing and suite rules loaded into the Firestore emulator.')
