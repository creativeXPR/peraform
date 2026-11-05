# Credits pages in HyperCBT: handoff from PeraForm

The owner chose this approach (2026-11-05): every Quality Tools app has the same credits pages, all using one wallet and one payment system. There is no shared credits page on the Quality Tools site for now.

## To do in HyperCBT, after the current build list
1. **Copy these files from peraform:**
   - `src/features/credits/CreditsPage.jsx`
   - `src/features/credits/CreditsReturn.jsx`
   - `src/features/credits/InvoicePage.jsx`
   - their CSS
   - any wallet pieces HyperCBT doesn't have yet
2. **Add the routes:** `/credits`, `/credits/return` and `/credits/invoice/:reference`.
3. **Change the Top up links** inside Dawn's windows and on the balance chip so they open HyperCBT's own `/credits`. They currently open peraform-qt in a new tab.
4. **Leave admin out.** `billingAdmin` and the admin credits page stay PeraForm-only.

## Server side (peraform dd0c9d6)
`createTopup` now sends Paystack back to the app that started the payment. It reads the request's Origin header and only accepts these two addresses:
- `https://peraform-qt.web.app`
- `https://hypercbt-qt.web.app`

Any other origin falls back to PeraForm, so the payment can't be redirected to an outside site.

This change is committed but not deployed. To deploy it, run:
`firebase deploy --only functions:peraform:createTopup --project quality-toolsx`

Until then, a top-up started in HyperCBT finishes on PeraForm's `/credits/return`. The payment is still credited, because both apps share the same wallet.

## Context
- **Later:** the owner wants each app on its own subdomain, for example forms.qualitytools.com. Sign-in won't carry across subdomains automatically, so that move will need a plan.
- **Next phase:** once both apps are on par, the focus moves to optimising the existing features.
