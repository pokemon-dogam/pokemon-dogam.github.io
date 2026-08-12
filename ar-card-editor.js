"use strict";

(function () {
  const SDK_VERSION = "12.16.0";
  const CONFIG = window.POKEMON_DEX_FIREBASE || {};
  const SERIES_URL = "./data/series.json";
  const account = window.PokemonDexPageAccount;

  if (!account) return;

  let overrides = {};
  let editorGroups = [];
  let activeCard = null;
  let seriesCatalogPromise = null;

  function normalizeSetCode(value) {
    return String(value || "")
      .trim()
      .replace(/\s+/g, "")
      .replace(/[^a-z0-9-]/gi, "")
      .toUpperCase();
  }

  function normalizedCardNumber(value) {
    const numerator = String(value || "")
      .split("/")[0]
      .match(/\d{1,4}/)?.[0];
    return numerator ? numerator.padStart(3, "0") : "";
  }

  function normalizeCardName(value) {
    return String(value || "")
      .trim()
      .toLocaleLowerCase("ko-KR")
      .replace(/\s+(ex|v|vmax|vstar)$/i, "")
      .replace(/[\s·._()\-]+/g, "");
  }

  function namesAreCompatible(inputName, catalogName) {
    const input = normalizeCardName(inputName);
    const catalog = normalizeCardName(catalogName);
    return (
      !input ||
      !catalog ||
      input === catalog ||
      input.includes(catalog) ||
      catalog.includes(input)
    );
  }

  function normalizeOverride(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    return {
      owned: Boolean(value.owned),
      setCode: String(value.setCode || "").trim(),
      cardNumber: String(value.cardNumber || "").trim(),
      cardName: String(value.cardName || "").trim(),
      imageUrl: String(value.imageUrl || "").trim(),
    };
  }

  async function loadOwnOverrides() {
    if (!account.canEdit?.() || !account.currentUser) return;

    try {
      const [appModule, firestoreModule] = await Promise.all([
        import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-app.js`),
        import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-firestore.js`),
      ]);
      const app = appModule.getApps().length
        ? appModule.getApp()
        : appModule.initializeApp(CONFIG.config || {});
      const db = firestoreModule.getFirestore(app);
      const documentRef = firestoreModule.doc(
        db,
        "users",
        account.currentUser.uid,
        CONFIG.userCollection || "collections",
        "arDex",
      );
      const snapshot = await firestoreModule.getDoc(documentRef);
      overrides = snapshot.exists() ? snapshot.data()?.overrides || {} : {};
    } catch (error) {
      console.warn("AR 실제 보유 카드 정보를 불러오지 못했습니다.", error);
      overrides = {};
    }
  }

  function applyActualCard(card) {
    if (!card?.accountKey) return;
    const item = normalizeOverride(overrides[card.accountKey]);
    card.actualSetCode = item?.owned ? item.setCode : "";
    card.actualCardNumber = item?.owned ? item.cardNumber : "";
    card.actualName = item?.owned ? item.cardName : "";
    card.actualImage = item?.owned ? item.imageUrl : "";
    if (item?.owned && item.imageUrl) card.image = item.imageUrl;
  }

  function applyActualCards(groups) {
    editorGroups = groups || [];
    editorGroups.forEach((group) => {
      (group.cards || []).forEach(applyActualCard);
    });
  }

  const originalReady = account.ready;
  account.ready = Promise.resolve(originalReady).then(loadOwnOverrides);

  const originalApplyGroups = account.applyGroups.bind(account);
  account.applyGroups = function applyGroupsWithActualCards(groups) {
    const result = originalApplyGroups(groups);
    applyActualCards(groups);
    return result;
  };

  function cardByDialogCode() {
    const code = document.querySelector("#dialog-code")?.textContent?.trim();
    if (!code) return null;
    for (const group of editorGroups) {
      const card = (group.cards || []).find((candidate) => candidate.code === code);
      if (card) return card;
    }
    return null;
  }

  function catalogCardNumber(card) {
    const value = String(card?.cardNumber || card?.code || card?.meta || "");
    const separator = value.lastIndexOf("_");
    return separator >= 0 ? value.slice(separator + 1) : value;
  }

  async function loadSeriesCatalog() {
    if (!seriesCatalogPromise) {
      seriesCatalogPromise = fetch(SERIES_URL, { cache: "no-store" })
        .then((response) => {
          if (!response.ok) throw new Error(`series.json ${response.status}`);
          return response.json();
        })
        .catch((error) => {
          console.warn("시리즈 카드 목록을 불러오지 못했습니다.", error);
          return [];
        });
    }
    return seriesCatalogPromise;
  }

  async function lookupSeriesCard(setCode, cardNumber, cardName) {
    const normalizedSet = normalizeSetCode(setCode);
    const normalizedNumber = normalizedCardNumber(cardNumber);
    if (!normalizedSet || !normalizedNumber) return null;

    const groups = await loadSeriesCatalog();
    const group = groups.find(
      (candidate) =>
        normalizeSetCode(candidate.code || candidate.name) === normalizedSet,
    );
    if (!group) return null;

    const numberMatches = (group.cards || []).filter((card) => {
      const code = String(card.code || card.meta || "");
      const codeSet = code.includes("_") ? code.split("_")[0] : group.code;
      return (
        normalizeSetCode(codeSet) === normalizedSet &&
        normalizedCardNumber(catalogCardNumber(card)) === normalizedNumber
      );
    });
    if (!numberMatches.length) return null;

    const matched =
      numberMatches.find((card) => namesAreCompatible(cardName, card.name)) ||
      numberMatches[0];

    if (matched.name && cardName && !namesAreCompatible(cardName, matched.name)) {
      throw new Error(
        `입력한 카드명(${cardName})과 검색된 카드명(${matched.name})이 다릅니다. 카드번호를 확인해주세요.`,
      );
    }

    return {
      imageUrl: matched.originalImage || matched.image || "",
      cardName: matched.name || cardName,
    };
  }

  function officialImageCandidates(setCode, cardNumber) {
    const code = normalizeSetCode(setCode);
    const number = normalizedCardNumber(cardNumber);
    if (!code || !number) return [];

    const typedCode = String(setCode || "")
      .trim()
      .replace(/\s+/g, "")
      .replace(/[^a-z0-9-]/gi, "");
    const canonicalCode = typedCode
      .replace(/^sv/i, "SV")
      .replace(/^sm/i, "SM")
      .replace(/^xy/i, "XY")
      .replace(/^bw/i, "BW")
      .replace(/^m/i, "M")
      .replace(/^s/i, "S");
    const codeVariants = [canonicalCode, code].filter(
      (value, index, values) => value && values.indexOf(value) === index,
    );

    let primaryRoot = "";
    if (code.startsWith("SV")) primaryRoot = "SV";
    else if (code.startsWith("SM")) primaryRoot = "SM";
    else if (code.startsWith("XY")) primaryRoot = "XY";
    else if (code.startsWith("BW")) primaryRoot = "BW";
    else if (/^M\d/.test(code)) primaryRoot = "MEGA";
    else if (code.startsWith("S")) primaryRoot = "S";

    const roots = [primaryRoot, "SV", "S", "MEGA", "SM", "XY", "BW"].filter(
      (root, index, values) => root && values.indexOf(root) === index,
    );
    const base = "https://cards.image.pokemonkorea.co.kr/data/wmimages";

    return roots.flatMap((root) =>
      codeVariants.flatMap((candidateCode) => [
        `${base}/${root}/${candidateCode}/${candidateCode}_${number}.png`,
        `${base}/${root}/${candidateCode}/${candidateCode}_${number}.jpg`,
      ]),
    );
  }

  function imageLoads(url, timeout = 5000) {
    return new Promise((resolve) => {
      if (!url) {
        resolve(false);
        return;
      }

      let parsed;
      try {
        parsed = new URL(url, window.location.href);
      } catch {
        resolve(false);
        return;
      }
      if (!["http:", "https:"].includes(parsed.protocol)) {
        resolve(false);
        return;
      }

      const probe = new Image();
      let settled = false;
      const finish = (success) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        probe.onload = null;
        probe.onerror = null;
        resolve(success);
      };
      const timer = setTimeout(() => finish(false), timeout);
      probe.onload = () => finish(probe.naturalWidth > 0);
      probe.onerror = () => finish(false);
      probe.src = parsed.href;
    });
  }

  async function findOwnedCardImage(setCode, cardNumber, cardName) {
    const catalogMatch = await lookupSeriesCard(setCode, cardNumber, cardName);
    if (catalogMatch?.imageUrl && (await imageLoads(catalogMatch.imageUrl))) {
      return catalogMatch;
    }

    const candidates = officialImageCandidates(setCode, cardNumber);
    const results = await Promise.all(
      candidates.map(async (imageUrl) => ({
        imageUrl,
        loaded: await imageLoads(imageUrl),
      })),
    );
    const match = results.find((result) => result.loaded);
    return match ? { imageUrl: match.imageUrl, cardName } : null;
  }

  function setMessage(message, state = "") {
    const element = document.querySelector("#ar-editor-message");
    if (!element) return;
    element.textContent = message;
    element.dataset.state = state;
  }

  function setInput(id, value) {
    const input = document.querySelector(`#${id}`);
    if (input) input.value = value || "";
  }

  function setDetail(id, value) {
    const element = document.querySelector(`#${id}`);
    if (element) element.textContent = value || "—";
  }

  function updateOwnedFields() {
    const editor = document.querySelector("#ar-card-editor");
    if (!editor) return;
    const owned = Boolean(editor.querySelector("#ar-edit-owned")?.checked);
    editor.querySelectorAll("[data-ar-owned-field]").forEach((field) => {
      field.disabled = !owned;
    });
    const save = editor.querySelector("#ar-editor-save");
    if (save && !save.disabled) {
      save.textContent = owned ? "이미지 찾아 저장" : "미보유로 저장";
    }
    setMessage(
      owned
        ? "세트 코드와 카드번호로 실제 보유 카드 이미지를 자동 검색합니다."
        : "미보유로 저장하면 기준 AR 이미지로 돌아갑니다.",
    );
  }

  function fillEditor(card) {
    activeCard = card;
    if (!card) return;
    const item = normalizeOverride(overrides[card.accountKey]);
    const owned = item?.owned ?? Boolean(card.owned);
    const ownedInput = document.querySelector("#ar-edit-owned");
    if (ownedInput) ownedInput.checked = owned;

    setInput("ar-edit-set-code", item?.setCode || card.setCode);
    setInput(
      "ar-edit-card-number",
      item?.cardNumber || `${String(card.number).padStart(3, "0")}/${card.denominator}`,
    );
    setInput("ar-edit-card-name", item?.cardName || card.name);
    setInput("ar-edit-image-url", "");

    setDetail("dialog-actual-set", item?.owned ? item.setCode : "");
    setDetail("dialog-actual-number", item?.owned ? item.cardNumber : "");
    setDetail("dialog-actual-name", item?.owned ? item.cardName : "");
    updateOwnedFields();
  }

  async function saveCurrent() {
    if (!activeCard || !account.canEdit?.()) {
      alert("Google 로그인 후 내 AR 도감을 수정할 수 있습니다.");
      return;
    }

    const owned = Boolean(document.querySelector("#ar-edit-owned")?.checked);
    const setCode = document.querySelector("#ar-edit-set-code")?.value.trim() || "";
    const cardNumber = document.querySelector("#ar-edit-card-number")?.value.trim() || "";
    const cardName = document.querySelector("#ar-edit-card-name")?.value.trim() || "";
    const manualImageUrl = document.querySelector("#ar-edit-image-url")?.value.trim() || "";
    const saveButton = document.querySelector("#ar-editor-save");

    if (owned && (!normalizeSetCode(setCode) || !normalizedCardNumber(cardNumber) || !cardName)) {
      setMessage("보유 카드의 세트 코드, 카드번호, 카드명을 모두 입력해주세요.", "error");
      return;
    }

    if (owned && !namesAreCompatible(activeCard.name, cardName)) {
      setMessage(
        `이 AR 슬롯은 ${activeCard.name} 카드입니다. 같은 포켓몬 카드명으로 입력해주세요.`,
        "error",
      );
      return;
    }

    if (saveButton) {
      saveButton.disabled = true;
      saveButton.textContent = owned ? "카드 찾는 중…" : "저장 중…";
    }

    try {
      let imageUrl = "";
      if (owned) {
        setMessage("실제 보유 카드 이미지를 검색하고 있습니다.", "loading");
        const found = await findOwnedCardImage(setCode, cardNumber, cardName);
        if (found) {
          imageUrl = found.imageUrl;
        } else if (manualImageUrl) {
          setMessage("입력한 이미지 URL을 확인하고 있습니다.", "loading");
          if (!(await imageLoads(manualImageUrl))) {
            throw new Error("자동 검색과 직접 입력한 URL 모두에서 이미지를 불러오지 못했습니다.");
          }
          imageUrl = manualImageUrl;
        } else {
          const manual = document.querySelector("#ar-manual-image");
          if (manual) manual.open = true;
          throw new Error(
            "카드를 자동으로 찾지 못했습니다. 세트 코드와 카드번호를 확인하거나 이미지 URL을 직접 입력해주세요.",
          );
        }
      }

      const saved = await account.saveOverride(activeCard.accountKey, {
        owned,
        setCode: owned ? setCode : "",
        cardNumber: owned ? cardNumber : "",
        cardName: owned ? cardName : "",
        imageUrl: owned ? imageUrl : "",
      });
      overrides[activeCard.accountKey] = saved;
      window.location.reload();
    } catch (error) {
      console.error(error);
      setMessage(error.message || "저장하지 못했습니다.", "error");
      if (saveButton) {
        saveButton.disabled = false;
        saveButton.textContent = owned ? "이미지 찾아 저장" : "미보유로 저장";
      }
    }
  }

  async function resetCurrent() {
    if (!activeCard || !account.canEdit?.()) return;
    if (!confirm("이 AR에 입력한 실제 보유 카드 정보를 초기화할까요?")) return;

    const current = normalizeOverride(overrides[activeCard.accountKey]);
    try {
      const saved = await account.saveOverride(activeCard.accountKey, {
        owned: current?.owned ?? Boolean(activeCard.owned),
        setCode: "",
        cardNumber: "",
        cardName: "",
        imageUrl: "",
      });
      overrides[activeCard.accountKey] = saved;
      window.location.reload();
    } catch (error) {
      alert(error.message || "초기화하지 못했습니다.");
    }
  }

  function createEditor() {
    const dialog = document.querySelector("#catalog-dialog");
    const details = dialog?.querySelector(".dialog-details");
    if (!dialog || !details || dialog.querySelector("#ar-card-editor")) return;

    const rows = [
      ["내 실제 세트", "dialog-actual-set"],
      ["내 실제 카드번호", "dialog-actual-number"],
      ["내 실제 카드명", "dialog-actual-name"],
    ];
    for (const [label, id] of rows) {
      const row = document.createElement("div");
      row.className = "collection-detail-row collector-private-detail";
      row.innerHTML = `<dt>${label}</dt><dd id="${id}">—</dd>`;
      details.append(row);
    }

    const editor = document.createElement("section");
    editor.id = "ar-card-editor";
    editor.className = "collection-editor account-only-control";
    editor.innerHTML = `
      <div class="collection-editor-heading">
        <div><span>MY AR CARD</span><strong>내 실제 보유 카드 입력</strong></div>
        <label class="owned-switch"><input id="ar-edit-owned" type="checkbox" /><span>보유</span></label>
      </div>
      <div class="collection-editor-grid">
        <label><span>세트 코드</span><input id="ar-edit-set-code" data-ar-owned-field type="text" placeholder="예: sv2a" /></label>
        <label><span>카드번호</span><input id="ar-edit-card-number" data-ar-owned-field type="text" placeholder="예: 173/165" /></label>
        <label class="collection-editor-wide"><span>카드명</span><input id="ar-edit-card-name" data-ar-owned-field type="text" placeholder="예: 피카츄" /></label>
        <details id="ar-manual-image" class="manual-image-fallback collection-editor-wide">
          <summary>자동 검색이 안 될 때 이미지 URL 직접 입력</summary>
          <label><span>실제 카드 이미지 URL</span><input id="ar-edit-image-url" data-ar-owned-field type="url" inputmode="url" placeholder="https://..." /></label>
          <p>자동 검색을 먼저 시도하고, 찾지 못했을 때만 직접 입력한 주소를 사용합니다.</p>
        </details>
      </div>
      <p id="ar-editor-message" class="collection-editor-message"></p>
      <div class="collection-editor-actions">
        <button id="ar-editor-reset" class="manager-button manager-button--danger" type="button">실제 카드 입력 초기화</button>
        <button id="ar-editor-save" class="primary-button" type="button">이미지 찾아 저장</button>
      </div>
      <p class="collection-save-hint">기준 AR 슬롯 정보는 유지되며, 실제 보유 카드와 이미지는 로그인한 내 계정에만 저장됩니다.</p>
    `;
    details.after(editor);

    editor.querySelector("#ar-editor-save")?.addEventListener("click", saveCurrent);
    editor.querySelector("#ar-editor-reset")?.addEventListener("click", resetCurrent);
    editor.querySelector("#ar-edit-owned")?.addEventListener("change", updateOwnedFields);

    editor.hidden = !account.canEdit?.();

    const observer = new MutationObserver(() => {
      if (!dialog.open) return;
      fillEditor(cardByDialogCode());
      editor.hidden = !account.canEdit?.();
    });
    observer.observe(dialog, { attributes: true, attributeFilter: ["open"] });
  }

  createEditor();
})();
