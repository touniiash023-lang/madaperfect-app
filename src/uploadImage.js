import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

export async function uploadImage(file) {
  if (!file) return null;

  const storage = getStorage();
  const fileRef = ref(storage, `articles/${Date.now()}_${file.name}`);

  await uploadBytes(fileRef, file);

  return await getDownloadURL(fileRef);
}
