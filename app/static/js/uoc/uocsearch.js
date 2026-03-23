document.addEventListener("DOMContentLoaded", () => {
    const searchInput = document.getElementById("uoc-search-input");
    const tableBody = document.getElementById("uoc-table-body");
    const searchButton = document.querySelector(".uoc-search .search-btn");

    const checkAllBox = document.getElementById("check-all");
    const deleteAllBtn = document.querySelector(".delete-all-btn");
    const editIcon = document.querySelector(".uoc-icon.edit-icon");

    function handleCheckboxChange(event) {
        const box = event.target;
        box.closest("tr").classList.toggle("selected-row", box.checked);
        updateCheckAllState();
        updateEditIconState();
    }

    function handleRowClick(event) {
        if (
            event.target.classList.contains("uoc-checkbox") ||
            event.target.closest(".delete-uoc-btn") ||
            event.target.closest("a")
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
            tableBody.innerHTML = "<tr><td colspan='9'>No results found</td></tr>";
            updateCheckAllState();
            updateEditIconState();
            return;
        }

        uocs.forEach(uoc => {
            const row = document.createElement("tr");

            row.innerHTML = `
                <td><input type="checkbox" class="uoc-checkbox" data-id="${uoc.IDU}"></td>
                <td>${uoc.IDU}</td>
                <td>${uoc.UName}</td>
                <td>${uoc.UFactor}</td>
                <td>${uoc.Unit}</td>
                <td>${uoc.UCategory}</td>
                <td>${uoc.State}</td>
                <td><a href="/auoc?id=${uoc.IDU}">Alias</a></td>
                <td>
                    <button class="delete-uoc-btn" data-id="${uoc.IDU}">
                        <img src="/static/img/trash-red.png" alt="Delete">
                    </button>
                </td>
            `;

            tableBody.appendChild(row);
        });

        attachRowClickBehavior();
        attachCheckboxBehavior();
        updateCheckAllState();
        updateEditIconState();
    }

    function updateCheckAllState() {
        const allBoxes = document.querySelectorAll(".uoc-checkbox");
        const checkedBoxes = document.querySelectorAll(".uoc-checkbox:checked");

        checkAllBox.checked = allBoxes.length > 0 && checkedBoxes.length === allBoxes.length;
    }

    checkAllBox.addEventListener("change", () => {
        const allBoxes = document.querySelectorAll(".uoc-checkbox");

        allBoxes.forEach(box => {
            box.checked = checkAllBox.checked;
            box.closest("tr").classList.toggle("selected-row", box.checked);
        });

        updateEditIconState();
    });

    function updateEditIconState() {
        if (!editIcon) return;

        const count = document.querySelectorAll(".uoc-checkbox:checked").length;
        editIcon.classList.toggle("disabled", count !== 1);
    }

    if (editIcon) {
        editIcon.addEventListener("click", () => {
            const checked = document.querySelectorAll(".uoc-checkbox:checked");

            if (checked.length === 0) {
                alert("Please select a uoc to edit.");
                return;
            }

            if (checked.length > 1) {
                alert("Please select only one uoc to edit.");
                return;
            }

            const id = checked[0].dataset.id;
            const url = editIcon.querySelector("img").dataset.url;

            window.location.href = `${url}?idu=${id}`;
        });
    }

    document.addEventListener("click", async (event) => {
        const btn = event.target.closest(".delete-uoc-btn");
        if (!btn) return;

        const id = btn.dataset.id;

        if (!confirm("Do you want to delete this uoc?")) return;

        try {
            const response = await fetch(`/delete_uoc/${id}`, { method: "DELETE" });
            const data = await response.json();

            if (data.success) {
                btn.closest("tr").remove();
                updateCheckAllState();
                updateEditIconState();
            } else {
                alert(data.message || "Failed to delete uoc.");
            }
        } catch {
            alert("Error deleting uoc.");
        }
    });

    deleteAllBtn.addEventListener("click", async () => {
        const selected = [...document.querySelectorAll(".uoc-checkbox:checked")];

        if (selected.length === 0) {
            alert("No uocs selected.");
            return;
        }

        if (!confirm("Do you want to delete ALL selected uocs?")) return;

        const ids = selected.map(box => box.dataset.id);

        try {
            const response = await fetch("/delete_uocs", {
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
                alert("An error occurred while deleting uocs.");
            }
        } catch {
            alert("Error deleting uocs.");
        }
    });

    function searchuocs(query) {
        fetch(`/searchuocs?q=${encodeURIComponent(query)}`)
            .then(res => res.json())
            .then(updateTable)
            .catch(() => {
                tableBody.innerHTML = "<tr><td colspan='9'>Error loading results</td></tr>";
            });
    }

    searchInput.addEventListener("input", () => {
        searchuocs(searchInput.value.trim());
    });

    searchButton.addEventListener("click", () => {
        searchuocs(searchInput.value.trim());
    });

    searchuocs("");
});