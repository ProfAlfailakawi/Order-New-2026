
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
    
    // We expect 401 Unauthorized for both if we use dummy tokens
    try {
      const response = await fetch("https://uapi.upayments.com/api/v1/charge", {
          method: "POST",
          headers: {
              "Authorization": "Bearer not_a_real_token",
              "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
      });
      console.log("uapi Status:", response.status, await response.text());
    } catch(e) {
      console.log(e);
    }
    
    try {
      // Test api.upayments.com
      const response2 = await fetch("https://api.upayments.com/api/v1/charge", {
          method: "POST",
          headers: {
              "Authorization": "Bearer not_a_real_token",
              "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
      });
      console.log("api Status:", response2.status, await response2.text());
    } catch(e) {
      console.log(e);
    }
}
test();
