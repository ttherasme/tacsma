document.addEventListener("DOMContentLoaded", () => {
  // Handle clicks on elements with data-url
  document.querySelectorAll('[data-url]').forEach(el => {
    el.addEventListener("click", () => {
      const altText = el.getAttribute("alt");
      const dataUrl = el.getAttribute("data-url");

      if (altText === "Edit") {
        // Handle different pages differently based on checkbox class
        const selectedUOM = document.querySelector(".uom-checkbox:checked");
        const selectedTask = document.querySelector(".task-checkbox:checked");
        const selectedSOP = document.querySelector(".sop-checkbox:checked");
        const selectedTOT = document.querySelector(".tot-checkbox:checked");

        let selected = selectedUOM || selectedTask || selectedSOP || selectedTOT;

        if (!selected) {
          alert("Please select an item to edit.");
          return;
        }

        const itemId = selected.dataset.id;
        const editUrl = `${dataUrl}?id=${itemId}`;
        window.location.href = editUrl;

      } else {
        // Default behavior for Add or other icons
        window.location.href = dataUrl;
      }
    });
  });

  // Allow only one checkbox to be selected per group
  function handleExclusiveCheckboxes(selector) {
    const checkboxes = document.querySelectorAll(selector);
    checkboxes.forEach(checkbox => {
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) {
          checkboxes.forEach(cb => {
            if (cb !== checkbox) cb.checked = false;
          });
        }
      });
    });
  }

  // Apply exclusive logic per checkbox group
  handleExclusiveCheckboxes(".task-checkbox");
  handleExclusiveCheckboxes(".uom-checkbox");
   handleExclusiveCheckboxes(".sop-checkbox");
});
