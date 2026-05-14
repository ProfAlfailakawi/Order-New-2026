export class FakeDocRef {
  constructor(public id: string, public path: string) {}
}

export function doc(db: any, path1: string, path2: string) {
  return new FakeDocRef(path2, `${path1}/${path2}`);
}

export function onSnapshot(ref: any, callback: any) {
  let isCancelled = false;

  const poll = async () => {
    if (isCancelled) return;
    try {
      const r = await fetch("/api/appdata");
      if (r.ok) {
        const data = await r.json();
        callback({ exists: () => true, data: () => data });
      }
    } catch(e) {}
    if (!isCancelled) {
      setTimeout(poll, 5000);
    }
  };
  poll();

  return () => { isCancelled = true; };
}

export async function updateDoc(ref: any, data: any) {
  try {
    const r = await fetch("/api/appdata", { 
      method: 'PATCH', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify(data) 
    });
    if (!r.ok) throw new Error("Update failed");
  } catch(e) {
    console.error("updateDoc error", e);
    throw e;
  }
}

export async function getDoc(ref: any) {
  try {
    const r = await fetch("/api/appdata");
    const data = await r.json();
    return { exists: () => true, data: () => data };
  } catch(e) {
    return { exists: () => false, data: () => ({}) };
  }
}

export async function getDocFromServer(ref: any) {
  return getDoc(ref);
}

// Stubs for others if needed
export function collection() {}
export function query() {}
export function orderBy() {}
export function getFirestore() { return {}; }
