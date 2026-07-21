import fetch from "node-fetch";
async function run() {
  const res = await fetch("http://localhost:3000/api/products");
  const data = await res.json();
  console.log(JSON.stringify(data.slice(0, 3), null, 2));
}
run();
