# FoodCycle NC

A responsive, local-first food expiry tracker with meal suggestions, food-sharing and pantry-coordination flows, and partner impact exports. Supabase-backed shared accounts are optional and are not connected until you configure your own project. Sample names, listings, locations, and impact totals are illustrative only.

## Run the demo

No package manager or build step is required. Open `index.html` in a modern browser. The local demo works without an account or API key; Supabase features require a configured project and an internet connection.

Without Supabase configuration, food entries, share-board posts, pickup claims, pantry-request drafts, and volunteer-hour logs stay in that browser’s local storage. Local demo roles are a workflow preview only: they do not authenticate people or protect local data from another person using the same device. Use **Reset sample data** at the bottom of the page to restore the illustrative starting set.

## Optional shared Supabase setup

1. Create a Supabase project and run `supabase/migrations/202610220001_shared_coordination.sql` in its SQL editor.
2. Copy the project URL and its **anon/public** key into `supabase-config.js` (`url` and `anonKey`). Never put a service-role key in this public website.
3. Enable the desired email authentication settings in Supabase Auth. Configure allowed redirect URLs for the deployed site if email confirmation is enabled.
4. Serve the site from HTTPS (or localhost) and sign in. The browser loads the Supabase JavaScript client from jsDelivr only when both configuration values are set.

The migration enables row-level security. Household inventory and activity are restricted to their owner; shared listings and pantry needs are available to signed-in accounts. Exact pickup addresses live only in `listing_private_details` and are readable by the donor or a confirmed claimant. Handoff codes are stored as salted hashes in a separate table; the donor sees the generated code after confirmation and shares it with the claimant, who enters it to complete pickup. The code is not recoverable after leaving that page, but the donor can issue a replacement (which invalidates the prior code). Five incorrect code attempts lock that confirmation until the donor replaces the code. Realtime subscriptions include shared listings, pantry needs, transfer requests, handoff status, and the signed-in user’s food list. The public anon key is expected to be visible in browser code; access depends on the database policies, not on hiding that key.

Until you configure a project and apply the migration, there are no shared accounts or realtime service. The Supabase backend is not provisioned by this repository.

## Try the main flows

1. In **Expiry tracker**, track best-by dates, locations, and amounts.
2. In **Use it next**, get meal ideas based on food due today through three days from now. Edit the on-hand ingredients and choose multiple dietary filters. Suggestions are not allergy-safe guarantees.
3. In **Share board**, set a pickup date/window and public area, enter the exact address separately, and add handling, allergen, and dietary notes. In the local demo, switch between volunteer and grower roles: request a pickup, confirm it as the donor, share the generated code, and enter it as the volunteer. The address stays hidden from other roles until confirmation in the interface, but local browser data is not a security boundary. With Supabase configured, row-level security protects the address server-side.
4. In **Pantry network**, use sample needs in local mode. Signed-in users can publish real shared needs and request transfers when Supabase is configured; client notices remain unsent drafts.
5. In **Impact & hours**, record volunteer time, filter activity by date, and export the selected range as CSV. The organization name is an export label; reports are scoped to activity visible to the current account or browser, not aggregated across an organization's members. Weight conversions are estimates and reports are not independently verified.

## Notes

- A best-by date is not a food-safety determination. Follow authoritative storage and handling guidance; ask donors about ingredients and cross-contact. Allergy and dietary notes are user-provided, not verified.
- Sample pickup addresses are fictional. Do not enter a real address in the public pickup-area field.
- Client notifications, pantry transfer fulfillment, routes, payments, certificates, and independent impact verification are not provided.
