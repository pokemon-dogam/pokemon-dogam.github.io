import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  deleteObject,
  getBytes,
  ref,
  uploadBytes,
} from "firebase/storage";
import { doc, setDoc } from "firebase/firestore";
import { readFile } from "node:fs/promises";
import test, { after, before } from "node:test";

const projectId = "demo-pokemon-dogam-storage";
const rules = await readFile(new URL("../storage.rules", import.meta.url), "utf8");
const firestoreRules = await readFile(
  new URL("../firestore.rules", import.meta.url),
  "utf8",
);
const PUBLIC_ID = "alice123test";
let environment;
let alice;
let bob;
let guest;

before(async () => {
  environment = await initializeTestEnvironment({
    projectId,
    firestore: { rules: firestoreRules },
    storage: { rules },
  });
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(
      doc(context.firestore(), "collectorPublicIdOwners", PUBLIC_ID),
      { ownerUid: "alice-user", createdAt: new Date() },
    );
  });
  alice = environment.authenticatedContext("alice-user").storage();
  bob = environment.authenticatedContext("bob-user").storage();
  guest = environment.unauthenticatedContext().storage();
});

after(async () => {
  await environment.cleanup();
});

test("an owner can upload a small WebP and the public can read it", async () => {
  const ownerRef = ref(alice, `publicProfiles/${PUBLIC_ID}/avatar-a.webp`);
  await assertSucceeds(
    uploadBytes(ownerRef, new Uint8Array([0x52, 0x49, 0x46, 0x46]), {
      contentType: "image/webp",
    }),
  );
  const publicBytes = await assertSucceeds(
    getBytes(ref(guest, `publicProfiles/${PUBLIC_ID}/avatar-a.webp`)),
  );
  if (publicBytes.byteLength !== 4) {
    throw new Error("public avatar bytes did not match the uploaded file");
  }
});

test("another user cannot overwrite or delete an avatar", async () => {
  const target = ref(bob, `publicProfiles/${PUBLIC_ID}/avatar-a.webp`);
  await assertFails(
    uploadBytes(target, new Uint8Array([1, 2, 3]), {
      contentType: "image/webp",
    }),
  );
  await assertFails(deleteObject(target));
});

test("invalid filename, content type, and oversized uploads are blocked", async () => {
  await assertFails(
    uploadBytes(
      ref(alice, `publicProfiles/${PUBLIC_ID}/original.jpg`),
      new Uint8Array([1, 2, 3]),
      { contentType: "image/jpeg" },
    ),
  );
  await assertFails(
    uploadBytes(
      ref(alice, `publicProfiles/${PUBLIC_ID}/avatar-b.webp`),
      new Uint8Array([1, 2, 3]),
      { contentType: "image/png" },
    ),
  );
  await assertFails(
    uploadBytes(
      ref(alice, `publicProfiles/${PUBLIC_ID}/avatar-b.webp`),
      new Uint8Array(2 * 1024 * 1024 + 1),
      { contentType: "image/webp" },
    ),
  );
});

test("an authenticated user cannot claim an unowned publicId path", async () => {
  await assertFails(
    uploadBytes(
      ref(alice, "publicProfiles/unowned12345/avatar-a.webp"),
      new Uint8Array([1, 2, 3]),
      { contentType: "image/webp" },
    ),
  );
});

test("the owner can remove the old slot after the new profile is committed", async () => {
  await assertSucceeds(
    deleteObject(ref(alice, `publicProfiles/${PUBLIC_ID}/avatar-a.webp`)),
  );
});
