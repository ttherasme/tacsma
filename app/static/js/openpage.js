document.addEventListener("DOMContentLoaded", function () {
  // Handle user dropdown toggle
  const userIcon = document.querySelector(".user-icon");
  const dropdown = document.querySelector(".user-menu .dropdown");

  if (userIcon && dropdown) {
    userIcon.addEventListener("click", function (e) {
      e.stopPropagation();
      dropdown.classList.toggle("show");
    });

    // Hide dropdown when clicking outside
    document.addEventListener("click", function (e) {
      if (!dropdown.contains(e.target) && !userIcon.contains(e.target)) {
        dropdown.classList.remove("show");
      }
    });
  }

  // Handle navigation buttons
  document.querySelectorAll("button[data-url], .topbar-icons .icon-wrapper[data-url]").forEach(function(button) {
    button.addEventListener("click", function () {
      const url = this.getAttribute("data-url");
      console.log("Redirecting to:", url); // Debugging
      if (url && url !== "#") {
        window.location.href = url;
      }
    });
  });
});
