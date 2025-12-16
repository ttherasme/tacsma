// app/static/js/soprocess/soprocess.js

document.addEventListener("DOMContentLoaded", () => {
    
    // ------------------------------
    // DOM ELEMENTS
    // ------------------------------
    const searchInput = document.getElementById("sop-search-input");
    const tableBody = document.getElementById("sop-table-body");
    // ADDED: Selectors for new functionality
    const searchButton = document.querySelector(".sop-search .search-btn");
    const checkAllBox = document.getElementById("check-all");
    const deleteAllBtn = document.querySelector(".delete-all-btn");
    const editIcon = document.querySelector(".sop-icon.edit-icon");
    
    // ------------------------------
    // HANDLERS FOR MULTIPLE SELECTION
    // ------------------------------
    function handleCheckboxChange(event) {
        const box = event.target;
        // FIX 1: Allow multiple selection and toggle highlight class
        box.closest("tr").classList.toggle("selected-row", box.checked);
        
        updateCheckAllState();
        updateEditIconState();
    }

    function handleRowClick(event) {
        if (event.target.classList.contains("sop-checkbox") ||
            event.target.closest(".delete-sop-btn")) {
            return; // ignore clicks on checkbox or delete button
        }

        const row = event.currentTarget;
        const box = row.querySelector(".sop-checkbox");
        
        // Toggle the checkbox state
        box.checked = !box.checked;

        // Manually update the row class and states
        row.classList.toggle("selected-row", box.checked);
        updateCheckAllState();
        updateEditIconState();
    }

    // ------------------------------
    // ATTACH BEHAVIORS
    // ------------------------------
    function attachCheckboxBehavior() {
        const boxes = document.querySelectorAll(".sop-checkbox");

        boxes.forEach(box => {
            // Ensure single listener is attached
            box.removeEventListener("change", handleCheckboxChange); 
            box.addEventListener("change", handleCheckboxChange);
        });
    }
    
    function attachRowClickBehavior() {
        const rows = document.querySelectorAll("#sop-table-body tr");

        rows.forEach(row => {
            // Ensure single listener is attached
            row.removeEventListener("click", handleRowClick);
            row.addEventListener("click", handleRowClick);
        });
    }


    // ------------------------------
    // RENDER TABLE
    // ------------------------------
    function updateTable(steps) { // Change rows to steps
        tableBody.innerHTML = ""; // Clear existing rows

        if (steps.length === 0) {
            // FIX 2: Updated colspan to 6 (total number of columns)
            tableBody.innerHTML = "<tr><td colspan='6'>No results found</td></tr>";
            return;
        }

        steps.forEach(step => {
            const row = document.createElement("tr");
            
            // Format the date if it's not already formatted (assuming it comes from the server)
            const entryDate = step.EntryDate ? step.EntryDate : ''; 

            row.innerHTML = `
                <td><input type="checkbox" class="sop-checkbox" data-id="${step.IDS}"></td>
                <td>${step.IDS}</td>
                <td>${step.SName}</td>
                <td>${step.State}</td>
                <td>${entryDate}</td>
                <td>
                    <button class="delete-sop-btn" data-id="${step.IDS}">
                        <img src="/static/img/trash-red.png" alt="Delete">
                    </button>
                </td>
            `;
            tableBody.appendChild(row);
        });

        // Re-attach behaviors to the new elements
        attachRowClickBehavior();
        attachCheckboxBehavior(); 
        updateCheckAllState();
        updateEditIconState();
    }

    // ------------------------------
    // CHECK-ALL SYNC
    // ------------------------------
    function updateCheckAllState() {
        const allBoxes = document.querySelectorAll(".sop-checkbox");
        const checkedBoxes = document.querySelectorAll(".sop-checkbox:checked");
        
        // Ensure checkAllBox is available before using it
        if (!checkAllBox) return;

        checkAllBox.checked = allBoxes.length > 0 && checkedBoxes.length === allBoxes.length;
    }


    // ------------------------------
    // CHECK ALL action
    // ------------------------------
    if (checkAllBox) {
        checkAllBox.addEventListener("change", () => {
            const allBoxes = document.querySelectorAll(".sop-checkbox");

            allBoxes.forEach(box => {
                box.checked = checkAllBox.checked;
                // FIX 3: Ensure row highlighting is updated
                box.closest("tr").classList.toggle("selected-row", box.checked);
            });

            updateEditIconState();
        });
    }


    // ------------------------------
    // EDIT ICON
    // ------------------------------
    function updateEditIconState() {
        if (!editIcon) return;

        const count = document.querySelectorAll(".sop-checkbox:checked").length;

        // The edit icon should be enabled ONLY if exactly one box is checked
        editIcon.classList.toggle("disabled", count !== 1);
    }

    if (editIcon) {
        editIcon.addEventListener("click", () => {
            const checked = document.querySelectorAll(".sop-checkbox:checked");

            if (checked.length !== 1) {
                 // Check if disabled class is present, then alert
                 if (editIcon.classList.contains('disabled')) return;
            }

            const id = checked[0].dataset.id;
            const url = editIcon.querySelector("img").dataset.url;

            window.location.href = `${url}?id=${id}`;
        });
    }


    // ------------------------------
    // DELETE ONE
    // ------------------------------
    document.addEventListener("click", async (event) => {
        const btn = event.target.closest(".delete-sop-btn");
        if (!btn) return;

        const id = btn.dataset.id;

        if (!confirm("Do you want to delete this step?")) return;

        try {
            // FIX 4: Correct delete endpoint URL
            const response = await fetch(`/delete_step/${id}`, { method: "DELETE" });
            const data = await response.json();

            if (data.success) {
                btn.closest("tr").remove();
                updateCheckAllState();
                updateEditIconState();
            } else {
                alert(data.message || "Failed to delete step.");
            }
        } catch {
            alert("Error deleting step.");
        }
    });


    // ------------------------------
    // DELETE ALL
    // ------------------------------
    if (deleteAllBtn) {
        deleteAllBtn.addEventListener("click", async () => {
            const selected = [...document.querySelectorAll(".sop-checkbox:checked")];

            if (selected.length === 0)
                return alert("No steps selected.");

            if (!confirm("Do you want to delete ALL selected steps?")) return;

            const ids = selected.map(box => box.dataset.id);

            try {
                // FIX 5: Correct multi-delete endpoint URL
                const response = await fetch("/delete_steps", { 
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ step_ids: ids }), // FIX 6: Use step_ids payload
                });

                const data = await response.json();

                if (data.success) {
                    ids.forEach(id => {
                        const row = document.querySelector(`.sop-checkbox[data-id="${id}"]`)?.closest("tr");
                        if (row) row.remove();
                    });

                    updateCheckAllState();
                    updateEditIconState();
                    alert("Deletion completed.");
                } else {
                    alert("An error occurred while deleting steps.");
                }
            } catch {
                alert("Error deleting steps.");
            }
        });
    }


    // ------------------------------
    // SEARCH
    // ------------------------------
    function searchSops(query) { 
        fetch(`/searchsops?q=${encodeURIComponent(query)}`) 
            .then(res => res.json())
            .then(data => {
                updateTable(data);
            })
            .catch(() => {
                // FIX 7: Correct colspan to 6
                tableBody.innerHTML = "<tr><td colspan='6'>Error loading results</td></tr>";
            });
    }

    searchInput.addEventListener("input", () => {
        searchSops(searchInput.value.trim());
    });

    if (searchButton) {
        searchButton.addEventListener("click", () => {
            searchSops(searchInput.value.trim());
        });
    }

    searchSops(""); // initial load
});