// app/static/js/modetransportation/totsearch.js

document.addEventListener("DOMContentLoaded", () => {
    
    // ------------------------------
    // DOM ELEMENTS
    // ------------------------------
    const searchInput = document.getElementById("tot-search-input");
    const tableBody = document.getElementById("tot-table-body");
    // ADDED: Selectors for new functionality (Check All, Delete All, Edit)
    const searchButton = document.querySelector(".tot-search .search-btn");
    const checkAllBox = document.getElementById("check-all");
    const deleteAllBtn = document.querySelector(".delete-all-btn");
    // Assuming the Edit icon uses the .tot-icon.edit-icon classes
    const editIcon = document.querySelector(".tot-icon.edit-icon"); 
    
    // ------------------------------
    // HANDLERS FOR MULTIPLE SELECTION
    // ------------------------------
    function handleCheckboxChange(event) {
        const box = event.target;
        // Allow multiple selection and toggle highlight class
        box.closest("tr").classList.toggle("selected-row", box.checked);
        
        updateCheckAllState();
        updateEditIconState();
    }

    function handleRowClick(event) {
        // FIX: Use the standardized delete button class: .delete-tot-btn
        if (event.target.classList.contains("tot-checkbox") ||
            event.target.closest(".delete-tot-btn")) {
            return; // ignore clicks on checkbox or delete button
        }

        const row = event.currentTarget;
        const box = row.querySelector(".tot-checkbox");
        
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
        const boxes = document.querySelectorAll(".tot-checkbox");

        boxes.forEach(box => {
            // Ensure single listener is attached
            box.removeEventListener("change", handleCheckboxChange); 
            box.addEventListener("change", handleCheckboxChange);
        });
    }
    
    function attachRowClickBehavior() {
        const rows = document.querySelectorAll("#tot-table-body tr");

        rows.forEach(row => {
            // Ensure single listener is attached
            row.removeEventListener("click", handleRowClick);
            row.addEventListener("click", handleRowClick);
        });
    }


    // ------------------------------
    // RENDER TABLE
    // ------------------------------
    function updateTable(mtransps) { // Use mtransps for clarity
        tableBody.innerHTML = "";

        if (mtransps.length === 0) {
            // FIX: Corrected colspan to 6 (total number of columns)
            tableBody.innerHTML = "<tr><td colspan='6'>No results found</td></tr>";
            return;
        }

        mtransps.forEach(mtransp => {
            const row = document.createElement("tr");
            
            // Format the date if it's not already formatted (assuming it comes from the server)
            const entryDate = mtransp.EntryDate ? mtransp.EntryDate : ''; 

            row.innerHTML = `
                <td><input type="checkbox" class="tot-checkbox" data-id="${mtransp.IDM}"></td>
                <td>${mtransp.IDM}</td>
                <td>${mtransp.MTName}</td>
                <td>${mtransp.State}</td>
                <td>${entryDate}</td>
                <td>
                    <button class="delete-tot-btn" data-id="${mtransp.IDM}">
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
        const allBoxes = document.querySelectorAll(".tot-checkbox");
        const checkedBoxes = document.querySelectorAll(".tot-checkbox:checked");
        
        if (!checkAllBox) return;

        checkAllBox.checked = allBoxes.length > 0 && checkedBoxes.length === allBoxes.length;
    }


    // ------------------------------
    // CHECK ALL action
    // ------------------------------
    if (checkAllBox) {
        checkAllBox.addEventListener("change", () => {
            const allBoxes = document.querySelectorAll(".tot-checkbox");

            allBoxes.forEach(box => {
                box.checked = checkAllBox.checked;
                // Ensure row highlighting is updated
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

        const count = document.querySelectorAll(".tot-checkbox:checked").length;

        // The edit icon should be enabled ONLY if exactly one box is checked
        editIcon.classList.toggle("disabled", count !== 1);
    }

    if (editIcon) {
        editIcon.addEventListener("click", () => {
            const checked = document.querySelectorAll(".tot-checkbox:checked");

            if (checked.length !== 1) {
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
        const btn = event.target.closest(".delete-tot-btn"); // FIX: Use .delete-tot-btn
        if (!btn) return;

        const id = btn.dataset.id;

        if (!confirm("Do you want to delete this mode of transportation?")) return;

        try {
            // FIX: Correct delete endpoint URL
            const response = await fetch(`/delete_mtransp/${id}`, { method: "DELETE" }); 
            const data = await response.json();

            if (data.success) {
                btn.closest("tr").remove();
                updateCheckAllState();
                updateEditIconState();
            } else {
                alert(data.message || "Failed to delete mode of transportation.");
            }
        } catch {
            alert("Error deleting mode of transportation.");
        }
    });


    // ------------------------------
    // DELETE ALL
    // ------------------------------
    if (deleteAllBtn) {
        deleteAllBtn.addEventListener("click", async () => {
            const selected = [...document.querySelectorAll(".tot-checkbox:checked")];

            if (selected.length === 0)
                return alert("No modes of transportation selected.");

            if (!confirm("Do you want to delete ALL selected modes of transportation?")) return;

            const ids = selected.map(box => box.dataset.id);

            try {
                // FIX: Correct multi-delete endpoint URL
                const response = await fetch("/delete_mtransps", { 
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ mtransp_ids: ids }), // FIX: Use mtransp_ids payload
                });

                const data = await response.json();

                if (data.success) {
                    ids.forEach(id => {
                        const row = document.querySelector(`.tot-checkbox[data-id="${id}"]`)?.closest("tr");
                        if (row) row.remove();
                    });

                    updateCheckAllState();
                    updateEditIconState();
                    alert("Deletion completed.");
                } else {
                    alert("An error occurred while deleting modes of transportation.");
                }
            } catch {
                alert("Error deleting modes of transportation.");
            }
        });
    }


    // ------------------------------
    // SEARCH
    // ------------------------------
    function searchTots(query) { 
        fetch(`/searchtots?q=${encodeURIComponent(query)}`) 
            .then(res => res.json())
            .then(data => {
                updateTable(data);
            })
            .catch(() => {
                // FIX: Correct colspan to 6
                tableBody.innerHTML = "<tr><td colspan='6'>Error loading results</td></tr>";
            });
    }

    searchInput.addEventListener("input", () => {
        searchTots(searchInput.value.trim());
    });

    if (searchButton) {
        searchButton.addEventListener("click", () => {
            searchTots(searchInput.value.trim());
        });
    }

    searchTots(""); // initial load
});