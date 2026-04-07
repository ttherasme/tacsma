document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("task-search-input");
  const tableBody = document.getElementById("task-table-body");
  const checkAllBox = document.getElementById("check-all");
  const deleteAllBtn = document.querySelector(".delete-all-btn");
  const editIcon = document.querySelector(".task-icon.edit-icon");
  const searchButton = document.querySelector(".task-search .search-btn");

  const prevPageBtn = document.getElementById("prev-page-btn");
  const nextPageBtn = document.getElementById("next-page-btn");
  const pageNumbers = document.getElementById("page-numbers");

  let currentPage = window.taskPagination?.initialPage || 1;
  let currentQuery = "";
  let totalPages = Math.max(
    1,
    Math.ceil(
      (window.taskPagination?.totalCount || 0) /
      (window.taskPagination?.perPage || 10)
    )
  );

  // ------------------------------
  // HANDLERS FOR MULTIPLE SELECTION
  // ------------------------------
  function handleCheckboxChange(event) {
    const box = event.target;
    box.closest("tr").classList.toggle("selected-row", box.checked);

    updateCheckAllBox();
    updateEditIconState();
  }

  function handleRowClick(event) {
    if (
      event.target.classList.contains("task-checkbox") ||
      event.target.closest(".delete-task-btn")
    ) {
      return;
    }

    const row = event.currentTarget;
    const checkbox = row.querySelector(".task-checkbox");

    checkbox.checked = !checkbox.checked;
    row.classList.toggle("selected-row", checkbox.checked);

    updateCheckAllBox();
    updateEditIconState();
  }

  // ------------------------------
  // ATTACH BEHAVIORS
  // ------------------------------
  function attachRowAndCheckboxBehavior() {
    const rows = document.querySelectorAll("#task-table-body tr");
    const checkboxes = document.querySelectorAll(".task-checkbox");

    rows.forEach(row => {
      row.removeEventListener("click", handleRowClick);
      row.addEventListener("click", handleRowClick);
    });

    checkboxes.forEach(box => {
      box.removeEventListener("change", handleCheckboxChange);
      box.addEventListener("change", handleCheckboxChange);
    });
  }

  // ------------------------------
  // RENDER TASK TABLE ROWS
  // ------------------------------
  function updateTable(rows) {
    tableBody.innerHTML = "";

    if (!rows || rows.length === 0) {
      tableBody.innerHTML = "<tr><td colspan='7'>No results found</td></tr>";
      updateCheckAllBox();
      updateEditIconState();
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
        <td>${task.EntryDate || ""}</td>
        <td>
          <button class="delete-task-btn" data-id="${task.IDT}">
            <img src="/static/img/trash-red.png" alt="Delete" />
          </button>
        </td>
      `;
      tableBody.appendChild(row);
    });

    attachRowAndCheckboxBehavior();
    updateCheckAllBox();
    updateEditIconState();
  }

  // ------------------------------
  // UPDATE CHECK ALL CHECKBOX
  // ------------------------------
  function updateCheckAllBox() {
    const allBoxes = document.querySelectorAll(".task-checkbox");
    const checkedBoxes = document.querySelectorAll(".task-checkbox:checked");

    checkAllBox.checked =
      allBoxes.length > 0 && allBoxes.length === checkedBoxes.length;
  }

  // ------------------------------
  // CHECK ALL / UNCHECK ALL
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
  // ENABLE/DISABLE EDIT ICON
  // ------------------------------
  function updateEditIconState() {
    if (!editIcon) return;

    const checkedBoxes = document.querySelectorAll(".task-checkbox:checked");
    editIcon.classList.toggle("disabled", checkedBoxes.length !== 1);
  }

  // ------------------------------
  // EDIT ICON CLICK
  // ------------------------------
  if (editIcon) {
    editIcon.addEventListener("click", () => {
      const checkedBoxes = document.querySelectorAll(".task-checkbox:checked");

      if (checkedBoxes.length === 0) {
        alert("Please select a task to edit.");
        return;
      }

      if (checkedBoxes.length > 1) {
        alert("Please select only one task to edit.");
        return;
      }

      const taskId = checkedBoxes[0].dataset.id;
      const url = editIcon.querySelector("img").dataset.url;
      window.location.href = `${url}?id=${taskId}`;
    });
  }

  // ------------------------------
  // DELETE SINGLE TASK
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
        loadPage(currentPage);
      } else {
        alert(data.message || "Failed to delete task.");
      }
    } catch (err) {
      console.error(err);
      alert("Error deleting task.");
    }
  });

  // ------------------------------
  // DELETE ALL CHECKED TASKS
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
        loadPage(currentPage);
        alert("Deletion completed.");
      } else {
        alert(data.message || "An error occurred while deleting tasks.");
      }
    } catch (err) {
      console.error(err);
      alert("Error deleting tasks.");
    }
  });

  // ------------------------------
  // PAGE BUTTONS
  // ------------------------------
  function createPageButton(page, isActive = false) {
    const btn = document.createElement("button");
    btn.textContent = page;
    btn.type = "button";

    if (isActive) {
      btn.disabled = true;
      btn.classList.add("active-page");
    }

    btn.addEventListener("click", () => {
      loadPage(page);
    });

    return btn;
  }

  function createDots() {
    const span = document.createElement("span");
    span.textContent = "...";
    return span;
  }

  function renderPageNumbers() {
    pageNumbers.innerHTML = "";

    if (totalPages <= 1) return;

    const maxVisible = 5;

    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, currentPage + 2);

    if ((endPage - startPage + 1) < maxVisible) {
      if (startPage === 1) {
        endPage = Math.min(totalPages, startPage + maxVisible - 1);
      } else if (endPage === totalPages) {
        startPage = Math.max(1, totalPages - maxVisible + 1);
      }
    }

    if (startPage > 1) {
      pageNumbers.appendChild(createPageButton(1, currentPage === 1));
      if (startPage > 2) {
        pageNumbers.appendChild(createDots());
      }
    }

    for (let page = startPage; page <= endPage; page++) {
      pageNumbers.appendChild(createPageButton(page, page === currentPage));
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        pageNumbers.appendChild(createDots());
      }
      pageNumbers.appendChild(
        createPageButton(totalPages, currentPage === totalPages)
      );
    }
  }

  // ------------------------------
  // UPDATE PAGINATION UI
  // ------------------------------
  function updatePagination(meta) {
    currentPage = meta.page;
    totalPages = Math.max(1, Math.ceil(meta.total_count / meta.per_page));

    prevPageBtn.disabled = !meta.has_prev;
    nextPageBtn.disabled = !meta.has_next;

    renderPageNumbers();
  }

  // ------------------------------
  // SEARCH TASKS + LOAD PAGE
  // ------------------------------
  function loadPage(page) {
    fetch(`/searchtasks?q=${encodeURIComponent(currentQuery)}&page=${page}`)
      .then(res => res.json())
      .then(data => {
        updateTable(data.tasks);
        updatePagination(data);
      })
      .catch(err => {
        console.error(err);
        tableBody.innerHTML = "<tr><td colspan='7'>Error loading results</td></tr>";
      });
  }

  // ------------------------------
  // SEARCH EVENTS
  // ------------------------------
  searchInput.addEventListener("input", () => {
    currentQuery = searchInput.value.trim();
    currentPage = 1;
    loadPage(1);
  });

  if (searchButton) {
    searchButton.addEventListener("click", () => {
      currentQuery = searchInput.value.trim();
      currentPage = 1;
      loadPage(1);
    });
  }

  // ------------------------------
  // PREV / NEXT
  // ------------------------------
  if (prevPageBtn) {
    prevPageBtn.addEventListener("click", () => {
      if (currentPage > 1) {
        loadPage(currentPage - 1);
      }
    });
  }

  if (nextPageBtn) {
    nextPageBtn.addEventListener("click", () => {
      if (currentPage < totalPages) {
        loadPage(currentPage + 1);
      }
    });
  }

  // ------------------------------
  // INITIAL LOAD
  // ------------------------------
  loadPage(currentPage);
});