// ============================================
// CONFIGURATION
// ============================================
const BACKEND_URL =
  window.location.hostname === "localhost"
    ? "http://localhost:3000"
    : "https://insighta-stage3-backend.vercel.app";

const STATE_KEY = "insighta_oauth_state";
const CALLBACK_PARAMS = ["code", "state"];

// ============================================
// APPLICATION STATE
// ============================================
let appState = {
  user: null,
  accessToken: null,
  currentPage: 1,
  totalPages: 1,
  filters: {
    gender: "",
    country_id: "",
    age_group: "",
  },
};

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener("DOMContentLoaded", () => {
  console.log("🚀 Insighta Labs+ Portal loaded");

  // Check if this is an OAuth callback
  handleOAuthCallback();

  // Check for existing credentials
  const token = getStoredToken();
  if (token) {
    showDashboard();
  } else {
    showLogin();
  }

  // Event listeners
  document
    .getElementById("githubLoginBtn")
    .addEventListener("click", initiateLogin);
  document.getElementById("logoutBtn").addEventListener("click", logout);
  document
    .getElementById("searchBtn")
    .addEventListener("click", searchProfiles);
  document.getElementById("resetBtn").addEventListener("click", resetFilters);
  document
    .getElementById("exportCsvBtn")
    .addEventListener("click", exportProfiles);
});

// ============================================
// OAUTH FLOW
// ============================================
async function initiateLogin() {
  try {
    // Generate state for CSRF protection
    const state = generateRandomString(32);
    sessionStorage.setItem(STATE_KEY, state);

    // Get auth URL from backend
    const response = await fetch(`${BACKEND_URL}/auth/github`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });

    const data = await response.json();

    if (!data.authUrl) {
      throw new Error("Failed to get authorization URL");
    }

    // Add state and redirect_uri parameters
    const authUrl = new URL(data.authUrl);
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set(
      "redirect_uri",
      `${window.location.origin}/index.html?code=__CODE__&state=${state}`,
    );

    window.location.href = data.authUrl;
  } catch (error) {
    showError(`Login failed: ${error.message}`);
  }
}

function handleOAuthCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const state = params.get("state");

  if (!code || !state) {
    return;
  }

  // Show callback view
  showCallbackView();

  // Verify state
  const storedState = sessionStorage.getItem(STATE_KEY);
  if (state !== storedState) {
    showError("OAuth state mismatch - possible CSRF attack");
    return;
  }

  completeOAuth(code, state);
}

async function completeOAuth(code, state) {
  try {
    const response = await fetch(
      `${BACKEND_URL}/auth/github/callback?code=${code}&state=${state}`,
      {
        method: "GET",
        credentials: "include",
      },
    );

    if (!response.ok) {
      throw new Error(`OAuth failed: ${response.statusText}`);
    }

    const data = await response.json();

    // Store token
    storeToken(data.accessToken);
    appState.user = data.user;
    appState.accessToken = data.accessToken;

    // Clean up URL
    window.history.replaceState({}, document.title, window.location.pathname);

    // Show dashboard after 1 second
    setTimeout(() => {
      showDashboard();
      showSuccess("✅ Successfully logged in!");
    }, 1000);
  } catch (error) {
    showError(`Authentication failed: ${error.message}`);
    setTimeout(() => showLogin(), 2000);
  }
}

async function logout() {
  try {
    // Notify backend
    const token = getStoredToken();
    await fetch(`${BACKEND_URL}/auth/logout`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      credentials: "include",
    }).catch(() => {
      // Ignore errors on logout
    });

    clearStoredToken();
    appState = {
      user: null,
      accessToken: null,
      currentPage: 1,
      totalPages: 1,
      filters: { gender: "", country_id: "", age_group: "" },
    };

    showLogin();
    showSuccess("Logged out successfully");
  } catch (error) {
    console.error("Logout error:", error);
    clearStoredToken();
    showLogin();
  }
}

// ============================================
// PROFILE OPERATIONS
// ============================================
async function searchProfiles() {
  try {
    const token = getStoredToken();
    if (!token) {
      showError("Not authenticated");
      return;
    }

    // Show loading
    document.getElementById("loadingSpinner").style.display = "block";
    document.getElementById("profilesTable").innerHTML = "";

    // Gather filters
    const filters = {
      gender: document.getElementById("genderFilter").value,
      country_id: document.getElementById("countryFilter").value,
      age_group: document.getElementById("ageGroupFilter").value,
      page: appState.currentPage,
      limit: 20,
    };

    // Fetch profiles
    const queryParams = new URLSearchParams(filters);
    const response = await fetch(
      `${BACKEND_URL}/api/v1/profiles?${queryParams}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        credentials: "include",
      },
    );

    if (!response.ok) {
      if (response.status === 401) {
        clearStoredToken();
        showLogin();
        throw new Error("Session expired");
      }
      throw new Error(`Search failed: ${response.statusText}`);
    }

    const data = await response.json();

    // Update state
    appState.filters = filters;
    appState.totalPages = data.pagination.totalPages;

    // Display results
    displayProfiles(data.data);
    displayPagination(data.pagination);

    if (data.data.length === 0) {
      showInfo("No profiles found matching your filters");
    }
  } catch (error) {
    showError(error.message);
  } finally {
    document.getElementById("loadingSpinner").style.display = "none";
  }
}

function displayProfiles(profiles) {
  const container = document.getElementById("profilesTable");

  if (profiles.length === 0) {
    container.innerHTML =
      '<p style="text-align: center; color: var(--text-light);">No results</p>';
    return;
  }

  const table = document.createElement("table");
  table.innerHTML = `
    <thead>
      <tr>
        <th>Name</th>
        <th>Gender</th>
        <th>Age Group</th>
        <th>Country</th>
        <th>ID</th>
      </tr>
    </thead>
    <tbody>
      ${profiles
        .map(
          (p) => `
        <tr>
          <td>${escapeHtml(p.name)}</td>
          <td>${escapeHtml(p.gender || "-")}</td>
          <td>${escapeHtml(p.age_group || "-")}</td>
          <td>${escapeHtml(p.country_id || "-")}</td>
          <td><code style="font-size: 11px;">${p.id.slice(0, 8)}...</code></td>
        </tr>
      `,
        )
        .join("")}
    </tbody>
  `;

  container.innerHTML = "";
  container.appendChild(table);
}

function displayPagination(pagination) {
  const container = document.getElementById("paginationControls");
  const { page, totalPages } = pagination;

  let html = "";

  // Previous button
  if (page > 1) {
    html += `<button onclick="goToPage(${page - 1})">← Previous</button>`;
  }

  // Page numbers
  for (
    let i = Math.max(1, page - 2);
    i <= Math.min(totalPages, page + 2);
    i++
  ) {
    if (i === page) {
      html += `<button class="active" disabled>${i}</button>`;
    } else {
      html += `<button onclick="goToPage(${i})">${i}</button>`;
    }
  }

  // Next button
  if (page < totalPages) {
    html += `<button onclick="goToPage(${page + 1})">Next →</button>`;
  }

  if (totalPages > 1) {
    html += `<span>Page ${page} of ${totalPages}</span>`;
  }

  container.innerHTML = html;
}

function goToPage(page) {
  appState.currentPage = page;
  searchProfiles();
}

function resetFilters() {
  document.getElementById("genderFilter").value = "";
  document.getElementById("countryFilter").value = "";
  document.getElementById("ageGroupFilter").value = "";
  appState.currentPage = 1;
  searchProfiles();
}

async function exportProfiles() {
  try {
    const token = getStoredToken();
    if (!token) {
      showError("Not authenticated");
      return;
    }

    showInfo("Preparing export...");

    const filters = {
      gender: document.getElementById("genderFilter").value,
      country_id: document.getElementById("countryFilter").value,
      age_group: document.getElementById("ageGroupFilter").value,
      limit: 1000,
    };

    const queryParams = new URLSearchParams(filters);
    const response = await fetch(
      `${BACKEND_URL}/api/v1/profiles?${queryParams}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        credentials: "include",
      },
    );

    if (!response.ok) {
      throw new Error(`Export failed: ${response.statusText}`);
    }

    const data = await response.json();
    const csv = generateCSV(data.data);
    downloadCSV(csv, `profiles_${Date.now()}.csv`);

    showSuccess(`✅ Exported ${data.data.length} profiles`);
  } catch (error) {
    showError(error.message);
  }
}

function generateCSV(profiles) {
  const headers = ["ID", "Name", "Gender", "Age Group", "Country"];
  const rows = profiles.map((p) => [
    p.id,
    p.name,
    p.gender || "",
    p.age_group || "",
    p.country_id || "",
  ]);

  const csv = [
    headers.join(","),
    ...rows.map((r) => r.map((v) => `"${v}"`).join(",")),
  ].join("\n");

  return csv;
}

function downloadCSV(csv, filename) {
  const blob = new Blob([csv], { type: "text/csv" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

// ============================================
// UI MANAGEMENT
// ============================================
function showLogin() {
  document.getElementById("loginView").style.display = "flex";
  document.getElementById("dashboardView").style.display = "none";
  document.getElementById("callbackView").style.display = "none";
}

function showDashboard() {
  document.getElementById("loginView").style.display = "none";
  document.getElementById("dashboardView").style.display = "block";
  document.getElementById("callbackView").style.display = "none";

  const token = getStoredToken();
  if (token) {
    loadUserInfo();
  }
}

function showCallbackView() {
  document.getElementById("loginView").style.display = "none";
  document.getElementById("dashboardView").style.display = "none";
  document.getElementById("callbackView").style.display = "flex";
}

async function loadUserInfo() {
  try {
    const token = getStoredToken();
    if (!token) return;

    const response = await fetch(`${BACKEND_URL}/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      credentials: "include",
    });

    if (!response.ok) {
      if (response.status === 401) {
        clearStoredToken();
        showLogin();
      }
      return;
    }

    const data = await response.json();
    const user = data.data;

    // Display user info in navbar
    document.getElementById("userDisplay").textContent =
      `👤 ${user.github_username} (${user.role})`;

    // Display detailed user info in sidebar
    const userInfo = document.getElementById("userInfo");
    userInfo.innerHTML = `
      <div class="user-info-item">
        <span class="user-info-label">Username:</span>
        <span class="user-info-value">${escapeHtml(user.github_username)}</span>
      </div>
      <div class="user-info-item">
        <span class="user-info-label">Email:</span>
        <span class="user-info-value">${escapeHtml(user.email || "N/A")}</span>
      </div>
      <div class="user-info-item">
        <span class="user-info-label">Role:</span>
        <span class="user-info-value">${escapeHtml(user.role)}</span>
      </div>
      <div class="user-info-item">
        <span class="user-info-label">Joined:</span>
        <span class="user-info-value">${new Date(user.created_at).toLocaleDateString()}</span>
      </div>
    `;

    // Show admin section if admin
    if (user.role === "admin") {
      document.getElementById("adminOnly").style.display = "block";
    }

    // Display permissions
    const permissions = document.getElementById("permissionsList");
    const perms = [
      "✓ View Profiles",
      user.role === "admin" ? "✓ Create Profiles" : null,
      user.role === "admin" ? "✓ Delete Profiles" : null,
      "✓ Search & Filter",
      "✓ Export CSV",
    ].filter(Boolean);

    permissions.innerHTML = perms.map((p) => `<li>${p}</li>`).join("");

    appState.user = user;
  } catch (error) {
    console.error("Failed to load user info:", error);
  }
}

// ============================================
// NOTIFICATIONS
// ============================================
function showSuccess(message) {
  console.log("✅", message);
}

function showError(message) {
  console.error("❌", message);
  alert(message);
}

function showInfo(message) {
  console.info("ℹ️", message);
}

// ============================================
// UTILITIES
// ============================================
function generateRandomString(length) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function storeToken(token) {
  localStorage.setItem("insighta_token", token);
}

function getStoredToken() {
  return localStorage.getItem("insighta_token");
}

function clearStoredToken() {
  localStorage.removeItem("insighta_token");
}
