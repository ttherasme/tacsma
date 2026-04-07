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

    const prevPageBtn = document.getElementById("prev-page-btn");
    const nextPageBtn = document.getElementById("next-page-btn");
    const pageNumbers = document.getElementById("page-numbers");

    let currentPage = window.elementPagination?.initialPage || 1;
    let currentQuery = "";
    let totalPages = Math.max(
        1,
        Math.ceil((window.elementPagination?.totalCount || 0) / (window.elementPagination?.perPage || 10))
    );

    // ------------------------------
    // HANDLERS FOR MULTIPLE SELECTION
    // ------------------------------
    function handleCheckboxChange(event) {
        const box = event.target;
        box.closest("tr").classList.toggle("selected-row", box.checked);
        updateCheckAllState();
        updateEditIconState();
    }

    function handleRowClick(event) {
        if (
            event.target.classList.contains("uom-checkbox") ||
            event.target.closest(".delete-uom-btn")
        ) {
            return;
        }

        const row = event.currentTarget;
        const box = row.querySelector(".uom-checkbox");

        box.checked = !box.checked;
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
            box.removeEventListener("change", handleCheckboxChange);
            box.addEventListener("change", handleCheckboxChange);
        });
    }

    function attachRowClickBehavior() {
        const rows = document.querySelectorAll("#uom-table-body tr");

        rows.forEach(row => {
            row.removeEventListener("click", handleRowClick);
            row.addEventListener("click", handleRowClick);
        });
    }

    // ------------------------------
    // RENDER TABLE
    // ------------------------------
    function updateTable(elements) {
        tableBody.innerHTML = "";

        if (!elements || elements.length === 0) {
            tableBody.innerHTML = "<tr><td colspan='6'>No results found</td></tr>";
            updateCheckAllState();
            updateEditIconState();
            return;
        }

        elements.forEach(element => {
            const row = document.createElement("tr");
            const entryDate = element.EntryDate ? element.EntryDate : "";

            row.innerHTML = `
                <td><input type="checkbox" class="uom-checkbox" data-id="${element.IDE}"></td>
                <td>${element.IDE}</td>
                <td>${element.EName}</td>
                <td>${element.IName}</td>
                <td>${entryDate}</td>
                <td>
                    <button class="delete-uom-btn" data-id="${element.IDE}">
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
        editIcon.classList.toggle("disabled", count !== 1);
    }

    if (editIcon) {
        editIcon.addEventListener("click", () => {
            const checked = document.querySelectorAll(".uom-checkbox:checked");

            if (checked.length === 0) {
                return alert("Please select an element to edit.");
            }

            if (checked.length > 1) {
                return alert("Please select only one element to edit.");
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
        const btn = event.target.closest(".delete-uom-btn");
        if (!btn) return;

        const id = btn.dataset.id;

        if (!confirm("Do you want to delete this element?")) return;

        try {
            const response = await fetch(`/delete_element/${id}`, { method: "DELETE" });
            const data = await response.json();

            if (data.success) {
                loadPage(currentPage);
            } else {
                alert(data.message || "Failed to delete element.");
            }
        } catch {
            alert("Error deleting element.");
        }
    });

    // ------------------------------
    // DELETE ALL
    // ------------------------------
    deleteAllBtn.addEventListener("click", async () => {
        const selected = [...document.querySelectorAll(".uom-checkbox:checked")];

        if (selected.length === 0) {
            return alert("No elements selected.");
        }

        if (!confirm("Do you want to delete ALL selected elements?")) return;

        const ids = selected.map(box => box.dataset.id);

        try {
            const response = await fetch("/delete_elements", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ element_ids: ids }),
            });

            const data = await response.json();

            if (data.success) {
                loadPage(currentPage);
                alert("Deletion completed.");
            } else {
                alert(data.message || "An error occurred while deleting elements.");
            }
        } catch {
            alert("Error deleting elements.");
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
        span.style.padding = "0 4px";
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
            pageNumbers.appendChild(createPageButton(totalPages, currentPage === totalPages));
        }
    }

    // ------------------------------
    // PAGINATION UI
    // ------------------------------
    function updatePagination(meta) {
        currentPage = meta.page;
        totalPages = Math.max(1, Math.ceil(meta.total_count / meta.per_page));

        prevPageBtn.disabled = !meta.has_prev;
        nextPageBtn.disabled = !meta.has_next;

        renderPageNumbers();
    }

    // ------------------------------
    // SEARCH + LOAD PAGE
    // ------------------------------
    function loadPage(page) {
        fetch(`/search_elements?q=${encodeURIComponent(currentQuery)}&page=${page}`)
            .then(res => res.json())
            .then(data => {
                updateTable(data.elements);
                updatePagination(data);
            })
            .catch(() => {
                tableBody.innerHTML = "<tr><td colspan='6'>Error loading results</td></tr>";
            });
    }

    searchInput.addEventListener("input", () => {
        currentQuery = searchInput.value.trim();
        currentPage = 1;
        loadPage(1);
    });

    searchButton.addEventListener("click", () => {
        currentQuery = searchInput.value.trim();
        currentPage = 1;
        loadPage(1);
    });

    prevPageBtn.addEventListener("click", () => {
        if (currentPage > 1) {
            loadPage(currentPage - 1);
        }
    });

    nextPageBtn.addEventListener("click", () => {
        if (currentPage < totalPages) {
            loadPage(currentPage + 1);
        }
    });

    // ------------------------------
    // INITIAL LOAD
    // ------------------------------
    loadPage(currentPage);
});