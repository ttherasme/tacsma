document.addEventListener("DOMContentLoaded", () => {
    const searchInput = document.getElementById("ds-search-input");
    const tableBody = document.getElementById("ds-table-body");
    const checkAllBox = document.getElementById("check-all");
    const deleteAllBtn = document.querySelector(".delete-all-btn");

    const editIcon = document.querySelector(".ds-icon.edit-icon");
    const viewIcon = document.querySelector(".ds-icon.view-icon");

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
                    <input type="checkbox" class="ds-checkbox" data-id="${task.IDT}">
                </td>
                <td>${task.IDT}</td>
                <td>${task.TName}</td>
                <td>${task.Region}</td>
                <td>${task.Description}</td>
                <td>${task.EntryDate}</td>
                <td>
                    <button class="delete-ds-btn" data-id="${task.IDT}">
                        <img src="/static/img/trash-red.png" alt="Delete" />
                    </button>
                </td>
            `;
            tableBody.appendChild(row);
        });

        attachRowAndCheckboxBehavior();
        updateEditIconState();
        updateViewIconState();
    }

    // ------------------------------
    // Multi-select behavior
    // ------------------------------
    function attachRowAndCheckboxBehavior() {
        const rows = document.querySelectorAll("#ds-table-body tr");
        // FIX #4: Removed unused variable 'checkboxes'

        // Row click toggles checkbox
        rows.forEach(row => {
            row.addEventListener("click", (event) => {
                // Check if the click target is the checkbox or the delete button
                if (event.target.classList.contains("ds-checkbox") || 
                    event.target.closest(".delete-ds-btn")) return;

                const checkbox = row.querySelector(".ds-checkbox");
                checkbox.checked = !checkbox.checked;

                row.classList.toggle("selected-row", checkbox.checked);

                updateCheckAllBox();
                updateEditIconState();
                updateViewIconState();
            });
        });

        // Checkbox change toggles row highlight
        // FIX #1: Corrected selector from .task-checkbox to .ds-checkbox
        document.querySelectorAll(".ds-checkbox").forEach(box => {
            box.addEventListener("change", () => {
                const row = box.closest("tr");
                row.classList.toggle("selected-row", box.checked);

                updateCheckAllBox();
                updateEditIconState();
                updateViewIconState();
            });
        });
    }

    // ------------------------------
    // Update Check All checkbox
    // ------------------------------
    function updateCheckAllBox() {
        const allBoxes = document.querySelectorAll(".ds-checkbox");
        const checkedBoxes = document.querySelectorAll(".ds-checkbox:checked");
        checkAllBox.checked = allBoxes.length > 0 && allBoxes.length === checkedBoxes.length;
    }

    // ------------------------------
    // Check All / Uncheck All
    // ------------------------------
    checkAllBox.addEventListener("change", () => {
        const allCheckboxes = document.querySelectorAll(".ds-checkbox");

        allCheckboxes.forEach(box => {
            box.checked = checkAllBox.checked;
            box.closest("tr").classList.toggle("selected-row", box.checked);
        });

        updateEditIconState();
        updateViewIconState();
    });

    // ------------------------------
    // Edit icon behavior (single selection)
    // ------------------------------
    if (editIcon) {
        editIcon.addEventListener("click", (event) => {
            // Check if the icon is disabled before proceeding
            if (editIcon.classList.contains('disabled')) return; 

            const checkedBoxes = document.querySelectorAll(".ds-checkbox:checked");

            if (checkedBoxes.length !== 1) {
                alert("Please select exactly one task to edit the corresponding datasheet.");
                return;
            }

            const checkedBox = checkedBoxes[0];
            const taskId = checkedBox.dataset.id;
            
            // Find the Task Name from the third column (index 2) of the row
            const row = checkedBox.closest('tr');
            // Assuming the TName is in the 3rd column (index 2) after Checkbox (0) and IDT (1)
            const taskName = row.children[2].textContent.trim(); 

            const url = editIcon.querySelector("img").dataset.url;
            
            // Construct and navigate to the new URL with ID and Name
            window.location.href = `${url}?id=${taskId}&name=${encodeURIComponent(taskName)}`;
        });
    }

    // ------------------------------
    // View icon behavior (single selection)
    // ------------------------------
    if (viewIcon) {
        viewIcon.addEventListener("click", (event) => {
            // Check if the icon is disabled before proceeding
            if (viewIcon.classList.contains('disabled')) return; 

            const checkedBoxes = document.querySelectorAll(".ds-checkbox:checked");

            if (checkedBoxes.length !== 1) {
                alert("Please select exactly one task to view the corresponding datasheet.");
                return;
            }

            const checkedBox = checkedBoxes[0];
            const taskId = checkedBox.dataset.id;
            
            // Find the Task Name from the third column (index 2) of the row
            const row = checkedBox.closest('tr');
            const taskName = row.children[2].textContent.trim(); 

            const url = viewIcon.querySelector("img").dataset.url;
            
            // Construct and navigate to the new URL with ID and Name
            window.location.href = `${url}?id=${taskId}&name=${encodeURIComponent(taskName)}`;
        });
    }
    


    // ------------------------------
    // Enable/disable Edit icon based on selection
    // ------------------------------
    function updateEditIconState() {
        const checkedBoxes = document.querySelectorAll(".ds-checkbox:checked");
        if (!editIcon) return;
        editIcon.classList.toggle("disabled", checkedBoxes.length !== 1);
    }

    function updateViewIconState() {
        const checkedBoxes = document.querySelectorAll(".ds-checkbox:checked");
        if (!viewIcon) return;
        // FIX #2: Corrected target from editIcon to viewIcon
        viewIcon.classList.toggle("disabled", checkedBoxes.length !== 1); 
    }

    // ------------------------------
    // Delete single task and their datasheet
    // ------------------------------
    document.addEventListener("click", async (event) => {
        const btn = event.target.closest(".delete-ds-btn");
        if (!btn) return;

        const taskId = btn.dataset.id;
        if (!confirm("Do you want to delete this task and their datasheet?")) return;

        try {
            const response = await fetch(`/delete_datasheet/${taskId}`, { method: "DELETE" });
            const data = await response.json();
            if (data.success) {
                btn.closest("tr").remove();
                updateCheckAllBox();
                updateEditIconState();
                updateViewIconState();
                // NOTE: Consider adding a success alert here
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
        // FIX #1: Corrected selector from .task-checkbox to .ds-checkbox
        const checkedBoxes = [...document.querySelectorAll(".ds-checkbox:checked")]; 
        
        if (checkedBoxes.length === 0) {
            alert("No tasks selected.");
            return;
        }

        if (!confirm("Do you want to delete ALL selected tasks and their datasheet?")) return;

        const taskIds = checkedBoxes.map(box => box.dataset.id);

        try {
            const response = await fetch("/delete_datasheets", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ task_ids: taskIds })
            });

            const data = await response.json();
            if (data.success) {
                data.results.forEach(result => {
                    if (result.status === "deleted") {
                        // FIX #1: Corrected selector from .task-checkbox to .ds-checkbox
                        const row = document.querySelector(`.ds-checkbox[data-id="${result.id}"]`)?.closest("tr");
                        if (row) row.remove();
                    }
                });
                updateCheckAllBox();
                updateEditIconState();
                updateViewIconState();
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
        // Assumes that /searchtasks returns a JSON array of task objects
        fetch(`/searchtasks?q=${encodeURIComponent(query)}`)
            .then(res => res.json())
            .then(data => {
                // NOTE: Assumes data is the array of tasks, not {success: true, tasks: [...]}
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
    // NOTE: This call only works if the initial tasks are NOT rendered by Jinja in the HTML.
    // If tasks are initially rendered by Jinja, this call will cause a double-load/flicker.
    // Assuming the Flask view passes an empty table and relies on JS for initial load:
    searchTasks(""); 
});