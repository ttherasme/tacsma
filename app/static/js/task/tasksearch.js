document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("task-search-input");
  const tableBody = document.getElementById("task-table-body");
  const checkAllBox = document.getElementById("check-all");
  const deleteAllBtn = document.querySelector(".delete-all-btn");

  // ------------------------------
  // Render task table rows
  // ------------------------------
  function updateTable(rows) {
    tableBody.innerHTML = "";

    if (rows.length === 0) {
      tableBody.innerHTML = "<tr><td colspan='7'>No results found</td></tr>";
      return;
    }

    rows.forEach(task => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>
          <input type="checkbox" class="task-checkbox" data-id="${task.IDT}">
        </td>
        <td>${task.IDT}</td>
        <td>${task.TName}</td>
        <td>${task.Region}</td>
        <td>${task.Description}</td>
        <td>${task.EntryDate}</td>
        <td>
          <button class="delete-task-btn" data-id="${task.IDT}">
            <img src="/static/img/trash-red.png" alt="Delete" />
          </button>
        </td>
      `;
      tableBody.appendChild(row);
    });

    attachRowAndCheckboxBehavior();
    updateEditIconState();
  }

  // ------------------------------
  // Multi-select behavior
  // ------------------------------
  function attachRowAndCheckboxBehavior() {
    const rows = document.querySelectorAll("#task-table-body tr");
    const checkboxes = document.querySelectorAll(".task-checkbox");

    // Row click toggles checkbox
    rows.forEach(row => {
      row.addEventListener("click", (event) => {
        if (event.target.classList.contains("task-checkbox") || 
            event.target.closest(".delete-task-btn")) return;

        const checkbox = row.querySelector(".task-checkbox");
        checkbox.checked = !checkbox.checked;

        row.classList.toggle("selected-row", checkbox.checked);

        updateCheckAllBox();
        updateEditIconState();
      });
    });

    // Checkbox change toggles row highlight
    checkboxes.forEach(box => {
      box.addEventListener("change", () => {
        const row = box.closest("tr");
        row.classList.toggle("selected-row", box.checked);

        updateCheckAllBox();
        updateEditIconState();
      });
    });
  }

  // ------------------------------
  // Update Check All checkbox
  // ------------------------------
  function updateCheckAllBox() {
    const allBoxes = document.querySelectorAll(".task-checkbox");
    const checkedBoxes = document.querySelectorAll(".task-checkbox:checked");
    checkAllBox.checked = allBoxes.length > 0 && allBoxes.length === checkedBoxes.length;
  }

  // ------------------------------
  // Check All / Uncheck All
  // ------------------------------
  checkAllBox.addEventListener("change", () => {
    const allCheckboxes = document.querySelectorAll(".task-checkbox");

    allCheckboxes.forEach(box => {
      box.checked = checkAllBox.checked;
      box.closest("tr").classList.toggle("selected-row", box.checked);
    });

    updateEditIconState();
  });

  // ------------------------------
  // Edit icon behavior (single selection)
  // ------------------------------
  // ------------------------------
  const editIcon = document.querySelector(".task-icon.edit-icon");

  if (editIcon) {
    editIcon.addEventListener("click", (event) => {
      const checkedBoxes = document.querySelectorAll(".task-checkbox:checked");

      // No selection
      if (checkedBoxes.length === 0) {
        alert("Please select a task to edit.");
        return;  // <-- prevent navigation
      }

      // More than one selected
      if (checkedBoxes.length > 1) {
        alert("Please select only one task to edit.");
        return;  // <-- prevent navigation
      }

      // Exactly one selected -> navigate
      const taskId = checkedBoxes[0].dataset.id;
      const url = editIcon.querySelector("img").dataset.url;
      window.location.href = `${url}?id=${taskId}`;
    });
  }


  // ------------------------------
  // Enable/disable Edit icon based on selection
  // ------------------------------
  function updateEditIconState() {
    const checkedBoxes = document.querySelectorAll(".task-checkbox:checked");
    if (!editIcon) return;
    editIcon.classList.toggle("disabled", checkedBoxes.length !== 1);
  }

  // ------------------------------
  // Delete single task
  // ------------------------------
  document.addEventListener("click", async (event) => {
    const btn = event.target.closest(".delete-task-btn");
    if (!btn) return;

    const taskId = btn.dataset.id;
    if (!confirm("Do you want to delete this task?")) return;

    try {
      const response = await fetch(`/delete_task/${taskId}`, { method: "DELETE" });
      const data = await response.json();
      if (data.success) {
        btn.closest("tr").remove();
        updateCheckAllBox();
        updateEditIconState();
      } else {
        alert(data.message || "Failed to delete task.");
      }
    } catch (err) {
      console.error(err);
      alert("Error deleting task.");
    }
  });

  // ------------------------------
  // Delete all checked tasks
  // ------------------------------
  deleteAllBtn.addEventListener("click", async () => {
    const checkedBoxes = [...document.querySelectorAll(".task-checkbox:checked")];
    if (checkedBoxes.length === 0) {
      alert("No tasks selected.");
      return;
    }

    if (!confirm("Do you want to delete ALL selected tasks?")) return;

    const taskIds = checkedBoxes.map(box => box.dataset.id);

    try {
      const response = await fetch("/delete_tasks", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_ids: taskIds })
      });

      const data = await response.json();
      if (data.success) {
        data.results.forEach(result => {
          if (result.status === "deleted") {
            const row = document.querySelector(`.task-checkbox[data-id="${result.id}"]`)?.closest("tr");
            if (row) row.remove();
          }
        });
        updateCheckAllBox();
        updateEditIconState();
        alert("Deletion completed.");
      } else {
        alert("An error occurred while deleting tasks.");
      }
    } catch (err) {
      console.error(err);
      alert("Error deleting tasks.");
    }
  });

  // ------------------------------
  // Search tasks
  // ------------------------------
  function searchTasks(query) {
    fetch(`/searchtasks?q=${encodeURIComponent(query)}`)
      .then(res => res.json())
      .then(data => {
        updateTable(data);
      })
      .catch(err => {
        console.error(err);
        tableBody.innerHTML = "<tr><td colspan='7'>Error loading results</td></tr>";
      });
  }

  searchInput.addEventListener("input", () => {
    searchTasks(searchInput.value.trim());
  });

  // ------------------------------
  // Initial load
  // ------------------------------
  searchTasks("");
});
