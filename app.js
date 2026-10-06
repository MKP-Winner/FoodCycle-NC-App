"use strict";

(() => {
  const STORAGE_KEY = "foodcycle-nc-demo-v1";
  const app = document.getElementById("app");
  const toast = document.getElementById("toast");
  const todayDate = document.getElementById("today-date");
  const crumbLabel = document.getElementById("crumb-label");
  const activeView = { value: "inventory" };
  const filters = { urgency: "all", category: "All", query: "" };
  let toastTimer;
  let storageAvailable = true;

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
      { id: "s1", name: "Backyard tomatoes", quantity: "20", unit: "lb", location: "Porch pickup · Durham (sample)", destination: "Community fridge · sample", date: nextSaturday(), slot: "9:00–11:00 am", note: "Mixed ripe and almost-ripe fruit. Bring a tote.", claimed: false, pickedUp: false, sample: true },
      { id: "s2", name: "Extra basil bunches", quantity: "6", unit: "bunches", location: "Garden gate · Raleigh (sample)", destination: "School meal program · sample", date: nextSaturday(), slot: "10:00 am–12:00 pm", note: "Cut this morning; water jar provided.", claimed: true, pickedUp: false, sample: true },
      { id: "s3", name: "Summer squash", quantity: "12", unit: "lb", location: "Farm stand · Orange County (sample)", destination: "Food pantry · sample", date: offsetDate(2), slot: "2:00–4:00 pm", note: "Small and medium squash, mixed.", claimed: false, pickedUp: false, sample: true }
    ],
    needs: [
      { id: "n1", pantry: "Demo pantry · East", location: "Sample location · Wake County", item: "Fresh greens", quantity: "8 bunches", urgency: "Needed soon", status: "Available" },
      { id: "n2", pantry: "Demo pantry · South", location: "Sample location · Durham County", item: "Eggs", quantity: "4 dozen", urgency: "Needed this week", status: "Available" },
      { id: "n3", pantry: "Demo pantry · Central", location: "Sample location · Orange County", item: "Shelf-stable milk", quantity: "12 cartons", urgency: "Ongoing need", status: "Available" }
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

  const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);

  const showToast = (message, isError = false) => {
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.toggle("is-error", isError);
    toast.classList.add("is-visible");
    toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 4200);
  };

  const persist = (message) => {
    if (!storageAvailable) {
      showToast("This browser cannot save demo changes. They will be lost when you leave.", true);
      return false;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      if (message) showToast(message);
      return true;
    } catch (error) {
      storageAvailable = false;
      showToast(`Could not save changes in this browser: ${error.message}. The current view is still available.`, true);
      return false;
    }
  };

  const dateLabel = (iso) => new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(new Date(`${iso}T12:00:00`));
  const daysUntil = (iso) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const target = new Date(`${iso}T00:00:00`);
    return Math.round((target - today) / 86400000);
  };
  const formatQty = (amount, unit) => `${amount} ${unit}`;
  const newId = (prefix) => `${prefix}${Date.now()}${Math.random().toString(36).slice(2, 7)}`;
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
        <div class="food-name"><span class="food-marker" data-kind="${escapeHTML(item.category)}" aria-hidden="true"></span><span><strong>${escapeHTML(item.name)}</strong><small>${escapeHTML(item.category)}</small></span></div>
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

  const renderSharing = () => {
    const ordered = [...state.listings].sort((left, right) => Number(left.pickedUp) - Number(right.pickedUp));
    const listingRows = ordered.map((listing) => {
      const status = listing.pickedUp ? "Pickup complete" : listing.claimed ? "Slot claimed" : "Pickup open";
      const statusClass = listing.pickedUp ? "complete" : listing.claimed ? "claimed" : "";
      const action = listing.pickedUp
        ? `<span class="section-count">Complete</span>`
        : listing.claimed
          ? `<button class="button button-lime button-small" type="button" data-action="complete-pickup" data-id="${escapeHTML(listing.id)}">Mark picked up</button>`
          : `<button class="button button-primary button-small" type="button" data-action="claim-pickup" data-id="${escapeHTML(listing.id)}">Claim pickup</button>`;
      return `<article class="share-row">
        <div><h3>${escapeHTML(listing.name)}</h3><p>Pickup: ${escapeHTML(listing.location)}<br>Dropoff: ${escapeHTML(listing.destination || "Local destination · demo")}<br>${escapeHTML(dateLabel(listing.date))} · ${escapeHTML(listing.slot)}</p><span class="share-status ${statusClass}">${status}${listing.sample ? " · sample" : ""}</span></div>
        <div><div class="share-quantity">${escapeHTML(formatQty(listing.quantity, listing.unit))}</div><p>${escapeHTML(listing.note || "Pickup details shared by the grower.")}</p></div>
        <div class="share-actions">${action}</div>
      </article>`;
    }).join("");
    return `<section class="page">
      ${pageHeading("Good food grows better together.", "A neighborhood pickup board for extra garden and farm produce.", `<button class="button button-primary" type="button" data-action="open-listing">${iconPlus} Post a harvest</button>`)}
      <div class="beta-banner"><span class="beta-label">BETA</span><span><strong>Local demo board.</strong> Sample listings are invented for this demo; new posts and pickup claims stay in this browser. No live growers, volunteers, or delivery routes are connected.</span></div>
      <div class="board-grid">
        <div>
          <div class="section-title"><h2>Available to neighbors</h2><span class="section-count">${state.listings.filter((listing) => !listing.claimed && !listing.pickedUp).length} open pickup slots</span></div>
          <details class="add-details" id="post-listing-details" ${state.openShareForm ? "open" : ""}>
            <summary>Post extra produce</summary>
            <form class="form-grid" id="post-listing-form">
              <div class="field"><label for="listing-name">What’s available?</label><input id="listing-name" name="name" required maxlength="70" placeholder="e.g. 20 lb tomatoes"></div>
              <div class="field"><label for="listing-quantity">Amount</label><div class="amount-fields"><input id="listing-quantity" name="quantity" type="number" required min="0.01" step="0.01" placeholder="20"><select name="unit" aria-label="Listing amount unit"><option>lb</option><option>oz</option><option>kg</option><option>g</option><option>boxes</option><option>bunches</option><option>each</option><option>bag</option><option>pint</option><option>carton</option><option>servings</option></select></div></div>
              <div class="field"><label for="listing-location">Pickup place</label><input id="listing-location" name="location" required maxlength="70" placeholder="Porch pickup · town"></div>
              <div class="field"><label for="listing-destination">Delivery destination</label><select id="listing-destination" name="destination"><option>Community fridge · sample</option><option>School meal program · sample</option><option>Food pantry · sample</option></select></div>
              <div class="field"><label for="listing-date">Pickup day</label><input id="listing-date" name="date" type="date" required min="${offsetDate(0)}" value="${nextSaturday()}"></div>
              <div class="field"><label for="listing-slot">Pickup window</label><select id="listing-slot" name="slot"><option>9:00–11:00 am</option><option>11:00 am–1:00 pm</option><option>2:00–4:00 pm</option><option>By arrangement</option></select></div>
              <div class="field"><label for="listing-note">Pickup notes (optional)</label><input id="listing-note" name="note" maxlength="100" placeholder="Bring a tote"></div>
              <div class="form-actions"><button class="button button-primary" type="submit">Post on this device</button></div>
            </form>
          </details>
          <div class="board-list">${listingRows || `<div class="empty-state"><strong>No produce posted yet.</strong>Add a listing to try the local demo pickup flow.</div>`}</div>
        </div>
        <aside class="side-register" aria-label="How the sample pickup board works">
          <h2>From extra to shared</h2><p>One small, local handoff can give good food another place to go.</p>
          <div class="mini-rule"><strong>Growers post what’s ready</strong><span>Share the amount, a pickup place, and a sample school, pantry, or fridge destination.</span></div>
          <div class="mini-rule"><strong>A volunteer claims the slot</strong><span>Try the pickup button. It only changes this local demo.</span></div>
          <div class="mini-rule"><strong>Log the handoff</strong><span>Mark the pickup complete to add an estimated amount to your demo activity.</span></div>
        </aside>
      </div>
    </section>`;
  };

  const renderPantries = () => {
    const rows = state.needs.map((need) => {
      const requested = Boolean(state.requests[need.id]);
      const notified = Boolean(state.notices[need.id]);
      return `<article class="pantry-row">
        <div class="pantry-name"><strong>${escapeHTML(need.pantry)}</strong><small>${escapeHTML(need.location)}</small></div>
        <div class="need-quantity">${escapeHTML(need.item)} · ${escapeHTML(need.quantity)}</div>
        <div class="need-urgency">${requested ? "Request pending in this demo" : escapeHTML(need.urgency)}</div>
        <div class="pantry-actions">
          <button class="button button-outline button-small" type="button" data-action="request-transfer" data-id="${escapeHTML(need.id)}" ${requested ? "disabled" : ""}>${requested ? "Requested" : "Request transfer"}</button>
          <button class="button button-outline button-small" type="button" data-action="notify-clients" data-id="${escapeHTML(need.id)}" ${notified ? "disabled" : ""}>${notified ? "Notice drafted" : "Draft client notice"}</button>
        </div>
      </article>`;
    }).join("");
    return `<section class="page">
      ${pageHeading("A clearer view of what’s needed.", "A sample coordination board for pantry teams to share needs and practice handoffs.")}
      <div class="beta-banner"><span class="beta-label">BETA</span><span><strong>Coordination preview—not live inventory.</strong> All pantry names, needs, and locations are sample entries. Requests and client notices are local drafts; this demo does not contact a pantry or send messages.</span></div>
      <div class="section-title"><h2>Example community needs</h2><span class="section-count">Sample data · ${state.needs.length} entries</span></div>
      <div class="pantry-head" aria-hidden="true"><span>Pantry</span><span>Looking for</span><span>When</span><span>Try a demo action</span></div>
      <div>${rows || `<div class="empty-state"><strong>No sample needs right now.</strong>The pantry coordination board is empty.</div>`}</div>
      <p class="inline-note">Actions above are examples of future coordination—not confirmed transfers, stock levels, or client notifications.</p>
    </section>`;
  };

  const renderImpact = () => {
    const events = [...state.events].reverse();
    const eventRows = events.map((event) => `<li><span>${escapeHTML(event.label)}</span><span>${escapeHTML(event.detail)}</span></li>`).join("");
    const dateMin = offsetDate(-30);
    const dateMax = offsetDate(0);
    return `<section class="page">
      ${pageHeading("Small actions, counted honestly.", "Keep a local record of food used, pickups practiced, and volunteer time logged.")}
      <div class="beta-banner"><span class="beta-label">DEMO</span><span><strong>Illustrative sample totals are not measured community outcomes.</strong> Only actions you try here are saved as on-device demo activity; pound conversions are estimates.</span></div>
      <div class="section-title"><h2>Your actions on this device</h2><span class="section-count">Not shared or verified</span></div>
      <div class="impact-ledger" aria-label="Local demo impact">
        <div class="impact-line"><strong>Estimated food kept in use</strong><span class="impact-number">${state.impact.pounds.toFixed(1)} lb</span><small>From items marked used or pickups completed here.</small></div>
        <div class="impact-line"><strong>Pickup handoffs marked complete</strong><span class="impact-number">${state.impact.pickups}</span><small>Demo actions only; no delivery has been arranged.</small></div>
        <div class="impact-line"><strong>Volunteer hours logged</strong><span class="impact-number">${state.impact.hours.toFixed(1)}</span><small>Entered in this browser; no certificate is issued.</small></div>
        <div class="impact-line"><strong>Pantry transfer requests drafted</strong><span class="impact-number">${state.impact.requests}</span><small>Local requests that did not reach a pantry.</small></div>
      </div>
      <section class="hours-section" aria-labelledby="hours-title">
        <div class="section-title"><h2 id="hours-title">Log volunteer time</h2><span class="section-count">Saved locally</span></div>
        <form class="form-grid hours-entry-form" id="log-hours-form">
          <div class="field"><label for="hours-activity">What did you work on?</label><input id="hours-activity" name="activity" required maxlength="70" placeholder="Packed pantry boxes"></div>
          <div class="field"><label for="hours-amount">Hours</label><input id="hours-amount" name="hours" type="number" required min="0.25" max="24" step="0.25" placeholder="1.5"></div>
          <div class="field"><label for="hours-date">Day</label><input id="hours-date" name="date" type="date" required min="${dateMin}" max="${dateMax}" value="${offsetDate(0)}"></div>
          <div class="form-actions"><button class="button button-primary" type="submit">Log demo hours</button></div>
        </form>
      </section>
      <section class="activity-section" aria-labelledby="activity-title">
        <div class="section-title"><h2 id="activity-title">Recent local activity</h2><span class="section-count">${events.length} entries</span></div>
        <ul class="event-list">${eventRows || `<li><span>No demo activity yet.</span><span>Try an action to get started.</span></li>`}</ul>
      </section>
      <p class="inline-note">The sample mode demonstrates how volunteer hours and food quantities might be recorded. No partners, families, or delivery outcomes are claimed.</p>
    </section>`;
  };

  const render = (moveFocus = false) => {
    const views = {
      inventory: { label: "YOUR FOOD", html: renderInventory() },
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

  const addEvent = (label, detail) => {
    state.events.push({ id: `e${Date.now()}${Math.random().toString(36).slice(2, 6)}`, label, detail });
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
    const id = action.dataset.id;

    switch (action.dataset.action) {
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
        addEvent(`Used ${item.name}`, `${pounds > 0 ? `${pounds.toFixed(1)} estimated lb` : formatQty(item.amount, item.unit)} · on this device`);
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
        const listing = state.listings.find((entry) => entry.id === id);
        if (!listing || listing.claimed || listing.pickedUp) return;
        listing.claimed = true;
        addEvent(`Claimed ${listing.name}`, "Pickup slot held in local demo");
        persist("Pickup claimed in this local demo.");
        render(true);
        break;
      }
      case "complete-pickup": {
        const listing = state.listings.find((entry) => entry.id === id);
        if (!listing || !listing.claimed || listing.pickedUp) return;
        listing.pickedUp = true;
        const pounds = amountToPounds(listing.quantity, listing.unit);
        state.impact.pounds += pounds;
        state.impact.pickups += 1;
        addEvent(`Marked pickup complete: ${listing.name}`, `${pounds > 0 ? `${pounds.toFixed(1)} estimated lb` : formatQty(listing.quantity, listing.unit)} · demo only`);
        persist("Pickup marked complete in your local demo log.");
        render(true);
        break;
      }
      case "request-transfer": {
        if (state.requests[id]) return;
        state.requests[id] = true;
        state.impact.requests += 1;
        const need = state.needs.find((entry) => entry.id === id);
        if (need) addEvent(`Drafted transfer request: ${need.item}`, "Pending locally; no pantry was contacted");
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
        storageAvailable = true;
        filters.urgency = "all";
        filters.category = "All";
        filters.query = "";
        state.openShareForm = false;
        persist("Sample data restored.");
        setView("inventory");
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
      addEvent(`Added ${item.name} to the food list`, `${formatQty(item.amount, item.unit)} · on this device`);
      persist(`${item.name} added to your food list.`);
      filters.category = "All";
      filters.urgency = "all";
      filters.query = "";
      render(true);
      return;
    }

    if (form.id === "post-listing-form") {
      const data = new FormData(form);
      const listing = {
        id: newId("s"),
        name: String(data.get("name")).trim(),
        quantity: String(data.get("quantity")),
        unit: String(data.get("unit")),
        location: String(data.get("location")).trim(),
        destination: String(data.get("destination")),
        date: String(data.get("date")),
        slot: String(data.get("slot")),
        note: String(data.get("note")).trim(),
        claimed: false,
        pickedUp: false,
        sample: false
      };
      if (!listing.name || !listing.location || !listing.date) return;
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

    if (form.id === "log-hours-form") {
      const data = new FormData(form);
      const activity = String(data.get("activity")).trim();
      const hours = Number(data.get("hours"));
      const date = String(data.get("date"));
      if (!activity || !Number.isFinite(hours) || hours < 0.25 || hours > 24) return;
      state.impact.hours += hours;
      addEvent(`Logged ${hours.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")} hr · ${activity}`, `${dateLabel(date)} · on this device`);
      persist("Volunteer time added to your local demo log.");
      render(true);
    }
  });

  render();
})();
