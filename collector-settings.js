"use strict";

(function () {
  const SDK_VERSION = "12.16.0";
  const CONFIG = window.POKEMON_DEX_FIREBASE || {};
  const registry = window.CollectorCollectionRegistry;
  const sync = window.CollectorPublicSync;
  const elements = {
    signInGate: document.querySelector("#collector-signin-gate"),
    signIn: document.querySelector("#collector-signin"),
    content: document.querySelector("#collector-settings-content"),
    error: document.querySelector("#collector-settings-error"),
    profileSummary: document.querySelector("#collector-profile-summary"),
    profileForm: document.querySelector("#collector-profile-form"),
    profileNickname: document.querySelector("#collector-profile-nickname"),
    profileBio: document.querySelector("#collector-profile-bio"),
    profilePublicId: document.querySelector("#collector-profile-public-id"),
    profileAvatar: document.querySelector("#collector-profile-avatar"),
    profileAvatarFallback: document.querySelector("#collector-profile-avatar-fallback"),
    profileEdit: document.querySelector("#collector-profile-edit"),
    profileCopy: document.querySelector("#collector-profile-copy"),
    nickname: document.querySelector("#collector-nickname"),
    bio: document.querySelector("#collector-bio"),
    bioCount: document.querySelector("#collector-bio-count"),
    avatarCurrent: document.querySelector("#collector-avatar-current"),
    avatarCurrentFallback: document.querySelector("#collector-avatar-current-fallback"),
    avatarFile: document.querySelector("#collector-avatar-file"),
    avatarRemove: document.querySelector("#collector-avatar-remove"),
    cropEditor: document.querySelector("#collector-crop-editor"),
    cropCanvas: document.querySelector("#collector-crop-canvas"),
    cropZoom: document.querySelector("#collector-crop-zoom"),
    profileStatus: document.querySelector("#collector-profile-status"),
    profileCancel: document.querySelector("#collector-profile-cancel"),
    profileSave: document.querySelector("#collector-profile-save"),
    settingsGrid: document.querySelector("#collector-settings-grid"),
    settingsStatus: document.querySelector("#collector-settings-status"),
    settingsSave: document.querySelector("#collector-settings-save"),
  };
  const crop = {
    source: null,
    width: 0,
    height: 0,
    zoom: 1,
    panX: 0,
    panY: 0,
    pointerId: null,
    startX: 0,
    startY: 0,
    startPanX: 0,
    startPanY: 0,
  };

  let firebase = null;
  let currentUser = null;
  let profile = null;
  let settings = new Map();
  let sourceDocuments = new Map();
  let pendingAvatarRemoval = false;

  function configured() {
    const config = CONFIG.config || {};
    return Boolean(
      CONFIG.enabled &&
        config.apiKey &&
        config.authDomain &&
        config.projectId,
    );
  }

  function setStatus(element, message, state = "") {
    if (!element) return;
    element.textContent = message;
    element.dataset.state = state;
  }

  function cleanNickname(value) {
    return String(value || "")
      .normalize("NFKC")
      .trim()
      .replace(/\s+/g, " ");
  }

  function normalizeNickname(value) {
    return cleanNickname(value)
      .toLocaleLowerCase("ko-KR")
      .replace(/ /g, "");
  }

  function validateNickname(value) {
    const nickname = cleanNickname(value);
    if (nickname.length < 2 || nickname.length > 20) {
      throw new Error("닉네임은 2자 이상 20자 이하로 입력해 주세요.");
    }
    if (!/^[가-힣A-Za-z0-9 ]+$/u.test(nickname)) {
      throw new Error("닉네임에는 한글, 영문, 숫자와 공백만 사용할 수 있습니다.");
    }
    return { nickname, nicknameNormalized: normalizeNickname(nickname) };
  }

  function randomId(length, alphabet) {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return [...bytes].map((value) => alphabet[value % alphabet.length]).join("");
  }

  function createPublicId() {
    return randomId(12, "abcdefghijklmnopqrstuvwxyz0123456789");
  }

  function createShareId() {
    return randomId(
      32,
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_",
    );
  }

  function profileUrl(publicId = profile?.publicId) {
    if (!publicId) return "";
    const url = new URL("./collector.html", window.location.href);
    url.searchParams.set("id", publicId);
    return url.href;
  }

  function collectionShareUrl(collectionId, setting) {
    if (setting.visibility === "private") return "";
    const meta = registry.COLLECTIONS[collectionId];
    const url = new URL(meta.href, window.location.href);
    if (setting.visibility === "public") {
      url.searchParams.set("collector", profile.publicId);
    } else {
      url.hash = new URLSearchParams({ share: setting.shareId }).toString();
    }
    return url.href;
  }

  async function copyText(
    value,
    successMessage,
    statusElement = elements.settingsStatus,
  ) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const input = document.createElement("textarea");
      input.value = value;
      input.setAttribute("readonly", "");
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.append(input);
      input.select();
      document.execCommand("copy");
      input.remove();
    }
    setStatus(statusElement, successMessage, "success");
  }

  function avatarDisplayUrl(sourceProfile = profile) {
    if (!sourceProfile?.avatarUrl) return "";
    const separator = sourceProfile.avatarUrl.includes("?") ? "&" : "?";
    return `${sourceProfile.avatarUrl}${separator}v=${sourceProfile.avatarVersion || 0}`;
  }

  function setAvatar(image, fallback, sourceProfile = profile) {
    const url = avatarDisplayUrl(sourceProfile);
    if (url) {
      image.src = url;
      image.hidden = false;
      fallback.hidden = true;
    } else {
      image.removeAttribute("src");
      image.hidden = true;
      fallback.hidden = false;
      fallback.textContent = (sourceProfile?.nickname || "C").slice(0, 1).toUpperCase();
    }
  }

  function renderProfile() {
    if (!profile?.profileCompleted) {
      elements.profileSummary.hidden = true;
      elements.profileForm.hidden = false;
      elements.profileCancel.hidden = true;
      elements.profileSave.textContent = "컬렉터 프로필 만들기";
      setAvatar(elements.avatarCurrent, elements.avatarCurrentFallback, null);
      return;
    }

    elements.profileNickname.textContent = profile.nickname;
    elements.profileBio.textContent = profile.bio || "한 줄 소개가 없습니다.";
    elements.profilePublicId.textContent = `PUBLIC ID · ${profile.publicId}`;
    setAvatar(elements.profileAvatar, elements.profileAvatarFallback);
    setAvatar(elements.avatarCurrent, elements.avatarCurrentFallback);
    elements.avatarRemove.hidden = !profile.avatarUrl;
    elements.profileSummary.hidden = false;
    elements.profileForm.hidden = true;
    elements.nickname.value = profile.nickname;
    elements.bio.value = profile.bio || "";
    elements.bioCount.textContent = String(elements.bio.value.length);
    elements.profileCancel.hidden = false;
    elements.profileSave.textContent = "프로필 저장";
  }

  function openProfileEditor() {
    elements.profileSummary.hidden = true;
    elements.profileForm.hidden = false;
    elements.nickname.focus();
    setStatus(elements.profileStatus, "");
  }

  function closeProfileEditor() {
    if (!profile) return;
    clearCrop();
    pendingAvatarRemoval = false;
    elements.nickname.value = profile.nickname;
    elements.bio.value = profile.bio || "";
    elements.bioCount.textContent = String(elements.bio.value.length);
    renderProfile();
  }

  function cropMetrics() {
    const baseScale = Math.max(512 / crop.width, 512 / crop.height);
    const scale = baseScale * crop.zoom;
    const drawWidth = crop.width * scale;
    const drawHeight = crop.height * scale;
    return {
      scale,
      drawWidth,
      drawHeight,
      maxPanX: Math.max(0, (drawWidth - 512) / 2),
      maxPanY: Math.max(0, (drawHeight - 512) / 2),
    };
  }

  function drawCrop() {
    if (!crop.source) return;
    const context = elements.cropCanvas.getContext("2d", { alpha: false });
    const metrics = cropMetrics();
    crop.panX = Math.max(-metrics.maxPanX, Math.min(metrics.maxPanX, crop.panX));
    crop.panY = Math.max(-metrics.maxPanY, Math.min(metrics.maxPanY, crop.panY));
    context.fillStyle = "#10182b";
    context.fillRect(0, 0, 512, 512);
    context.drawImage(
      crop.source,
      (512 - metrics.drawWidth) / 2 + crop.panX,
      (512 - metrics.drawHeight) / 2 + crop.panY,
      metrics.drawWidth,
      metrics.drawHeight,
    );
  }

  function releaseCropSource() {
    if (crop.source && typeof crop.source.close === "function") crop.source.close();
    crop.source = null;
  }

  function clearCrop() {
    releaseCropSource();
    crop.width = 0;
    crop.height = 0;
    crop.zoom = 1;
    crop.panX = 0;
    crop.panY = 0;
    elements.cropZoom.value = "1";
    elements.cropEditor.hidden = true;
    elements.avatarFile.value = "";
  }

  async function decodeImage(file) {
    if ("createImageBitmap" in window) {
      try {
        return await createImageBitmap(file, { imageOrientation: "from-image" });
      } catch {
        return createImageBitmap(file);
      }
    }
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.decoding = "async";
      image.src = url;
      await image.decode();
      return image;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function selectAvatar(file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      throw new Error("이미지 파일을 선택해 주세요.");
    }
    if (file.size > 25 * 1024 * 1024) {
      throw new Error("25MB 이하의 사진을 선택해 주세요.");
    }
    const source = await decodeImage(file);
    releaseCropSource();
    crop.source = source;
    crop.width = source.width || source.naturalWidth;
    crop.height = source.height || source.naturalHeight;
    crop.zoom = 1;
    crop.panX = 0;
    crop.panY = 0;
    pendingAvatarRemoval = false;
    elements.cropZoom.value = "1";
    elements.cropEditor.hidden = false;
    drawCrop();
  }

  function canvasToWebp() {
    drawCrop();
    return new Promise((resolve, reject) => {
      elements.cropCanvas.toBlob(
        (blob) => {
          if (!blob || blob.type !== "image/webp") {
            reject(new Error("이 브라우저에서 WebP 사진을 만들지 못했습니다."));
            return;
          }
          resolve(blob);
        },
        "image/webp",
        0.86,
      );
    });
  }

  function pointerPosition(event) {
    const rect = elements.cropCanvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (512 / rect.width),
      y: (event.clientY - rect.top) * (512 / rect.height),
    };
  }

  function bindCropEvents() {
    elements.cropCanvas.addEventListener("pointerdown", (event) => {
      if (!crop.source) return;
      const point = pointerPosition(event);
      crop.pointerId = event.pointerId;
      crop.startX = point.x;
      crop.startY = point.y;
      crop.startPanX = crop.panX;
      crop.startPanY = crop.panY;
      elements.cropCanvas.setPointerCapture(event.pointerId);
    });
    elements.cropCanvas.addEventListener("pointermove", (event) => {
      if (crop.pointerId !== event.pointerId) return;
      const point = pointerPosition(event);
      crop.panX = crop.startPanX + point.x - crop.startX;
      crop.panY = crop.startPanY + point.y - crop.startY;
      drawCrop();
    });
    const release = (event) => {
      if (crop.pointerId !== event.pointerId) return;
      crop.pointerId = null;
      if (elements.cropCanvas.hasPointerCapture(event.pointerId)) {
        elements.cropCanvas.releasePointerCapture(event.pointerId);
      }
    };
    elements.cropCanvas.addEventListener("pointerup", release);
    elements.cropCanvas.addEventListener("pointercancel", release);
    elements.cropZoom.addEventListener("input", () => {
      crop.zoom = Number(elements.cropZoom.value) || 1;
      drawCrop();
    });
  }

  function privateProfilePayload(fields, createdAt) {
    return {
      nickname: fields.nickname,
      nicknameNormalized: fields.nicknameNormalized,
      publicId: fields.publicId,
      bio: fields.bio,
      avatarUrl: fields.avatarUrl || "",
      avatarStoragePath: fields.avatarStoragePath || "",
      avatarVersion: Number(fields.avatarVersion) || 0,
      profileCompleted: true,
      createdAt,
      updatedAt: firebase.firestoreModule.serverTimestamp(),
    };
  }

  function publicProfilePayload(fields) {
    return {
      nickname: fields.nickname,
      bio: fields.bio,
      avatarUrl: fields.avatarUrl || "",
      avatarVersion: Number(fields.avatarVersion) || 0,
      profileCompleted: true,
    };
  }

  async function createProfile(fields) {
    const nicknameRef = firebase.firestoreModule.doc(
      firebase.db,
      "collectorNicknames",
      fields.nicknameNormalized,
    );
    const privateRef = sync.profileRef(
      firebase.firestoreModule,
      firebase.db,
      currentUser.uid,
    );

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const publicId = createPublicId();
      const next = {
        ...fields,
        publicId,
        avatarUrl: "",
        avatarStoragePath: "",
        avatarVersion: 0,
      };

      try {
        await firebase.firestoreModule.runTransaction(
          firebase.db,
          async (transaction) => {
            const [nicknameSnapshot, profileSnapshot] = await Promise.all([
              transaction.get(nicknameRef),
              transaction.get(privateRef),
            ]);
            if (nicknameSnapshot.exists()) {
              const error = new Error("이미 사용 중인 컬렉터 닉네임입니다.");
              error.code = "collector/nickname-taken";
              throw error;
            }
            if (profileSnapshot.exists()) {
              const error = new Error("이미 컬렉터 프로필이 만들어져 있습니다.");
              error.code = "collector/profile-exists";
              throw error;
            }

            const createdAt = firebase.firestoreModule.serverTimestamp();
            transaction.set(nicknameRef, { claimed: true });
            transaction.set(
              firebase.firestoreModule.doc(
                firebase.db,
                "collectorNicknameOwners",
                fields.nicknameNormalized,
              ),
              { ownerUid: currentUser.uid, createdAt },
            );
            transaction.set(
              firebase.firestoreModule.doc(
                firebase.db,
                "collectorPublicIdOwners",
                publicId,
              ),
              { ownerUid: currentUser.uid, createdAt },
            );
            transaction.set(
              privateRef,
              privateProfilePayload(next, createdAt),
            );
            transaction.set(
              firebase.firestoreModule.doc(
                firebase.db,
                "publicProfiles",
                publicId,
              ),
              publicProfilePayload(next),
            );
          },
        );
        const snapshot = await firebase.firestoreModule.getDoc(
          privateRef,
        );
        return snapshot.data();
      } catch (error) {
        const profileSnapshot = await firebase.firestoreModule.getDoc(privateRef);
        if (profileSnapshot.exists()) return profileSnapshot.data();
        const nicknameSnapshot = await firebase.firestoreModule.getDoc(nicknameRef);
        if (
          error.code === "collector/nickname-taken" ||
          nicknameSnapshot.exists()
        ) {
          throw new Error("이미 사용 중인 컬렉터 닉네임입니다.");
        }
        if (attempt === 2) throw error;
      }
    }
    throw new Error("공개 프로필 식별값을 만들지 못했습니다.");
  }

  async function updateProfileIdentity(fields) {
    const privateRef = sync.profileRef(
      firebase.firestoreModule,
      firebase.db,
      currentUser.uid,
    );
    try {
      await firebase.firestoreModule.runTransaction(
        firebase.db,
        async (transaction) => {
          const profileSnapshot = await transaction.get(privateRef);
          if (!profileSnapshot.exists()) {
            throw new Error("컬렉터 프로필을 찾지 못했습니다.");
          }
          const current = profileSnapshot.data() || {};
          const nicknameChanged =
            fields.nicknameNormalized !== current.nicknameNormalized;
          const next = { ...current, ...fields };

          if (nicknameChanged) {
            const nextNicknameRef = firebase.firestoreModule.doc(
              firebase.db,
              "collectorNicknames",
              fields.nicknameNormalized,
            );
            const nicknameSnapshot = await transaction.get(nextNicknameRef);
            if (nicknameSnapshot.exists()) {
              const error = new Error("이미 사용 중인 컬렉터 닉네임입니다.");
              error.code = "collector/nickname-taken";
              throw error;
            }
            const createdAt = firebase.firestoreModule.serverTimestamp();
            transaction.set(nextNicknameRef, { claimed: true });
            transaction.set(
              firebase.firestoreModule.doc(
                firebase.db,
                "collectorNicknameOwners",
                fields.nicknameNormalized,
              ),
              { ownerUid: currentUser.uid, createdAt },
            );
            transaction.delete(
              firebase.firestoreModule.doc(
                firebase.db,
                "collectorNicknames",
                current.nicknameNormalized,
              ),
            );
            transaction.delete(
              firebase.firestoreModule.doc(
                firebase.db,
                "collectorNicknameOwners",
                current.nicknameNormalized,
              ),
            );
          }

          transaction.set(
            privateRef,
            privateProfilePayload(next, current.createdAt),
          );
          transaction.set(
            firebase.firestoreModule.doc(
              firebase.db,
              "publicProfiles",
              current.publicId,
            ),
            publicProfilePayload(next),
          );
        },
      );
    } catch (error) {
      if (error.code === "collector/nickname-taken") {
        throw new Error("이미 사용 중인 컬렉터 닉네임입니다.");
      }
      throw error;
    }
    const snapshot = await firebase.firestoreModule.getDoc(privateRef);
    return snapshot.data();
  }

  async function updateProfileMirrors(changes) {
    const next = { ...profile, ...changes };
    const batch = firebase.firestoreModule.writeBatch(firebase.db);
    const privateRef = sync.profileRef(
      firebase.firestoreModule,
      firebase.db,
      currentUser.uid,
    );
    batch.set(privateRef, privateProfilePayload(next, profile.createdAt));
    batch.set(
      firebase.firestoreModule.doc(
        firebase.db,
        "publicProfiles",
        profile.publicId,
      ),
      publicProfilePayload(next),
    );
    await batch.commit();
    const snapshot = await firebase.firestoreModule.getDoc(privateRef);
    profile = snapshot.data();
  }

  function avatarSlotPaths() {
    if (!profile?.publicId) return [];
    const prefix = `publicProfiles/${profile.publicId}`;
    return [`${prefix}/avatar-a.webp`, `${prefix}/avatar-b.webp`];
  }

  async function cleanupAvatarPaths(paths) {
    let cleanupFailed = false;
    for (const path of [...new Set(paths.filter(Boolean))]) {
      try {
        await firebase.storageModule.deleteObject(
          firebase.storageModule.ref(firebase.storage, path),
        );
      } catch (error) {
        if (error.code !== "storage/object-not-found") {
          cleanupFailed = true;
          console.warn("이전 프로필 사진 정리 실패", error);
        }
      }
    }
    return cleanupFailed;
  }

  async function uploadAvatar() {
    const blob = await canvasToWebp();
    const oldPath = String(profile.avatarStoragePath || "");
    const nextSlot = oldPath.endsWith("/avatar-a.webp") ? "b" : "a";
    // 공개 이미지 URL에 Firebase UID가 포함되지 않도록 publicId만 사용합니다.
    // Storage Rules는 비공개 collectorPublicIdOwners 문서로 쓰기 권한을 확인합니다.
    const path = `publicProfiles/${profile.publicId}/avatar-${nextSlot}.webp`;
    const reference = firebase.storageModule.ref(firebase.storage, path);
    let uploaded = false;
    try {
      await firebase.storageModule.uploadBytes(reference, blob, {
        contentType: "image/webp",
        cacheControl: "public,max-age=3600",
      });
      uploaded = true;
      const avatarUrl = await firebase.storageModule.getDownloadURL(reference);
      await updateProfileMirrors({
        avatarUrl,
        avatarStoragePath: path,
        avatarVersion: (Number(profile.avatarVersion) || 0) + 1,
      });
    } catch (error) {
      if (uploaded) {
        try {
          await firebase.storageModule.deleteObject(reference);
        } catch (cleanupError) {
          console.warn("반영되지 않은 새 프로필 사진 정리 실패", cleanupError);
        }
      }
      throw error;
    }

    const stalePaths = avatarSlotPaths().filter((candidate) => candidate !== path);
    if (oldPath && oldPath !== path && !stalePaths.includes(oldPath)) {
      stalePaths.push(oldPath);
    }
    return { cleanupFailed: await cleanupAvatarPaths(stalePaths) };
  }

  async function removeAvatar() {
    const oldPath = String(profile.avatarStoragePath || "");
    const paths = avatarSlotPaths();
    if (oldPath && !paths.includes(oldPath)) paths.push(oldPath);
    await updateProfileMirrors({
      avatarUrl: "",
      avatarStoragePath: "",
      avatarVersion: (Number(profile.avatarVersion) || 0) + 1,
    });
    if (await cleanupAvatarPaths(paths)) {
      throw new Error("프로필 사진 파일 정리를 완료하지 못했습니다.");
    }
  }

  async function saveProfile(event) {
    event.preventDefault();
    if (!currentUser || !firebase) return;

    let nicknameFields;
    try {
      nicknameFields = validateNickname(elements.nickname.value);
    } catch (error) {
      setStatus(elements.profileStatus, error.message, "error");
      elements.nickname.focus();
      return;
    }
    const bio = String(elements.bio.value || "").trim();
    if (bio.length > 80) {
      setStatus(elements.profileStatus, "한 줄 소개는 80자 이하로 입력해 주세요.", "error");
      return;
    }

    elements.profileSave.disabled = true;
    elements.profileSave.textContent = "저장 중…";
    setStatus(elements.profileStatus, "컬렉터 프로필을 안전하게 저장하고 있습니다.", "loading");

    try {
      const fields = { ...nicknameFields, bio };
      profile = profile?.profileCompleted
        ? await updateProfileIdentity(fields)
        : await createProfile(fields);

      let avatarMessage = "";
      if (crop.source) {
        setStatus(elements.profileStatus, "사진을 512×512 WebP로 압축해 업로드하고 있습니다.", "loading");
        try {
          const result = await uploadAvatar();
          avatarMessage = result.cleanupFailed
            ? " 새 사진은 저장했지만 이전 사진 파일 정리를 완료하지 못했습니다."
            : " 프로필 사진도 저장했습니다.";
        } catch (error) {
          console.error("프로필 사진 업로드 실패", error);
          avatarMessage = " 프로필은 저장했지만 사진 업로드는 완료하지 못했습니다.";
        }
      } else if (pendingAvatarRemoval && profile.avatarUrl) {
        try {
          await removeAvatar();
          avatarMessage = " 프로필 사진을 삭제했습니다.";
        } catch (error) {
          console.error("프로필 사진 삭제 실패", error);
          avatarMessage = " 프로필 정보는 저장했지만 사진 파일 정리를 완료하지 못했습니다.";
        }
      }

      clearCrop();
      pendingAvatarRemoval = false;
      renderProfile();
      renderSettings();
      setStatus(
        elements.profileStatus,
        `컬렉터 프로필을 저장했습니다.${avatarMessage}`,
        avatarMessage.includes("못했습니다") ? "error" : "success",
      );
      elements.profileSummary.hidden = false;
      elements.profileForm.hidden = true;
    } catch (error) {
      console.error("컬렉터 프로필 저장 실패", error);
      setStatus(
        elements.profileStatus,
        error.message || "컬렉터 프로필을 저장하지 못했습니다.",
        "error",
      );
    } finally {
      elements.profileSave.disabled = false;
      elements.profileSave.textContent = profile?.profileCompleted
        ? "프로필 저장"
        : "컬렉터 프로필 만들기";
    }
  }

  async function loadProfile() {
    const snapshot = await firebase.firestoreModule.getDoc(
      sync.profileRef(firebase.firestoreModule, firebase.db, currentUser.uid),
    );
    profile = snapshot.exists() ? snapshot.data() || null : null;
  }

  async function loadSettings() {
    const reads = await Promise.all(
      registry.COLLECTION_ORDER.map(async (collectionId) => {
        const reference = sync.settingRef(
          firebase.firestoreModule,
          firebase.db,
          currentUser.uid,
          collectionId,
        );
        const snapshot = await firebase.firestoreModule.getDoc(reference);
        return [
          collectionId,
          {
            value: registry.normalizeSetting(
              collectionId,
              snapshot.exists() ? snapshot.data() || {} : null,
            ),
            exists: snapshot.exists(),
            createdAt: snapshot.exists() ? snapshot.data()?.createdAt : null,
          },
        ];
      }),
    );
    settings = new Map(reads);
  }

  async function loadSourceDocuments() {
    const byDocument = new Map();
    for (const collectionId of registry.COLLECTION_ORDER) {
      const documentId = registry.COLLECTIONS[collectionId].documentId;
      if (!byDocument.has(documentId)) {
        byDocument.set(
          documentId,
          firebase.firestoreModule.getDoc(
            sync.sourceRef(
              firebase.firestoreModule,
              firebase.db,
              currentUser.uid,
              collectionId,
            ),
          ),
        );
      }
    }
    const entries = await Promise.all(
      registry.COLLECTION_ORDER.map(async (collectionId) => {
        const documentId = registry.COLLECTIONS[collectionId].documentId;
        const snapshot = await byDocument.get(documentId);
        return [
          collectionId,
          sync.sourceDocumentFromSnapshot(snapshot, currentUser),
        ];
      }),
    );
    sourceDocuments = new Map(entries);
  }

  async function metricFor(collectionId) {
    try {
      const ownership = await registry.ownershipFor(
        collectionId,
        sourceDocuments.get(collectionId) || {},
      );
      return {
        owned: ownership.ownedKeys.length,
        total: ownership.catalog.items.length,
      };
    } catch (error) {
      console.warn(`${collectionId} 설정용 수집률 계산 실패`, error);
      return { owned: 0, total: 0 };
    }
  }

  function visibilityLabel(value) {
    if (value === "public") return "PUBLIC · 공개 프로필에 표시";
    if (value === "unlisted") return "UNLISTED · 링크를 가진 사람만";
    return "PRIVATE · 나만 보기";
  }

  async function renderSettings() {
    const metrics = await Promise.all(
      registry.COLLECTION_ORDER.map((collectionId) => metricFor(collectionId)),
    );
    const cards = registry.COLLECTION_ORDER.map((collectionId, index) => {
      const meta = registry.COLLECTIONS[collectionId];
      const setting = settings.get(collectionId)?.value || registry.defaultSetting(collectionId);
      const metric = metrics[index];
      const card = document.createElement("article");
      card.className = "collector-setting-card";
      card.dataset.collectionId = collectionId;
      card.innerHTML = `
        <div class="collector-setting-identity">
          <span class="collector-setting-number" aria-hidden="true">${meta.number}</span>
          <span><strong></strong><small></small></span>
        </div>
        <label class="collector-dashboard-switch">
          <span>내 대시보드에 표시</span>
          <input type="checkbox" data-setting="dashboard" />
          <i aria-hidden="true"></i>
        </label>
        <label class="collector-setting-visibility">
          <span>공개 범위</span>
          <select data-setting="visibility">
            <option value="private">PRIVATE · 나만 보기</option>
            <option value="unlisted">UNLISTED · 링크 공개</option>
            <option value="public">PUBLIC · 프로필 공개</option>
          </select>
        </label>
        <div class="collector-setting-share" hidden>
          <input type="text" readonly aria-label="공유 링크" />
          <button class="manager-button" type="button" data-copy-share>링크 복사</button>
        </div>
      `;
      card.querySelector(".collector-setting-identity strong").textContent = meta.title;
      card.querySelector(".collector-setting-identity small").textContent =
        `${metric.owned.toLocaleString("ko-KR")} / ${metric.total.toLocaleString("ko-KR")}${meta.unit}`;
      const dashboard = card.querySelector('[data-setting="dashboard"]');
      const visibility = card.querySelector('[data-setting="visibility"]');
      dashboard.checked = setting.dashboardVisible;
      visibility.value = setting.visibility;
      updateShareRow(card, collectionId, setting);
      dashboard.addEventListener("change", () => markSettingDirty(card));
      visibility.addEventListener("change", () => {
        const draft = settingFromCard(card, collectionId);
        updateShareRow(card, collectionId, draft);
        markSettingDirty(card);
      });
      card.querySelector("[data-copy-share]").addEventListener("click", () => {
        const value = card.querySelector(".collector-setting-share input").value;
        void copyText(value, `${meta.title} 공유 링크를 복사했습니다.`);
      });
      return card;
    });
    elements.settingsGrid.replaceChildren(...cards);

    const requested = new URLSearchParams(window.location.search).get("collection");
    if (requested && registry.supportedCollectionId(requested)) {
      requestAnimationFrame(() => {
        elements.settingsGrid
          .querySelector(`[data-collection-id="${requested}"]`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }
  }

  function settingFromCard(card, collectionId) {
    const current = settings.get(collectionId)?.value || registry.defaultSetting(collectionId);
    return {
      ...current,
      dashboardVisible: card.querySelector('[data-setting="dashboard"]').checked,
      visibility: card.querySelector('[data-setting="visibility"]').value,
    };
  }

  function markSettingDirty(card) {
    card.classList.add("is-dirty");
    setStatus(elements.settingsStatus, "저장하지 않은 변경사항이 있습니다.");
  }

  function updateShareRow(card, collectionId, setting) {
    const row = card.querySelector(".collector-setting-share");
    const input = row.querySelector("input");
    const copyButton = row.querySelector("[data-copy-share]");
    const persisted = settings.get(collectionId)?.value;
    const visible = setting.visibility !== "private" && profile?.profileCompleted;
    const saved = Boolean(
      visible &&
        persisted?.visibility === setting.visibility &&
        (
          setting.visibility !== "unlisted" ||
          (persisted.shareId && persisted.shareId === setting.shareId)
        ),
    );
    row.hidden = !visible;
    input.value = saved
      ? collectionShareUrl(collectionId, setting)
      : "저장 후 링크가 만들어집니다.";
    copyButton.disabled = !saved;
  }

  async function saveOneSetting(collectionId, draft) {
    const current = settings.get(collectionId) || {
      value: registry.defaultSetting(collectionId),
      exists: false,
      createdAt: null,
    };
    if (draft.visibility !== "private" && !profile?.profileCompleted) {
      throw new Error(`${registry.COLLECTIONS[collectionId].title}: 컬렉터 프로필을 먼저 만들어 주세요.`);
    }

    const previousShareId = current.value.shareId;
    const leavingUnlisted =
      current.value.visibility === "unlisted" &&
      draft.visibility !== "unlisted" &&
      Boolean(previousShareId);
    let shareId = draft.visibility === "unlisted" ? previousShareId : "";
    let createShareOwner = false;
    if (draft.visibility === "unlisted" && !shareId) {
      shareId = createShareId();
      createShareOwner = true;
    }
    const next = { ...draft, shareId };
    const batch = firebase.firestoreModule.writeBatch(firebase.db);
    const settingReference = sync.settingRef(
      firebase.firestoreModule,
      firebase.db,
      currentUser.uid,
      collectionId,
    );
    const settingPayload = {
      schemaVersion: 1,
      collectionId,
      dashboardVisible: next.dashboardVisible,
      visibility: next.visibility,
      displayOrder: next.displayOrder,
      shareId: next.shareId,
      createdAt: current.exists
        ? current.createdAt
        : firebase.firestoreModule.serverTimestamp(),
      updatedAt: firebase.firestoreModule.serverTimestamp(),
    };

    if (!profile?.profileCompleted) {
      batch.set(settingReference, settingPayload);
      await batch.commit();
    } else {
      const projection = await registry.buildProjection(
        collectionId,
        sourceDocuments.get(collectionId) || {},
        profile.publicId,
      );
      const publicReference = sync.publicProjectionRef(
        firebase.firestoreModule,
        firebase.db,
        profile.publicId,
        collectionId,
      );
      const sharedReference = shareId
        ? sync.sharedProjectionRef(firebase.firestoreModule, firebase.db, shareId)
        : null;
      const previousSharedReference = leavingUnlisted
        ? sync.sharedProjectionRef(
            firebase.firestoreModule,
            firebase.db,
            previousShareId,
          )
        : null;
      const previousShareOwnerReference = leavingUnlisted
        ? firebase.firestoreModule.doc(
            firebase.db,
            "collectorShareOwners",
            previousShareId,
          )
        : null;
      const projectionPayload = { ...projection };

      if (createShareOwner) {
        batch.set(
          firebase.firestoreModule.doc(
            firebase.db,
            "collectorShareOwners",
            shareId,
          ),
          {
            ownerUid: currentUser.uid,
            collectionId,
            createdAt: firebase.firestoreModule.serverTimestamp(),
          },
        );
      }

      batch.set(settingReference, settingPayload);
      if (next.visibility === "public") {
        batch.set(publicReference, projectionPayload);
        if (previousSharedReference) batch.delete(previousSharedReference);
      } else if (next.visibility === "unlisted") {
        batch.delete(publicReference);
        batch.set(sharedReference, projectionPayload);
      } else {
        batch.delete(publicReference);
        if (previousSharedReference) batch.delete(previousSharedReference);
      }
      if (previousShareOwnerReference) {
        batch.delete(previousShareOwnerReference);
      }
      await batch.commit();
    }

    const snapshot = await firebase.firestoreModule.getDoc(settingReference);
    settings.set(collectionId, {
      value: registry.normalizeSetting(collectionId, snapshot.data() || next),
      exists: true,
      createdAt: snapshot.data()?.createdAt || current.createdAt,
    });
  }

  async function saveSettings() {
    const dirtyCards = [...elements.settingsGrid.querySelectorAll(".is-dirty")];
    if (!dirtyCards.length) {
      setStatus(elements.settingsStatus, "변경한 설정이 없습니다.");
      return;
    }
    elements.settingsSave.disabled = true;
    elements.settingsSave.textContent = "저장 중…";
    setStatus(elements.settingsStatus, "도감별 설정을 안전하게 저장하고 있습니다.", "loading");

    try {
      for (const card of dirtyCards) {
        const collectionId = card.dataset.collectionId;
        await saveOneSetting(collectionId, settingFromCard(card, collectionId));
        card.classList.remove("is-dirty");
        updateShareRow(card, collectionId, settings.get(collectionId).value);
      }
      setStatus(
        elements.settingsStatus,
        "설정을 저장했습니다. 실제 도감 데이터는 변경하지 않았습니다.",
        "success",
      );
    } catch (error) {
      console.error("도감 설정 저장 실패", error);
      setStatus(
        elements.settingsStatus,
        error.message || "도감 설정을 저장하지 못했습니다.",
        "error",
      );
    } finally {
      elements.settingsSave.disabled = false;
      elements.settingsSave.textContent = "변경한 설정 저장";
    }
  }

  function createAuthUi() {
    if (document.querySelector("#firebase-auth-panel")) return;
    const panel = document.createElement("div");
    panel.id = "firebase-auth-panel";
    panel.className = "firebase-auth-panel";
    panel.innerHTML = `
      <span class="firebase-auth-dot" aria-hidden="true"></span>
      <span id="firebase-auth-status">로그인 상태 확인 중</span>
      <button id="firebase-login" type="button">Google 로그인</button>
      <button id="firebase-logout" type="button" hidden>로그아웃</button>
    `;
    document.querySelector(".site-header")?.append(panel);
    panel.querySelector("#firebase-login").addEventListener("click", signIn);
    panel.querySelector("#firebase-logout").addEventListener("click", signOut);
  }

  function updateAuthUi(message = "") {
    const panel = document.querySelector("#firebase-auth-panel");
    const login = panel.querySelector("#firebase-login");
    const logout = panel.querySelector("#firebase-logout");
    panel.querySelector("#firebase-auth-status").textContent = message || (
      currentUser
        ? currentUser.displayName || currentUser.email || "내 계정"
        : "방문자"
    );
    panel.classList.toggle("is-account", Boolean(currentUser));
    login.hidden = Boolean(currentUser) || !configured();
    logout.hidden = !currentUser;
    elements.signInGate.hidden = Boolean(currentUser);
    elements.content.hidden = !currentUser;
  }

  async function signIn() {
    if (!firebase) return;
    const provider = new firebase.authModule.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    try {
      await firebase.authModule.signInWithPopup(firebase.auth, provider);
      window.location.reload();
    } catch (error) {
      if (error.code === "auth/popup-closed-by-user") return;
      alert(`Google 로그인에 실패했습니다.\n${error.message || ""}`);
    }
  }

  async function signOut() {
    if (!firebase) return;
    await firebase.authModule.signOut(firebase.auth);
    window.location.reload();
  }

  async function firstAuthUser(auth, authModule) {
    return new Promise((resolve, reject) => {
      let unsubscribe = () => {};
      unsubscribe = authModule.onAuthStateChanged(
        auth,
        (user) => {
          unsubscribe();
          resolve(user || null);
        },
        reject,
      );
    });
  }

  async function initializeFirebase() {
    createAuthUi();
    if (!configured()) {
      updateAuthUi("Firebase 설정 필요");
      elements.signIn.disabled = true;
      return;
    }

    try {
      const [appModule, authModule, firestoreModule, storageModule] = await Promise.all([
        import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-app.js`),
        import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-auth.js`),
        import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-firestore.js`),
        import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-storage.js`),
      ]);
      const app = appModule.getApps().length
        ? appModule.getApp()
        : appModule.initializeApp(CONFIG.config);
      const auth = authModule.getAuth(app);
      await authModule.setPersistence(auth, authModule.browserLocalPersistence);
      firebase = {
        app,
        auth,
        db: firestoreModule.getFirestore(app),
        storage: storageModule.getStorage(app),
        authModule,
        firestoreModule,
        storageModule,
      };
      currentUser = await firstAuthUser(auth, authModule);
      updateAuthUi();
      if (!currentUser) return;

      setStatus(elements.settingsStatus, "도감 설정을 불러오는 중입니다.", "loading");
      await Promise.all([loadProfile(), loadSettings(), loadSourceDocuments()]);
      renderProfile();
      await renderSettings();
      setStatus(elements.settingsStatus, "");
    } catch (error) {
      console.error("도감 관리 초기화 실패", error);
      updateAuthUi("Firebase 연결 오류");
      elements.error.hidden = false;
    }
  }

  elements.signIn.addEventListener("click", signIn);
  elements.profileEdit.addEventListener("click", openProfileEditor);
  elements.profileCancel.addEventListener("click", closeProfileEditor);
  elements.profileCopy.addEventListener("click", () => {
    void copyText(
      profileUrl(),
      "내 컬렉션 프로필 링크를 복사했습니다.",
      elements.profileStatus,
    );
  });
  elements.bio.addEventListener("input", () => {
    elements.bioCount.textContent = String(elements.bio.value.length);
  });
  elements.avatarFile.addEventListener("change", async () => {
    try {
      setStatus(elements.profileStatus, "사진을 불러오는 중입니다.", "loading");
      await selectAvatar(elements.avatarFile.files?.[0]);
      setStatus(elements.profileStatus, "사진 위치와 크기를 맞춘 뒤 프로필을 저장해 주세요.");
    } catch (error) {
      setStatus(elements.profileStatus, error.message, "error");
      clearCrop();
    }
  });
  elements.avatarRemove.addEventListener("click", () => {
    clearCrop();
    pendingAvatarRemoval = true;
    setAvatar(elements.avatarCurrent, elements.avatarCurrentFallback, null);
    elements.avatarRemove.hidden = true;
    setStatus(elements.profileStatus, "프로필을 저장하면 현재 사진이 삭제됩니다.");
  });
  elements.profileForm.addEventListener("submit", saveProfile);
  elements.settingsSave.addEventListener("click", saveSettings);
  bindCropEvents();
  void initializeFirebase();
})();
