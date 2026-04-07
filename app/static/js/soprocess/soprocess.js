document.addEventListener("DOMContentLoaded", () => {

    const searchInput = document.getElementById("sop-search-input");
    const tableBody = document.getElementById("sop-table-body");
    const searchButton = document.querySelector(".sop-search .search-btn");

    const checkAllBox = document.getElementById("check-all");
    const deleteAllBtn = document.querySelector(".delete-all-btn");
    const editIcon = document.querySelector(".sop-icon.edit-icon");

    const prevPageBtn = document.getElementById("prev-page-btn");
    const nextPageBtn = document.getElementById("next-page-btn");
    const pageNumbers = document.getElementById("page-numbers");

    let currentPage = window.sopPagination?.initialPage || 1;
    let currentQuery = "";
    let totalPages = Math.max(
        1,
        Math.ceil(
            (window.sopPagination?.totalCount || 0) /
            (window.sopPagination?.perPage || 10)
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
        if (e.target.classList.contains("sop-checkbox") ||
            e.target.closest(".delete-sop-btn")) return;

        const row = e.currentTarget;
        const box = row.querySelector(".sop-checkbox");

        box.checked = !box.checked;
        row.classList.toggle("selected-row", box.checked);

        updateCheckAllState();
        updateEditIconState();
    }

    function attachBehaviors() {
        document.querySelectorAll(".sop-checkbox").forEach(box => {
            box.removeEventListener("change", handleCheckboxChange);
            box.addEventListener("change", handleCheckboxChange);
        });

        document.querySelectorAll("#sop-table-body tr").forEach(row => {
            row.removeEventListener("click", handleRowClick);
            row.addEventListener("click", handleRowClick);
        });
    }

    // ------------------------------
    // TABLE
    // ------------------------------
    function updateTable(steps) {
        tableBody.innerHTML = "";

        if (!steps || steps.length === 0) {
            tableBody.innerHTML = "<tr><td colspan='6'>No results found</td></tr>";
            updateCheckAllState();
            updateEditIconState();
            return;
        }

        steps.forEach(step => {
            const row = document.createElement("tr");

            row.innerHTML = `
                <td><input type="checkbox" class="sop-checkbox" data-id="${step.IDS}"></td>
                <td>${step.IDS}</td>
                <td>${step.SName}</td>
                <td>${step.State}</td>
                <td>${step.EntryDate || ""}</td>
                <td>
                    <button class="delete-sop-btn" data-id="${step.IDS}">
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
        const all = document.querySelectorAll(".sop-checkbox");
        const checked = document.querySelectorAll(".sop-checkbox:checked");

        if (!checkAllBox) return;

        checkAllBox.checked = all.length > 0 && all.length === checked.length;
    }

    if (checkAllBox) {
        checkAllBox.addEventListener("change", () => {
            document.querySelectorAll(".sop-checkbox").forEach(box => {
                box.checked = checkAllBox.checked;
                box.closest("tr").classList.toggle("selected-row", box.checked);
            });
            updateEditIconState();
        });
    }

    function updateEditIconState() {
        const count = document.querySelectorAll(".sop-checkbox:checked").length;
        editIcon?.classList.toggle("disabled", count !== 1);
    }

    if (editIcon) {
        editIcon.addEventListener("click", () => {
            const checked = document.querySelectorAll(".sop-checkbox:checked");

            if (checked.length !== 1) {
                if (editIcon.classList.contains("disabled")) return;
            }

            const id = checked[0].dataset.id;
            const url = editIcon.querySelector("img").dataset.url;
            window.location.href = `${url}?id=${id}`;
        });
    }

    // ------------------------------
    // DELETE
    // ------------------------------
    document.addEventListener("click", async (e) => {
        const btn = e.target.closest(".delete-sop-btn");
        if (!btn) return;

        const id = btn.dataset.id;

        if (!confirm("Delete this step?")) return;

        const res = await fetch(`/delete_step/${id}`, { method: "DELETE" });
        const data = await res.json();

        if (data.success) {
            loadPage(currentPage);
        } else {
            alert("Delete failed");
        }
    });

    if (deleteAllBtn) {
        deleteAllBtn.addEventListener("click", async () => {
            const selected = [...document.querySelectorAll(".sop-checkbox:checked")];

            if (!selected.length) return alert("No steps selected.");
            if (!confirm("Delete ALL selected?")) return;

            const ids = selected.map(x => x.dataset.id);

            const res = await fetch("/delete_steps", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ step_ids: ids })
            });

            const data = await res.json();

            if (data.success) {
                loadPage(currentPage);
            } else {
                alert("Delete failed");
            }
        });
    }

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
        fetch(`/searchsops?q=${encodeURIComponent(currentQuery)}&page=${page}`)
            .then(r => r.json())
            .then(data => {
                updateTable(data.steps);
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

    if (searchButton) {
        searchButton.addEventListener("click", () => {
            currentQuery = searchInput.value.trim();
            currentPage = 1;
            loadPage(1);
        });
    }

    prevPageBtn.addEventListener("click", () => {
        if (currentPage > 1) loadPage(currentPage - 1);
    });

    nextPageBtn.addEventListener("click", () => {
        if (currentPage < totalPages) loadPage(currentPage + 1);
    });

    // INIT
    loadPage(currentPage);
});