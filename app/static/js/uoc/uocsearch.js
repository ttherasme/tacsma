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

    let currentPage = window.uocPagination?.initialPage || 1;
    let currentQuery = "";
    let totalPages = Math.max(
        1,
        Math.ceil(
            (window.uocPagination?.totalCount || 0) /
            (window.uocPagination?.perPage || 10)
        )
    );

    // ------------------------------
    // EXISTING BEHAVIOR (UNCHANGED)
    // ------------------------------
    function handleCheckboxChange(e) {
        const box = e.target;
        box.closest("tr").classList.toggle("selected-row", box.checked);
        updateCheckAllState();
        updateEditIconState();
    }

    function handleRowClick(e) {
        if (
            e.target.classList.contains("uoc-checkbox") ||
            e.target.closest(".delete-uoc-btn") ||
            e.target.closest("a")
        ) return;

        const row = e.currentTarget;
        const box = row.querySelector(".uoc-checkbox");

        box.checked = !box.checked;
        row.classList.toggle("selected-row", box.checked);

        updateCheckAllState();
        updateEditIconState();
    }

    function attachBehaviors() {
        document.querySelectorAll(".uoc-checkbox").forEach(box => {
            box.removeEventListener("change", handleCheckboxChange);
            box.addEventListener("change", handleCheckboxChange);
        });

        document.querySelectorAll("#uoc-table-body tr").forEach(row => {
            row.removeEventListener("click", handleRowClick);
            row.addEventListener("click", handleRowClick);
        });
    }

    function updateTable(uocs) {
        tableBody.innerHTML = "";

        if (!uocs || uocs.length === 0) {
            tableBody.innerHTML = "<tr><td colspan='9'>No results found</td></tr>";
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
        const all = document.querySelectorAll(".uoc-checkbox");
        const checked = document.querySelectorAll(".uoc-checkbox:checked");

        checkAllBox.checked = all.length > 0 && all.length === checked.length;
    }

    checkAllBox.addEventListener("change", () => {
        document.querySelectorAll(".uoc-checkbox").forEach(box => {
            box.checked = checkAllBox.checked;
            box.closest("tr").classList.toggle("selected-row", box.checked);
        });
        updateEditIconState();
    });

    function updateEditIconState() {
        const count = document.querySelectorAll(".uoc-checkbox:checked").length;
        editIcon?.classList.toggle("disabled", count !== 1);
    }

    // ------------------------------
    // DELETE FIX (IMPORTANT)
    // ------------------------------
    document.addEventListener("click", async (e) => {
        const btn = e.target.closest(".delete-uoc-btn");
        if (!btn) return;

        const id = btn.dataset.id;

        if (!confirm("Delete this uoc?")) return;

        const res = await fetch(`/delete_uoc/${id}`, { method: "DELETE" });
        const data = await res.json();

        if (data.success) {
            loadPage(currentPage); // 🔥 FIX: reload page instead of removing row
        }
    });

    deleteAllBtn.addEventListener("click", async () => {
        const selected = [...document.querySelectorAll(".uoc-checkbox:checked")];

        if (!selected.length) return alert("No uocs selected.");
        if (!confirm("Delete ALL selected?")) return;

        const ids = selected.map(x => x.dataset.id);

        const res = await fetch("/delete_uocs", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ uoc_ids: ids })
        });

        const data = await res.json();

        if (data.success) {
            loadPage(currentPage); // 🔥 FIX
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
        fetch(`/searchuocs?q=${encodeURIComponent(currentQuery)}&page=${page}`)
            .then(r => r.json())
            .then(data => {
                updateTable(data.uocs);
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

    // INIT
    loadPage(currentPage);
});