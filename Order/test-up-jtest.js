async function test() {
    let payload = {
        returnUrl: "https://example.com/success",
        cancelUrl: "https://example.com/cancel",
        notificationUrl: "https://example.com/webhook",
        language: "ar",
        order: { id: "test_123_" + Date.now(), currency: "KWD", amount: 10.0 },
        reference: { id: "ref_123_" + Date.now() },
        customer: { uniqueId: "c_123_" + Date.now(), name: "Test", email: "test@example.com", mobile: "12345678" }
    };
    
    const response = await fetch("https://sandboxapi.upayments.com/api/v1/charge", {
        method: "POST",
        headers: {
            "Authorization": "Bearer jtest123",
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });
    const text = await response.text();
    console.log("Status:", response.status, "Response:", text);
}
test();
