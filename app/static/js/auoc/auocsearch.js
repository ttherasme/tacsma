document.addEventListener("DOMContentLoaded", () => {
    const searchInput = document.getElementById("uoc-search-input");
    const tableBody = document.getElementById("uoc-table-body");
    const searchButton = document.querySelector(".uoc-search .search-btn");

    const checkAllBox = document.getElementById("check-all");
    const deleteAllBtn = document.querySelector(".delete-all-btn");
    const editIcon = document.querySelector(".uoc-icon.edit-icon");

    const prevPageBtn = document.getElementById("prev-page-btn");
    const nextPageBtn = document.getElementById("next-page-btn");
    const pageNumbers = document.getElementById("page-numbers");

    const uocId = tableBody.dataset.uocId;

    let currentPage = window.auocPagination?.initialPage || 1;
    let currentQuery = "";
    let totalPages = Math.max(
        1,
        Math.ceil(
            (window.auocPagination?.totalCount || 0) /
            (window.auocPagination?.perPage || 10)
        )
    );

    // ------------------------------
    // STATE HELPERS
    // ------------------------------
    function updateCheckAllState() {
        if (!checkAllBox) return;

        const allBoxes = document.querySelectorAll(".uoc-checkbox");
        const checkedBoxes = document.querySelectorAll(".uoc-checkbox:checked");

        checkAllBox.checked =
            allBoxes.length > 0 && checkedBoxes.length === allBoxes.length;
    }

    function updateEditIconState() {
        if (!editIcon) return;

        const checkedBoxes = document.querySelectorAll(".uoc-checkbox:checked");

        // IMPORTANT:
        // Edit must be enabled ONLY when exactly one row is selected.
        editIcon.classList.toggle("disabled", checkedBoxes.length !== 1);
    }

    // ------------------------------
    // ROW / CHECKBOX HANDLERS
    // ------------------------------
    function handleCheckboxChange(event) {
        const box = event.target;
        const row = box.closest("tr");

        row.classList.toggle("selected-row", box.checked);

        updateCheckAllState();
        updateEditIconState();
    }

    function handleRowClick(event) {
        // Ignore direct clicks on checkbox or delete button
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

    function attachBehaviors() {
        attachCheckboxBehavior();
        attachRowClickBehavior();
    }

    // ------------------------------
    // TABLE RENDER
    // ------------------------------
    function updateTable(uocs) {
        tableBody.innerHTML = "";

        if (!uocs || uocs.length === 0) {
            tableBody.innerHTML = "<tr><td colspan='6'>No results found</td></tr>";
            updateCheckAllState();
            updateEditIconState();
            return;
        }

        uocs.forEach(uoc => {
            const row = document.createElement("tr");

            row.innerHTML = `
                <td>
                    <input type="checkbox" class="uoc-checkbox" data-id="${uoc.IDU}">
                </td>
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

        attachBehaviors();
        updateCheckAllState();
        updateEditIconState();
    }

    // ------------------------------
    // CHECK ALL
    // ------------------------------
    if (checkAllBox) {
        checkAllBox.addEventListener("change", () => {
            const allBoxes = document.querySelectorAll(".uoc-checkbox");

            allBoxes.forEach(box => {
                box.checked = checkAllBox.checked;
                box.closest("tr").classList.toggle("selected-row", box.checked);
            });

            updateEditIconState();
        });
    }

    // ------------------------------
    // EDIT
    // ------------------------------
    if (editIcon) {
        editIcon.addEventListener("click", () => {
            // Keep original protection:
            // do nothing if disabled
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

    // ------------------------------
    // DELETE ONE
    // ------------------------------
    document.addEventListener("click", async (event) => {
        const btn = event.target.closest(".delete-uoc-btn");
        if (!btn) return;

        const id = btn.dataset.id;

        if (!confirm("Do you want to delete this row?")) return;

        try {
            const response = await fetch(`/delete_auoc/${id}`, { method: "DELETE" });
            const data = await response.json();

            if (data.success) {
                // Reload current page so pagination stays consistent
                loadPage(currentPage);
            } else {
                alert(data.message || "Failed to delete the data.");
            }
        } catch {
            alert("Error deleting.");
        }
    });

    // ------------------------------
    // DELETE ALL
    // ------------------------------
    if (deleteAllBtn) {
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
                    // Reload current page so pagination stays consistent
                    loadPage(currentPage);
                    alert("Deletion completed.");
                } else {
                    alert(data.message || "An error occurred while deleting.");
                }
            } catch {
                alert("Error deleting uocs.");
            }
        });
    }

    // ------------------------------
    // PAGINATION
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
        if (!pageNumbers) return;

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

    function updatePagination(meta) {
        currentPage = meta.page;
        totalPages = Math.max(1, Math.ceil(meta.total_count / meta.per_page));

        if (prevPageBtn) {
            prevPageBtn.disabled = !meta.has_prev;
        }

        if (nextPageBtn) {
            nextPageBtn.disabled = !meta.has_next;
        }

        renderPageNumbers();
    }

    // ------------------------------
    // SEARCH + LOAD PAGE
    // ------------------------------
    function loadPage(page) {
        fetch(`/searchauocs?id=${encodeURIComponent(uocId)}&q=${encodeURIComponent(currentQuery)}&page=${page}`)
            .then(res => res.json())
            .then(data => {
                updateTable(data.uocs);
                updatePagination(data);
            })
            .catch(() => {
                tableBody.innerHTML = "<tr><td colspan='6'>Error loading results</td></tr>";
                updateCheckAllState();
                updateEditIconState();
            });
    }

    // ------------------------------
    // SEARCH
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
    // INIT
    // ------------------------------
    loadPage(currentPage);
});