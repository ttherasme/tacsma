document.addEventListener("DOMContentLoaded", () => {
    const searchInput = document.getElementById("uoc-search-input");
    const tableBody = document.getElementById("uoc-table-body");
    const searchButton = document.querySelector(".uoc-search .search-btn");

    const checkAllBox = document.getElementById("check-all");
    const deleteAllBtn = document.querySelector(".delete-all-btn");
    const editIcon = document.querySelector(".uoc-icon.edit-icon");

    const uocId = tableBody.dataset.uocId;

    function updateCheckAllState() {
        const allBoxes = document.querySelectorAll(".uoc-checkbox");
        const checkedBoxes = document.querySelectorAll(".uoc-checkbox:checked");

        checkAllBox.checked = allBoxes.length > 0 && checkedBoxes.length === allBoxes.length;
    }

    function updateEditIconState() {
        if (!editIcon) return;

        const checkedBoxes = document.querySelectorAll(".uoc-checkbox:checked");

        // enable only when exactly one checkbox is selected
        editIcon.classList.toggle("disabled", checkedBoxes.length !== 1);
    }

    function handleCheckboxChange(event) {
        const box = event.target;
        const row = box.closest("tr");

        row.classList.toggle("selected-row", box.checked);

        updateCheckAllState();
        updateEditIconState();
    }

    function handleRowClick(event) {
        // do nothing if clicking directly on checkbox or delete button
        if (
            event.target.classList.contains("uoc-checkbox") ||
            event.target.closest(".delete-uoc-btn")
        ) {
            return;
        }

        const row = event.currentTarget;
        const box = row.querySelector(".uoc-checkbox");

        box.checked = !box.checked;
        row.classList.toggle("selected-row", box.checked);

        updateCheckAllState();
        updateEditIconState();
    }

    function attachCheckboxBehavior() {
        const boxes = document.querySelectorAll(".uoc-checkbox");

        boxes.forEach(box => {
            box.removeEventListener("change", handleCheckboxChange);
            box.addEventListener("change", handleCheckboxChange);
        });
    }

    function attachRowClickBehavior() {
        const rows = document.querySelectorAll("#uoc-table-body tr");

        rows.forEach(row => {
            row.removeEventListener("click", handleRowClick);
            row.addEventListener("click", handleRowClick);
        });
    }

    function updateTable(uocs) {
        tableBody.innerHTML = "";

        if (uocs.length === 0) {
            tableBody.innerHTML = "<tr><td colspan='6'>No results found</td></tr>";
            updateCheckAllState();
            updateEditIconState();
            return;
        }

        uocs.forEach(uoc => {
            const row = document.createElement("tr");

            row.innerHTML = `
                <td><input type="checkbox" class="uoc-checkbox" data-id="${uoc.IDU}"></td>
                <td>${uoc.IDU}</td>
                <td>${uoc.UAlias}</td>
                <td>${uoc.CanonicalUnit}</td>
                <td>${uoc.State}</td>
                <td>
                    <button class="delete-uoc-btn" data-id="${uoc.IDU}">
                        <img src="/static/img/trash-red.png" alt="Delete">
                    </button>
                </td>
            `;

            tableBody.appendChild(row);
        });

        attachCheckboxBehavior();
        attachRowClickBehavior();
        updateCheckAllState();
        updateEditIconState();
    }

    checkAllBox.addEventListener("change", () => {
        const allBoxes = document.querySelectorAll(".uoc-checkbox");

        allBoxes.forEach(box => {
            box.checked = checkAllBox.checked;
            box.closest("tr").classList.toggle("selected-row", box.checked);
        });

        updateEditIconState();
    });

    if (editIcon) {
        editIcon.addEventListener("click", () => {
            if (editIcon.classList.contains("disabled")) return;

            const checked = document.querySelectorAll(".uoc-checkbox:checked");

            if (checked.length !== 1) {
                alert("Please select only one row to edit.");
                return;
            }

            const id = checked[0].dataset.id;
            const url = editIcon.querySelector("img").dataset.url;

        window.location.href = `${url}?idu=${id}&id2=${uocId}`;
        });
    }

    document.addEventListener("click", async (event) => {
        const btn = event.target.closest(".delete-uoc-btn");
        if (!btn) return;

        const id = btn.dataset.id;

        if (!confirm("Do you want to delete this row?")) return;

        try {
            const response = await fetch(`/delete_auoc/${id}`, { method: "DELETE" });
            const data = await response.json();

            if (data.success) {
                btn.closest("tr").remove();
                updateCheckAllState();
                updateEditIconState();
            } else {
                alert(data.message || "Failed to delete the data.");
            }
        } catch {
            alert("Error deleting.");
        }
    });

    deleteAllBtn.addEventListener("click", async () => {
        const selected = [...document.querySelectorAll(".uoc-checkbox:checked")];

        if (selected.length === 0) {
            alert("No row selected.");
            return;
        }

        if (!confirm("Do you want to delete ALL selected rows?")) return;

        const ids = selected.map(box => box.dataset.id);

        try {
            const response = await fetch("/delete_auocs", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ uoc_ids: ids }),
            });

            const data = await response.json();

            if (data.success) {
                ids.forEach(id => {
                    const row = document.querySelector(`.uoc-checkbox[data-id="${id}"]`)?.closest("tr");
                    if (row) row.remove();
                });

                updateCheckAllState();
                updateEditIconState();
                alert("Deletion completed.");
            } else {
                alert("An error occurred while deleting.");
            }
        } catch {
            alert("Error deleting uocs.");
        }
    });

   /*  function searchuocs(query) {
        fetch(`/searchauocs?q=${encodeURIComponent(query)}`)
            .then(res => res.json())
            .then(updateTable)
            .catch(() => {
                tableBody.innerHTML = "<tr><td colspan='6'>Error loading results</td></tr>";
            });
    } */

    function searchuocs(query) {
        fetch(`/searchauocs?id=${encodeURIComponent(uocId)}&q=${encodeURIComponent(query)}`)
            .then(res => res.json())
            .then(updateTable)
            .catch(() => {
                tableBody.innerHTML = "<tr><td colspan='6'>Error loading results</td></tr>";
            });
    }

    searchInput.addEventListener("input", () => {
        searchuocs(searchInput.value.trim());
    });

    searchButton.addEventListener("click", () => {
        searchuocs(searchInput.value.trim());
    });

    // attach behavior to rows already rendered by Jinja
    attachCheckboxBehavior();
    attachRowClickBehavior();
    updateCheckAllState();
    updateEditIconState();

    // if you really need ajax initial load, keep this
    // searchuocs("");
});