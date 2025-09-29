document.addEventListener("DOMContentLoaded", function () {
  const form = document.querySelector("form");
  const messageContainer = document.getElementById("client-side-messages");
  const usernameInput = form.username;
  const passwordInput = form.password;
  const rememberCheckbox = document.getElementById("remember-checkbox");

  // Load remembered username and checkbox state
  const rememberedUsername = localStorage.getItem("rememberedUsername");
  if (rememberedUsername) {
    usernameInput.value = rememberedUsername;
    rememberCheckbox.checked = true;
  }

  // When checkbox changes, save/remove username in localStorage
  rememberCheckbox.addEventListener("change", function () {
    if (this.checked) {
      localStorage.setItem("rememberedUsername", usernameInput.value);
    } else {
      localStorage.removeItem("rememberedUsername");
    }
  });

  // Save username again if user edits it while "Remember me" is still checked
  usernameInput.addEventListener("input", function () {
    if (rememberCheckbox.checked) {
      localStorage.setItem("rememberedUsername", usernameInput.value);
    }
  });

  // Form validation
  form.addEventListener("submit", function (e) {
    messageContainer.innerHTML = ""; // Clear previous messages
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    let hasError = false;

    if (!username || !password) {
      const msg = document.createElement("p");
      msg.textContent = "Please enter both username and password.";
      msg.style.color = "red";
      messageContainer.appendChild(msg);
      hasError = true;
    }

    if (password.length > 0 && password.length < 6) {
      const msg = document.createElement("p");
      msg.textContent = "Password must be at least 6 characters long.";
      msg.style.color = "red";
      messageContainer.appendChild(msg);
      hasError = true;
    }

    // Store or remove username based on checkbox state
    if (rememberCheckbox.checked && !hasError) {
      localStorage.setItem("rememberedUsername", username);
    } else {
      localStorage.removeItem("rememberedUsername");
    }

    if (hasError) {
      e.preventDefault(); // Stop form submission
    }
  });
});
