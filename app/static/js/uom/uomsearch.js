document.addEventListener("DOMContentLoaded", () => {

    const searchInput = document.getElementById("uom-search-input");
    const tableBody = document.getElementById("uom-table-body");
    const searchButton = document.querySelector(".uom-search .search-btn");

    const checkAllBox = document.getElementById("check-all");
    const deleteAllBtn = document.querySelector(".delete-all-btn");
    const editIcon = document.querySelector(".uom-icon.edit-icon");

    const prevPageBtn = document.getElementById("prev-page-btn");
    const nextPageBtn = document.getElementById("next-page-btn");
    const pageNumbers = document.getElementById("page-numbers");

    let currentPage = window.uomPagination?.initialPage || 1;
    let currentQuery = "";
    let totalPages = Math.max(
        1,
        Math.ceil(
            (window.uomPagination?.totalCount || 0) /
            (window.uomPagination?.perPage || 10)
        )
    );

    // ------------------------------
    // SELECTION HANDLERS
    // ------------------------------
    function handleCheckboxChange(e) {
        const box = e.target;
        box.closest("tr").classList.toggle("selected-row", box.checked);
        updateCheckAllState();
        updateEditIconState();
    }

    function handleRowClick(e) {
        if (e.target.classList.contains("uom-checkbox") ||
            e.target.closest(".delete-uom-btn")) return;

        const row = e.currentTarget;
        const box = row.querySelector(".uom-checkbox");

        box.checked = !box.checked;
        row.classList.toggle("selected-row", box.checked);

        updateCheckAllState();
        updateEditIconState();
    }

    function attachBehaviors() {
        document.querySelectorAll(".uom-checkbox").forEach(box => {
            box.removeEventListener("change", handleCheckboxChange);
            box.addEventListener("change", handleCheckboxChange);
        });

        document.querySelectorAll("#uom-table-body tr").forEach(row => {
            row.removeEventListener("click", handleRowClick);
            row.addEventListener("click", handleRowClick);
        });
    }

    // ------------------------------
    // TABLE
    // ------------------------------
    function updateTable(uoms) {
        tableBody.innerHTML = "";

        if (!uoms || uoms.length === 0) {
            tableBody.innerHTML = "<tr><td colspan='7'>No results found</td></tr>";
            updateCheckAllState();
            updateEditIconState();
            return;
        }

        uoms.forEach(uom => {
            const row = document.createElement("tr");

            row.innerHTML = `
                <td><input type="checkbox" class="uom-checkbox" data-id="${uom.IDU}"></td>
                <td>${uom.IDU}</td>
                <td>${uom.UName}</td>
                <td>${uom.Unit}</td>
                <td>${uom.State}</td>
                <td>${uom.EntryDate || ""}</td>
                <td>
                    <button class="delete-uom-btn" data-id="${uom.IDU}">
                        <img src="/static/img/trash-red.png">
                    </button>
                </td>
            `;

            tableBody.appendChild(row);
        });

        attachBehaviors();
        updateCheckAllState();
        updateEditIconState();
    }

    function updateCheckAllState() {
        const all = document.querySelectorAll(".uom-checkbox");
        const checked = document.querySelectorAll(".uom-checkbox:checked");
        checkAllBox.checked = all.length > 0 && all.length === checked.length;
    }

    checkAllBox.addEventListener("change", () => {
        document.querySelectorAll(".uom-checkbox").forEach(box => {
            box.checked = checkAllBox.checked;
            box.closest("tr").classList.toggle("selected-row", box.checked);
        });
        updateEditIconState();
    });

    function updateEditIconState() {
        const count = document.querySelectorAll(".uom-checkbox:checked").length;
        editIcon?.classList.toggle("disabled", count !== 1);
    }

    if (editIcon) {
        editIcon.addEventListener("click", () => {
            const selected = document.querySelectorAll(".uom-checkbox:checked");

            if (selected.length === 0)
                return alert("Please select a uom to edit.");
            if (selected.length > 1)
                return alert("Please select only one uom.");

            const id = selected[0].dataset.id;
            const url = editIcon.querySelector("img").dataset.url;
            window.location.href = `${url}?id=${id}`;
        });
    }

    // ------------------------------
    // DELETE
    // ------------------------------
    document.addEventListener("click", async (e) => {
        const btn = e.target.closest(".delete-uom-btn");
        if (!btn) return;

        const id = btn.dataset.id;

        if (!confirm("Delete this uom?")) return;

        const res = await fetch(`/delete_uom/${id}`, { method: "DELETE" });
        const data = await res.json();

        if (data.success) {
            loadPage(currentPage);
        } else {
            alert("Delete failed");
        }
    });

    deleteAllBtn.addEventListener("click", async () => {
        const selected = [...document.querySelectorAll(".uom-checkbox:checked")];

        if (!selected.length)
            return alert("No uoms selected.");

        if (!confirm("Delete ALL selected?")) return;

        const ids = selected.map(x => x.dataset.id);

        const res = await fetch("/delete_uoms", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ uom_ids: ids })
        });

        const data = await res.json();

        if (data.success) {
            loadPage(currentPage);
        } else {
            alert("Delete failed");
        }
    });

    // ------------------------------
    // PAGINATION
    // ------------------------------
    function createBtn(page, active = false) {
        const btn = document.createElement("button");
        btn.textContent = page;

        if (active) {
            btn.disabled = true;
            btn.classList.add("active-page");
        }

        btn.onclick = () => loadPage(page);
        return btn;
    }

    function dots() {
        const s = document.createElement("span");
        s.textContent = "...";
        return s;
    }

    function renderPages() {
        pageNumbers.innerHTML = "";

        if (totalPages <= 1) return;

        let start = Math.max(1, currentPage - 2);
        let end = Math.min(totalPages, currentPage + 2);

        if (start > 1) {
            pageNumbers.appendChild(createBtn(1, currentPage === 1));
            if (start > 2) pageNumbers.appendChild(dots());
        }

        for (let i = start; i <= end; i++) {
            pageNumbers.appendChild(createBtn(i, i === currentPage));
        }

        if (end < totalPages) {
            if (end < totalPages - 1) pageNumbers.appendChild(dots());
            pageNumbers.appendChild(createBtn(totalPages, currentPage === totalPages));
        }
    }

    function updatePagination(meta) {
        currentPage = meta.page;
        totalPages = Math.max(1, Math.ceil(meta.total_count / meta.per_page));

        prevPageBtn.disabled = !meta.has_prev;
        nextPageBtn.disabled = !meta.has_next;

        renderPages();
    }

    function loadPage(page) {
        fetch(`/searchuoms?q=${encodeURIComponent(currentQuery)}&page=${page}`)
            .then(r => r.json())
            .then(data => {
                updateTable(data.uoms);
                updatePagination(data);
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

    searchButton.addEventListener("click", () => {
        currentQuery = searchInput.value.trim();
        currentPage = 1;
        loadPage(1);
    });

    prevPageBtn.addEventListener("click", () => {
        if (currentPage > 1) loadPage(currentPage - 1);
    });

    nextPageBtn.addEventListener("click", () => {
        if (currentPage < totalPages) loadPage(currentPage + 1);
    });

    // ------------------------------
    // INIT
    // ------------------------------
    loadPage(currentPage);
});