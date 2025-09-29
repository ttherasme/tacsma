  document.addEventListener('DOMContentLoaded', function () {
    const searchInput = document.getElementById('userSearchInput');
    const tableRows = document.querySelectorAll('.user-table tbody tr');

    searchInput.addEventListener('input', function () {
      const query = this.value.toLowerCase();

      tableRows.forEach(row => {
        const cells = row.querySelectorAll('td');
        const rowText = Array.from(cells).map(td => td.textContent.toLowerCase()).join(' ');

        row.style.display = rowText.includes(query) ? '' : 'none';
      });
    });
  });