document.addEventListener("DOMContentLoaded", () => {

    // ------------------------------
    // DOM ELEMENTS
    // ------------------------------
    const searchInput = document.getElementById("uom-search-input");
    const tableBody = document.getElementById("uom-table-body");
    const searchButton = document.querySelector(".uom-search .search-btn");

    const checkAllBox = document.getElementById("check-all");
    const deleteAllBtn = document.querySelector(".delete-all-btn");
    const editIcon = document.querySelector(".uom-icon.edit-icon");

    // ------------------------------
    // HANDLERS FOR MULTIPLE SELECTION
    // ------------------------------
    function handleCheckboxChange(event) {
        const box = event.target;
        // FIX: Toggle the selected-row class based only on the current checkbox state
        box.closest("tr").classList.toggle("selected-row", box.checked);
        
        updateCheckAllState();
        updateEditIconState();
    }

    function handleRowClick(event) {
        if (event.target.classList.contains("uom-checkbox") ||
            event.target.closest(".delete-uom-btn")) {
            return; // ignore clicks on checkbox or delete button
        }

        const row = event.currentTarget;
        const box = row.querySelector(".uom-checkbox");
        
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
        const boxes = document.querySelectorAll(".uom-checkbox");

        boxes.forEach(box => {
            // Remove previous listeners to prevent duplicates
            box.removeEventListener("change", handleCheckboxChange); 
            box.addEventListener("change", handleCheckboxChange);
        });
    }
    
    function attachRowClickBehavior() {
        const rows = document.querySelectorAll("#uom-table-body tr");

        rows.forEach(row => {
            // Remove previous listeners to prevent duplicates
            row.removeEventListener("click", handleRowClick);
            row.addEventListener("click", handleRowClick);
        });
    }

    // ------------------------------
    // RENDER TABLE
    // ------------------------------
    function updateTable(uoms) {
        tableBody.innerHTML = "";

        if (uoms.length === 0) {
            // FIX: colspan must be 7 to cover all columns
            tableBody.innerHTML = "<tr><td colspan='7'>No results found</td></tr>";
            return;
        }

        uoms.forEach(uom => {
            const row = document.createElement("tr");
            
            // Format the date if it's not already formatted (assuming it comes from the server)
            const entryDate = uom.EntryDate ? uom.EntryDate : ''; 

            row.innerHTML = `
                <td><input type="checkbox" class="uom-checkbox" data-id="${uom.IDU}"></td>
                <td>${uom.IDU}</td>
                <td>${uom.UName}</td>
                <td>${uom.Unit}</td>
                <td>${uom.State}</td>
                <td>${entryDate}</td>
                <td>
                    <button class="delete-uom-btn" data-id="${uom.IDU}">
                        <img src="/static/img/trash-red.png" alt="Delete">
                    </button>
                </td>
            `;

            tableBody.appendChild(row);
        });

        // Re-attach behaviors to the new elements
        attachRowClickBehavior();
        attachCheckboxBehavior(); // Now attaches the multi-select change handler
        updateCheckAllState();
        updateEditIconState();
    }


    // ------------------------------
    // CHECK-ALL SYNC
    // ------------------------------
    function updateCheckAllState() {
        const allBoxes = document.querySelectorAll(".uom-checkbox");
        const checkedBoxes = document.querySelectorAll(".uom-checkbox:checked");

        checkAllBox.checked = allBoxes.length > 0 && checkedBoxes.length === allBoxes.length;
    }


    // ------------------------------
    // CHECK ALL action
    // ------------------------------
    checkAllBox.addEventListener("change", () => {
        const allBoxes = document.querySelectorAll(".uom-checkbox");

        allBoxes.forEach(box => {
            box.checked = checkAllBox.checked;
            // FIX: Ensure the row highlighting is updated
            box.closest("tr").classList.toggle("selected-row", box.checked);
        });

        updateEditIconState();
    });


    // ------------------------------
    // EDIT ICON
    // ------------------------------
    function updateEditIconState() {
        if (!editIcon) return;

        const count = document.querySelectorAll(".uom-checkbox:checked").length;

        // The edit icon should be enabled ONLY if exactly one box is checked
        editIcon.classList.toggle("disabled", count !== 1);
    }

    if (editIcon) {
        editIcon.addEventListener("click", () => {
            const checked = document.querySelectorAll(".uom-checkbox:checked");

            if (checked.length === 0)
                return alert("Please select a uom to edit.");

            if (checked.length > 1)
                return alert("Please select only one uom to edit.");

            const id = checked[0].dataset.id;
            const url = editIcon.querySelector("img").dataset.url;

            window.location.href = `${url}?id=${id}`;
        });
    }


    // ------------------------------
    // DELETE ONE
    // ------------------------------
    document.addEventListener("click", async (event) => {
        const btn = event.target.closest(".delete-uom-btn");
        if (!btn) return;

        const id = btn.dataset.id;

        if (!confirm("Do you want to delete this uom?")) return;

        try {
            const response = await fetch(`/delete_uom/${id}`, { method: "DELETE" });
            const data = await response.json();

            if (data.success) {
                btn.closest("tr").remove();
                updateCheckAllState();
                updateEditIconState();
            } else {
                alert(data.message || "Failed to delete uom.");
            }
        } catch {
            alert("Error deleting uom.");
        }
    });


    // ------------------------------
    // DELETE ALL
    // ------------------------------
    deleteAllBtn.addEventListener("click", async () => {
        const selected = [...document.querySelectorAll(".uom-checkbox:checked")];

        if (selected.length === 0)
            return alert("No uoms selected.");

        if (!confirm("Do you want to delete ALL selected uoms?")) return;

        const ids = selected.map(box => box.dataset.id);

        try {
            const response = await fetch("/delete_uoms", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ uom_ids: ids }),
            });

            const data = await response.json();

            if (data.success) {
                ids.forEach(id => {
                    const row = document.querySelector(`.uom-checkbox[data-id="${id}"]`)?.closest("tr");
                    if (row) row.remove();
                });

                updateCheckAllState();
                updateEditIconState();
                alert("Deletion completed.");
            } else {
                alert("An error occurred while deleting uoms.");
            }
        } catch {
            alert("Error deleting uoms.");
        }
    });


    // ------------------------------
    // SEARCH
    // ------------------------------
    function searchUOMs(query) {
        fetch(`/searchuoms?q=${encodeURIComponent(query)}`)
            .then(res => res.json())
            .then(updateTable)
            .catch(() => {
                // FIX: colspan must be 7 to cover all columns
                tableBody.innerHTML = "<tr><td colspan='7'>Error loading results</td></tr>";
            });
    }

    searchInput.addEventListener("input", () => {
        searchUOMs(searchInput.value.trim());
    });

    searchButton.addEventListener("click", () => {
        searchUOMs(searchInput.value.trim());
    });

    searchUOMs(""); // initial load
});