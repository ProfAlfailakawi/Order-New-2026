async function test() {
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
    try {
      const response = await fetch("https://sandboxapi.upayments.com/api/v1/charge", {
          method: "POST",
          headers: {
              "Authorization": "Bearer e66a94d579cf75fba327ff716ad68c53aae11528",
              "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
      });
      console.log("Status:", response.status, await response.text());
    } catch(e) {}
}
test();
