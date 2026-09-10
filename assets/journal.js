const search = document.querySelector('#journal-search');
const buttons = [...document.querySelectorAll('.filter')];
const cards = [...document.querySelectorAll('[data-post]')];
let category = 'All';
function filterPosts() {
  const query = search.value.trim().toLocaleLowerCase();
  let count = 0;
  for (const card of cards) {
    const matches = (category === 'All' || card.dataset.category === category) && card.dataset.search.includes(query);
    card.hidden = !matches;
    if (matches) count++;
  }
  document.querySelector('#empty-results').hidden = count > 0;
  document.querySelector('#result-count').textContent = `${count} ${count === 1 ? 'guide' : 'guides'} found`;
}
if (search) {
  search.addEventListener('input', filterPosts);
  for (const button of buttons) button.addEventListener('click', () => {
    category = button.dataset.filter;
    for (const item of buttons) item.setAttribute('aria-pressed', String(item === button));
    filterPosts();
  });
  document.querySelector('.journal-tools').hidden = false;
}
