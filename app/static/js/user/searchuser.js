document.addEventListener("DOMContentLoaded", () => {

    const searchInput = document.getElementById("userSearchInput");
    const tableBody = document.querySelector(".user-table tbody");

    const prevBtn = document.getElementById("prev-page-btn");
    const nextBtn = document.getElementById("next-page-btn");
    const pageNumbers = document.getElementById("page-numbers");

    let currentPage = window.userPagination?.initialPage || 1;
    let currentQuery = "";
    let totalPages = Math.max(
        1,
        Math.ceil(
            (window.userPagination?.totalCount || 0) /
            (window.userPagination?.perPage || 10)
        )
    );

    // ------------------------------
    // TABLE RENDER
    // ------------------------------
    function updateTable(users) {
        tableBody.innerHTML = "";

        if (!users || users.length === 0) {
            tableBody.innerHTML = "<tr><td colspan='6'>No users found.</td></tr>";
            return;
        }

        users.forEach(user => {
            const row = document.createElement("tr");

            row.innerHTML = `
                <td>${user.id}</td>
                <td>${user.username}</td>
                <td>${user.state}</td>
                <td>Level ${user.level} - ${user.level_name}</td>
                <td>${user.change}</td>
                <td>
                    <a href="/users/edit_user/${user.id}">Edit</a> |
                    <form action="/users/delete_user/${user.id}" method="post" style="display:inline;" onsubmit="return confirm('Delete this user?');">
                        <button type="submit" style="background:none; border:none; color:#c00; cursor:pointer;">Delete</button>
                    </form>
                </td>
            `;

            tableBody.appendChild(row);
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

        prevBtn.disabled = !meta.has_prev;
        nextBtn.disabled = !meta.has_next;

        renderPages();
    }

    function loadPage(page) {
        fetch(`/users/searchusers?q=${encodeURIComponent(currentQuery)}&page=${page}`)
            .then(res => res.json())
            .then(data => {
                updateTable(data.users);
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

    // ------------------------------
    // PREV / NEXT
    // ------------------------------
    prevBtn.addEventListener("click", () => {
        if (currentPage > 1) loadPage(currentPage - 1);
    });

    nextBtn.addEventListener("click", () => {
        if (currentPage < totalPages) loadPage(currentPage + 1);
    });

    // ------------------------------
    // INIT
    // ------------------------------
    loadPage(currentPage);
});