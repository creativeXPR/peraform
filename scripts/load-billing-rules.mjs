// The Firestore emulator only reads one rules file from firebase.json
// (PeraForm's). This loads the billing database's own rules into it, so
// local testing matches production. Run inside `firebase emulators:exec`.
import { readFileSync } from 'node:fs'

const host = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080'
const content = readFileSync(new URL('../firestore.billing.rules', import.meta.url), 'utf8')
const res = await fetch(`http://${host}/emulator/v1/projects/quality-toolsx/databases/billing:securityRules`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ rules: { files: [{ name: 'firestore.billing.rules', content }] } }),
})
if (!res.ok) {
  console.error('Couldn’t load the billing rules:', res.status, await res.text())
  process.exit(1)
}
console.log('Billing rules loaded into the Firestore emulator.')
