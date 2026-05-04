function readStoredJson(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    localStorage.removeItem(key);
    return fallback;
  }
}

let cart = readStoredJson("cart", []);
let selectedOrderMode = localStorage.getItem("orderMode") || "Delivery";
let motionEnabled = localStorage.getItem("motionEnabled") !== "false";
let selectedTheme = localStorage.getItem("themePreference") || "classic";
let compactMenuEnabled = localStorage.getItem("compactMenu") === "true";
let orderAlertsEnabled = localStorage.getItem("orderAlerts") !== "false";
let checkoutMemoryEnabled = localStorage.getItem("checkoutMemory") === "true";
const API_BASE_URL = "http://127.0.0.1:8000";
let openOverlayCount = 0;

if (!checkoutMemoryEnabled) {
  localStorage.removeItem("customerDetails");
}

function lockPageScroll() {
  openOverlayCount += 1;
  document.body.classList.add("modal-open-lock");
}

function unlockPageScroll() {
  openOverlayCount = Math.max(0, openOverlayCount - 1);
  if (openOverlayCount === 0) {
    document.body.classList.remove("modal-open-lock");
  }
}

function saveCart() {
  localStorage.setItem("cart", JSON.stringify(cart));
}

function logout() {
  localStorage.removeItem("customerSession");
  localStorage.removeItem("isLoggedIn");
  localStorage.removeItem("loggedInUser");
  localStorage.removeItem("cart");
  localStorage.removeItem("customerDetails");
  window.location.href = "login.html";
}

function getCustomerSession() {
  const session = readStoredJson("customerSession", null);
  if (session && session.role === "customer") return session;

  const legacyUser = readStoredJson("loggedInUser", {});
  if (localStorage.getItem("isLoggedIn") === "true") {
    return {
      role: "customer",
      user: legacyUser
    };
  }

  return null;
}

function setLoggedInUserName() {
  const welcomeUser = document.getElementById("welcomeUser");
  const quickMenuUser = document.getElementById("quickMenuUser");
  const session = getCustomerSession();
  const loggedInUser = session?.user || {};

  if (welcomeUser && loggedInUser.name) {
    welcomeUser.textContent = `Hi, ${loggedInUser.name}`;
  }

  if (quickMenuUser) {
    quickMenuUser.textContent = loggedInUser.name ? `Hi, ${loggedInUser.name}` : "Guest";
  }

  const bookingName = document.getElementById("bookingName");
  const bookingPhone = document.getElementById("bookingPhone");

  if (bookingName && loggedInUser.name) {
    bookingName.value = loggedInUser.name;
  }

  if (bookingPhone && loggedInUser.phone) {
    bookingPhone.value = loggedInUser.phone;
  }
}

function addToCart(name, price, id) {
  const existingItem = cart.find(item => item.id === id);

  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    cart.push({
      id: id,
      name: name,
      price: Number(price),
      quantity: 1
    });
  }

  saveCart();
  updateOrders();
  updateCartButtons();
  showAddedMessage();
}

function increaseQuantityById(id) {
  const item = cart.find(product => product.id === id);
  if (item) {
    item.quantity += 1;
    saveCart();
    updateOrders();
    updateCartButtons();
  }
}

function decreaseQuantityById(id) {
  const itemIndex = cart.findIndex(product => product.id === id);

  if (itemIndex !== -1) {
    if (cart[itemIndex].quantity > 1) {
      cart[itemIndex].quantity -= 1;
    } else {
      cart.splice(itemIndex, 1);
    }

    saveCart();
    updateOrders();
    updateCartButtons();
  }
}

function updateCartButtons() {
  const actionBoxes = document.querySelectorAll(".cart-action");

  actionBoxes.forEach(box => {
    const id = box.dataset.id;
    const name = box.dataset.name;
    const price = box.dataset.price;
    const item = cart.find(product => product.id === id);

    if (item) {
      box.innerHTML = `
        <div class="quantity-box">
          <button class="qty-btn" onclick="decreaseQuantityById('${id}')">-</button>
          <span class="qty-count">${item.quantity}</span>
          <button class="qty-btn" onclick="increaseQuantityById('${id}')">+</button>
        </div>
      `;
    } else {
      box.innerHTML = `
        <button class="btn btn-warning btn-order w-100 add-btn"
          onclick="addToCart('${name.replace(/'/g, "\\'")}', ${price}, '${id}')">
          Add to Order
        </button>
      `;
    }
  });
}

function updateOrders() {
  const orderList = document.getElementById("orderList");
  const cartCount = document.getElementById("cartCount");
  const totalPrice = document.getElementById("totalPrice");
  const emptyOrderText = document.getElementById("emptyOrderText");

  let total = 0;
  let totalItems = 0;

  if (orderList) {
    orderList.innerHTML = "";
  }

  if (emptyOrderText) {
    emptyOrderText.style.display = cart.length === 0 ? "block" : "none";
  }

  cart.forEach((item, index) => {
    const itemTotal = item.price * item.quantity;
    total += itemTotal;
    totalItems += item.quantity;

    if (!orderList) return;

    const li = document.createElement("li");
    li.className = "cart-panel-item";

    li.innerHTML = `
      <div class="order-item">
        <div>
          <div class="order-name">${item.name}</div>
          <div class="order-price">₹${item.price} × ${item.quantity} = ₹${itemTotal}</div>
        </div>

        <div class="qty-controls">
          <button class="qty-btn small-btn" onclick="decreaseQuantity(${index})">-</button>
          <span class="qty-number">${item.quantity}</span>
          <button class="qty-btn small-btn" onclick="increaseQuantity(${index})">+</button>
          <button class="remove-btn" onclick="removeItem(${index})">Remove</button>
        </div>
      </div>
    `;

    orderList.appendChild(li);
  });

  if (cartCount) cartCount.innerText = totalItems;
  if (totalPrice) totalPrice.innerText = total;
}

function increaseQuantity(index) {
  cart[index].quantity += 1;
  saveCart();
  updateOrders();
  updateCartButtons();
}

function decreaseQuantity(index) {
  if (cart[index].quantity > 1) {
    cart[index].quantity -= 1;
  } else {
    cart.splice(index, 1);
  }

  saveCart();
  updateOrders();
  updateCartButtons();
}

function removeItem(index) {
  cart.splice(index, 1);
  saveCart();
  updateOrders();
  updateCartButtons();
}

function clearCart() {
  cart = [];
  saveCart();
  updateOrders();
  updateCartButtons();
  updatePreferenceLabels();
}

function openCartPanel() {
  const panel = document.getElementById("cartPanel");
  if (panel && !panel.classList.contains("show")) {
    panel.classList.add("show");
    lockPageScroll();
    updateOrders();
  }
}

function closeCartPanel() {
  const panel = document.getElementById("cartPanel");
  if (panel && panel.classList.contains("show")) {
    panel.classList.remove("show");
    unlockPageScroll();
  }
}

function goToCustomerPage() {
  if (cart.length === 0) {
    alert("Your order is empty!");
    return;
  }

  window.location.href = "customer.html";
}

function scrollToMenu() {
  const menuSection = document.getElementById("menuSection");
  if (menuSection) {
    menuSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function filterAndScroll(category) {
  filterMenu(category);
  scrollToMenu();
}

function filterMenu(category) {
  const items = document.querySelectorAll(".menu-item");
  const filterButtons = document.querySelectorAll(".filter-btn");

  filterButtons.forEach(button => {
    const buttonAction = button.getAttribute("onclick") || "";
    const isActive = buttonAction.includes(`'${category}'`);
    button.classList.toggle("btn-warning", isActive);
    button.classList.toggle("btn-outline-warning", !isActive);
  });

  items.forEach(item => {
    if (category === "all" || item.dataset.category === category) {
      item.style.display = "block";
    } else {
      item.style.display = "none";
    }
  });
}

function selectOrderMode(button, mode) {
  selectedOrderMode = mode;
  localStorage.setItem("orderMode", mode);

  document.querySelectorAll(".mode-chip").forEach(chip => {
    chip.classList.remove("active");
  });

  if (button) {
    button.classList.add("active");
  }

  updatePreferenceLabels();
}

function initOrderMode() {
  document.querySelectorAll(".mode-chip").forEach(chip => {
    chip.classList.toggle("active", chip.textContent.trim() === selectedOrderMode);
  });

  updatePreferenceLabels();
}

function showAddedMessage() {
  const alertBox = document.getElementById("orderAlert");
  if (alertBox && orderAlertsEnabled) {
    alertBox.classList.remove("d-none");
    setTimeout(() => {
      alertBox.classList.add("d-none");
    }, 1000);
  }
}

function openBookingModal() {
  const modal = document.getElementById("bookingModal");
  if (modal && modal.style.display !== "flex") {
    modal.style.display = "flex";
    lockPageScroll();
  }
}

function closeBookingModal() {
  const modal = document.getElementById("bookingModal");
  if (modal && modal.style.display !== "none") {
    modal.style.display = "none";
    unlockPageScroll();
  }
}

function openSupportModal() {
  const modal = document.getElementById("supportModal");
  if (modal && modal.style.display !== "flex") {
    modal.style.display = "flex";
    lockPageScroll();
  }
}

function closeSupportModal() {
  const modal = document.getElementById("supportModal");
  if (modal && modal.style.display !== "none") {
    modal.style.display = "none";
    unlockPageScroll();
  }
}

function openFeedbackModal() {
  closeSupportModal();
  const modal = document.getElementById("feedbackModal");
  if (modal) {
    modal.style.display = "flex";
  }
}

function closeFeedbackModal() {
  const modal = document.getElementById("feedbackModal");
  if (modal && modal.style.display !== "none") {
    modal.style.display = "none";
    unlockPageScroll();
  }
}

function openQuickMenu() {
  const menu = document.getElementById("quickMenu");
  if (menu && !menu.classList.contains("show")) {
    updatePreferenceLabels();
    menu.classList.add("show");
    lockPageScroll();
  }
}

function closeQuickMenu() {
  const menu = document.getElementById("quickMenu");
  if (menu && menu.classList.contains("show")) {
    menu.classList.remove("show");
    unlockPageScroll();
  }
}

function openSupportFromMenu() {
  closeQuickMenu();
  openSupportModal();
}

function openFeedbackFromMenu() {
  closeQuickMenu();
  openFeedbackModal();
}

function openSettingsModal() {
  const modal = document.getElementById("settingsModal");
  if (modal && modal.style.display !== "flex") {
    updatePreferenceLabels();
    modal.style.display = "flex";
    lockPageScroll();
  }
}

function closeSettingsModal() {
  const modal = document.getElementById("settingsModal");
  if (modal && modal.style.display !== "none") {
    modal.style.display = "none";
    unlockPageScroll();
  }
}

function openSettingsFromMenu() {
  closeQuickMenu();
  openSettingsModal();
}

function openBookingFromMenu() {
  closeQuickMenu();
  openBookingModal();
}

function openCartFromMenu() {
  closeQuickMenu();
  openCartPanel();
}

function openDealsFromMenu() {
  closeQuickMenu();
  filterAndScroll("combo");
}

function openLiveDeliveryFromMenu() {
  closeQuickMenu();
  const orderId = localStorage.getItem("lastOrderId");
  window.location.href = orderId ? `tracking.html?order=${orderId}` : "tracking.html";
}

function openAiAssistantModal() {
  const modal = document.getElementById("aiAssistantModal");
  if (modal && modal.style.display !== "flex") {
    modal.style.display = "flex";
    lockPageScroll();
    const input = document.getElementById("aiAssistantInput");
    if (input) input.focus();
  }
}

function closeAiAssistantModal() {
  const modal = document.getElementById("aiAssistantModal");
  if (modal && modal.style.display !== "none") {
    modal.style.display = "none";
    unlockPageScroll();
  }
}

function openAiAssistantFromMenu() {
  closeQuickMenu();
  openAiAssistantModal();
}

function setPreferredOrderMode(mode) {
  const button = Array.from(document.querySelectorAll(".mode-chip")).find(chip => {
    return chip.textContent.trim() === mode;
  });

  selectOrderMode(button, mode);
}

function toggleMotionSetting(isEnabled) {
  motionEnabled = isEnabled;
  localStorage.setItem("motionEnabled", String(isEnabled));
  document.body.classList.toggle("motion-paused", !isEnabled);
}

function setThemePreference(theme) {
  selectedTheme = theme;
  localStorage.setItem("themePreference", theme);
  applyThemePreference();
  updatePreferenceLabels();
}

function applyThemePreference() {
  document.body.classList.remove("theme-spice", "theme-midnight");

  if (selectedTheme === "spice") {
    document.body.classList.add("theme-spice");
  }

  if (selectedTheme === "midnight") {
    document.body.classList.add("theme-midnight");
  }
}

function toggleCompactMenu(isEnabled) {
  compactMenuEnabled = isEnabled;
  localStorage.setItem("compactMenu", String(isEnabled));
  document.body.classList.toggle("compact-menu", isEnabled);
  updatePreferenceLabels();
}

function toggleOrderAlerts(isEnabled) {
  orderAlertsEnabled = isEnabled;
  localStorage.setItem("orderAlerts", String(isEnabled));
  updatePreferenceLabels();
}

function toggleCheckoutMemory(isEnabled) {
  checkoutMemoryEnabled = isEnabled;
  localStorage.setItem("checkoutMemory", String(isEnabled));

  if (!isEnabled) {
    localStorage.removeItem("customerDetails");
  }

  updatePreferenceLabels();
}

function clearCartFromSettings() {
  clearCart();
  const settingsCartStatus = document.getElementById("settingsCartStatus");
  if (settingsCartStatus) {
    settingsCartStatus.textContent = "Bag cleared";
  }
}

function resetPreferences() {
  selectedOrderMode = "Delivery";
  motionEnabled = true;
  selectedTheme = "classic";
  compactMenuEnabled = false;
  orderAlertsEnabled = true;
  checkoutMemoryEnabled = false;

  localStorage.setItem("orderMode", selectedOrderMode);
  localStorage.setItem("motionEnabled", "true");
  localStorage.setItem("themePreference", selectedTheme);
  localStorage.setItem("compactMenu", "false");
  localStorage.setItem("orderAlerts", "true");
  localStorage.setItem("checkoutMemory", "false");
  localStorage.removeItem("customerDetails");

  applyThemePreference();
  document.body.classList.remove("compact-menu", "motion-paused");
  initOrderMode();
  updatePreferenceLabels();
}

function updatePreferenceLabels() {
  const quickMenuMode = document.getElementById("quickMenuMode");
  const settingsOrderMode = document.getElementById("settingsOrderMode");
  const motionToggle = document.getElementById("motionToggle");
  const compactMenuToggle = document.getElementById("compactMenuToggle");
  const alertsToggle = document.getElementById("alertsToggle");
  const checkoutMemoryToggle = document.getElementById("checkoutMemoryToggle");
  const settingsThemeName = document.getElementById("settingsThemeName");
  const settingsCartStatus = document.getElementById("settingsCartStatus");
  const themeNames = {
    classic: "Classic Feast",
    spice: "Spice Market",
    midnight: "Midnight Dine"
  };

  if (quickMenuMode) quickMenuMode.textContent = selectedOrderMode;
  if (settingsOrderMode) settingsOrderMode.textContent = selectedOrderMode;
  if (motionToggle) motionToggle.checked = motionEnabled;
  if (compactMenuToggle) compactMenuToggle.checked = compactMenuEnabled;
  if (alertsToggle) alertsToggle.checked = orderAlertsEnabled;
  if (checkoutMemoryToggle) checkoutMemoryToggle.checked = checkoutMemoryEnabled;
  if (settingsThemeName) settingsThemeName.textContent = themeNames[selectedTheme] || themeNames.classic;
  if (settingsCartStatus) {
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    settingsCartStatus.textContent = `${totalItems} item${totalItems === 1 ? "" : "s"} in My Bag`;
  }

  document.body.classList.toggle("motion-paused", !motionEnabled);
  document.body.classList.toggle("compact-menu", compactMenuEnabled);

  document.querySelectorAll(".theme-buttons button").forEach(button => {
    button.classList.toggle("active-setting", button.textContent.trim().toLowerCase().startsWith(selectedTheme));
  });

  document.querySelectorAll(".settings-mode-buttons:not(.theme-buttons) button").forEach(button => {
    const mode = button.textContent.trim();
    button.classList.toggle("active-setting", mode === selectedOrderMode);
  });
}

function showFeedbackToast(message, type = "success") {
  const toast = document.getElementById("feedbackToast");
  if (!toast) return;

  toast.textContent = message;
  toast.className = `feedback-toast show ${type}`;
}

function addAiChatMessage(message, sender) {
  const chatWindow = document.getElementById("aiChatWindow");
  if (!chatWindow) return;

  const messageBubble = document.createElement("div");
  messageBubble.className = `ai-message ${sender}`;
  messageBubble.textContent = message;
  chatWindow.appendChild(messageBubble);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function showAiAssistantToast(message, type = "error") {
  const toast = document.getElementById("aiAssistantToast");
  if (!toast) return;

  if (!message) {
    toast.textContent = "";
    toast.className = "feedback-toast";
    return;
  }

  toast.textContent = message;
  toast.className = `feedback-toast show ${type}`;
}

async function sendAiAssistantMessage() {
  const input = document.getElementById("aiAssistantInput");
  if (!input) return;

  const message = input.value.trim();
  if (!message) {
    showAiAssistantToast("Please type a question for AI Chef.", "error");
    return;
  }

  input.value = "";
  showAiAssistantToast("");
  addAiChatMessage(message, "user");
  addAiChatMessage("Thinking...", "assistant");

  try {
    const response = await fetch(`${API_BASE_URL}/ai/menu-assistant`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message,
        order_mode: selectedOrderMode,
        cart_items: cart
      })
    });

    const result = await response.json();
    const chatWindow = document.getElementById("aiChatWindow");
    const loadingMessage = chatWindow ? chatWindow.lastElementChild : null;

    if (!response.ok) {
      throw new Error(result.detail || "AI Chef is not available.");
    }

    if (loadingMessage) {
      loadingMessage.textContent = result.reply;
    }

    showAiAssistantToast("");
  } catch (error) {
    const chatWindow = document.getElementById("aiChatWindow");
    const loadingMessage = chatWindow ? chatWindow.lastElementChild : null;
    if (loadingMessage) {
      loadingMessage.textContent = "AI Chef is using local suggestions now. Add OPENAI_API_KEY in backend for smarter replies.";
    }
    showAiAssistantToast(error.message, "error");
  }
}

function submitFeedback() {
  const ratingInput = document.getElementById("feedbackRating");
  const typeInput = document.getElementById("feedbackType");
  const messageInput = document.getElementById("feedbackMessage");

  const rating = ratingInput ? ratingInput.value : "";
  const feedbackType = typeInput ? typeInput.value : "App Experience";
  const message = messageInput ? messageInput.value.trim() : "";

  if (!rating || !message) {
    showFeedbackToast("Please select a rating and enter your feedback.", "error");
    return;
  }

  const session = getCustomerSession();
  const loggedInUser = session?.user || {};
  const feedbackList = readStoredJson("feedbacks", []);

  feedbackList.push({
    rating,
    feedbackType,
    message,
    name: loggedInUser.name || "Guest",
    phone: loggedInUser.phone || "",
    createdAt: new Date().toISOString()
  });

  localStorage.setItem("feedbacks", JSON.stringify(feedbackList));

  if (ratingInput) ratingInput.value = "";
  if (typeInput) typeInput.value = "Food";
  if (messageInput) messageInput.value = "";

  showFeedbackToast("Thanks! Your feedback has been saved.", "success");
}

async function submitBooking() {
  const name = document.getElementById("bookingName").value.trim();
  const phone = document.getElementById("bookingPhone").value.trim();
  const booking_date = document.getElementById("bookingDate").value;
  const booking_time = document.getElementById("bookingTime").value;
  const guests = parseInt(document.getElementById("bookingGuests").value);

  if (!name || !phone || !booking_date || !booking_time || !guests) {
    alert("Please fill all table booking details.");
    return;
  }

  const payload = {
    name,
    phone,
    booking_date,
    booking_time,
    guests
  };

  try {
    const response = await fetch("http://127.0.0.1:8000/bookings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.detail || "Booking failed");
    }

    alert("Table booked successfully! Booking ID: " + result.booking_id);
    closeBookingModal();

    document.getElementById("bookingDate").value = "";
    document.getElementById("bookingTime").value = "";
    document.getElementById("bookingGuests").value = "";
  } catch (error) {
    console.error(error);
    alert("Backend connection failed for table booking.");
  }
}

window.addEventListener("click", function (e) {
  const modal = document.getElementById("bookingModal");
  if (e.target === modal) {
    closeBookingModal();
  }

  const cartPanel = document.getElementById("cartPanel");
  if (e.target === cartPanel) {
    closeCartPanel();
  }

  const supportModal = document.getElementById("supportModal");
  if (e.target === supportModal) {
    closeSupportModal();
  }

  const feedbackModal = document.getElementById("feedbackModal");
  if (e.target === feedbackModal) {
    closeFeedbackModal();
  }

  const quickMenu = document.getElementById("quickMenu");
  if (e.target === quickMenu) {
    closeQuickMenu();
  }

  const settingsModal = document.getElementById("settingsModal");
  if (e.target === settingsModal) {
    closeSettingsModal();
  }

  const aiAssistantModal = document.getElementById("aiAssistantModal");
  if (e.target === aiAssistantModal) {
    closeAiAssistantModal();
  }
});

const searchInput = document.getElementById("searchInput");

if (searchInput) {
  searchInput.addEventListener("keyup", function () {
    const searchValue = this.value.toLowerCase();
    const items = document.querySelectorAll(".menu-item");

    items.forEach(item => {
      const itemName = item.dataset.name.toLowerCase();
      item.style.display = itemName.includes(searchValue) ? "block" : "none";
    });
  });
}

const aiAssistantInput = document.getElementById("aiAssistantInput");

if (aiAssistantInput) {
  aiAssistantInput.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      sendAiAssistantMessage();
    }
  });
}

document.querySelectorAll(".action-card").forEach(card => {
  card.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      card.click();
    }
  });
});

setLoggedInUserName();
applyThemePreference();
initOrderMode();
updatePreferenceLabels();
updateOrders();
updateCartButtons();
