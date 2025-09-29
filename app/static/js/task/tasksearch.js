document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("task-search-input");
  const tableBody = document.getElementById("task-table-body");

  // Render task table rows
  function updateTable(rows) {
    tableBody.innerHTML = "";

    if (rows.length === 0) {
      tableBody.innerHTML = "<tr><td colspan='5'>No results found</td></tr>";
      return;
    }

    rows.forEach(task => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${task.IDT}</td>
        <td>${task.TName}</td>
        <td>${task.Description}</td>
        <td>${task.EntryDate}</td>
        <td>
          <input type="checkbox" class="task-checkbox" data-id="${task.IDT}">
        </td>
      `;
      tableBody.appendChild(row);
    });

    attachCheckboxBehavior();
  }

  // Ensure only one checkbox is selected at a time
  function attachCheckboxBehavior() {
    const checkboxes = document.querySelectorAll(".task-checkbox");

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
  function searchTasks(query) {
    fetch(`/searchtasks?q=${encodeURIComponent(query)}`)
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
    searchTasks(query);
  });

  // Load default tasks initially
  searchTasks("");
});
