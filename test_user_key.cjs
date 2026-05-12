async function test() {
    console.log("Starting test...");
    const key = process.env.UPAYMENTS_API_KEY;
    if (!key) { console.log('no key'); return; }
    
    let payload = {
        returnUrl: "https://example.com/success",
        cancelUrl: "https://example.com/cancel",
        notificationUrl: "https://example.com/webhook",
        language: "ar",
        paymentGateway: { src: "knet" },
        order: { id: "test_123_" + Date.now(), currency: "KWD", amount: 10.0 },
        reference: { id: "ref_123_" + Date.now() },
        customer: { uniqueId: "c_123_" + Date.now(), name: "Test", email: "test@example.com", mobile: "12345678" }
    };
    
    for (let authType of ['Bearer', 'Token']) {
        try {
          const response = await fetch("https://uapi.upayments.com/api/v1/charge", {
              method: "POST",
              headers: {
                  "Authorization": `${authType} ${key}`,
                  "Content-Type": "application/json"
              },
              body: JSON.stringify(payload)
          });
          const text = await response.text();
          console.log(`[uapi] ${authType} Status:`, response.status, text.substring(0, 100));
        } catch(e) { console.log("Error uapi", e); }
    }

    for (let authType of ['Bearer', 'Token']) {
        try {
          const response = await fetch("https://api.upayments.com/api/v1/charge", {
              method: "POST",
              headers: {
                  "Authorization": `${authType} ${key}`,
                  "Content-Type": "application/json"
              },
              body: JSON.stringify(payload)
          });
          const text = await response.text();
          console.log(`[api] ${authType} Status:`, response.status, text.substring(0, 100));
        } catch(e) { console.log("Error api", e); }
    }
}
test();
