const peopleState = {
  data: null,
  generation: "all",
  category: "all",
  query: "",
  visible: 48,
};

const PEOPLE_PAGE_SIZE = 48;
const peopleById = new Map();

const peopleElement = (id) => document.getElementById(id);

function setPeopleText(id, value) {
  const element = peopleElement(id);
  if (element) element.textContent = value;
}

function peoplePercent(value, total) {
  return total ? Math.round((value / total) * 1000) / 10 : 0;
}

function normalizePeopleSearch(value) {
  return String(value || "")
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("ko");
}

function makeFilterButton(label, value, type, active = false) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.dataset[type] = value;
  button.classList.toggle("is-active", active);
  button.setAttribute("aria-pressed", String(active));
  return button;
}

function renderPeopleFilters() {
  const generationFilters = peopleElement("people-generation-filters");
  const categoryFilters = peopleElement("people-category-filters");
  if (!generationFilters || !categoryFilters || !peopleState.data) return;

  generationFilters.replaceChildren();
  generationFilters.append(
    makeFilterButton("전체", "all", "generation", peopleState.generation === "all"),
  );
  peopleState.data.generations.forEach((generation) => {
    generationFilters.append(
      makeFilterButton(
        `${generation}세대`,
        String(generation),
        "generation",
        peopleState.generation === String(generation),
      ),
    );
  });

  categoryFilters.replaceChildren();
  categoryFilters.append(
    makeFilterButton("전체", "all", "category", peopleState.category === "all"),
  );
  peopleState.data.categories.forEach((category) => {
    categoryFilters.append(
      makeFilterButton(category, category, "category", peopleState.category === category),
    );
  });
}

function renderGenerationSummary() {
  const summary = peopleElement("people-generation-summary");
  if (!summary || !peopleState.data) return;
  summary.replaceChildren();

  peopleState.data.generations.forEach((generation) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.generationSummary = String(generation);
    button.classList.toggle("is-active", peopleState.generation === String(generation));
    button.setAttribute("aria-pressed", String(peopleState.generation === String(generation)));
    button.innerHTML = `<span>${generation}세대</span><strong>${peopleState.data.metadata.counts.byGeneration[generation] || 0}명</strong>`;
    summary.append(button);
  });
}

function matchesPeopleFilter(person) {
  if (
    peopleState.generation !== "all" &&
    String(person.generation) !== peopleState.generation
  ) {
    return false;
  }
  if (peopleState.category !== "all" && person.category !== peopleState.category) {
    return false;
  }
  if (!peopleState.query) return true;
  return [person.nameKo, person.nameEn].some((value) =>
    normalizePeopleSearch(value).includes(peopleState.query),
  );
}

function filteredPeople() {
  return peopleState.data.people.filter(matchesPeopleFilter);
}

function initialsFor(person) {
  if (person.nameEn === "N") return "N";
  const words = person.nameEn.split(/\s+/).filter(Boolean);
  return words.length > 1
    ? words.map((word) => word[0]).join("").slice(0, 3).toUpperCase()
    : person.nameKo.slice(0, 2);
}

function makePeoplePlaceholder(person) {
  const placeholder = document.createElement("span");
  placeholder.className = "people-placeholder";
  placeholder.innerHTML = `<strong>${initialsFor(person)}</strong><span>CARD CHECK PENDING</span>`;
  return placeholder;
}

function makePeopleImage(person, large = false) {
  if (!person.image) return makePeoplePlaceholder(person);

  const image = document.createElement("img");
  image.className = large ? "people-dialog-image" : "card-image people-card-image";
  image.src = large ? person.imageLarge || person.image : person.image;
  image.alt = `${person.nameKo} 대표 포켓몬 카드`;
  image.loading = large ? "eager" : "lazy";
  image.decoding = "async";
  image.addEventListener(
    "error",
    () => {
      image.replaceWith(makePeoplePlaceholder(person));
    },
    { once: true },
  );
  return image;
}

function makePeopleStatus(person, longLabel = false) {
  const status = document.createElement("span");
  status.className = `people-card-status ${person.cardExists ? "is-confirmed" : "is-unconfirmed"}`;
  status.textContent = person.cardExists
    ? longLabel
      ? "카드 확인 완료"
      : "카드 확인"
    : longLabel
      ? "카드 추가 확인"
      : "미확인";
  return status;
}

function makeCategoryBadge(person) {
  const badge = document.createElement("span");
  badge.className = "people-category-badge";
  badge.dataset.category = person.category;
  badge.textContent = person.category;
  return badge;
}

function makePersonCard(person) {
  const article = document.createElement("article");
  article.className = "pokemon-card people-card";
  article.dataset.personId = person.id;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "pokemon-card-button";
  button.setAttribute("aria-label", `${person.nameKo} 상세 보기`);

  const imageWrap = document.createElement("span");
  imageWrap.className = "card-image-wrap";
  imageWrap.append(makePeopleImage(person));

  const body = document.createElement("span");
  body.className = "card-body";

  const top = document.createElement("span");
  top.className = "card-topline";
  const generation = document.createElement("span");
  generation.className = "number-badge";
  generation.textContent = `${person.generation}세대 · ${person.category}`;
  top.append(generation, makePeopleStatus(person));

  const nameKo = document.createElement("strong");
  nameKo.className = "card-name-ko";
  nameKo.textContent = person.nameKo;
  const nameEn = document.createElement("span");
  nameEn.className = "card-name-en";
  nameEn.textContent = person.nameEn.toLocaleUpperCase("en");
  const role = document.createElement("span");
  role.className = "people-card-role";
  role.textContent = person.role;
  const meta = document.createElement("span");
  meta.className = "card-meta";
  meta.textContent = `${person.affiliation} · ${person.region}지방`;

  body.append(top, nameKo, nameEn, role, meta);
  button.append(imageWrap, body);
  article.append(button);
  button.addEventListener("click", () => openPeopleDialog(person));
  return article;
}

function updatePeopleFilterLabel(resultCount) {
  const labels = [];
  if (peopleState.generation !== "all") labels.push(`${peopleState.generation}세대`);
  if (peopleState.category !== "all") labels.push(peopleState.category);
  if (peopleState.query) labels.push(`“${peopleState.query}”`);
  setPeopleText("people-active-filter-label", labels.length ? `· ${labels.join(" · ")}` : "");

  const reset = peopleElement("people-reset-filters");
  if (reset) reset.hidden = labels.length === 0;
  setPeopleText("people-result-count", resultCount);
}

function renderPeople() {
  const grid = peopleElement("people-grid");
  const empty = peopleElement("people-empty");
  const loadMore = peopleElement("people-load-more");
  if (!grid || !empty || !loadMore || !peopleState.data) return;

  const matches = filteredPeople();
  const visible = matches.slice(0, peopleState.visible);
  grid.replaceChildren(...visible.map(makePersonCard));
  grid.setAttribute("aria-busy", "false");
  grid.hidden = matches.length === 0;
  empty.hidden = matches.length !== 0;
  loadMore.hidden = visible.length >= matches.length;
  setPeopleText(
    "people-visible-count",
    matches.length ? `${visible.length} / ${matches.length}명 표시 중` : "",
  );
  updatePeopleFilterLabel(matches.length);
  renderPeopleFilters();
  renderGenerationSummary();
}

function selectPeopleGeneration(value) {
  peopleState.generation = value;
  peopleState.visible = PEOPLE_PAGE_SIZE;
  renderPeople();
}

function selectPeopleCategory(value) {
  peopleState.category = value;
  peopleState.visible = PEOPLE_PAGE_SIZE;
  renderPeople();
}

function resetPeopleFilters() {
  peopleState.generation = "all";
  peopleState.category = "all";
  peopleState.query = "";
  peopleState.visible = PEOPLE_PAGE_SIZE;
  const search = peopleElement("people-search");
  if (search) search.value = "";
  renderPeople();
}

function renderPeopleSummary() {
  const { counts } = peopleState.data.metadata;
  const rate = peoplePercent(counts.cardConfirmed, counts.total);
  setPeopleText("people-rate", `${rate}%`);
  setPeopleText("people-confirmed", counts.cardConfirmed);
  setPeopleText("people-total", counts.total);
  setPeopleText("people-unconfirmed", counts.unconfirmed);
  setPeopleText("stat-people-total", counts.total);
  setPeopleText("stat-people-confirmed", counts.cardConfirmed);
  setPeopleText("stat-people-unconfirmed", counts.unconfirmed);
  peopleElement("people-progress-ring")?.style.setProperty("--progress", rate);
}

function renderDialogCardList(person) {
  const list = peopleElement("people-dialog-card-list");
  const empty = peopleElement("people-dialog-card-empty");
  if (!list || !empty) return;
  list.replaceChildren();
  empty.hidden = person.cards.length > 0;
  setPeopleText("people-dialog-card-count", `${person.cards.length}장 연결`);

  person.cards.forEach((card) => {
    const link = document.createElement("a");
    link.className = "people-archive-card";
    link.href = card.source;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.setAttribute("aria-label", `${card.name} 공식 카드 데이터베이스에서 보기`);

    const image = document.createElement("img");
    image.src = card.image;
    image.alt = `${card.name} 카드`;
    image.loading = "lazy";
    const name = document.createElement("strong");
    name.textContent = card.name;
    const meta = document.createElement("small");
    meta.textContent = `${card.set} · ${card.number}`;
    link.append(image, name, meta);
    list.append(link);
  });
}

function openPeopleDialog(person) {
  const dialog = peopleElement("people-dialog");
  const visual = peopleElement("people-dialog-visual");
  if (!dialog || !visual) return;

  visual.replaceChildren(makePeopleImage(person, true));
  setPeopleText("people-dialog-generation", `${person.generation}세대`);
  const categoryHost = peopleElement("people-dialog-category");
  if (categoryHost) {
    categoryHost.dataset.category = person.category;
    categoryHost.textContent = person.category;
  }
  const cardStatusHost = peopleElement("people-dialog-card-status");
  if (cardStatusHost) {
    cardStatusHost.className = `people-card-status ${person.cardExists ? "is-confirmed" : "is-unconfirmed"}`;
    cardStatusHost.textContent = person.cardExists ? "카드 확인 완료" : "카드 추가 확인 필요";
  }

  setPeopleText("people-dialog-name-ko", person.nameKo);
  setPeopleText("people-dialog-name-en", person.nameEn);
  setPeopleText("people-dialog-generation-detail", `${person.generation}세대`);
  setPeopleText("people-dialog-role", person.role);
  setPeopleText("people-dialog-affiliation", `${person.affiliation} · ${person.region}지방`);
  setPeopleText(
    "people-dialog-representative",
    person.cards[0]
      ? `${person.cards[0].name} · ${person.cards[0].set} ${person.cards[0].number}`
      : "대표 카드 추가 확인 필요",
  );
  renderDialogCardList(person);
  dialog.showModal();
}

function bindPeopleEvents() {
  peopleElement("people-generation-filters")?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-generation]");
    if (button) selectPeopleGeneration(button.dataset.generation);
  });
  peopleElement("people-category-filters")?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-category]");
    if (button) selectPeopleCategory(button.dataset.category);
  });
  peopleElement("people-generation-summary")?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-generation-summary]");
    if (!button) return;
    const selected = button.dataset.generationSummary;
    selectPeopleGeneration(peopleState.generation === selected ? "all" : selected);
  });
  peopleElement("people-search")?.addEventListener("input", (event) => {
    peopleState.query = normalizePeopleSearch(event.target.value);
    peopleState.visible = PEOPLE_PAGE_SIZE;
    renderPeople();
  });
  peopleElement("people-reset-filters")?.addEventListener("click", resetPeopleFilters);
  document.querySelector("[data-people-reset]")?.addEventListener("click", resetPeopleFilters);
  peopleElement("people-load-more")?.addEventListener("click", () => {
    peopleState.visible += PEOPLE_PAGE_SIZE;
    renderPeople();
  });
  peopleElement("people-dialog-close")?.addEventListener("click", () => {
    peopleElement("people-dialog")?.close();
  });
  peopleElement("people-dialog")?.addEventListener("click", (event) => {
    if (event.target === event.currentTarget) event.currentTarget.close();
  });
  document.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase("en") === "k") {
      event.preventDefault();
      peopleElement("people-search")?.focus();
    }
  });
}

async function initPeopleArchive() {
  try {
    const response = await fetch("./data/people.json?v=20260810-1", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    peopleState.data = await response.json();
    peopleState.data.people.forEach((person) => peopleById.set(person.id, person));
    renderPeopleSummary();
    renderPeopleFilters();
    renderGenerationSummary();
    bindPeopleEvents();
    renderPeople();
  } catch (error) {
    console.error("인물도감 초기화 실패", error);
    peopleElement("people-error").hidden = false;
    peopleElement("people-grid")?.setAttribute("aria-busy", "false");
  }
}

void initPeopleArchive();
