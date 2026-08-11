import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import test, { after, before } from "node:test";

const projectId = "demo-pokemon-dogam";
const rules = await readFile(new URL("../firestore.rules", import.meta.url), "utf8");
let environment;
let alice;
let bob;
let guest;

const ALICE_UID = "alice-user";
const BOB_UID = "bob-user";
const PUBLIC_ID = "alice123test";
const SHARE_ID = "AbCdEfGhIjKlMnOpQrStUvWxYz012345";
const NEXT_SHARE_ID = "ZyXwVuTsRqPoNmLkJiHgFeDcBa543210";

function userDb(uid, email) {
  return environment
    .authenticatedContext(uid, { email, name: uid })
    .firestore();
}

function profileFields() {
  return {
    nickname: "Alice 84",
    nicknameNormalized: "alice84",
    publicId: PUBLIC_ID,
    bio: "Korean card collector",
    avatarUrl: "",
    avatarStoragePath: "",
    avatarVersion: 0,
    profileCompleted: true,
  };
}

function publicProfileFields() {
  return {
    nickname: "Alice 84",
    bio: "Korean card collector",
    avatarUrl: "",
    avatarVersion: 0,
    profileCompleted: true,
  };
}

function projection(collectionId = "national") {
  return {
    schemaVersion: 1,
    publicId: PUBLIC_ID,
    collectionId,
    ownedKeys: ["1", "25"],
    ownedCount: 2,
    totalCount: collectionId === "people" ? 179 : 1025,
    promoOwnedKeys: [],
    promoOwnedCount: 0,
  };
}

async function createAliceProfile() {
  const batch = writeBatch(alice);
  const createdAt = serverTimestamp();
  batch.set(doc(alice, "collectorNicknames", "alice84"), {
    claimed: true,
  });
  batch.set(doc(alice, "collectorNicknameOwners", "alice84"), {
    ownerUid: ALICE_UID,
    createdAt,
  });
  batch.set(doc(alice, "collectorPublicIdOwners", PUBLIC_ID), {
    ownerUid: ALICE_UID,
    createdAt,
  });
  batch.set(doc(alice, "users", ALICE_UID, "profile", "main"), {
    ...profileFields(),
    createdAt,
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(alice, "publicProfiles", PUBLIC_ID), {
    ...publicProfileFields(),
  });
  await assertSucceeds(batch.commit());
}

async function savePrivateSetting() {
  await assertSucceeds(
    setDoc(doc(alice, "users", ALICE_UID, "collectionSettings", "national"), {
      schemaVersion: 1,
      collectionId: "national",
      dashboardVisible: true,
      visibility: "private",
      displayOrder: 0,
      shareId: "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }),
  );
}

before(async () => {
  environment = await initializeTestEnvironment({
    projectId,
    firestore: { rules },
  });
  alice = userDb(ALICE_UID, "alice@example.com");
  bob = userDb(BOB_UID, "bob@example.com");
  guest = environment.unauthenticatedContext().firestore();
});

after(async () => {
  await environment.cleanup();
});

test("existing collection documents remain owner-only and retain baseMode", async () => {
  const reference = doc(alice, "users", ALICE_UID, "collections", "nationalDex");
  await assertSucceeds(
    setDoc(reference, {
      baseMode: "empty",
      email: "alice@example.com",
      displayName: "Alice",
      overrides: {},
    }),
  );
  await assertSucceeds(getDoc(reference));
  await assertFails(
    getDoc(doc(bob, "users", ALICE_UID, "collections", "nationalDex")),
  );
  await assertFails(
    setDoc(doc(bob, "users", ALICE_UID, "collections", "nationalDex"), {
      baseMode: "empty",
      email: "bob@example.com",
      overrides: {},
    }),
  );
});

test("profile creation atomically claims nickname and publicId without exposing UID", async () => {
  await createAliceProfile();
  const publicSnapshot = await assertSucceeds(
    getDoc(doc(guest, "publicProfiles", PUBLIC_ID)),
  );
  assert.equal(publicSnapshot.data().nickname, "Alice 84");
  assert.equal("ownerUid" in publicSnapshot.data(), false);
  assert.equal("email" in publicSnapshot.data(), false);
  assert.equal("nicknameNormalized" in publicSnapshot.data(), false);
  const nicknameSnapshot = await assertSucceeds(
    getDoc(doc(guest, "collectorNicknames", "alice84")),
  );
  assert.deepEqual(nicknameSnapshot.data(), { claimed: true });
  await assertFails(getDocs(collection(guest, "collectorNicknames")));
  await assertSucceeds(
    getDoc(doc(alice, "collectorNicknameOwners", "alice84")),
  );
  await assertFails(
    getDoc(doc(bob, "collectorNicknameOwners", "alice84")),
  );
  await assertFails(
    getDoc(doc(guest, "collectorNicknameOwners", "alice84")),
  );
  await assertFails(getDocs(collection(guest, "publicProfiles")));
  await assertFails(
    getDoc(doc(bob, "users", ALICE_UID, "profile", "main")),
  );
});

test("a concurrent user cannot overwrite an existing nickname claim", async () => {
  const batch = writeBatch(bob);
  const createdAt = serverTimestamp();
  batch.set(doc(bob, "collectorNicknames", "alice84"), {
    claimed: true,
  });
  batch.set(doc(bob, "collectorNicknameOwners", "alice84"), {
    ownerUid: BOB_UID,
    createdAt,
  });
  batch.set(doc(bob, "collectorPublicIdOwners", "bob12345test"), {
    ownerUid: BOB_UID,
    createdAt,
  });
  batch.set(doc(bob, "users", BOB_UID, "profile", "main"), {
    nickname: "Alice84",
    nicknameNormalized: "alice84",
    publicId: "bob12345test",
    bio: "",
    avatarUrl: "",
    avatarStoragePath: "",
    avatarVersion: 0,
    profileCompleted: true,
    createdAt,
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(bob, "publicProfiles", "bob12345test"), {
    nickname: "Alice84",
    bio: "",
    avatarUrl: "",
    avatarVersion: 0,
    profileCompleted: true,
  });
  await assertFails(batch.commit());
});

test("direct profile writes cannot bypass normalized nickname spacing", async () => {
  const batch = writeBatch(bob);
  const createdAt = serverTimestamp();
  batch.set(doc(bob, "collectorNicknames", "bob84"), {
    claimed: true,
  });
  batch.set(doc(bob, "collectorNicknameOwners", "bob84"), {
    ownerUid: BOB_UID,
    createdAt,
  });
  batch.set(doc(bob, "collectorPublicIdOwners", "bob12345test"), {
    ownerUid: BOB_UID,
    createdAt,
  });
  batch.set(doc(bob, "users", BOB_UID, "profile", "main"), {
    nickname: "Bob  84",
    nicknameNormalized: "bob84",
    publicId: "bob12345test",
    bio: "",
    avatarUrl: "",
    avatarStoragePath: "",
    avatarVersion: 0,
    profileCompleted: true,
    createdAt,
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(bob, "publicProfiles", "bob12345test"), {
    nickname: "Bob  84",
    bio: "",
    avatarUrl: "",
    avatarVersion: 0,
    profileCompleted: true,
  });
  await assertFails(batch.commit());
});

test("nickname rename releases the old claim and keeps the publicId stable", async () => {
  const privateRef = doc(alice, "users", ALICE_UID, "profile", "main");
  const publicRef = doc(alice, "publicProfiles", PUBLIC_ID);
  const privateProfile = (await getDoc(privateRef)).data();
  const publicProfile = (await getDoc(publicRef)).data();

  const incompleteRename = writeBatch(alice);
  incompleteRename.set(doc(alice, "collectorNicknames", "aliceheld"), {
    claimed: true,
  });
  incompleteRename.set(doc(alice, "collectorNicknameOwners", "aliceheld"), {
    ownerUid: ALICE_UID,
    createdAt: serverTimestamp(),
  });
  incompleteRename.set(privateRef, {
    ...privateProfile,
    nickname: "Alice Held",
    nicknameNormalized: "aliceheld",
    updatedAt: serverTimestamp(),
  });
  incompleteRename.set(publicRef, {
    ...publicProfile,
    nickname: "Alice Held",
  });
  await assertFails(incompleteRename.commit());

  const batch = writeBatch(alice);
  const createdAt = serverTimestamp();

  batch.set(doc(alice, "collectorNicknames", "alicenew"), {
    claimed: true,
  });
  batch.set(doc(alice, "collectorNicknameOwners", "alicenew"), {
    ownerUid: ALICE_UID,
    createdAt,
  });
  batch.delete(doc(alice, "collectorNicknames", "alice84"));
  batch.delete(doc(alice, "collectorNicknameOwners", "alice84"));
  batch.set(privateRef, {
    ...privateProfile,
    nickname: "Alice New",
    nicknameNormalized: "alicenew",
    updatedAt: serverTimestamp(),
  });
  batch.set(publicRef, {
    ...publicProfile,
    nickname: "Alice New",
  });

  await assertSucceeds(batch.commit());
  const renamed = await getDoc(privateRef);
  assert.equal(renamed.data().publicId, PUBLIC_ID);
  assert.equal(renamed.data().nicknameNormalized, "alicenew");
  assert.equal(
    (await getDoc(doc(guest, "collectorNicknames", "alice84"))).exists(),
    false,
  );
  assert.equal(
    (await getDoc(doc(guest, "collectorNicknames", "alicenew"))).exists(),
    true,
  );
});

test("an avatar mirror may expose publicId but never the Firebase UID", async () => {
  const privateRef = doc(alice, "users", ALICE_UID, "profile", "main");
  const publicRef = doc(alice, "publicProfiles", PUBLIC_ID);
  const privateProfile = (await getDoc(privateRef)).data();
  const publicProfile = (await getDoc(publicRef)).data();
  const avatarUrl =
    `https://firebasestorage.googleapis.com/v0/b/` +
    `pokemon-dex-40e92.firebasestorage.app/o/` +
    `publicProfiles%2F${PUBLIC_ID}%2Favatar-a.webp?alt=media&token=test`;
  const batch = writeBatch(alice);
  batch.set(privateRef, {
    ...privateProfile,
    avatarUrl,
    avatarStoragePath: `publicProfiles/${PUBLIC_ID}/avatar-a.webp`,
    avatarVersion: 1,
    updatedAt: serverTimestamp(),
  });
  batch.set(publicRef, {
    ...publicProfile,
    avatarUrl,
    avatarVersion: 1,
  });
  await assertSucceeds(batch.commit());

  const publicSnapshot = await getDoc(doc(guest, "publicProfiles", PUBLIC_ID));
  assert.equal(publicSnapshot.data().avatarUrl.includes(ALICE_UID), false);
  assert.equal(publicSnapshot.data().avatarUrl.includes(PUBLIC_ID), true);
});

test("private profile changes cannot leave the public mirror stale", async () => {
  const privateRef = doc(alice, "users", ALICE_UID, "profile", "main");
  const privateProfile = (await getDoc(privateRef)).data();
  await assertFails(
    setDoc(privateRef, {
      ...privateProfile,
      bio: "private-only update",
      updatedAt: serverTimestamp(),
    }),
  );
});

test("a profile cannot publish an arbitrary external avatar URL", async () => {
  const privateRef = doc(alice, "users", ALICE_UID, "profile", "main");
  const publicRef = doc(alice, "publicProfiles", PUBLIC_ID);
  const privateProfile = (await getDoc(privateRef)).data();
  const publicProfile = (await getDoc(publicRef)).data();
  const batch = writeBatch(alice);
  batch.set(privateRef, {
    ...privateProfile,
    avatarUrl: "https://example.com/tracker.webp",
    avatarStoragePath: `publicProfiles/${PUBLIC_ID}/avatar-a.webp`,
    updatedAt: serverTimestamp(),
  });
  batch.set(publicRef, {
    ...publicProfile,
    avatarUrl: "https://example.com/tracker.webp",
  });
  await assertFails(batch.commit());
});

test("public projection is readable but private source and extra fields stay blocked", async () => {
  await savePrivateSetting();
  const settingRef = doc(
    alice,
    "users",
    ALICE_UID,
    "collectionSettings",
    "national",
  );
  const createdAt = (await getDoc(settingRef)).data().createdAt;
  const publicRef = doc(
    alice,
    "publicProfiles",
    PUBLIC_ID,
    "collections",
    "national",
  );
  const batch = writeBatch(alice);
  batch.set(settingRef, {
    schemaVersion: 1,
    collectionId: "national",
    dashboardVisible: true,
    visibility: "public",
    displayOrder: 0,
    shareId: "",
    createdAt,
    updatedAt: serverTimestamp(),
  });
  batch.set(publicRef, projection());
  await assertSucceeds(batch.commit());

  const publicRead = await assertSucceeds(
    getDoc(
      doc(
        guest,
        "publicProfiles",
        PUBLIC_ID,
        "collections",
        "national",
      ),
    ),
  );
  assert.deepEqual(publicRead.data().ownedKeys, ["1", "25"]);
  await assertFails(
    getDoc(doc(guest, "users", ALICE_UID, "collections", "nationalDex")),
  );
  await assertFails(
    setDoc(
      doc(
        bob,
        "publicProfiles",
        PUBLIC_ID,
        "collections",
        "national",
      ),
      projection(),
    ),
  );
  await assertFails(
    setDoc(publicRef, { ...projection(), note: "must never be public" }),
  );
  await assertFails(deleteDoc(publicRef));
  const publicList = await assertSucceeds(
    getDocs(collection(guest, "publicProfiles", PUBLIC_ID, "collections")),
  );
  assert.equal(publicList.size, 1);
});

test("private transition atomically revokes the old public link", async () => {
  const settingRef = doc(
    alice,
    "users",
    ALICE_UID,
    "collectionSettings",
    "national",
  );
  const publicRef = doc(
    alice,
    "publicProfiles",
    PUBLIC_ID,
    "collections",
    "national",
  );
  const setting = (await getDoc(settingRef)).data();
  await assertFails(
    setDoc(settingRef, {
      ...setting,
      visibility: "private",
      updatedAt: serverTimestamp(),
    }),
  );

  const batch = writeBatch(alice);
  batch.set(settingRef, {
    ...setting,
    visibility: "private",
    updatedAt: serverTimestamp(),
  });
  batch.delete(publicRef);
  await assertSucceeds(batch.commit());
  const revoked = await assertSucceeds(
    getDoc(
      doc(
        guest,
        "publicProfiles",
        PUBLIC_ID,
        "collections",
        "national",
      ),
    ),
  );
  assert.equal(revoked.exists(), false);
});

test("unlisted token supports exact get, blocks list, and is revoked by private", async () => {
  const settingRef = doc(
    alice,
    "users",
    ALICE_UID,
    "collectionSettings",
    "national",
  );
  const setting = (await getDoc(settingRef)).data();
  const sharedRef = doc(alice, "sharedCollections", SHARE_ID);
  const batch = writeBatch(alice);
  batch.set(settingRef, {
    ...setting,
    visibility: "unlisted",
    shareId: SHARE_ID,
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(alice, "collectorShareOwners", SHARE_ID), {
    ownerUid: ALICE_UID,
    collectionId: "national",
    createdAt: serverTimestamp(),
  });
  batch.set(sharedRef, projection());
  await assertSucceeds(batch.commit());

  await assertSucceeds(getDoc(doc(guest, "sharedCollections", SHARE_ID)));
  await assertFails(getDocs(collection(guest, "sharedCollections")));
  await assertFails(
    setDoc(doc(bob, "sharedCollections", SHARE_ID), projection()),
  );
  await assertFails(deleteDoc(sharedRef));

  const incompleteRotation = writeBatch(alice);
  incompleteRotation.set(settingRef, {
    ...(await getDoc(settingRef)).data(),
    shareId: NEXT_SHARE_ID,
    updatedAt: serverTimestamp(),
  });
  incompleteRotation.set(doc(alice, "collectorShareOwners", NEXT_SHARE_ID), {
    ownerUid: ALICE_UID,
    collectionId: "national",
    createdAt: serverTimestamp(),
  });
  incompleteRotation.set(
    doc(alice, "sharedCollections", NEXT_SHARE_ID),
    projection(),
  );
  await assertFails(incompleteRotation.commit());

  const incompleteRevocation = writeBatch(alice);
  incompleteRevocation.set(settingRef, {
    ...(await getDoc(settingRef)).data(),
    visibility: "private",
    shareId: "",
    updatedAt: serverTimestamp(),
  });
  incompleteRevocation.delete(sharedRef);
  await assertFails(incompleteRevocation.commit());

  const privateBatch = writeBatch(alice);
  privateBatch.set(settingRef, {
    ...(await getDoc(settingRef)).data(),
    visibility: "private",
    shareId: "",
    updatedAt: serverTimestamp(),
  });
  privateBatch.delete(sharedRef);
  privateBatch.delete(doc(alice, "collectorShareOwners", SHARE_ID));
  await assertSucceeds(privateBatch.commit());
  const revoked = await assertSucceeds(
    getDoc(doc(guest, "sharedCollections", SHARE_ID)),
  );
  assert.equal(revoked.exists(), false);
});

test("collector settings never allow a private state while projection remains", async () => {
  const settingRef = doc(
    alice,
    "users",
    ALICE_UID,
    "collectionSettings",
    "national",
  );
  const current = (await getDoc(settingRef)).data();
  await assertSucceeds(
    setDoc(settingRef, {
      ...current,
      visibility: "private",
      updatedAt: serverTimestamp(),
    }),
  );
  await assertFails(
    deleteDoc(doc(bob, "users", ALICE_UID, "collectionSettings", "national")),
  );
  await assertFails(
    setDoc(doc(bob, "users", ALICE_UID, "collectionSettings", "national"), {
      ...current,
      dashboardVisible: false,
      updatedAt: serverTimestamp(),
    }),
  );
  await assertFails(
    setDoc(doc(guest, "sharedCollections", SHARE_ID), projection()),
  );
});
