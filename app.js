"use strict";

(() => {
  const STORAGE_KEY = "foodcycle-nc-demo-v1";
  const app = document.getElementById("app");
  const toast = document.getElementById("toast");
  const todayDate = document.getElementById("today-date");
  const crumbLabel = document.getElementById("crumb-label");
  const accountArea = document.getElementById("account-area");
  const modeLabel = document.getElementById("mode-label");
  const modeDescription = document.getElementById("mode-description");
  const storageDescription = document.getElementById("storage-description");
  const activeView = { value: "inventory" };
  const filters = { urgency: "all", category: "All", query: "" };
  const mealFilters = { ingredients: "", onlyOnHand: true, diets: [] };
  const reportFilters = { from: "", to: "", organization: "" };
  let toastTimer;
  let storageAvailable = true;
  let supabase = null;
  let currentUser = null;
  let sharedReady = false;
  let backendError = "";
  let demoActor = "demo-volunteer";
  let listingSubscription = null;
  let inventorySubscription = null;
  let pantrySubscription = null;
  const mealIdeas = [
    { name: "Spinach & lentil warm bowl", uses: ["spinach", "lentil"], requires: ["spinach", "lentil"], ingredients: ["spinach", "lentils", "lemon", "olive oil"], diets: ["Vegan", "Vegetarian", "Dairy-free", "Gluten-free"], steps: "Warm the lentils, fold through spinach, then finish with lemon and oil.", allergenNote: "Check packaged lentils and seasonings for cross-contact." },
    { name: "Tomato, basil & rice skillet", uses: ["tomato"], requires: ["tomato", "rice"], ingredients: ["tomatoes", "basil", "rice", "olive oil"], diets: ["Vegan", "Vegetarian", "Dairy-free", "Gluten-free"], steps: "Warm chopped tomatoes with cooked rice; add basil just before serving.", allergenNote: "Check packaged rice and seasonings for cross-contact." },
    { name: "Blueberry oat breakfast bowl", uses: ["blueberr"], requires: ["blueberr", "oats"], ingredients: ["blueberries", "oats", "oat milk"], diets: ["Vegan", "Vegetarian", "Dairy-free"], steps: "Stir oats with oat milk and top with rinsed blueberries.", allergenNote: "Oats may be cross-contacted with wheat; check the package if gluten matters." },
    { name: "Greens & egg rice bowl", uses: ["spinach", "greens"], requires: ["spinach", "eggs", "rice"], ingredients: ["spinach", "eggs", "rice"], diets: ["Vegetarian", "Gluten-free"], steps: "Wilt the greens and serve over rice with a fully cooked egg.", allergenNote: "Contains egg. Check packaged ingredients and shared-kitchen cross-contact." },
    { name: "Roasted squash & lentil tray", uses: ["squash", "lentil"], requires: ["squash", "lentil"], ingredients: ["squash", "lentils", "olive oil"], diets: ["Vegan", "Vegetarian", "Dairy-free", "Gluten-free"], steps: "Roast squash until tender and serve with warmed lentils.", allergenNote: "Check packaged lentils and seasonings for cross-contact." },
    { name: "Oat-milk blueberry smoothie", uses: ["blueberr", "oat milk"], requires: ["blueberr", "oat milk"], ingredients: ["blueberries", "oat milk", "banana"], diets: ["Vegan", "Vegetarian", "Dairy-free"], steps: "Blend oat milk and blueberries with banana if available.", allergenNote: "Check oat-milk and any add-ins for declared allergens and cross-contact." }
  ];
  const dietOptions = ["Vegan", "Vegetarian", "Dairy-free", "Gluten-free"];

  const toISODate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const offsetDate = (offset) => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + offset);
    return toISODate(date);
  };

  const nextSaturday = () => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    const days = (6 - date.getDay() + 7) % 7 || 7;
    date.setDate(date.getDate() + days);
    return toISODate(date);
  };

  const createSampleState = () => ({
    version: 1,
    items: [
      { id: "f1", name: "Baby spinach", category: "Produce", amount: "1", unit: "bag", location: "Fridge · crisper", bestBy: offsetDate(0), note: "Rinse before storing." },
      { id: "f2", name: "Blueberries", category: "Produce", amount: "1", unit: "pint", location: "Fridge · top shelf", bestBy: offsetDate(1), note: "" },
      { id: "f3", name: "Oat milk", category: "Dairy", amount: "0.5", unit: "carton", location: "Fridge · door", bestBy: offsetDate(2), note: "Opened yesterday." },
      { id: "f4", name: "Roasted lentils", category: "Prepared", amount: "2", unit: "servings", location: "Fridge · middle", bestBy: offsetDate(3), note: "Good over greens." },
      { id: "f5", name: "Cherry tomatoes", category: "Produce", amount: "1", unit: "pint", location: "Counter · bowl", bestBy: offsetDate(4), note: "" },
      { id: "f6", name: "Chicken thighs", category: "Protein", amount: "1.4", unit: "lb", location: "Freezer · lower", bestBy: offsetDate(12), note: "Frozen." },
      { id: "f7", name: "Brown rice", category: "Pantry", amount: "2", unit: "lb", location: "Pantry · dry goods", bestBy: offsetDate(180), note: "" }
    ],
    history: [],
    listings: [
      { id: "s1", name: "Backyard tomatoes", quantity: "20", unit: "lb", location: "Durham, NC · sample area", destination: "Community fridge · sample", date: nextSaturday(), slot: "9:00–11:00 am", note: "Mixed ripe and almost-ripe fruit. Bring a tote.", claimed: false, pickedUp: false, status: "open", ownerId: "demo-grower", exactAddress: "100 Example Garden Lane, Durham, NC", sample: true },
      { id: "s2", name: "Extra basil bunches", quantity: "6", unit: "bunches", location: "Raleigh, NC · sample area", destination: "School meal program · sample", date: nextSaturday(), slot: "10:00 am–12:00 pm", note: "Cut this morning; water jar provided.", claimed: true, pickedUp: false, status: "confirmed", ownerId: "demo-grower", claimedBy: "demo-volunteer", exactAddress: "200 Example Garden Lane, Raleigh, NC", handoffCode: "381204", sample: true },
      { id: "s3", name: "Summer squash", quantity: "12", unit: "lb", location: "Orange County, NC · sample area", destination: "Food pantry · sample", date: offsetDate(2), slot: "2:00–4:00 pm", note: "Small and medium squash, mixed.", claimed: false, pickedUp: false, status: "open", ownerId: "demo-grower", exactAddress: "300 Example Farm Road, Orange County, NC", sample: true }
    ],
    needs: [
      { id: "n1", pantry: "Demo pantry · East", location: "Sample location · Wake County", item: "Fresh greens", quantity: "8 bunches", urgency: "Needed soon", status: "Available", sample: true },
      { id: "n2", pantry: "Demo pantry · South", location: "Sample location · Durham County", item: "Eggs", quantity: "4 dozen", urgency: "Needed this week", status: "Available", sample: true },
      { id: "n3", pantry: "Demo pantry · Central", location: "Sample location · Orange County", item: "Shelf-stable milk", quantity: "12 cartons", urgency: "Ongoing need", status: "Available", sample: true }
    ],
    requests: {},
    notices: {},
    events: [],
    impact: { pounds: 0, pickups: 0, hours: 0, requests: 0 }
  });

  const loadState = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return createSampleState();
      const parsed = JSON.parse(saved);
      if (parsed.version !== 1 || !Array.isArray(parsed.items) || !Array.isArray(parsed.history) || !Array.isArray(parsed.listings) || !Array.isArray(parsed.needs) || !Array.isArray(parsed.events) || !parsed.requests || typeof parsed.requests !== "object" || Array.isArray(parsed.requests) || !parsed.notices || typeof parsed.notices !== "object" || Array.isArray(parsed.notices) || !parsed.impact || !["pounds", "pickups", "hours", "requests"].every((key) => Number.isFinite(parsed.impact[key]))) {
        throw new Error("Saved demo data is incomplete.");
      }
      return parsed;
    } catch (error) {
      storageAvailable = false;
      window.setTimeout(() => showToast(`Saved data could not be read: ${error.message}. Refresh the sample data to continue.`, true), 0);
      return createSampleState();
    }
  };

  let state = loadState();
  state.items = state.items.map((item) => (/^f[1-7]$/.test(item.id) ? { ...item, sample: true } : item));
  state.listings = state.listings.map((listing) => {
    const sampleDefaults = {
      s1: { ownerId: "demo-grower", location: "Durham, NC · sample area", exactAddress: "100 Example Garden Lane, Durham, NC", status: "open", claimedBy: "" },
      s2: { ownerId: "demo-grower", location: "Raleigh, NC · sample area", exactAddress: "200 Example Garden Lane, Raleigh, NC", status: "confirmed", claimedBy: "demo-volunteer", handoffCode: "38120476" },
      s3: { ownerId: "demo-grower", location: "Orange County, NC · sample area", exactAddress: "300 Example Farm Road, Orange County, NC", status: "open", claimedBy: "" }
    }[listing.id];
    if (sampleDefaults) return { ...listing, ...sampleDefaults, sample: true };
    return {
      ...listing,
      status: listing.status || (listing.pickedUp ? "completed" : listing.claimed ? "confirmed" : "open"),
      ownerId: listing.ownerId || "demo-grower",
      claimedBy: listing.claimedBy || ""
    };
  });
  state.needs = state.needs.map((need) => need.id.startsWith("n") ? { ...need, sample: true } : need);

  const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);

  const renderAccount = () => {
    const badge = document.getElementById("data-mode-pill");
    if (!window.FOODCYCLE_SUPABASE_CONFIG?.url || !window.FOODCYCLE_SUPABASE_CONFIG?.anonKey) {
      if (accountArea) accountArea.innerHTML = `<span class="account-state">Local demo · not shared</span>`;
      if (modeLabel) modeLabel.textContent = "Local demo";
      if (modeDescription) modeDescription.innerHTML = "Saved in this browser.<br>Not shared with others.";
      if (storageDescription) storageDescription.innerHTML = "Saved in this browser<br>on this device.";
      if (badge) badge.textContent = "LOCAL DEMO";
      return;
    }
    if (!supabase) {
      if (accountArea) accountArea.innerHTML = `<span class="account-state">${backendError ? "Shared service unavailable · local demo" : "Connecting to shared service…"}</span>`;
      if (storageDescription) storageDescription.innerHTML = "Your sample entries stay<br>in this browser.";
      if (badge) badge.textContent = backendError ? "LOCAL DEMO" : "CONNECTING";
      return;
    }
    if (currentUser && !sharedReady) {
      if (accountArea) accountArea.innerHTML = `<span class="account-state">${backendError ? "Signed in · shared data unavailable" : "Loading shared account…"}</span><button class="text-button" type="button" data-action="sign-out">Sign out</button>`;
      if (modeLabel) modeLabel.textContent = "Shared data unavailable";
      if (modeDescription) modeDescription.innerHTML = "Reconnect or sign out<br>to return to local demo.";
      if (storageDescription) storageDescription.innerHTML = "Shared data did not load.<br>Local sample entries only.";
      if (badge) badge.textContent = "LOCAL DEMO";
      return;
    }
    if (currentUser) {
      if (accountArea) accountArea.innerHTML = `<span class="account-state" title="${escapeHTML(currentUser.email || "")}">Shared account</span><button class="text-button" type="button" data-action="sign-out">Sign out</button>`;
      if (modeLabel) modeLabel.textContent = "Shared + local";
      if (modeDescription) modeDescription.innerHTML = "Signed-in records sync;<br>sample/demo entries stay local.";
      if (storageDescription) storageDescription.innerHTML = "Shared account records plus<br>local-only demo entries.";
      if (badge) badge.textContent = "SHARED + LOCAL";
      return;
    }
    if (accountArea) accountArea.innerHTML = `
      <details class="account-menu">
        <summary>Sign in</summary>
        <form id="auth-form" class="auth-form">
          <p>Use an account to coordinate with other households. Your browser’s demo entries are not uploaded.</p>
          <label>Email<input type="email" name="email" required autocomplete="email"></label>
          <label>Password<input type="password" name="password" required minlength="8" autocomplete="current-password"></label>
          <div class="auth-actions"><button class="button button-primary button-small" type="submit" data-auth-action="signin">Sign in</button><button class="button button-outline button-small" type="submit" data-auth-action="signup">Create account</button></div>
        </form>
      </details>`;
    if (modeLabel) modeLabel.textContent = "Shared service ready";
    if (modeDescription) modeDescription.innerHTML = "Sign in to coordinate.<br>Demo entries stay local.";
    if (storageDescription) storageDescription.innerHTML = "Sample data stays in this<br>browser until you sign in.";
    if (badge) badge.textContent = "LOCAL DEMO";
  };

  const initializeSharedBackend = async () => {
    const config = window.FOODCYCLE_SUPABASE_CONFIG || {};
    if (!config.url || !config.anonKey) {
      renderAccount();
      return;
    }
    try {
      const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
      supabase = createClient(config.url, config.anonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      currentUser = data.session?.user || null;
      if (currentUser) clearRemoteState();
      renderAccount();
      if (currentUser) {
        await loadRemoteState();
        subscribeToSharedChanges();
      }
      supabase.auth.onAuthStateChange(async (_event, session) => {
        const nextUser = session?.user || null;
        if (nextUser?.id === currentUser?.id) return;
        currentUser = nextUser;
        sharedReady = false;
        renderAccount();
        if (currentUser) {
          clearRemoteState();
          try {
            await loadRemoteState();
            subscribeToSharedChanges();
            showToast("Signed in to shared FoodCycle data.");
          } catch (error) {
            backendError = error.message;
            renderAccount();
            render();
            showToast(`Could not load shared data: ${error.message}`, true);
          }
        } else {
          clearRemoteState();
          if (listingSubscription) supabase.removeChannel(listingSubscription);
          if (inventorySubscription) supabase.removeChannel(inventorySubscription);
          if (pantrySubscription) supabase.removeChannel(pantrySubscription);
          listingSubscription = null;
          inventorySubscription = null;
          pantrySubscription = null;
          render();
        }
      });
    } catch (error) {
      backendError = error.message;
      renderAccount();
      showToast(`Shared service could not start: ${error.message}. Check the Supabase URL, anon key, and network, or continue in local demo mode.`, true);
    }
  };

  const showToast = (message, isError = false) => {
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.toggle("is-error", isError);
    toast.classList.add("is-visible");
    toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 4200);
  };

  const persist = (message) => {
    if (!storageAvailable) {
      if (sharedReady) {
        syncRemoteState().then(() => {
          if (message) showToast(`${message} Shared account saved; this browser could not keep a local copy.`);
        }).catch((error) => showToast(`Shared account save failed: ${error.message}`, true));
        return true;
      }
      showToast("This browser cannot save demo changes. They will be lost when you leave.", true);
      return false;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      if (message) showToast(message);
      if (sharedReady) {
        syncRemoteState().catch((error) => showToast(`Saved on this device, but shared sync failed: ${error.message}`, true));
      }
      return true;
    } catch (error) {
      storageAvailable = false;
      if (sharedReady) {
        syncRemoteState().then(() => showToast(`Shared account saved. Local browser cache failed: ${error.message}`, true))
          .catch((syncError) => showToast(`Local cache failed: ${error.message}. Shared save also failed: ${syncError.message}`, true));
        return true;
      }
      showToast(`Could not save changes in this browser: ${error.message}. The current view is still available.`, true);
      return false;
    }
  };

  const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  const clearRemoteState = () => {
    state.items = state.items.filter((item) => !isUuid(item.id));
    state.history = state.history.filter((item) => !isUuid(item.id));
    state.listings = state.listings.filter((listing) => !isUuid(listing.id));
    state.needs = state.needs.filter((need) => !isUuid(need.id));
    state.events = state.events.filter((item) => !isUuid(item.id));
    state.requests = Object.fromEntries(Object.entries(state.requests).filter(([id]) => !isUuid(id)));
    state.impact = state.events.reduce((totals, item) => ({
      pounds: totals.pounds + (Number(item.pounds) || 0),
      pickups: totals.pickups + (Number(item.pickups) || 0),
      hours: totals.hours + (Number(item.hours) || 0),
      requests: totals.requests + (Number(item.requests) || 0)
    }), { pounds: 0, pickups: 0, hours: 0, requests: 0 });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      showToast(`Could not clear cached shared data from this browser: ${error.message}`, true);
    }
  };
  const mapFoodRow = (row) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    amount: row.amount,
    unit: row.unit,
    location: row.location,
    bestBy: row.best_by,
    note: row.note || ""
  });
  const mapListingRow = (row, privateDetail = {}) => ({
    id: row.id,
    name: row.name,
    quantity: row.quantity,
    unit: row.unit,
    location: row.pickup_area,
    destination: row.destination,
    date: row.pickup_date,
    slot: row.pickup_window,
    note: row.handling_notes || "",
    allergens: row.allergens || "",
    dietaryNotes: row.dietary_notes || "",
    status: row.status,
    ownerId: row.owner_id,
    claimedBy: row.claimed_by,
    claimed: ["requested", "confirmed", "completed"].includes(row.status),
    pickedUp: row.status === "completed",
    exactAddress: privateDetail.exact_address || "",
    handoffCode: privateDetail.handoffCode || "",
    handoffLocked: Boolean(privateDetail.lockedAt),
    sample: false
  });

  const syncRemoteState = async () => {
    if (!sharedReady || !currentUser) return;
    const foodRows = [
      ...state.items.filter((item) => isUuid(item.id)).map((item) => ({
        id: item.id, owner_id: currentUser.id, name: item.name, category: item.category,
        amount: item.amount, unit: item.unit, location: item.location, best_by: item.bestBy,
        note: item.note || "", status: "active", disposition: null
      })),
      ...state.history.filter((item) => isUuid(item.id)).map((item) => ({
        id: item.id, owner_id: currentUser.id, name: item.name, category: item.category,
        amount: item.amount, unit: item.unit, location: item.location, best_by: item.bestBy,
        note: item.note || "", status: "archived", disposition: item.disposition || "used"
      }))
    ];
    const eventRows = state.events.filter((item) => isUuid(item.id)).map((item) => ({
      id: item.id, owner_id: currentUser.id, occurred_on: item.date || toISODate(new Date()),
      label: item.label, detail: item.detail, pounds: item.pounds || 0,
      pickups: item.pickups || 0, hours: item.hours || 0, requests: item.requests || 0
    }));
    const writes = [];
    if (foodRows.length) writes.push(supabase.from("food_items").upsert(foodRows, { onConflict: "id" }));
    if (eventRows.length) writes.push(supabase.from("impact_events").upsert(eventRows, { onConflict: "id" }));
    const results = await Promise.all(writes);
    const failed = results.find((result) => result.error);
    if (failed) throw failed.error;
  };

  const loadRemoteState = async () => {
    if (!currentUser) return;
    sharedReady = false;
    const [foodsResult, listingsResult, eventsResult, needsResult, transfersResult] = await Promise.all([
      supabase.from("food_items").select("id,name,category,amount,unit,location,best_by,note,status,disposition").eq("owner_id", currentUser.id),
      supabase.from("share_listings").select("id,owner_id,name,quantity,unit,pickup_area,destination,pickup_date,pickup_window,handling_notes,allergens,dietary_notes,status,claimed_by"),
      supabase.from("impact_events").select("id,occurred_on,label,detail,pounds,pickups,hours,requests").eq("owner_id", currentUser.id),
      supabase.from("pantry_needs").select("id,created_by,pantry_name,area_label,item,quantity,urgency,status"),
      supabase.from("transfer_requests").select("need_id,requester_id,status")
    ]);
    const queryError = [foodsResult, listingsResult, eventsResult, needsResult, transfersResult].find((result) => result.error);
    if (queryError) throw queryError.error;

    const remoteListings = listingsResult.data || [];
    const listingIds = remoteListings.map((listing) => listing.id);
    let privateDetails = [];
    let handoffSecrets = [];
    if (listingIds.length) {
      const detailsResult = await supabase.from("listing_private_details").select("listing_id,exact_address").in("listing_id", listingIds);
      if (detailsResult.error) throw detailsResult.error;
      privateDetails = detailsResult.data || [];
      const secretsResult = await supabase.from("listing_handoff_secrets").select("listing_id,locked_at,failed_attempts").in("listing_id", listingIds);
      if (secretsResult.error) throw secretsResult.error;
      handoffSecrets = secretsResult.data || [];
    }
    const secretsById = new Map(handoffSecrets.map((secret) => [secret.listing_id, secret]));
    const detailsById = new Map(privateDetails.map((detail) => [detail.listing_id, {
      ...detail,
      lockedAt: secretsById.get(detail.listing_id)?.locked_at || ""
    }]));
    const foodRows = foodsResult.data || [];
    const eventRows = eventsResult.data || [];
    state.items = [
      ...state.items.filter((item) => !isUuid(item.id)),
      ...foodRows.filter((row) => row.status === "active").map(mapFoodRow)
    ];
    state.history = [
      ...state.history.filter((item) => !isUuid(item.id)),
      ...foodRows.filter((row) => row.status === "archived").map((row) => ({ ...mapFoodRow(row), disposition: row.disposition }))
    ];
    state.listings = [
      ...state.listings.filter((listing) => listing.sample),
      ...remoteListings.map((row) => mapListingRow(row, detailsById.get(row.id)))
    ];
    const remoteNeeds = needsResult.data || [];
    const transferRows = transfersResult.data || [];
    const requestCounts = transferRows.reduce((counts, request) => counts.set(request.need_id, (counts.get(request.need_id) || 0) + 1), new Map());
    state.needs = [
      ...state.needs.filter((need) => need.sample),
      ...remoteNeeds.map((need) => ({
        id: need.id,
        pantry: need.pantry_name,
        location: need.area_label,
        item: need.item,
        quantity: need.quantity,
        urgency: need.urgency,
        status: need.status === "open" ? "Available" : need.status,
        createdBy: need.created_by,
        requestCount: requestCounts.get(need.id) || 0,
        sample: false
      }))
    ];
    state.requests = {
      ...Object.fromEntries(Object.entries(state.requests).filter(([needId]) => !isUuid(needId))),
      ...Object.fromEntries(transferRows.filter((request) => request.requester_id === currentUser.id).map((request) => [request.need_id, true]))
    };
    state.events = [
      ...state.events.filter((item) => !isUuid(item.id)),
      ...eventRows.map((row) => ({
        id: row.id, date: row.occurred_on, label: row.label, detail: row.detail,
        pounds: Number(row.pounds) || 0, pickups: Number(row.pickups) || 0,
        hours: Number(row.hours) || 0, requests: Number(row.requests) || 0
      }))
    ];
    state.impact = state.events.reduce((totals, item) => ({
      pounds: totals.pounds + (Number(item.pounds) || 0),
      pickups: totals.pickups + (Number(item.pickups) || 0),
      hours: totals.hours + (Number(item.hours) || 0),
      requests: totals.requests + (Number(item.requests) || 0)
    }), { pounds: 0, pickups: 0, hours: 0, requests: 0 });
    backendError = "";
    sharedReady = true;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      storageAvailable = false;
      showToast(`Shared data loaded, but this browser could not cache a copy: ${error.message}`, true);
    }
    renderAccount();
    render();
  };

  const subscribeToSharedChanges = () => {
    if (listingSubscription) supabase.removeChannel(listingSubscription);
    if (inventorySubscription) supabase.removeChannel(inventorySubscription);
    if (pantrySubscription) supabase.removeChannel(pantrySubscription);
    listingSubscription = supabase.channel("foodcycle-listings")
      .on("postgres_changes", { event: "*", schema: "public", table: "share_listings" }, () => {
        loadRemoteState().catch((error) => showToast(`Could not refresh shared listings: ${error.message}`, true));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "listing_handoff_secrets" }, () => {
        loadRemoteState().catch((error) => showToast(`Could not refresh handoff status: ${error.message}`, true));
      }).subscribe();
    inventorySubscription = supabase.channel(`foodcycle-food-${currentUser.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "food_items", filter: `owner_id=eq.${currentUser.id}` }, () => {
        loadRemoteState().catch((error) => showToast(`Could not refresh your food list: ${error.message}`, true));
      }).subscribe();
    pantrySubscription = supabase.channel("foodcycle-pantry-needs")
      .on("postgres_changes", { event: "*", schema: "public", table: "pantry_needs" }, () => {
        loadRemoteState().catch((error) => showToast(`Could not refresh pantry needs: ${error.message}`, true));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "transfer_requests" }, () => {
        loadRemoteState().catch((error) => showToast(`Could not refresh transfer requests: ${error.message}`, true));
      }).subscribe();
  };

  const createHandoffCode = () => {
    if (!window.crypto || !window.crypto.getRandomValues) throw new Error("Secure random codes are unavailable in this browser. Open the site over HTTPS and try again.");
    const values = new Uint32Array(1);
    const limit = Math.floor(0x100000000 / 100000000) * 100000000;
    do {
      window.crypto.getRandomValues(values);
    } while (values[0] >= limit);
    return String(values[0] % 100000000).padStart(8, "0");
  };

  const dateLabel = (iso) => new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(new Date(`${iso}T12:00:00`));
  const daysUntil = (iso) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const target = new Date(`${iso}T00:00:00`);
    return Math.round((target - today) / 86400000);
  };
  const formatQty = (amount, unit) => `${amount} ${unit}`;
  const newId = (prefix) => {
    if (sharedReady && window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    if (sharedReady && window.crypto && window.crypto.getRandomValues) {
      const bytes = new Uint8Array(16);
      window.crypto.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
    return `${prefix}${Date.now()}${Math.random().toString(36).slice(2, 7)}`;
  };
  const amountToPounds = (amount, unit) => {
    const value = Number.parseFloat(String(amount).replace(",", "."));
    if (!Number.isFinite(value)) return 0;
    const normalized = unit.toLowerCase();
    if (normalized === "lb" || normalized === "lbs") return value;
    if (normalized === "kg") return value * 2.205;
    if (normalized === "oz") return value / 16;
    if (normalized === "g") return value / 453.6;
    if (normalized === "each" || normalized === "items") return value * 0.5;
    return 0;
  };
  const expiryInfo = (iso) => {
    const difference = daysUntil(iso);
    if (difference < 0) return { label: `${Math.abs(difference)}d past`, tone: "urgent", score: difference };
    if (difference === 0) return { label: "Today", tone: "urgent", score: 0 };
    if (difference === 1) return { label: "Tomorrow", tone: "urgent", score: 1 };
    if (difference <= 3) return { label: `In ${difference} days`, tone: "soon", score: difference };
    return { label: dateLabel(iso), tone: "good", score: difference };
  };
  const iconPlus = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  const currentHeaderDate = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "short", day: "numeric" }).format(new Date());
  todayDate.textContent = currentHeaderDate;

  const pageHeading = (title, subtitle, action = "") => `
    <header class="page-heading">
      <div><h1 tabindex="-1" id="page-title">${title}</h1><p class="page-subtitle">${subtitle}</p></div>
      ${action}
    </header>`;

  const expiryMarkup = (item) => {
    const info = expiryInfo(item.bestBy);
    const description = info.score < 0 ? `${Math.abs(info.score)} days past best by` : info.score === 0 ? "Best by today" : info.score === 1 ? "Best by tomorrow" : `Best by ${dateLabel(item.bestBy)}`;
    return `<span class="expiry expiry-${info.tone}" aria-label="${description}">${escapeHTML(info.label)}</span>`;
  };

  const renderInventory = () => {
    const sorted = [...state.items].sort((left, right) => daysUntil(left.bestBy) - daysUntil(right.bestBy));
    const urgentCount = sorted.filter((item) => daysUntil(item.bestBy) <= 2).length;
    const categories = ["All", "Produce", "Dairy", "Prepared", "Protein", "Pantry"];
    const categoryOptions = categories.map((category) => `<button class="filter-button" type="button" data-category="${escapeHTML(category)}" aria-pressed="${filters.category === category}">${escapeHTML(category)}</button>`).join("");
    const visible = sorted.filter((item) => {
      const difference = daysUntil(item.bestBy);
      const categoryMatch = filters.category === "All" || item.category === filters.category;
      const urgencyMatch = filters.urgency === "all" || (filters.urgency === "soon" && difference <= 3) || (filters.urgency === "later" && difference > 3);
      const queryMatch = `${item.name} ${item.location} ${item.category}`.toLowerCase().includes(filters.query.toLowerCase());
      return categoryMatch && urgencyMatch && queryMatch;
    });
    const rows = visible.map((item) => `
      <article class="inventory-row">
        <div class="food-name"><span class="food-marker" data-kind="${escapeHTML(item.category)}" aria-hidden="true"></span><span><strong>${escapeHTML(item.name)}</strong><small>${escapeHTML(item.category)}${item.sample ? " · sample" : !isUuid(item.id) ? " · this device only" : ""}</small></span></div>
        <span class="row-muted">${escapeHTML(item.location)}</span>
        <span class="row-muted">${escapeHTML(formatQty(item.amount, item.unit))}</span>
        ${expiryMarkup(item)}
        <div class="row-actions">
          <button class="button button-outline button-small" type="button" data-action="finish-item" data-id="${escapeHTML(item.id)}">Used</button>
          <button class="button button-outline button-small" type="button" data-action="share-item" data-id="${escapeHTML(item.id)}" aria-label="Move ${escapeHTML(item.name)} to the share board">Share</button>
        </div>
      </article>`).join("");
    const dateMin = offsetDate(-365);
    const dateMax = offsetDate(730);
    return `
      <section class="page">
        ${pageHeading("Use it while it’s good.", "A clear next step for every item. Start with what needs attention first.", `<button class="button button-primary" type="button" data-action="open-add">${iconPlus} Add food</button>`)}
        <div class="facts-strip" aria-label="Pantry overview">
          <div class="fact"><strong class="${urgentCount ? "fact-alert" : ""}">${urgentCount}</strong><span>need attention soon</span></div>
          <div class="fact"><strong>${state.items.length}</strong><span>items on your list</span></div>
          <div class="fact"><strong>${state.history.length}</strong><span>moved to history</span></div>
        </div>
        <details class="add-details" id="add-food-details">
          <summary>Add food to your list</summary>
          <form class="form-grid" id="add-food-form">
            <div class="field"><label for="food-name">Food name</label><input id="food-name" name="name" required maxlength="70" placeholder="e.g. Green beans"></div>
            <div class="field"><label for="food-category">Food group</label><select id="food-category" name="category"><option>Produce</option><option>Dairy</option><option>Prepared</option><option>Protein</option><option>Pantry</option></select></div>
            <div class="field"><label for="food-amount">Amount</label><div class="amount-fields"><input id="food-amount" name="amount" type="number" required min="0.01" step="0.01" placeholder="1"><select name="unit" aria-label="Amount unit"><option>lb</option><option>oz</option><option>kg</option><option>g</option><option>each</option><option>bag</option><option>pint</option><option>bunches</option><option>carton</option><option>servings</option></select></div></div>
            <div class="field"><label for="food-location">Stored where?</label><input id="food-location" name="location" required maxlength="50" placeholder="Fridge · crisper"></div>
            <div class="field"><label for="food-bestby">Best by</label><input id="food-bestby" name="bestBy" type="date" required min="${dateMin}" max="${dateMax}" value="${offsetDate(5)}"></div>
            <div class="field"><label for="food-note">A note (optional)</label><input id="food-note" name="note" maxlength="80" placeholder="Opened yesterday"></div>
            <div class="form-actions"><button class="button button-primary" type="submit">Save to my list</button></div>
          </form>
        </details>
        <div class="section-title"><h2>Food to keep an eye on</h2><span class="section-count">${visible.length} of ${state.items.length} items</span></div>
        <div class="list-toolbar">
          <div class="filter-group" role="group" aria-label="Filter by expiry">
            <button class="filter-button" type="button" data-urgency="all" aria-pressed="${filters.urgency === "all"}">Everything</button>
            <button class="filter-button" type="button" data-urgency="soon" aria-pressed="${filters.urgency === "soon"}">Soon</button>
            <button class="filter-button" type="button" data-urgency="later" aria-pressed="${filters.urgency === "later"}">Later</button>
          </div>
          <label class="search-field"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><circle cx="10.8" cy="10.8" r="6.6" stroke="currentColor" stroke-width="1.8"/><path d="m16 16 4.2 4.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg><input type="search" id="food-search" placeholder="Find food or location" value="${escapeHTML(filters.query)}" aria-label="Find food or location"></label>
        </div>
        <div class="filter-group category-filters" role="group" aria-label="Filter by food group">${categoryOptions}</div>
        <div class="inventory-head" aria-hidden="true"><span>Food</span><span>Stored in</span><span>Amount</span><span>Best by</span><span>Next step</span></div>
        <div class="inventory-list" aria-label="Your food, sorted by best-by date">
          ${rows || `<div class="empty-state"><strong>${state.items.length ? "No food matches those filters." : "Your list is clear for now."}</strong>${state.items.length ? "Try another food group, or clear the search." : "Add something you have so it’s easier to use in time."}</div>`}
        </div>
        <p class="inline-note">A best-by date is a guide, not a safety test. When in doubt, follow food-safety guidance for that item.</p>
      </section>`;
  };

  const renderUseNext = () => {
    const expiring = state.items.filter((item) => {
      const difference = daysUntil(item.bestBy);
      return difference >= 0 && difference <= 3;
    });
    if (!mealFilters.ingredients) mealFilters.ingredients = state.items.map((item) => item.name).join(", ");
    const onHandIngredients = mealFilters.ingredients.toLowerCase().split(",").map((ingredient) => ingredient.trim()).filter(Boolean);
    const hasIngredient = (term) => onHandIngredients.some((ingredient) => ingredient.includes(term));
    const ideas = mealIdeas.map((idea) => {
      const expiringMatches = expiring.filter((item) => idea.uses.some((term) => item.name.toLowerCase().includes(term)));
      return { ...idea, expiringMatches };
    }).filter((idea) => idea.expiringMatches.length
      && mealFilters.diets.every((diet) => idea.diets.includes(diet))
      && (!mealFilters.onlyOnHand || idea.requires.every(hasIngredient)));
    const options = dietOptions.map((diet) => `<label class="check-option"><input type="checkbox" name="diet" value="${escapeHTML(diet)}" ${mealFilters.diets.includes(diet) ? "checked" : ""}>${escapeHTML(diet)}</label>`).join("");
    const cards = ideas.map((idea) => {
      const urgentNames = idea.expiringMatches.map((item) => item.name).join(", ");
      const missingIngredients = idea.ingredients.filter((ingredient) => !hasIngredient(ingredient.toLowerCase()));
      return `<article class="meal-idea">
        <h3>${escapeHTML(idea.name)}</h3>
        <p class="meal-use">Use soon: ${escapeHTML(urgentNames)}</p>
        <p><strong>You'll need:</strong> ${escapeHTML(idea.ingredients.join(", "))}</p>
        <p class="field-help">Quick idea: ${escapeHTML(idea.steps)}</p>
        <p class="food-safety-note">Allergy check: ${escapeHTML(idea.allergenNote)} These ideas are not allergy-safe guarantees; verify every ingredient and label.</p>
        ${missingIngredients.length ? `<small>Also needed: ${escapeHTML(missingIngredients.join(", "))}</small>` : `<small>Everything listed is on your list.</small>`}
      </article>`;
    }).join("");
    return `<section class="page">
      ${pageHeading("Use it next.", "Simple meal ideas start with food that is approaching its best-by date.")}
      <div class="beta-banner"><span class="beta-label">GUIDE</span><span><strong>Use your judgment.</strong> Best-by dates are not safety tests. These are flexible meal suggestions, not recipes tested for safety or allergy suitability. Avoid food that looks or smells unsafe and follow authoritative storage guidance.</span></div>
      <form class="meal-filters" id="meal-filter-form">
        <div class="section-title"><h2>Make ideas fit your kitchen</h2><span class="section-count">${expiring.length} items best by in the next 3 days</span></div>
        <div class="field"><label for="meal-ingredients">Ingredients you have</label><input id="meal-ingredients" name="ingredients" value="${escapeHTML(mealFilters.ingredients || state.items.map((item) => item.name).join(", "))}" placeholder="e.g. spinach, rice, eggs"><small class="field-help">Comma-separated. Your food list is prefilled; edit it to match what’s actually available.</small></div>
        <fieldset class="diet-options"><legend>Dietary preferences to include</legend>${options}</fieldset>
        <label class="check-option only-on-hand"><input type="checkbox" name="onlyOnHand" ${mealFilters.onlyOnHand ? "checked" : ""}> Only show ideas when all featured ingredients are on hand</label>
        <button class="button button-primary button-small" type="submit">Update meal ideas</button>
      </form>
      <div class="section-title"><h2>Ideas for what needs using</h2><span class="section-count">${ideas.length} ${ideas.length === 1 ? "idea" : "ideas"}</span></div>
      <div class="meal-list">${cards || `<div class="empty-state"><strong>No meal ideas match right now.</strong>Try another dietary filter or adjust your ingredients list. Food due today through three days from now is considered “use soon” here.</div>`}</div>
      <p class="inline-note">Dietary tags are ingredient-based suggestions, not medical advice. Read package labels and consider cross-contact, shared equipment, and individual needs.</p>
    </section>`;
  };

  const renderSharing = () => {
    const ordered = [...state.listings].sort((left, right) => Number(left.pickedUp) - Number(right.pickedUp));
    const listingRows = ordered.map((listing) => {
      const statusValue = listing.status || (listing.pickedUp ? "completed" : listing.claimed ? "confirmed" : "open");
      const status = statusValue === "completed" ? "Pickup complete" : statusValue === "confirmed" ? "Pickup confirmed" : statusValue === "requested" ? "Claim awaiting donor confirmation" : "Pickup open";
      const statusClass = statusValue === "completed" ? "complete" : statusValue === "open" ? "" : "claimed";
      const isOwner = listing.ownerId === (currentUser?.id || demoActor);
      const isClaimant = listing.claimedBy === (currentUser?.id || demoActor);
      const canSeePrivateDetails = Boolean(listing.exactAddress && (isOwner || (statusValue === "confirmed" && isClaimant)));
      let action = "";
      if (statusValue === "completed") action = `<span class="section-count">Complete</span>`;
      else if (statusValue === "requested" && isOwner) action = `<button class="button button-primary button-small" type="button" data-action="confirm-claim" data-id="${escapeHTML(listing.id)}">Confirm claimant</button>`;
      else if (statusValue === "requested" && isClaimant) action = `<span class="section-count">Waiting for donor</span>`;
      else if (statusValue === "confirmed" && isClaimant) action = `<form class="handoff-form" data-listing-id="${escapeHTML(listing.id)}"><label for="handoff-${escapeHTML(listing.id)}">Enter the 8-digit handoff code to complete</label><input id="handoff-${escapeHTML(listing.id)}" name="code" inputmode="numeric" pattern="[0-9]{8}" maxlength="8" required autocomplete="one-time-code"><button class="button button-lime button-small" type="submit" data-action="complete-pickup" data-id="${escapeHTML(listing.id)}">Verify &amp; complete</button></form>`;
      else if (statusValue === "confirmed" && isOwner && !listing.handoffCode) action = `<button class="button button-outline button-small" type="button" data-action="confirm-claim" data-id="${escapeHTML(listing.id)}">Issue new handoff code</button>`;
      else if (statusValue === "confirmed" && isOwner) action = `<span class="section-count">Waiting for pickup</span>`;
      else if (statusValue === "open" && !isOwner) action = `<button class="button button-primary button-small" type="button" data-action="claim-pickup" data-id="${escapeHTML(listing.id)}">Request this pickup</button>`;
      else if (isOwner) action = `<span class="section-count">Your listing</span>`;
      const privateDetails = canSeePrivateDetails
        ? `<div class="private-pickup"><strong>Private pickup address</strong><span>${escapeHTML(listing.exactAddress)}</span>${statusValue === "confirmed" && isOwner && listing.handoffCode ? `<span>${listing.handoffLocked ? "Previous code locked. Share this new code with the volunteer: " : "Share this handoff code with the volunteer: "}<strong>${escapeHTML(listing.handoffCode)}</strong></span>` : ""}</div>`
        : `<p class="private-pickup-note">${statusValue === "confirmed" ? "Exact pickup address is shared with the confirmed volunteer only." : "Exact pickup address stays hidden until the donor confirms a volunteer."}</p>`;
      const allergenText = listing.allergens ? escapeHTML(listing.allergens) : "Not provided — ask the donor before pickup.";
      const foodNotes = `<div class="food-notes"><span><strong>Allergens:</strong> ${allergenText}</span>${listing.dietaryNotes ? `<span><strong>Dietary notes:</strong> ${escapeHTML(listing.dietaryNotes)}</span>` : ""}</div>`;
      return `<article class="share-row">
        <div><h3>${escapeHTML(listing.name)}</h3><p>Pickup area: ${escapeHTML(listing.location)}<br>Dropoff: ${escapeHTML(listing.destination || "Local destination · demo")}<br>${escapeHTML(dateLabel(listing.date))} · ${escapeHTML(listing.slot)}</p><span class="share-status ${statusClass}">${status}${listing.sample ? " · sample" : !isUuid(listing.id) ? " · this device only" : ""}</span>${privateDetails}</div>
        <div><div class="share-quantity">${escapeHTML(formatQty(listing.quantity, listing.unit))}</div><p>${escapeHTML(listing.note || "Pickup notes not provided.")}</p>${foodNotes}</div>
        <div class="share-actions">${action}</div>
      </article>`;
    }).join("");
    return `<section class="page">
      ${pageHeading("Good food grows better together.", "A neighborhood pickup board for extra garden and farm produce.", `<button class="button button-primary" type="button" data-action="open-listing">${iconPlus} Post a harvest</button>`)}
      <div class="beta-banner"><span class="beta-label">SAFETY</span><span><strong>${sharedReady ? "Shared board with protected pickup details." : "Local demo board only."}</strong> ${sharedReady ? "Shared listings update in real time. Exact addresses are stored separately and are visible only to the donor and a confirmed claimant." : "Sample listings are invented and new activity stays in this browser. The demo role switch is not authentication; anyone using this device can inspect its local storage."} Do not share unsafe food; recipients should confirm handling and allergy details with the donor.</span></div>
      ${!currentUser ? `<form class="demo-role-form" id="demo-role-form"><label for="demo-role">Try as</label><select id="demo-role" name="role"><option value="demo-volunteer" ${demoActor === "demo-volunteer" ? "selected" : ""}>Volunteer</option><option value="demo-grower" ${demoActor === "demo-grower" ? "selected" : ""}>Grower / donor</option></select><span>Demo roles are for trying the workflow on this device; they do not protect identity or address data.</span></form>` : ""}
      <div class="board-grid">
        <div>
          <div class="section-title"><h2>Available to neighbors</h2><span class="section-count">${state.listings.filter((listing) => !listing.claimed && !listing.pickedUp).length} open pickup slots</span></div>
          <details class="add-details" id="post-listing-details" ${state.openShareForm ? "open" : ""}>
            <summary>Post extra produce</summary>
            <form class="form-grid" id="post-listing-form">
              <div class="field"><label for="listing-name">What’s available?</label><input id="listing-name" name="name" required maxlength="70" placeholder="e.g. 20 lb tomatoes"></div>
              <div class="field"><label for="listing-quantity">Amount</label><div class="amount-fields"><input id="listing-quantity" name="quantity" type="number" required min="0.01" step="0.01" placeholder="20"><select name="unit" aria-label="Listing amount unit"><option>lb</option><option>oz</option><option>kg</option><option>g</option><option>boxes</option><option>bunches</option><option>each</option><option>bag</option><option>pint</option><option>carton</option><option>servings</option></select></div></div>
              <div class="field"><label for="listing-location">Pickup area (public)</label><input id="listing-location" name="location" required maxlength="70" placeholder="Town or neighborhood"></div>
              <div class="field"><label for="listing-address">Exact pickup address (private)</label><input id="listing-address" name="exactAddress" required maxlength="120" autocomplete="street-address" placeholder="Visible only after donor confirmation"><small class="field-help">Stored separately; do not put an address in the public pickup-area field.</small></div>
              <div class="field"><label for="listing-destination">Delivery destination</label><select id="listing-destination" name="destination"><option>Community fridge · sample</option><option>School meal program · sample</option><option>Food pantry · sample</option></select></div>
              <div class="field"><label for="listing-date">Pickup day</label><input id="listing-date" name="date" type="date" required min="${offsetDate(0)}" value="${nextSaturday()}"></div>
              <div class="field"><label for="listing-slot">Pickup window</label><select id="listing-slot" name="slot"><option>9:00–11:00 am</option><option>11:00 am–1:00 pm</option><option>2:00–4:00 pm</option><option>By arrangement</option></select></div>
              <div class="field"><label for="listing-allergens">Known allergens (optional)</label><input id="listing-allergens" name="allergens" maxlength="120" placeholder="e.g. contains peanuts"></div>
              <div class="field"><label for="listing-dietary-notes">Dietary notes (optional)</label><input id="listing-dietary-notes" name="dietaryNotes" maxlength="120" placeholder="e.g. grown without sprays"></div>
              <div class="field"><label for="listing-note">Handling / pickup notes</label><input id="listing-note" name="note" maxlength="120" placeholder="Washed, chilled, bring a tote"></div>
              <div class="form-actions"><button class="button button-primary" type="submit">${sharedReady ? "Post to shared board" : "Post on this device"}</button></div>
            </form>
          </details>
          <div class="board-list">${listingRows || `<div class="empty-state"><strong>No produce posted yet.</strong>Add a listing to try the local demo pickup flow.</div>`}</div>
        </div>
        <aside class="side-register" aria-label="How the sample pickup board works">
          <h2>From extra to shared</h2><p>One small, local handoff can give good food another place to go.</p>
          <div class="mini-rule"><strong>Agree on a pickup window</strong><span>The donor sets a date and two-hour window. A request is not confirmed until the donor accepts it.</span></div>
          <div class="mini-rule"><strong>Confirm before sharing the address</strong><span>Only the donor and confirmed claimant can see the private pickup details. Never put a street address in the public area field.</span></div>
          <div class="mini-rule"><strong>Keep cold food cold</strong><span>Keep perishable food at 40°F / 4°C or colder and transport it in an insulated cooler. Do not share perishables left out for over 2 hours (1 hour above 90°F / 32°C).</span></div>
          <div class="mini-rule"><strong>Prevent cross-contact</strong><span>Use clean containers, keep raw foods separate, and ask about ingredients and allergens. Donors should describe how food was handled.</span></div>
        </aside>
      </div>
    </section>`;
  };

  const renderPantries = () => {
    const rows = state.needs.map((need) => {
      const requested = Boolean(state.requests[need.id]);
      const notified = Boolean(state.notices[need.id]);
      const ownNeed = need.createdBy === currentUser?.id;
      const needAction = ownNeed
        ? `<span class="section-count">${need.requestCount || 0} transfer requests</span>`
        : `<button class="button button-outline button-small" type="button" data-action="request-transfer" data-id="${escapeHTML(need.id)}" ${requested || need.status !== "Available" ? "disabled" : ""}>${requested ? "Requested" : "Request transfer"}</button>`;
      return `<article class="pantry-row">
        <div class="pantry-name"><strong>${escapeHTML(need.pantry)}${need.sample ? " · sample" : ""}</strong><small>${escapeHTML(need.location)}</small></div>
        <div class="need-quantity">${escapeHTML(need.item)} · ${escapeHTML(need.quantity)}</div>
        <div class="need-urgency">${requested ? (sharedReady && !need.sample ? "Request sent to pantry" : "Request pending in this demo") : escapeHTML(need.urgency)}</div>
        <div class="pantry-actions">
          ${needAction}
          <button class="button button-outline button-small" type="button" data-action="notify-clients" data-id="${escapeHTML(need.id)}" ${notified ? "disabled" : ""}>${notified ? "Notice drafted" : "Draft client notice"}</button>
        </div>
      </article>`;
    }).join("");
    return `<section class="page">
      ${pageHeading("A clearer view of what’s needed.", "A sample coordination board for pantry teams to share needs and practice handoffs.")}
      <div class="beta-banner"><span class="beta-label">${sharedReady ? "SHARED" : "BETA"}</span><span><strong>${sharedReady ? "Shared pantry coordination." : "Coordination preview—not live inventory."}</strong> ${sharedReady ? "Needs and transfer requests are shared with authenticated accounts. Client notices remain drafts." : "The listed pantry needs are sample entries; local requests and client notices do not contact a pantry."}</span></div>
      ${sharedReady ? `<details class="add-details" id="post-need-details"><summary>Post a pantry need to the shared network</summary><form class="form-grid" id="post-need-form">
        <div class="field"><label for="need-pantry">Organization or pantry</label><input id="need-pantry" name="pantry" required maxlength="100"></div>
        <div class="field"><label for="need-area">Public area</label><input id="need-area" name="area" required maxlength="100" placeholder="Town or neighborhood"></div>
        <div class="field"><label for="need-item">Needed food</label><input id="need-item" name="item" required maxlength="100"></div>
        <div class="field"><label for="need-quantity">Amount needed</label><input id="need-quantity" name="quantity" required maxlength="80" placeholder="e.g. 8 bunches"></div>
        <div class="field"><label for="need-urgency">When needed</label><select id="need-urgency" name="urgency"><option>Needed today</option><option>Needed this week</option><option>Ongoing need</option></select></div>
        <div class="form-actions"><button class="button button-primary" type="submit">Post shared need</button></div>
      </form></details>` : `<p class="inline-note">Sign in with a Supabase account to publish a pantry need or send a real transfer request. The entries below are samples.</p>`}
      <div class="section-title"><h2>${sharedReady ? "Community pantry needs" : "Example community needs"}</h2><span class="section-count">${state.needs.length} entries${sharedReady ? " · shared + sample" : " · sample data"}</span></div>
      <div class="pantry-head" aria-hidden="true"><span>Pantry</span><span>Looking for</span><span>When</span><span>Try a demo action</span></div>
      <div>${rows || `<div class="empty-state"><strong>No sample needs right now.</strong>The pantry coordination board is empty.</div>`}</div>
      <p class="inline-note">Actions above are examples of future coordination—not confirmed transfers, stock levels, or client notifications.</p>
    </section>`;
  };

  const renderImpact = () => {
    const from = reportFilters.from || offsetDate(-30);
    const to = reportFilters.to || offsetDate(0);
    const organization = reportFilters.organization || "";
    const events = [...state.events]
      .filter((event) => {
        const date = event.date || toISODate(new Date());
        return (!sharedReady || isUuid(event.id)) && date >= from && date <= to;
      })
      .reverse();
    const eventRows = events.map((event) => `<li><span>${escapeHTML(event.label)}</span><span>${escapeHTML(event.detail)}</span></li>`).join("");
    const reportTotals = events.reduce((totals, event) => ({
      pounds: totals.pounds + (Number(event.pounds) || 0),
      pickups: totals.pickups + (Number(event.pickups) || 0),
      hours: totals.hours + (Number(event.hours) || 0)
    }), { pounds: 0, pickups: 0, hours: 0 });
    const dateMin = offsetDate(-3650);
    const dateMax = offsetDate(0);
    return `<section class="page">
      ${pageHeading("Small actions, counted honestly.", "Keep a record of food rescued, completed pickups, and volunteer hours for partner reporting.")}
      <div class="beta-banner"><span class="beta-label">${sharedReady ? "SHARED" : "DEMO"}</span><span><strong>${sharedReady ? "Shared account activity; quantities remain estimates." : "Local demo activity only—not measured community outcomes."}</strong> ${sharedReady ? "Signed-in records are stored in Supabase and shared according to account permissions." : "Only actions in this browser are included; pound conversions are estimates and are not verified."}</span></div>
      <div class="section-title"><h2>${sharedReady ? "Shared account activity" : "Your actions on this device"}</h2><span class="section-count">${sharedReady ? "Stored in shared service" : "Not shared or verified"}</span></div>
      <div class="impact-ledger" aria-label="Local demo impact">
        <div class="impact-line"><strong>Estimated pounds rescued · selected dates</strong><span class="impact-number">${reportTotals.pounds.toFixed(1)} lb</span><small>Recorded quantities converted to estimated pounds.</small></div>
        <div class="impact-line"><strong>Pickups completed · selected dates</strong><span class="impact-number">${reportTotals.pickups}</span><small>Completed handoffs recorded in this activity log.</small></div>
        <div class="impact-line"><strong>Volunteer hours · selected dates</strong><span class="impact-number">${reportTotals.hours.toFixed(1)}</span><small>Hours entered by users; no certificate is issued.</small></div>
        <div class="impact-line"><strong>Pantry transfer requests</strong><span class="impact-number">${events.reduce((total, item) => total + (Number(item.requests) || 0), 0)}</span><small>Includes local drafts and requests sent through shared accounts.</small></div>
      </div>
      <section class="report-section" aria-labelledby="report-title">
        <div class="section-title"><h2 id="report-title">Partner impact report</h2><span class="section-count">${events.length} activity records in range</span></div>
        <form class="report-filters" id="report-filter-form">
          <div class="field"><label for="report-organization">Organization name for report</label><input id="report-organization" name="organization" maxlength="100" value="${escapeHTML(organization)}" placeholder="Optional organization or program"></div>
          <div class="field"><label for="report-from">From</label><input id="report-from" name="from" type="date" required min="${dateMin}" max="${dateMax}" value="${escapeHTML(from)}"></div>
          <div class="field"><label for="report-to">Through</label><input id="report-to" name="to" type="date" required min="${dateMin}" max="${dateMax}" value="${escapeHTML(to)}"></div>
          <div class="form-actions"><button class="button button-outline" type="submit">Apply date range</button><button class="button button-primary" type="button" data-action="export-report">Export CSV</button></div>
        </form>
        <p class="inline-note">The organization name is an export label, not an organization account or membership. CSV totals include only activity visible to this account or browser; impact is not independently verified.</p>
      </section>
      <section class="hours-section" aria-labelledby="hours-title">
        <div class="section-title"><h2 id="hours-title">Log volunteer time</h2><span class="section-count">${sharedReady ? "Saved to shared account" : "Saved locally"}</span></div>
        <form class="form-grid hours-entry-form" id="log-hours-form">
          <div class="field"><label for="hours-activity">What did you work on?</label><input id="hours-activity" name="activity" required maxlength="70" placeholder="Packed pantry boxes"></div>
          <div class="field"><label for="hours-amount">Hours</label><input id="hours-amount" name="hours" type="number" required min="0.25" max="24" step="0.25" placeholder="1.5"></div>
          <div class="field"><label for="hours-date">Day</label><input id="hours-date" name="date" type="date" required min="${dateMin}" max="${dateMax}" value="${offsetDate(0)}"></div>
          <div class="form-actions"><button class="button button-primary" type="submit">${sharedReady ? "Log volunteer hours" : "Log demo hours"}</button></div>
        </form>
      </section>
      <section class="activity-section" aria-labelledby="activity-title">
        <div class="section-title"><h2 id="activity-title">Recent local activity</h2><span class="section-count">${events.length} entries</span></div>
        <ul class="event-list">${eventRows || `<li><span>No demo activity yet.</span><span>Try an action to get started.</span></li>`}</ul>
      </section>
      <p class="inline-note">Reports contain only records accessible to the signed-in account or this browser. No partner, family, or delivery outcome is independently verified.</p>
    </section>`;
  };

  const render = (moveFocus = false) => {
    const views = {
      inventory: { label: "YOUR FOOD", html: renderInventory() },
      "use-next": { label: "USE IT NEXT", html: renderUseNext() },
      sharing: { label: "SHARE BOARD · BETA", html: renderSharing() },
      pantries: { label: "PANTRY NETWORK · BETA", html: renderPantries() },
      impact: { label: "IMPACT & HOURS", html: renderImpact() }
    };
    const view = views[activeView.value] || views.inventory;
    crumbLabel.textContent = view.label;
    document.querySelectorAll("[data-nav]").forEach((button) => {
      const current = button.dataset.nav === activeView.value;
      button.classList.toggle("is-active", current);
      if (current) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    app.innerHTML = view.html;
    if (moveFocus) document.getElementById("page-title")?.focus();
  };

  const addEvent = (label, detail, metrics = {}) => {
    state.events.push({
      id: newId("e"),
      date: metrics.date || toISODate(new Date()),
      label,
      detail,
      pounds: Number(metrics.pounds) || 0,
      pickups: Number(metrics.pickups) || 0,
      hours: Number(metrics.hours) || 0,
      requests: Number(metrics.requests) || 0
    });
    state.events = state.events.slice(-24);
  };

  const setView = (view) => {
    if (view !== "sharing") state.prefillShare = null;
    activeView.value = view;
    render(true);
    window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };

  document.addEventListener("click", (event) => {
    const nav = event.target.closest("[data-nav]");
    if (nav) {
      setView(nav.dataset.nav);
      return;
    }

    const urgency = event.target.closest("[data-urgency]");
    if (urgency) {
      filters.urgency = urgency.dataset.urgency;
      render();
      document.querySelector(`[data-urgency="${filters.urgency}"]`).focus();
      return;
    }

    const category = event.target.closest("[data-category]");
    if (category) {
      filters.category = category.dataset.category;
      render();
      document.querySelector(`[data-category="${filters.category}"]`).focus();
      return;
    }

    const action = event.target.closest("[data-action]");
    if (!action) return;
    if (action.dataset.action === "complete-pickup") return;
    const id = action.dataset.id;

    switch (action.dataset.action) {
      case "sign-out":
        if (!supabase) return;
        supabase.auth.signOut().then(({ error }) => {
          if (error) showToast(`Could not sign out: ${error.message}`, true);
        }).catch((error) => showToast(`Could not sign out: ${error.message}`, true));
        break;
      case "export-report": {
        const from = reportFilters.from || offsetDate(-30);
        const to = reportFilters.to || offsetDate(0);
        const events = state.events.filter((item) => {
          const date = item.date || toISODate(new Date());
          return (!sharedReady || isUuid(item.id)) && date >= from && date <= to;
        });
        const totals = events.reduce((result, item) => ({
          pounds: result.pounds + (Number(item.pounds) || 0),
          pickups: result.pickups + (Number(item.pickups) || 0),
          hours: result.hours + (Number(item.hours) || 0)
        }), { pounds: 0, pickups: 0, hours: 0 });
        const quote = (value) => `"${String(value).replace(/"/g, '""')}"`;
        const rows = [
          ["Organization", reportFilters.organization || "Not specified"],
          ["From", from],
          ["Through", to],
          ["Estimated pounds rescued", totals.pounds.toFixed(1)],
          ["Pickups completed", totals.pickups],
          ["Volunteer hours", totals.hours.toFixed(2)],
          [],
          ["Date", "Activity", "Details", "Estimated pounds", "Pickups completed", "Volunteer hours"],
          ...events.map((item) => [item.date || toISODate(new Date()), item.label, item.detail, Number(item.pounds) || 0, Number(item.pickups) || 0, Number(item.hours) || 0])
        ];
        const csv = rows.map((row) => row.map(quote).join(",")).join("\r\n");
        const link = document.createElement("a");
        const downloadUrl = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
        link.href = downloadUrl;
        link.download = `foodcycle-impact-${from}-to-${to}.csv`;
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
        showToast("Impact report CSV downloaded. Totals are based on recorded activity.");
        break;
      }
      case "open-add":
        document.getElementById("add-food-details").open = true;
        document.getElementById("food-name").focus();
        break;
      case "open-listing":
        state.prefillShare = null;
        state.openShareForm = true;
        render(true);
        document.getElementById("listing-name").focus();
        break;
      case "finish-item": {
        const index = state.items.findIndex((item) => item.id === id);
        if (index < 0) return;
        const [item] = state.items.splice(index, 1);
        const pounds = amountToPounds(item.amount, item.unit);
        state.history.push({ ...item, disposition: "used" });
        state.impact.pounds += pounds;
        addEvent(`Used ${item.name}`, `${pounds > 0 ? `${pounds.toFixed(1)} estimated lb` : formatQty(item.amount, item.unit)} · ${sharedReady ? "shared account" : "on this device"}`, { pounds });
        persist(`${item.name} moved to history.`);
        render(true);
        break;
      }
      case "share-item": {
        const item = state.items.find((entry) => entry.id === id);
        if (!item) return;
        state.prefillShare = { itemId: item.id, name: item.name, quantity: item.amount, unit: item.unit };
        state.openShareForm = true;
        setView("sharing");
        const nameInput = document.getElementById("listing-name");
        nameInput.value = state.prefillShare.name;
        document.getElementById("listing-quantity").value = state.prefillShare.quantity;
        const unitSelect = document.querySelector('#post-listing-form [name="unit"]');
        if ([...unitSelect.options].some((option) => option.value === item.unit)) unitSelect.value = item.unit;
        nameInput.focus();
        showToast("Add a pickup place and time before posting.");
        break;
      }
      case "claim-pickup": {
        if (currentUser && !sharedReady) {
          showToast("Shared data is unavailable. Reload after reconnecting or sign out to use the local demo.", true);
          return;
        }
        const listing = state.listings.find((entry) => entry.id === id);
        if (!listing || (listing.status || (listing.claimed ? "confirmed" : "open")) !== "open" || listing.ownerId === (currentUser?.id || demoActor)) return;
        if (sharedReady) {
          supabase.rpc("request_pickup", { p_listing_id: id }).then(async ({ error }) => {
            if (error) throw error;
            await loadRemoteState();
            showToast("Pickup request sent to the donor for confirmation.");
          }).catch((error) => showToast(`Pickup request failed: ${error.message}`, true));
          break;
        }
        listing.status = "requested";
        listing.claimed = true;
        listing.claimedBy = demoActor;
        addEvent(`Requested pickup: ${listing.name}`, "Waiting for donor confirmation · local demo");
        persist("Pickup request sent for donor confirmation in this local demo.");
        render(true);
        break;
      }
      case "confirm-claim": {
        if (currentUser && !sharedReady) {
          showToast("Shared data is unavailable. Reload after reconnecting or sign out to use the local demo.", true);
          return;
        }
        const listing = state.listings.find((entry) => entry.id === id);
        if (!listing || (listing.status !== "requested" && listing.status !== "confirmed") || listing.ownerId !== (currentUser?.id || demoActor)) return;
        let handoffCode;
        try {
          handoffCode = createHandoffCode();
        } catch (error) {
          showToast(error.message, true);
          return;
        }
        if (sharedReady) {
          supabase.rpc("confirm_pickup", { p_listing_id: id, p_handoff_code: handoffCode }).then(async ({ error }) => {
            if (error) throw error;
            await loadRemoteState();
            const confirmedListing = state.listings.find((entry) => entry.id === id);
            if (confirmedListing) {
              confirmedListing.handoffCode = handoffCode;
              confirmedListing.handoffLocked = false;
              render(true);
            }
            showToast("Pickup confirmed. The claimant can now see the address; only you can see the handoff code to share.");
          }).catch((error) => showToast(`Could not confirm pickup: ${error.message}`, true));
          break;
        }
        listing.status = "confirmed";
        listing.handoffCode = handoffCode;
        listing.failedAttempts = 0;
        listing.handoffLocked = false;
        persist(listing.claimedBy ? "New handoff code issued. Share it with the confirmed volunteer." : "Pickup confirmed. The volunteer can now see the address; share the code with them.");
        render(true);
        break;
      }
      case "request-transfer": {
        if (state.requests[id]) return;
        const need = state.needs.find((entry) => entry.id === id);
        if (sharedReady && need && !need.sample) {
          supabase.from("transfer_requests").insert({ need_id: id, requester_id: currentUser.id }).then(async ({ error }) => {
            if (error) throw error;
            await loadRemoteState();
            state.impact.requests += 1;
            addEvent(`Requested transfer: ${need.item}`, `Sent to ${need.pantry} · shared service`, { requests: 1 });
            persist();
            render();
            showToast("Transfer request sent to the pantry account.");
          }).catch((error) => showToast(`Could not send transfer request: ${error.message}`, true));
          break;
        }
        state.requests[id] = true;
        state.impact.requests += 1;
        if (need) addEvent(`Drafted transfer request: ${need.item}`, "Pending locally; no pantry was contacted", { requests: 1 });
        persist("Request saved locally; no pantry was contacted.");
        render(true);
        break;
      }
      case "notify-clients": {
        if (state.notices[id]) return;
        state.notices[id] = true;
        const need = state.needs.find((entry) => entry.id === id);
        if (need) addEvent(`Drafted client notice: ${need.item}`, "Local demo only; no message sent");
        persist("Client notice drafted locally; nothing was sent.");
        render(true);
        break;
      }
      case "reset-demo":
        if (!window.confirm("Reset this browser’s FoodCycle demo data? Your food entries, listings, and local activity will be replaced with the sample set.")) return;
        state = createSampleState();
        state.items = state.items.map((item) => ({ ...item, sample: true }));
        state.needs = state.needs.map((need) => ({ ...need, sample: true }));
        storageAvailable = true;
        filters.urgency = "all";
        filters.category = "All";
        filters.query = "";
        mealFilters.diets = [];
        mealFilters.ingredients = "";
        mealFilters.onlyOnHand = true;
        state.openShareForm = false;
        persist("Sample data restored.");
        setView("inventory");
        if (sharedReady) {
          loadRemoteState().catch((error) => showToast(`Your shared data could not be reloaded: ${error.message}`, true));
          showToast("Local sample data reset. Your shared account records are unchanged.");
        }
        break;
    }
  });

  document.addEventListener("input", (event) => {
    if (event.target.id !== "food-search") return;
    const input = event.target;
    const position = input.selectionStart;
    filters.query = input.value;
    render();
    const nextInput = document.getElementById("food-search");
    nextInput.focus();
    nextInput.setSelectionRange(position, position);
  });

  document.addEventListener("submit", (event) => {
    const form = event.target;
    if (!form.matches("form")) return;
    event.preventDefault();

    if (form.id === "auth-form") {
      if (!supabase) {
        showToast("The shared service is not connected. Add a Supabase URL and anon key, then refresh.", true);
        return;
      }
      const data = new FormData(form);
      const email = String(data.get("email")).trim();
      const password = String(data.get("password"));
      const action = event.submitter?.dataset.authAction || "signin";
      const request = action === "signup"
        ? supabase.auth.signUp({ email, password })
        : supabase.auth.signInWithPassword({ email, password });
      request.then(({ error, data: result }) => {
        if (error) throw error;
        if (action === "signup" && !result.session) showToast("Account created. Check your email to confirm it, then sign in.");
        else showToast(action === "signup" ? "Account created." : "Signing in to shared FoodCycle data.");
      }).catch((error) => showToast(`Account action failed: ${error.message}`, true));
      return;
    }

    if (form.id === "meal-filter-form") {
      const data = new FormData(form);
      mealFilters.ingredients = String(data.get("ingredients") || "");
      mealFilters.onlyOnHand = data.get("onlyOnHand") === "on";
      mealFilters.diets = data.getAll("diet").map(String);
      render(true);
      return;
    }

    if (form.id === "demo-role-form") {
      demoActor = String(new FormData(form).get("role"));
      render(true);
      showToast(`Demo role changed to ${demoActor === "demo-grower" ? "grower / donor" : "volunteer"}.`);
      return;
    }

    if (form.id === "report-filter-form") {
      const data = new FormData(form);
      const from = String(data.get("from"));
      const to = String(data.get("to"));
      if (!from || !to || from > to) {
        showToast("Choose a valid report range: the start date must be on or before the end date.", true);
        return;
      }
      reportFilters.from = from;
      reportFilters.to = to;
      reportFilters.organization = String(data.get("organization")).trim();
      render(true);
      return;
    }

    if (form.classList.contains("handoff-form")) {
      const listingId = form.dataset.listingId;
      const listing = state.listings.find((entry) => entry.id === listingId);
      const code = String(new FormData(form).get("code") || "").trim();
      if (!listing || listing.status !== "confirmed" || listing.claimedBy !== (currentUser?.id || demoActor)) return;
      if (sharedReady) {
        supabase.rpc("complete_pickup", { p_listing_id: listingId, p_handoff_code: code }).then(async ({ data: completed, error }) => {
          if (error) throw error;
          if (!completed) {
            showToast("That handoff code does not match. Check with the donor and try again; repeated guesses lock the code.", true);
            return;
          }
          await loadRemoteState();
          showToast("Handoff code verified; pickup recorded in shared activity.");
        }).catch((error) => showToast(`Pickup could not be completed: ${error.message}`, true));
        return;
      }
      if (code !== listing.handoffCode) {
        listing.failedAttempts = (listing.failedAttempts || 0) + 1;
        if (listing.failedAttempts >= 5) listing.handoffLocked = true;
        persist();
        showToast(listing.handoffLocked
          ? "Too many incorrect codes. Ask the donor to issue a new handoff code."
          : `That code does not match. Check with the donor and try again (${5 - listing.failedAttempts} attempts remain).`, true);
        render(true);
        return;
      }
      listing.status = "completed";
      listing.pickedUp = true;
      const pounds = amountToPounds(listing.quantity, listing.unit);
      state.impact.pounds += pounds;
      state.impact.pickups += 1;
      addEvent(`Pickup completed: ${listing.name}`, `${pounds > 0 ? `${pounds.toFixed(1)} estimated lb` : formatQty(listing.quantity, listing.unit)} · local demo`, { pounds, pickups: 1 });
      persist("Handoff code verified and pickup recorded in this local demo.");
      render(true);
      return;
    }

    if (form.id === "add-food-form") {
      const data = new FormData(form);
      const item = {
        id: newId("f"),
        name: String(data.get("name")).trim(),
        category: String(data.get("category")),
        amount: String(data.get("amount")),
        unit: String(data.get("unit")),
        location: String(data.get("location")).trim(),
        bestBy: String(data.get("bestBy")),
        note: String(data.get("note")).trim()
      };
      if (!item.name || !item.location || !item.bestBy) return;
      state.items.push(item);
      addEvent(`Added ${item.name} to the food list`, `${formatQty(item.amount, item.unit)} · ${sharedReady ? "shared account" : "on this device"}`);
      persist(`${item.name} added to your food list.`);
      filters.category = "All";
      filters.urgency = "all";
      filters.query = "";
      render(true);
      return;
    }

    if (form.id === "post-listing-form") {
      if (currentUser && !sharedReady) {
        showToast("Shared data is unavailable right now. Sign out to use the local demo, or reload after reconnecting.", true);
        return;
      }
      const data = new FormData(form);
      const listing = {
        id: newId("s"),
        name: String(data.get("name")).trim(),
        quantity: String(data.get("quantity")),
        unit: String(data.get("unit")),
        location: String(data.get("location")).trim(),
        exactAddress: String(data.get("exactAddress")).trim(),
        destination: String(data.get("destination")),
        date: String(data.get("date")),
        slot: String(data.get("slot")),
        note: String(data.get("note")).trim(),
        allergens: String(data.get("allergens")).trim(),
        dietaryNotes: String(data.get("dietaryNotes")).trim(),
        claimed: false,
        pickedUp: false,
        status: "open",
        ownerId: currentUser?.id || demoActor,
        sample: false
      };
      if (!listing.name || !listing.location || !listing.exactAddress || !listing.date) return;
      if (sharedReady) {
        supabase.rpc("create_share_listing", {
          p_name: listing.name,
          p_quantity: listing.quantity,
          p_unit: listing.unit,
          p_pickup_area: listing.location,
          p_exact_address: listing.exactAddress,
          p_destination: listing.destination,
          p_pickup_date: listing.date,
          p_pickup_window: listing.slot,
          p_handling_notes: listing.note,
          p_allergens: listing.allergens,
          p_dietary_notes: listing.dietaryNotes
        }).then(async ({ error }) => {
          if (error) throw error;
          const sharedItemIndex = state.items.findIndex((item) => item.id === state.prefillShare?.itemId);
          if (sharedItemIndex >= 0) {
            const [sharedItem] = state.items.splice(sharedItemIndex, 1);
            state.history.push({ ...sharedItem, disposition: "shared" });
            addEvent(`Moved ${sharedItem.name} to the share board`, "Removed from your food list while pickup is arranged");
            await syncRemoteState();
          }
          state.openShareForm = false;
          state.prefillShare = null;
          await loadRemoteState();
          showToast("Listing posted to the shared board. Its exact address is stored privately.");
        }).catch((error) => showToast(`Could not post listing: ${error.message}`, true));
        return;
      }
      state.listings.unshift(listing);
      const sharedItemIndex = state.items.findIndex((item) => item.id === state.prefillShare?.itemId);
      if (sharedItemIndex >= 0) {
        const [sharedItem] = state.items.splice(sharedItemIndex, 1);
        state.history.push({ ...sharedItem, disposition: "shared" });
        addEvent(`Moved ${sharedItem.name} to the share board`, "Removed from your food list while pickup is arranged");
      }
      state.openShareForm = false;
      state.prefillShare = null;
      addEvent(`Posted ${listing.name}`, `${formatQty(listing.quantity, listing.unit)} · local demo board`);
      persist("Listing added to this local demo board.");
      render(true);
      return;
    }

    if (form.id === "post-need-form") {
      if (!sharedReady || !currentUser) {
        showToast("Sign in to post a shared pantry need.", true);
        return;
      }
      const data = new FormData(form);
      const need = {
        created_by: currentUser.id,
        pantry_name: String(data.get("pantry")).trim(),
        area_label: String(data.get("area")).trim(),
        item: String(data.get("item")).trim(),
        quantity: String(data.get("quantity")).trim(),
        urgency: String(data.get("urgency"))
      };
      supabase.from("pantry_needs").insert(need).then(async ({ error }) => {
        if (error) throw error;
        await loadRemoteState();
        showToast("Pantry need posted to the shared network.");
      }).catch((error) => showToast(`Could not post pantry need: ${error.message}`, true));
      return;
    }

    if (form.id === "log-hours-form") {
      const data = new FormData(form);
      const activity = String(data.get("activity")).trim();
      const hours = Number(data.get("hours"));
      const date = String(data.get("date"));
      if (!activity || !Number.isFinite(hours) || hours < 0.25 || hours > 24) return;
      state.impact.hours += hours;
      addEvent(`Logged ${hours.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")} hr · ${activity}`, `${dateLabel(date)} · ${sharedReady ? "shared account" : "on this device"}`, { date, hours });
      persist(sharedReady ? "Volunteer time added to your shared account log." : "Volunteer time added to your local demo log.");
      render(true);
    }
  });

  renderAccount();
  render();
  initializeSharedBackend().catch((error) => showToast(`Shared service initialization failed: ${error.message}`, true));
})();
