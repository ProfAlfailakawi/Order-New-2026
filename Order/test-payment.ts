async function run() {
  try {
    const res = await fetch('http://127.0.0.1:3000/api/create-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 10, customerName: 'Test', customerMobile: '12345678', orderId: 'ORD-123' })
    });
    console.log("Status:", res.status);
    console.log("Text:", await res.text());
  } catch(e) {
    console.error("Fetch error:", e.message);
  }
}
run();
