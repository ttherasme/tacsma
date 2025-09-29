document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("tot-search-input");
  const tableBody = document.getElementById("tot-table-body");

  // Render task table rows
  function updateTable(rows) {
    tableBody.innerHTML = "";

    if (rows.length === 0) {
      tableBody.innerHTML = "<tr><td colspan='5'>No results found</td></tr>";
      return;
    }

    rows.forEach(mtransp => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${mtransp.IDM}</td>
        <td>${mtransp.MTName}</td>
        <td>${mtransp.State}</td>
        <td>${mtransp.EntryDate}</td>
        <td>
          <input type="checkbox" class="tot-checkbox" data-id="${mtransp.IDM}">
        </td>
      `;
      tableBody.appendChild(row);
    });

    attachCheckboxBehavior();
  }

  // Ensure only one checkbox is selected at a time
  function attachCheckboxBehavior() {
    const checkboxes = document.querySelectorAll(".tot-checkbox");

    checkboxes.forEach(box => {
      box.addEventListener("change", () => {
        if (box.checked) {
          checkboxes.forEach(other => {
            if (other !== box) other.checked = false;
          });
        }
      });
    });
  }

  // Search and update the table
  function searchTots(query) {
    fetch(`/searchtots?q=${encodeURIComponent(query)}`)
      .then(response => response.json())
      .then(data => {
        updateTable(data);
      })
      .catch(error => {
        console.error("Search failed:", error);
        tableBody.innerHTML = "<tr><td colspan='5'>Error loading results</td></tr>";
      });
  }

  // Event: auto search on input
  searchInput.addEventListener("input", () => {
    const query = searchInput.value.trim();
    searchTots(query);
  });

  // Load default tasks initially
  searchTots("");
});
