document.addEventListener("DOMContentLoaded", () => {

    const searchInput = document.getElementById("ds-search-input");
    const tableBody = document.getElementById("ds-table-body");
    const checkAllBox = document.getElementById("check-all");
    const deleteAllBtn = document.querySelector(".delete-all-btn");

    const editIcon = document.querySelector(".ds-icon.edit-icon");
    const viewIcon = document.querySelector(".ds-icon.view-icon");

    const prevPageBtn = document.getElementById("prev-page-btn");
    const nextPageBtn = document.getElementById("next-page-btn");
    const pageNumbers = document.getElementById("page-numbers");

    let currentPage = window.dsPagination?.initialPage || 1;
    let currentQuery = "";
    let totalPages = Math.max(
        1,
        Math.ceil(
            (window.dsPagination?.totalCount || 0) /
            (window.dsPagination?.perPage || 10)
        )
    );

    // ------------------------------
    // TABLE RENDER
    // ------------------------------
    function updateTable(rows) {
        tableBody.innerHTML = "";

        if (!rows || rows.length === 0) {
            tableBody.innerHTML = "<tr><td colspan='7'>No results found</td></tr>";
            updateCheckAllBox();
            updateEditIconState();
            updateViewIconState();
            return;
        }

        rows.forEach(task => {
            const row = document.createElement("tr");

            row.innerHTML = `
                <td><input type="checkbox" class="ds-checkbox" data-id="${task.IDT}"></td>
                <td>${task.IDT}</td>
                <td>${task.TName}</td>
                <td>${task.Region}</td>
                <td>${task.Description}</td>
                <td>${task.EntryDate}</td>
                <td>
                    <button class="delete-ds-btn" data-id="${task.IDT}">
                        <img src="/static/img/trash-red.png">
                    </button>
                </td>
            `;

            tableBody.appendChild(row);
        });

        attachBehavior();
        updateCheckAllBox();
        updateEditIconState();
        updateViewIconState();
    }

    // ------------------------------
    // SELECTION BEHAVIOR
    // ------------------------------
    function attachBehavior() {
        document.querySelectorAll("#ds-table-body tr").forEach(row => {
            row.onclick = (e) => {
                if (
                    e.target.classList.contains("ds-checkbox") ||
                    e.target.closest(".delete-ds-btn")
                ) return;

                const box = row.querySelector(".ds-checkbox");
                box.checked = !box.checked;
                row.classList.toggle("selected-row", box.checked);

                updateCheckAllBox();
                updateEditIconState();
                updateViewIconState();
            };
        });

        document.querySelectorAll(".ds-checkbox").forEach(box => {
            box.onchange = () => {
                box.closest("tr").classList.toggle("selected-row", box.checked);
                updateCheckAllBox();
                updateEditIconState();
                updateViewIconState();
            };
        });
    }

    function updateCheckAllBox() {
        const all = document.querySelectorAll(".ds-checkbox");
        const checked = document.querySelectorAll(".ds-checkbox:checked");
        checkAllBox.checked = all.length > 0 && all.length === checked.length;
    }

    checkAllBox.addEventListener("change", () => {
        document.querySelectorAll(".ds-checkbox").forEach(box => {
            box.checked = checkAllBox.checked;
            box.closest("tr").classList.toggle("selected-row", box.checked);
        });

        updateEditIconState();
        updateViewIconState();
    });

    // ------------------------------
    // EDIT / VIEW STATE
    // ------------------------------
    function updateEditIconState() {
        const checked = document.querySelectorAll(".ds-checkbox:checked");
        editIcon?.classList.toggle("disabled", checked.length !== 1);
    }

    function updateViewIconState() {
        const checked = document.querySelectorAll(".ds-checkbox:checked");
        viewIcon?.classList.toggle("disabled", checked.length !== 1);
    }

    // ------------------------------
    // EDIT CLICK
    // ------------------------------
    if (editIcon) {
        editIcon.addEventListener("click", () => {
            if (editIcon.classList.contains("disabled")) return;

            const checked = document.querySelectorAll(".ds-checkbox:checked");
            if (checked.length !== 1) return;

            const row = checked[0].closest("tr");
            const id = checked[0].dataset.id;
            const name = row.children[2].textContent.trim();

            const url = editIcon.querySelector("img").dataset.url;
            window.location.href = `${url}?id=${id}&name=${encodeURIComponent(name)}`;
        });
    }

    // ------------------------------
    // VIEW CLICK
    // ------------------------------
    if (viewIcon) {
        viewIcon.addEventListener("click", () => {
            if (viewIcon.classList.contains("disabled")) return;

            const checked = document.querySelectorAll(".ds-checkbox:checked");
            if (checked.length !== 1) return;

            const row = checked[0].closest("tr");
            const id = checked[0].dataset.id;
            const name = row.children[2].textContent.trim();

            const url = viewIcon.querySelector("img").dataset.url;
            window.location.href = `${url}?id=${id}&name=${encodeURIComponent(name)}`;
        });
    }

    // ------------------------------
    // DELETE SINGLE
    // ------------------------------
    document.addEventListener("click", async (e) => {
        const btn = e.target.closest(".delete-ds-btn");
        if (!btn) return;

        const id = btn.dataset.id;

        if (!confirm("Delete this task and datasheet?")) return;

        const res = await fetch(`/delete_datasheet/${id}`, { method: "DELETE" });
        const data = await res.json();

        if (data.success) {
            loadPage(currentPage); // 🔥 important fix
        }
    });

    // ------------------------------
    // DELETE ALL
    // ------------------------------
    deleteAllBtn.addEventListener("click", async () => {
        const selected = [...document.querySelectorAll(".ds-checkbox:checked")];

        if (!selected.length) return alert("No tasks selected.");
        if (!confirm("Delete ALL selected?")) return;

        const ids = selected.map(x => x.dataset.id);

        const res = await fetch("/delete_datasheets", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ task_ids: ids })
        });

        const data = await res.json();

        if (data.success) {
            loadPage(currentPage); // 🔥 important fix
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
        // Note the updated URL here:
        fetch(`/searchtasks_with_datasheet?q=${encodeURIComponent(currentQuery)}&page=${page}`)
            .then(res => res.json())
            .then(data => {
                updateTable(data.tasks);
                updatePagination(data);
            })
            .catch(err => console.error("Error loading tasks:", err));
    }

    // ------------------------------
    // SEARCH
    // ------------------------------
    searchInput.addEventListener("input", () => {
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